import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { Role, TaskStatus, Priority } from '@prisma/client';
import { socketManager } from '../socket/socketManager';

export const createTaskSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  dueDate: z.string().datetime(),
  projectId: z.string().uuid(),
  developerId: z.string().uuid().optional()
});

export const updateTaskStatusSchema = z.object({
  status: z.nativeEnum(TaskStatus)
});

// GET /tasks
export async function getTasks(req: AuthenticatedRequest, res: Response) {
  const user = req.user!;
  const { status, priority, projectId, dueDateFrom, dueDateTo } = req.query;

  let whereClause: any = {};

  if (user.role === Role.DEVELOPER) {
    whereClause.developerId = user.userId;
  } else if (user.role === Role.PROJECT_MANAGER) {
    whereClause.project = { pmId: user.userId };
  }

  if (projectId) whereClause.projectId = String(projectId);
  if (status) whereClause.status = status as TaskStatus;
  if (priority) whereClause.priority = priority as Priority;
  if (dueDateFrom || dueDateTo) {
    whereClause.dueDate = {};
    if (dueDateFrom) whereClause.dueDate.gte = new Date(String(dueDateFrom));
    if (dueDateTo) whereClause.dueDate.lte = new Date(String(dueDateTo));
  }

  const tasks = await prisma.task.findMany({
    where: whereClause,
    include: {
      project: { select: { id: true, title: true, pmId: true } },
      developer: { select: { id: true, name: true, email: true } }
    },
    orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }]
  });

  return res.json({ success: true, data: tasks });
}

// POST /tasks
export async function createTask(req: AuthenticatedRequest, res: Response) {
  const user = req.user!;
  const { title, description, priority, dueDate, projectId, developerId } = req.body;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return res.status(404).json({ success: false, error: 'Project not found' });
  }

  if (user.role === Role.PROJECT_MANAGER && project.pmId !== user.userId) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: You do not manage this project'
    });
  }

  const task = await prisma.task.create({
    data: {
      title,
      description,
      priority,
      dueDate: new Date(dueDate),
      projectId,
      developerId: developerId || null
    },
    include: {
      project: true,
      developer: { select: { id: true, name: true, email: true } }
    }
  });

  const activity = await prisma.activity.create({
    data: {
      action: 'TASK_CREATED',
      description: `${user.name} created Task #${task.id}: "${task.title}"`,
      newStatus: TaskStatus.TODO,
      taskId: task.id,
      projectId: task.projectId,
      userId: user.userId
    },
    include: { user: true, project: true }
  });

  if (developerId) {
    const notif = await prisma.notification.create({
      data: {
        userId: developerId,
        title: 'New Task Assigned',
        message: `You were assigned Task #${task.id}: "${task.title}" in project "${project.title}"`,
        link: `/projects/${project.id}`
      }
    });
    socketManager.sendNotification(developerId, notif);
  }

  socketManager.broadcastActivity({
    id: activity.id,
    action: activity.action,
    description: activity.description,
    taskId: task.id,
    projectId: project.id,
    projectTitle: project.title,
    userId: user.userId,
    userName: user.name,
    developerId: task.developerId,
    pmId: project.pmId,
    createdAt: activity.createdAt.toISOString()
  });

  return res.status(201).json({ success: true, data: task });
}

// PATCH /tasks/:id/status
export async function updateTaskStatus(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { status } = req.body;
  const user = req.user!;
  const taskId = parseInt(id, 10);

  if (isNaN(taskId)) {
    return res.status(400).json({ success: false, error: 'Invalid task ID' });
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { project: true, developer: true }
  });

  if (!task) {
    return res.status(404).json({ success: false, error: 'Task not found' });
  }

  if (user.role === Role.DEVELOPER && task.developerId !== user.userId) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: You can only modify tasks assigned to you'
    });
  }

  if (user.role === Role.PROJECT_MANAGER && task.project.pmId !== user.userId) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: You do not manage this project'
    });
  }

  const oldStatus = task.status;
  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: {
      status,
      isOverdue: status === TaskStatus.DONE ? false : task.isOverdue
    },
    include: { project: true, developer: true }
  });

  const formattedDesc = `${user.name} moved Task #${taskId} from ${oldStatus.replace('_', ' ')} → ${status.replace('_', ' ')}`;

  const activity = await prisma.activity.create({
    data: {
      action: 'STATUS_CHANGED',
      description: formattedDesc,
      oldStatus,
      newStatus: status,
      taskId,
      projectId: task.projectId,
      userId: user.userId
    }
  });

  if (status === TaskStatus.IN_REVIEW && task.project.pmId) {
    const notif = await prisma.notification.create({
      data: {
        userId: task.project.pmId,
        title: 'Task In Review',
        message: `Task #${taskId} ("${task.title}") was submitted for review by ${user.name}`,
        link: `/projects/${task.projectId}`
      }
    });
    socketManager.sendNotification(task.project.pmId, notif);
  }

  socketManager.broadcastActivity({
    id: activity.id,
    action: activity.action,
    description: activity.description,
    oldStatus: activity.oldStatus,
    newStatus: activity.newStatus,
    taskId,
    projectId: task.projectId,
    projectTitle: task.project.title,
    userId: user.userId,
    userName: user.name,
    developerId: task.developerId,
    pmId: task.project.pmId,
    createdAt: activity.createdAt.toISOString()
  });

  return res.json({ success: true, data: updatedTask });
}
