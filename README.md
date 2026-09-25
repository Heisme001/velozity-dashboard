# Velozity Global Solutions — Real-Time Client Project Dashboard

A production-grade full-stack application that allows a small agency to manage client projects, track task progress, and monitor team activity in real time.

---

## Live Application

| Service | URL |
|---------|-----|
| Frontend | _Vercel deploy URL here_ |
| Backend API | _Railway/Render deploy URL here_ |

---

## Architecture Decisions

### Web Framework — Express (Node.js)
Express was chosen for its minimal footprint and mature middleware ecosystem. The middleware chain (`authenticate` → `authorize` → `validateBody` → controller) maps cleanly to the assessment's role enforcement requirements. Fastify was considered but Express has better out-of-the-box compatibility with Socket.io's adapter layer.

### ORM — Prisma
Prisma provides fully-typed query results, which eliminates an entire class of runtime type errors in TypeScript. The auto-generated `PrismaClient` types allowed strict role-based filtering to be expressed directly in the query layer rather than post-processing raw SQL rows.

### Real-time — Socket.io (WebSocket)
Socket.io was chosen over native WebSocket for three reasons:
1. **Room support** — the role-filtered feed is implemented using `user:<id>` personal rooms and `role:<ROLE>` rooms. This means the server routes each activity only to the correct recipients without any client-side filtering.
2. **Automatic reconnection** — clients reconnect transparently; the `connect` event fires again, triggering the `activity:catch-up` emission to recover missed events.
3. **Polling fallback** — works in restrictive network environments (proxies that block `Upgrade: websocket`).

**Role-filtered feed design (server-side, never client-side):**
```
Socket connects → JWT verified → socket joins:
  role:ADMIN   → receives all activity:feed events globally
  user:<pmId>  → receives activity:feed only for their own projects
  user:<devId> → receives activity:feed only for tasks assigned to them
  user:<userId>→ receives notification:new events
  project:<id> → receives task:updated events (project detail view)
```
A developer cannot see another developer's task activity because the server only emits to `user:<devId>` — the assigned developer's personal room — not to a shared developer role room.

### Missed-event recovery (offline catch-up)
When a socket reconnects, the client emits `activity:catch-up` with the ISO timestamp of the last event it received. The server runs a Prisma query filtered by the same role rules as the live feed and returns the last 20 matching rows. This is fetched from the database, not from an in-memory cache.

### Background Jobs — node-cron
`node-cron` was chosen over Bull queue because:
- No Redis dependency for what is a simple periodic job
- The overdue-task check runs every 5 minutes and has no retry or concurrency requirements
- Bull would add operational complexity (Redis, worker processes) without benefit at this scale

**Trade-off:** Bull would be the correct choice for high-volume, distributed, or retry-required jobs. For a future `sendEmailDigest` or `generateMonthlyReport` job, Bull/BullMQ would be appropriate.

### Token storage — HttpOnly Cookie + In-memory Access Token
| Token | Storage | Why |
|-------|---------|-----|
| Access token (15 min) | `Authorization: Bearer` header (localStorage) | Short-lived; if stolen, expires quickly |
| Refresh token (7 days) | `HttpOnly; Secure; SameSite=Strict` cookie | Cannot be read by JavaScript — XSS-proof |

The refresh flow: when the access token expires, the API interceptor calls `POST /api/auth/refresh`. The browser automatically sends the HttpOnly cookie; the server verifies it and issues a new access token. The refresh token itself is rotated on every use.

---

## Database Schema

```
User
  id (uuid PK) | name | email (unique) | password (bcrypt) | role (ADMIN|PROJECT_MANAGER|DEVELOPER)

Client
  id (uuid PK) | name | email (unique) | company

Project
  id (uuid PK) | title | description | clientId (FK→Client) | pmId (FK→User)

Task
  id (serial PK) | title | description | status | priority | dueDate | isOverdue
  projectId (FK→Project) | developerId (FK→User, nullable)

Activity
  id (uuid PK) | action | description | oldStatus | newStatus
  taskId (FK→Task) | projectId (FK→Project) | userId (FK→User) | createdAt

Notification
  id (uuid PK) | userId (FK→User) | title | message | link | isRead | createdAt
```

### Indexing decisions

| Table | Index | Rationale |
|-------|-------|-----------|
| `User` | `email` | Login lookup |
| `User` | `role` | Role-based admin queries |
| `Project` | `pmId` | PM dashboard and RBAC checks |
| `Project` | `clientId` | Client-project joins |
| `Task` | `projectId` | Kanban board — tasks per project |
| `Task` | `developerId` | Developer dashboard — assigned tasks |
| `Task` | `status` | Status filter (shareable URL) |
| `Task` | `priority` | Priority filter |
| `Task` | `dueDate` | Due-date range filter and cron job |
| `Task` | `isOverdue` | Overdue count on admin dashboard |
| `Activity` | `(projectId, createdAt)` | PM project feed ordered by time |
| `Activity` | `taskId` | Developer task feed |
| `Activity` | `createdAt DESC` | Global feed pagination |
| `Notification` | `(userId, isRead)` | Unread count badge |
| `Notification` | `createdAt DESC` | Notification inbox ordering |

---

## Local Setup (Docker — recommended)

### Prerequisites
- Docker Desktop running
- Git

### Steps

```bash
git clone https://github.com/Heisme001/velozity-dashboard.git
cd velozity-dashboard

# Copy and configure environment
cp backend/.env.example backend/.env
# Edit backend/.env if needed (defaults work for Docker Compose)

# Start all services (postgres + backend + frontend)
docker compose up --build

# In a separate terminal, seed the database
docker exec velozity_backend npx ts-node prisma/seed.ts
```

App is now available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000/api
- **Health check**: http://localhost:5000/health

### Demo accounts (all passwords: `Password@123`)

| Role | Email |
|------|-------|
| Admin | admin@velozity.com |
| Project Manager 1 | ravi.pm@velozity.com |
| Project Manager 2 | ananya.pm@velozity.com |
| Developer 1 | priya.dev@velozity.com |
| Developer 2 | siddharth.dev@velozity.com |
| Developer 3 | marcus.dev@velozity.com |
| Developer 4 | kavya.dev@velozity.com |

---

## Local Setup (without Docker)

### Step 1 — Start PostgreSQL

```bash
docker run --name velozity_postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgrespassword \
  -e POSTGRES_DB=velozity_db \
  -p 5432:5432 -d postgres:15-alpine
```

### Step 2 — Backend

```bash
cd backend
npm install
cp .env.example .env
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
# Running on http://localhost:5000
```

### Step 3 — Frontend (new terminal)

```bash
cd frontend
npm install
npm run dev
# Running on http://localhost:5173
```

---

## Testing RBAC (curl)

```bash
# 1. Login as Admin → get access token
ADMIN_TOKEN=$(curl -s -c cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@velozity.com","password":"Password@123"}' \
  | jq -r '.data.accessToken')

# 2. Login as PM
PM_TOKEN=$(curl -s -c cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ravi.pm@velozity.com","password":"Password@123"}' \
  | jq -r '.data.accessToken')

# 3. Login as Developer
DEV_TOKEN=$(curl -s -c cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"priya.dev@velozity.com","password":"Password@123"}' \
  | jq -r '.data.accessToken')

# 4. Developer tries to update a task that belongs to another developer → 403
curl -s -X PATCH http://localhost:5000/api/tasks/1/status \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"DONE"}'

# 5. PM tries to access another PM's project → 403
curl -s http://localhost:5000/api/projects/<project3_id> \
  -H "Authorization: Bearer $PM_TOKEN"

# 6. Admin sees all projects
curl -s http://localhost:5000/api/projects \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data | length'

# 7. PM only sees their own projects
curl -s http://localhost:5000/api/projects \
  -H "Authorization: Bearer $PM_TOKEN" | jq '.data | length'

# 8. Verify refresh token works (uses HttpOnly cookie)
curl -s -b cookies.txt -X POST http://localhost:5000/api/auth/refresh | jq .
```

---

## Known Limitations

1. **No token revocation list** — refresh tokens are stateless JWTs. Logging out clears the cookie client-side but a stolen refresh token remains valid until expiry. A production system should store a token hash in Redis and invalidate on logout.
2. **In-process presence tracking** — the `onlineUsers` Map lives in the Node.js process. In a multi-instance deployment (horizontal scaling), a shared Redis store (Socket.io Redis adapter) would be required for accurate presence counts.
3. **node-cron in same process** — the overdue scheduler runs in the same process as the API server. Under high load this could delay cron ticks. A separate worker process or BullMQ with a dedicated worker would be more robust.
4. **No rate limiting** — login endpoint and API routes are not rate-limited. In production, add `express-rate-limit`.
5. **Seed data is deterministic** — re-running the seed script deletes all data first. Production environments should use idempotent migration-based seeds.

---

## In the Explanation Field (150–250 words)

The hardest problem was designing the real-time activity feed to be **role-filtered at the server level** — not just hidden on the frontend. The naive approach (emit to all, filter on client) would fail the assessment's API-level security requirement: a developer could intercept WebSocket messages and see other users' data.

The solution uses Socket.io personal rooms (`user:<userId>`) as the enforcement boundary. On connection, the server verifies the JWT, then routes events exclusively to the correct personal room: admin events go to `role:ADMIN`, PM events go to `user:<pmId>` (not the role room), and developer events go to `user:<devId>`. This means Dev A's socket never receives an event intended for Dev B — the isolation happens before any data leaves the server.

For offline recovery, the client stores the timestamp of the last received event. On reconnect, it emits `activity:catch-up` with that timestamp; the server runs the same role-filtered Prisma query and returns the last 20 matching rows from the database (not from memory).

If I did this again, I would add a **Redis adapter** for Socket.io from day one, enabling horizontal scaling without rewriting the room-based architecture. I'd also replace `node-cron` with BullMQ so the overdue scheduler can run in a separate worker process with retry logic and a monitoring dashboard.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Tailwind CSS + Vite |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL 15 + Prisma ORM |
| Real-time | Socket.io (WebSocket) |
| Auth | JWT (access) + HttpOnly cookie (refresh) |
| Validation | Zod |
| Background jobs | node-cron |
| Containers | Docker + Docker Compose |
