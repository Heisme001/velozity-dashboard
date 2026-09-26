import { Response } from 'express';
import { prisma } from '../services/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { Role } from '@prisma/client';

export async function getActivities(req: AuthenticatedRequest, res: Response) {
  const user = req.user!;
  const limit = Math.min(parseInt(String(req.query.limit || '20'), 10), 50);
  const projectId = req.query.projectId ? String(req.query.projectId) : undefined;

  let whereClause: any = {};

  if (projectId) {
    whereClause.projectId = projectId;
  }

  if (user.role === Role.ADMIN) {
    // Admin has global visibility
  } else if (user.role === Role.PROJECT_MANAGER) {
    whereClause.project = { pmId: user.userId };
  } else if (user.role === Role.DEVELOPER) {
    whereClause.task = { developerId: user.userId };
  }

  const activities = await prisma.activity.findMany({
    where: whereClause,
    include: {
      user: { select: { id: true, name: true, role: true } },
      project: { select: { id: true, title: true } },
      task: { select: { id: true, title: true, developerId: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  });

  return res.json({ success: true, data: activities });
}

export async function getNotifications(req: AuthenticatedRequest, res: Response) {
  const user = req.user!;

  const notifications = await prisma.notification.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: 'desc' },
    take: 30
  });

  const unreadCount = await prisma.notification.count({
    where: { userId: user.userId, isRead: false }
  });

  return res.json({ success: true, data: { notifications, unreadCount } });
}

export async function markNotificationRead(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const user = req.user!;

  const notif = await prisma.notification.findUnique({ where: { id } });
  if (!notif || notif.userId !== user.userId) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  await prisma.notification.update({
    where: { id },
    data: { isRead: true }
  });

  return res.json({ success: true, message: 'Notification marked as read' });
}

export async function markAllNotificationsRead(req: AuthenticatedRequest, res: Response) {
  const user = req.user!;

  await prisma.notification.updateMany({
    where: { userId: user.userId, isRead: false },
    data: { isRead: true }
  });

  return res.json({ success: true, message: 'All notifications marked as read' });
}

export async function getDashboardStats(req: AuthenticatedRequest, res: Response) {
  const user = req.user!;

  if (user.role === Role.ADMIN) {
    const [totalProjects, totalTasks, overdueTasks, tasksByStatus] = await Promise.all([
      prisma.project.count(),
      prisma.task.count(),
      prisma.task.count({ where: { isOverdue: true } }),
      prisma.task.groupBy({ by: ['status'], _count: { _all: true } })
    ]);

    const { socketManager } = await import('../socket/socketManager');
    const activeUsersOnline = socketManager.getOnlineUsersCount();

    return res.json({
      success: true,
      data: {
        role: 'ADMIN',
        totalProjects,
        totalTasks,
        overdueTasks,
        tasksByStatus,
        activeUsersOnline
      }
    });
  }

  if (user.role === Role.PROJECT_MANAGER) {
    const [myProjects, tasksByPriority] = await Promise.all([
      prisma.project.findMany({
        where: { pmId: user.userId },
        include: { _count: { select: { tasks: true } } }
      }),
      prisma.task.groupBy({
        where: { project: { pmId: user.userId } },
        by: ['priority'],
        _count: { _all: true }
      })
    ]);

    const oneWeekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const upcomingTasks = await prisma.task.findMany({
      where: {
        project: { pmId: user.userId },
        dueDate: { lte: oneWeekFromNow, gte: new Date() },
        status: { not: 'DONE' }
      },
      include: {
        project: { select: { title: true } },
        developer: { select: { name: true } }
      },
      orderBy: { dueDate: 'asc' }
    });

    return res.json({
      success: true,
      data: {
        role: 'PROJECT_MANAGER',
        projectsCount: myProjects.length,
        projects: myProjects,
        tasksByPriority,
        upcomingTasks
      }
    });
  }

  if (user.role === Role.DEVELOPER) {
    const assignedTasks = await prisma.task.findMany({
      where: { developerId: user.userId },
      include: { project: { select: { id: true, title: true } } },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }]
    });

    return res.json({
      success: true,
      data: {
        role: 'DEVELOPER',
        assignedTasksCount: assignedTasks.length,
        assignedTasks
      }
    });
  }

  return res.status(400).json({ success: false, error: 'Unknown role' });
}
