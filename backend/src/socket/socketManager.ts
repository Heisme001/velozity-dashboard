import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyAccessToken, TokenPayload } from '../services/tokenService';
import { prisma } from '../services/prisma';

export interface AuthenticatedSocket extends Socket {
  user?: TokenPayload;
}

class SocketManager {
  private io: SocketIOServer | null = null;
  private onlineUsers: Map<string, Set<string>> = new Map();

  public init(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: (origin, callback) => {
          if (!origin) return callback(null, true);
          return callback(null, origin);
        },
        credentials: true
      }
    });

    this.io.use((socket: AuthenticatedSocket, next) => {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) {
        return next(new Error('Authentication error: Token required'));
      }
      try {
        const payload = verifyAccessToken(token);
        socket.user = payload;
        next();
      } catch {
        next(new Error('Authentication error: Invalid or expired token'));
      }
    });

    this.io.on('connection', async (socket: AuthenticatedSocket) => {
      const user = socket.user;
      if (!user) return;

      const userId = user.userId;

      if (!this.onlineUsers.has(userId)) {
        this.onlineUsers.set(userId, new Set());
      }
      this.onlineUsers.get(userId)!.add(socket.id);

      socket.join(`user:${userId}`);
      socket.join(`role:${user.role}`);

      if (user.role === 'PROJECT_MANAGER') {
        const ownedProjects = await prisma.project.findMany({
          where: { pmId: userId },
          select: { id: true }
        });
        for (const p of ownedProjects) {
          socket.join(`project:${p.id}`);
        }
      }

      this.broadcastPresence();

      socket.on('join:project', (projectId: string) => {
        socket.join(`project:${projectId}`);
      });

      socket.on('leave:project', (projectId: string) => {
        socket.leave(`project:${projectId}`);
      });

      socket.on('activity:catch-up', async (afterIso: string) => {
        try {
          const after = afterIso ? new Date(afterIso) : new Date(0);

          let whereClause: any = { createdAt: { gt: after } };

          if (user.role === 'PROJECT_MANAGER') {
            whereClause.project = { pmId: userId };
          } else if (user.role === 'DEVELOPER') {
            whereClause.task = { developerId: userId };
          }

          const missed = await prisma.activity.findMany({
            where: whereClause,
            include: {
              user: { select: { id: true, name: true, role: true } },
              project: { select: { id: true, title: true } },
              task: { select: { id: true, title: true, developerId: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 20
          });

          socket.emit('activity:catch-up:result', missed);
        } catch (err) {
          console.error('[Socket] catch-up error:', err);
        }
      });

      socket.on('disconnect', () => {
        const userSockets = this.onlineUsers.get(userId);
        if (userSockets) {
          userSockets.delete(socket.id);
          if (userSockets.size === 0) {
            this.onlineUsers.delete(userId);
          }
        }
        this.broadcastPresence();
      });
    });
  }

  public getOnlineUsersCount(): number {
    return this.onlineUsers.size;
  }

  public broadcastPresence() {
    if (!this.io) return;
    const count = this.onlineUsers.size;
    this.io.to('role:ADMIN').emit('presence:update', { onlineCount: count });
  }

  public broadcastActivity(activity: {
    id: string;
    action: string;
    description: string;
    oldStatus?: string | null;
    newStatus?: string | null;
    taskId: number;
    projectId: string;
    projectTitle?: string;
    userId: string;
    userName: string;
    developerId?: string | null;
    pmId?: string | null;
    createdAt: string;
  }) {
    if (!this.io) return;

    // Global feed for admins
    this.io.to('role:ADMIN').emit('activity:feed', activity);

    // Project manager personal room
    if (activity.pmId) {
      this.io.to(`user:${activity.pmId}`).emit('activity:feed', activity);
    }

    // Assigned developer personal room
    if (activity.developerId) {
      this.io.to(`user:${activity.developerId}`).emit('activity:feed', activity);
    }

    // Project room subscribers
    this.io.to(`project:${activity.projectId}`).emit('task:updated', {
      taskId: activity.taskId,
      projectId: activity.projectId,
      newStatus: activity.newStatus,
      activity
    });
  }

  public sendNotification(userId: string, notification: any) {
    if (!this.io) return;
    this.io.to(`user:${userId}`).emit('notification:new', notification);
  }
}

export const socketManager = new SocketManager();
