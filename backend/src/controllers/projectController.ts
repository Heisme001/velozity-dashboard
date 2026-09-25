import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { Role } from '@prisma/client';

export const createProjectSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  clientId: z.string().uuid(),
  pmId: z.string().uuid().optional() // if PM creates it, defaults to themselves
});

export async function getProjects(req: AuthenticatedRequest, res: Response) {
  const user = req.user!;

  let whereClause: any = {};

  if (user.role === Role.PROJECT_MANAGER) {
    // PM can only view projects they created / manage
    whereClause.pmId = user.userId;
  } else if (user.role === Role.DEVELOPER) {
    // Developer can only view projects where they have assigned tasks
    whereClause.tasks = {
      some: {
        developerId: user.userId
      }
    };
  }

  const projects = await prisma.project.findMany({
    where: whereClause,
    include: {
      client: true,
      pm: { select: { id: true, name: true, email: true } },
      _count: {
        select: {
          tasks: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return res.json({ success: true, data: projects });
}

export async function getProjectById(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const user = req.user!;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      pm: { select: { id: true, name: true, email: true } },
      tasks: {
        include: {
          developer: { select: { id: true, name: true, email: true } }
        },
        orderBy: { dueDate: 'asc' }
      }
    }
  });

  if (!project) {
    return res.status(404).json({ success: false, error: 'Project not found' });
  }

  // RBAC checks
  if (user.role === Role.PROJECT_MANAGER && project.pmId !== user.userId) {
    return res.status(403).json({ success: false, error: 'Forbidden: You cannot access another PM\'s project' });
  }

  if (user.role === Role.DEVELOPER) {
    // Filter tasks to only those assigned to this developer
    project.tasks = project.tasks.filter(t => t.developerId === user.userId);
    if (project.tasks.length === 0) {
      return res.status(403).json({ success: false, error: 'Forbidden: You have no assigned tasks in this project' });
    }
  }

  return res.json({ success: true, data: project });
}

export async function createProject(req: AuthenticatedRequest, res: Response) {
  const user = req.user!;
  const { title, description, clientId, pmId } = req.body;

  let assignedPmId = pmId;
  if (user.role === Role.PROJECT_MANAGER) {
    assignedPmId = user.userId;
  }

  if (!assignedPmId) {
    return res.status(400).json({ success: false, error: 'PM ID is required' });
  }

  const project = await prisma.project.create({
    data: {
      title,
      description,
      clientId,
      pmId: assignedPmId
    },
    include: {
      client: true,
      pm: { select: { id: true, name: true, email: true } }
    }
  });

  return res.status(201).json({ success: true, data: project });
}
