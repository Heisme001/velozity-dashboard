import { Router } from 'express';
import {
  login,
  refreshToken,
  logout,
  getCurrentUser,
  loginSchema
} from '../controllers/authController';
import {
  getProjects,
  getProjectById,
  createProject,
  createProjectSchema
} from '../controllers/projectController';
import {
  getTasks,
  createTask,
  updateTaskStatus,
  createTaskSchema,
  updateTaskStatusSchema
} from '../controllers/taskController';
import {
  getActivities,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getDashboardStats
} from '../controllers/dashboardController';
import { authenticate, authorize } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { Role } from '@prisma/client';

export const apiRouter = Router();

// Auth routes
apiRouter.post('/auth/login', validateBody(loginSchema), login);
apiRouter.post('/auth/refresh', refreshToken);
apiRouter.post('/auth/logout', logout);
apiRouter.get('/auth/me', authenticate, getCurrentUser);

// Projects routes
apiRouter.get('/projects', authenticate, getProjects);
apiRouter.get('/projects/:id', authenticate, getProjectById);
apiRouter.post(
  '/projects',
  authenticate,
  authorize([Role.ADMIN, Role.PROJECT_MANAGER]),
  validateBody(createProjectSchema),
  createProject
);

// Tasks routes
apiRouter.get('/tasks', authenticate, getTasks);
apiRouter.post(
  '/tasks',
  authenticate,
  authorize([Role.ADMIN, Role.PROJECT_MANAGER]),
  validateBody(createTaskSchema),
  createTask
);
apiRouter.patch(
  '/tasks/:id/status',
  authenticate,
  validateBody(updateTaskStatusSchema),
  updateTaskStatus
);

// Activity feed
apiRouter.get('/activities', authenticate, getActivities);

// Notifications
apiRouter.get('/notifications', authenticate, getNotifications);
apiRouter.patch('/notifications/:id/read', authenticate, markNotificationRead);
apiRouter.patch('/notifications/all/read', authenticate, markAllNotificationsRead);

// Dashboard metrics
apiRouter.get('/dashboard/stats', authenticate, getDashboardStats);
