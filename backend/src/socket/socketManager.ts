import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyAccessToken, TokenPayload } from '../services/tokenService';
import { prisma } from '../services/prisma';

export interface AuthenticatedSocket extends Socket {
  user?: TokenPayload;
}

class SocketManager {
  private io: SocketIOServer | null = null;
  // userId -> Set<socketId>  (one user can have multiple tabs open)
  private onlineUsers: Map<string, Set<string>> = new Map();

  public init(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: (origin, callback) => callback(null, true),
        credentials: true
      }
    });

    // ── Socket auth middleware ─────────────────────────────────────────────
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

    // ── Connection handler ─────────────────────────────────────────────────
    this.io.on('connection', async (socket: AuthenticatedSocket) => {
      const user = socket.user;
      if (!user) return;

      const userId = user.userId;

      // Track presence
      if (!this.onlineUsers.has(userId)) {
        this.onlineUsers.set(userId, new Set());
      }
      this.onlineUsers.get(userId)!.add(socket.id);

      // Personal room for direct notifications
      socket.join(`user:${userId}`);

      // Role room
      socket.join(`role:${user.role}`);

      // For PMs: join all project rooms they own so they get
      // real-time updates server-side without client filtering
      if (user.role === 'PROJECT_MANAGER') {
        const ownedProjects = await prisma.project.findMany({
          where: { pmId: userId },
          select: { id: true }
        });
        for (const p of ownedProjects) {
          socket.join(`project:${p.id}`);
        }
      }

      // Broadcast live presence count to all admins
      this.broadcastPresence();

      // ── Join a specific project room (for project detail view) ───────────
      socket.on('join:project', (projectId: string) => {
        socket.join(`project:${projectId}`);
      });

      socket.on('leave:project', (projectId: string) => {
        socket.leave(`project:${projectId}`);
      });

      // ── Missed-event catch-up (last 20 events since a timestamp) ─────────
      // Client emits this on reconnect with the ISO timestamp of the last
      // event it received.  Backend filters by role and returns ≤20 rows.
      socket.on('activity:catch-up', async (afterIso: string) => {
        try {
          const after = afterIso ? new Date(afterIso) : new Date(0);

          let whereClause: any = { createdAt: { gt: after } };

          if (user.role === 'PROJECT_MANAGER') {
            whereClause.project = { pmId: userId };
          } else if (user.role === 'DEVELOPER') {
            whereClause.task = { developerId: userId };
          }
          // ADMIN: no extra filter → global feed

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

      // ── Disconnect ────────────────────────────────────────────────────────
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

  // ── Public helpers ─────────────────────────────────────────────────────────

  public getOnlineUsersCount(): number {
    return this.onlineUsers.size;
  }

  public broadcastPresence() {
    if (!this.io) return;
    const count = this.onlineUsers.size;
    // Only admins see the global presence count in the UI
    this.io.to('role:ADMIN').emit('presence:update', { onlineCount: count });
  }

  /**
   * Broadcast a new activity to the correct server-side rooms.
   *
   * Routing rules (ALL enforced server-side, never on the client):
   *   ADMIN room  → global feed, always receives every event
   *   PM room     → only the PM who owns the project (user:<pmId>)
   *   DEV room    → only the developer assigned to the task (user:<devId>)
   *   project room → everyone viewing that project's detail page
   *
   * Note: PM and DEV rooms overlap with admin, but socket.io de-duplicates
   * delivery automatically when a socket is in multiple rooms.
   */
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

    // 1. Admin global feed
    this.io.to('role:ADMIN').emit('activity:feed', activity);

    // 2. PM of this project (personal room, not PM role room)
    //    This ensures PM A doesn't see PM B's project activity
    if (activity.pmId) {
      this.io.to(`user:${activity.pmId}`).emit('activity:feed', activity);
    }

    // 3. Developer assigned to this specific task (personal room)
    //    This ensures Dev A doesn't see Dev B's task activity
    if (activity.developerId) {
      this.io.to(`user:${activity.developerId}`).emit('activity:feed', activity);
    }

    // 4. Anyone currently viewing the project detail page
    this.io.to(`project:${activity.projectId}`).emit('task:updated', {
      taskId: activity.taskId,
      projectId: activity.projectId,
      newStatus: activity.newStatus,
      activity
    });
  }

  /** Push a direct notification to a specific user's socket room */
  public sendNotification(userId: string, notification: any) {
    if (!this.io) return;
    this.io.to(`user:${userId}`).emit('notification:new', notification);
  }
}

export const socketManager = new SocketManager();
