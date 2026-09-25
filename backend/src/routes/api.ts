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

// ── Public auth routes ────────────────────────────────────────────────────────
apiRouter.post('/auth/login', validateBody(loginSchema), login);
apiRouter.post('/auth/refresh', refreshToken);
apiRouter.post('/auth/logout', logout);
apiRouter.get('/auth/me', authenticate, getCurrentUser);

// ── Projects ──────────────────────────────────────────────────────────────────
// GET /projects  – role-filtered inside getProjects (Admin=all, PM=own, Dev=assigned)
apiRouter.get('/projects', authenticate, getProjects);

// GET /projects/:id – resource-level RBAC inside getProjectById
apiRouter.get('/projects/:id', authenticate, getProjectById);

// POST /projects – only Admin and PM can create projects
apiRouter.post(
  '/projects',
  authenticate,
  authorize([Role.ADMIN, Role.PROJECT_MANAGER]),
  validateBody(createProjectSchema),
  createProject
);

// ── Tasks ─────────────────────────────────────────────────────────────────────
// GET /tasks  – role-filtered inside getTasks
// Supports query params: ?status=&priority=&projectId=&dueDateFrom=&dueDateTo=
apiRouter.get('/tasks', authenticate, getTasks);

// POST /tasks – only Admin and PM
apiRouter.post(
  '/tasks',
  authenticate,
  authorize([Role.ADMIN, Role.PROJECT_MANAGER]),
  validateBody(createTaskSchema),
  createTask
);

// PATCH /tasks/:id/status – all roles can call, but resource-level check inside
apiRouter.patch(
  '/tasks/:id/status',
  authenticate,
  validateBody(updateTaskStatusSchema),
  updateTaskStatus
);

// ── Activities (role-filtered) ────────────────────────────────────────────────
apiRouter.get('/activities', authenticate, getActivities);

// ── Notifications ─────────────────────────────────────────────────────────────
apiRouter.get('/notifications', authenticate, getNotifications);

// Mark a single notification as read
apiRouter.patch('/notifications/:id/read', authenticate, markNotificationRead);

// Mark ALL notifications as read  (Navbar uses PATCH /notifications/all/read)
apiRouter.patch('/notifications/all/read', authenticate, markAllNotificationsRead);

// ── Dashboard stats ───────────────────────────────────────────────────────────
apiRouter.get('/dashboard/stats', authenticate, getDashboardStats);
