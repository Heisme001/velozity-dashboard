# Velozity - Real-Time Client Project Dashboard

A full-stack project management dashboard for client agencies to track project progress, manage tasks, and monitor team activity in real time with role-based access control.

---

## Live Links

| Service | URL |
|---|---|
| Frontend (Vercel) | [https://velozity-dashboard.vercel.app]([https://velozity-dashboard.vercel.app](https://velozity-dashboard-jaldkw6nt-hemanth-kumars-projects-de5dd856.vercel.app)) |
| Backend API (Render) | [https://velozity-dashboard-is1w.onrender.com](https://velozity-dashboard-is1w.onrender.com) |
| Health Check | [https://velozity-dashboard-is1w.onrender.com/health](https://velozity-dashboard-is1w.onrender.com/health) |

---

## Technical Challenges & Implementation Notes

The trickiest part of the project was cleanly isolating data between the three user roles (Admin, PM, Developer) without leaking records through either the database queries or live WebSocket feeds. Making sure developers only see their own assigned tasks and activity—while PMs only access their own projects and Admins have global visibility—required careful Prisma query scoping and dedicated Socket.io rooms (`role:ADMIN`, `user:<id>`). Since I recently worked on a similar TypeScript stack, writing the core controllers, auth middleware, and migrations went pretty fast and felt straightforward.

Deploying on free hosting came with real trade-offs. Render's free tier spins down after idle periods, causing 30-second cold starts and dropping WebSocket connections until reconnection kicks in. Cross-origin HttpOnly cookies also required extra care with `SameSite=None` and `Secure` settings to work reliably between Vercel and Render.

If I were building this again for production, I’d replace the in-memory Socket.io adapter and node-cron scheduler with Redis Pub/Sub and BullMQ. Running jobs and WebSockets in the same Node process works fine for this setup, but Redis would allow horizontal scaling across multiple instances.

---

## Architectural Decisions

### Real-Time Library: Socket.io vs Native WebSocket
- **Choice:** Socket.io
- **Reasoning:** Socket.io handles automatic reconnections out of the box and provides built-in room abstractions (`role:ADMIN`, `user:<id>`, `project:<id>`). This makes targeted, role-scoped event broadcasting clean without having to manually track socket connections and client subscriptions. It also falls back to HTTP long-polling if a proxy or network blocks raw WebSocket upgrades.

### Background Job Scheduler: node-cron vs Bull Queue
- **Choice:** node-cron
- **Reasoning:** For this scale and single-container deployment, `node-cron` runs directly inside the Node runtime with zero extra infrastructure. It runs every 5 minutes to scan tasks past their due date, flag them as `isOverdue`, and trigger real-time alerts. If scaling to a multi-instance cluster, BullMQ backed by Redis would be the natural next step.

### Authentication & Token Storage
- **Choice:** Dual-Token Authentication (JWT in headers + Refresh Token in HttpOnly cookie)
- **Reasoning:** 
  - Access tokens expire quickly (15 minutes) and are stored in client memory/headers to protect against CSRF attacks.
  - Refresh tokens last 7 days and are stored in an `HttpOnly`, `Secure`, `SameSite=None` cookie so JavaScript cannot read them, preventing XSS token theft.
  - An Axios response interceptor silently requests a new access token on `401 Unauthorized` errors and retries the failed request seamlessly.

---

## Database Schema & Indexing

### Schema Layout

```
User (id [UUID PK], name, email [Unique], password, role [ADMIN | PM | DEVELOPER], createdAt, updatedAt)
  │
  ├── 1:N ── Project (pmId)
  ├── 1:N ── Task (developerId)
  ├── 1:N ── Activity (userId)
  └── 1:N ── Notification (userId)

Client (id [UUID PK], name, email [Unique], company, createdAt, updatedAt)
  │
  └── 1:N ── Project (clientId)

Project (id [UUID PK], title, description, clientId [FK], pmId [FK], createdAt, updatedAt)
  │
  ├── 1:N ── Task (projectId)
  └── 1:N ── Activity (projectId)

Task (id [Int PK], title, description, status [TODO | IN_PROGRESS | IN_REVIEW | DONE], priority [LOW | MEDIUM | HIGH | CRITICAL], dueDate, isOverdue, projectId [FK], developerId [FK], createdAt, updatedAt)
  │
  └── 1:N ── Activity (taskId)

Activity (id [UUID PK], action, description, oldStatus, newStatus, taskId [FK], projectId [FK], userId [FK], createdAt)

Notification (id [UUID PK], userId [FK], title, message, link, isRead, createdAt)
```

### Indexing Decisions

| Table | Index Column(s) | Purpose |
|---|---|---|
| `User` | `email` | Fast lookups on login |
| `User` | `role` | Role-filtered queries and online user counts |
| `Project` | `pmId` | Scoping projects to their owning Project Manager |
| `Project` | `clientId` | Joining client details to projects |
| `Task` | `projectId` | Fetching tasks for a specific project board |
| `Task` | `developerId` | Filtering tasks assigned to a specific developer |
| `Task` | `status`, `priority` | Sorting and filtering tasks on the dashboard |
| `Task` | `dueDate`, `isOverdue` | Periodic scan queries for the overdue task cron job |
| `Activity` | `(projectId, createdAt)` | Timeline order and missed event catch-up on reconnect |
| `Activity` | `createdAt DESC` | Pagination for activity feeds |
| `Notification` | `(userId, isRead)` | Fast counts for unread notification badges |

---

## Local Setup

### Option 1: Docker (Recommended)

1. Clone the repository:
   ```bash
   git clone https://github.com/Heisme001/velozity-dashboard.git
   cd velozity-dashboard
   ```

2. Copy the environment template:
   ```bash
   cp backend/.env.example backend/.env
   ```

3. Start services with Docker Compose:
   ```bash
   docker compose up --build
   ```

4. Run database seed:
   ```bash
   docker compose exec backend npx ts-node prisma/seed.ts
   ```

5. Open the app:
   - Frontend: [http://localhost:5173](http://localhost:5173)
   - Backend API: [http://localhost:5000/api](http://localhost:5000/api)
   - Health check: [http://localhost:5000/health](http://localhost:5000/health)

---

### Option 2: Manual Setup

1. **Start PostgreSQL:**
   ```bash
   docker run --name velozity_postgres \
     -e POSTGRES_USER=postgres \
     -e POSTGRES_PASSWORD=postgrespassword \
     -e POSTGRES_DB=velozity_db \
     -p 5432:5432 -d postgres:15-alpine
   ```

2. **Backend:**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   npx prisma migrate dev --name init
   npx ts-node prisma/seed.ts
   npm run dev
   ```

3. **Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

## Test Accounts (Password: `Password@123`)

| Role | Email | Scope |
|---|---|---|
| Admin | `admin@velozity.com` | Full visibility across all projects and all activities |
| Project Manager | `ravi.pm@velozity.com` | Manages own projects, assigns tasks, receives review notifications |
| Project Manager | `ananya.pm@velozity.com` | Separate PM account (isolated projects) |
| Developer | `priya.dev@velozity.com` | Views assigned tasks only, updates task status |
| Developer | `siddharth.dev@velozity.com` | Assigned to separate developer tasks |

---

## Known Limitations

- **Free-tier cold starts:** Render spins down free backend web services after 15 minutes of inactivity. Initial page loads after idle take 30–45 seconds while the service boots up.
- **In-memory Socket.io adapter:** The current setup uses Socket.io's default memory adapter, which is fine for a single instance. Multi-server deployment would require an adapter backed by Redis.
- **Third-party cookies:** Strict privacy modes on some browsers (like Safari ITP or Brave) can occasionally block cross-origin cookies between different domains (`vercel.app` and `onrender.com`).
