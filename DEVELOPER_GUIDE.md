# Developer Guide

Technical guide and developer reference for the Velozity Real-Time Client Project Dashboard.

---

## 1. Architecture Overview

The system consists of a Vite React frontend, an Express TypeScript backend, PostgreSQL for persistence with Prisma ORM, and Socket.io for real-time WebSocket communication.

```
┌─────────────────────────────────────────────────────────┐
│                      React Frontend                     │
│  - Vite + React 18 + TypeScript + Tailwind CSS          │
│  - AuthContext & useSocket hook                         │
│  - Real-time Activity Feed & Task Management            │
└────────────┬───────────────────────────────▲────────────┘
             │ REST (Axios)                  │ WebSocket (Socket.io)
             ▼                               │
┌────────────────────────────────────────────┴────────────┐
│                    Express Backend API                  │
│  - JWT & Role Middleware (Admin, PM, Developer)         │
│  - Controllers: Auth, Projects, Tasks, Dashboard        │
│  - Socket.io Manager: Room-based routing                │
│  - node-cron: Background overdue task scanner           │
└────────────────────────────┬────────────────────────────┘
                             │ Prisma ORM
                             ▼
┌─────────────────────────────────────────────────────────┐
│                       PostgreSQL                        │
│  - Users, Clients, Projects, Tasks, Activities, Notifs  │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Core Implementation Details

### 2.1 Role-Based Access Control (RBAC) & Room Isolation

Access control is enforced at both the HTTP route level and the WebSocket transport level:

1. **HTTP Layer**:
   - `authenticate` validates the JWT bearer token.
   - `authorize([roles])` ensures the caller possesses required roles.
   - Controller queries filter data according to the caller's identity (e.g., developers can only update tasks assigned to their user ID; project managers only view and manage their projects).

2. **WebSocket Layer (`socketManager.ts`)**:
   - Clients join rooms on connection:
     - `role:ADMIN` for organization-wide feeds.
     - `user:<id>` for personal events (task assignments, notifications).
     - `project:<id>` for real-time board updates.
   - Events are published strictly to target rooms rather than globally broadcast to all sockets.

### 2.2 Dual-Token Authentication & Refresh Flow

- **Access Token**: Short duration (15m), stored in memory/client storage.
- **Refresh Token**: Long duration (7d), transmitted via `HttpOnly` cookie.
- **Axios Interceptor (`services/api.ts`)**: On `401 Unauthorized` responses, the interceptor attempts a token renewal via `POST /api/auth/refresh` before retrying the original request.

### 2.3 Offline Event Recovery

When a client reconnects to the WebSocket server, it sends its latest recorded timestamp via `activity:catch-up`. The backend executes a Prisma query scoped to the user's role to retrieve any events logged during the disconnection period.

### 2.4 Scheduled Tasks

`node-cron` runs every 5 minutes (`cron/overdueJob.ts`) to check for tasks past their due date that remain in an open state. Identified tasks have their `isOverdue` flag set and notifications are dispatched to the assigned developer and project manager.

---

## 3. Project Structure

### Backend (`backend/`)

```
backend/
├── prisma/
│   ├── schema.prisma       # Database schema and indexes
│   └── seed.ts             # Development seed dataset
├── src/
│   ├── controllers/
│   │   ├── authController.ts       # Authentication, session refresh, current user
│   │   ├── dashboardController.ts  # Activities, notifications, dashboard metrics
│   │   ├── projectController.ts    # Project management and permissions
│   │   └── taskController.ts       # Task management and status updates
│   ├── cron/
│   │   └── overdueJob.ts   # Overdue task background job
│   ├── middleware/
│   │   ├── auth.ts         # JWT verification and role checks
│   │   ├── errorHandler.ts # Global error handling middleware
│   │   └── validate.ts     # Zod schema validation middleware
│   ├── routes/
│   │   └── api.ts          # API route definitions
│   ├── services/
│   │   ├── prisma.ts       # Prisma Client instance
│   │   └── tokenService.ts # JWT issuance and verification
│   ├── socket/
│   │   └── socketManager.ts # Socket.io configuration and room handlers
│   └── server.ts           # HTTP server bootstrapping
```

### Frontend (`frontend/`)

```
frontend/
├── src/
│   ├── components/
│   │   ├── ActivityFeed.tsx # Real-time activity list with offline catch-up
│   │   ├── Navbar.tsx       # Top navigation, role badges, notifications
│   │   └── TaskCard.tsx     # Task card component with inline status updater
│   ├── context/
│   │   └── AuthContext.tsx  # User state and login/logout handlers
│   ├── hooks/
│   │   └── useSocket.ts     # Socket.io connection lifecycle hook
│   ├── pages/
│   │   ├── DashboardPage.tsx # Main dashboard with board/list views & filtering
│   │   └── LoginPage.tsx     # Login page with demo credentials
│   ├── services/
│   │   └── api.ts           # Axios instance with refresh interceptor
│   ├── App.tsx              # Application routes
│   └── main.tsx             # React entry point
```

---

## 4. Local Development

### Prerequisites
- Node.js 18+
- Docker & Docker Compose

### Environment Variables

**Backend (`backend/.env`):**
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/velozity_db?schema=public"
JWT_ACCESS_SECRET="dev-access-secret-key-change-in-production-1234"
JWT_REFRESH_SECRET="dev-refresh-secret-key-change-in-production-5678"
FRONTEND_URL="http://localhost:5173"
```

**Frontend (`frontend/.env`):**
```env
VITE_API_BASE_URL="http://localhost:5000/api"
VITE_SOCKET_URL="http://localhost:5000"
```

### Running the Application

```bash
# 1. Start PostgreSQL
docker run --name velozity_postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgrespassword \
  -e POSTGRES_DB=velozity_db \
  -p 5432:5432 -d postgres:15-alpine

# 2. Setup and run backend
cd backend
npm install
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev

# 3. Setup and run frontend (in a separate terminal)
cd frontend
npm install
npm run dev
```

---

## 5. Production Deployment

### Database (e.g. Neon, Supabase, Railway)
1. Provision a PostgreSQL instance.
2. Set the `DATABASE_URL` environment variable on the backend service.

### Backend (e.g. Railway, Render, Fly.io)
- **Root Directory**: `backend`
- **Build Command**: `npm ci && npx prisma generate && npm run build`
- **Start Command**: `npx prisma migrate deploy && node dist/server.js`
- Set `NODE_ENV=production`, `FRONTEND_URL`, and production JWT secrets.

### Frontend (e.g. Vercel, Netlify)
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- Set `VITE_API_BASE_URL` and `VITE_SOCKET_URL` to point to the backend domain.
