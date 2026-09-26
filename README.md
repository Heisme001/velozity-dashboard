# Velozity — Real-Time Client Project Dashboard

A full-stack project management dashboard for agencies to manage client projects, track task status, and monitor team activity in real time with role-based access control.

---

## Live Application

| Service | URL |
|---------|-----|
| Frontend | _Deployment URL_ |
| Backend API | _Deployment URL_ |

---

## Architecture Overview

### Backend Framework — Express (Node.js)
Express handles the REST API routes and integrates with Socket.io. The middleware chain (`authenticate` → `authorize` → `validateBody` → controller) enforces role and resource permissions before requests reach domain logic.

### ORM — Prisma
Prisma is used for type-safe database queries against PostgreSQL. Role-based scoping is applied directly in the query layer to ensure data isolation.

### Real-Time Updates — Socket.io
Real-time events are delivered using Socket.io rooms:
- `role:ADMIN` — Receives all global activity events.
- `user:<pmId>` — Receives activity updates for projects owned by the project manager.
- `user:<devId>` — Receives activity updates for tasks assigned to the developer.
- `project:<id>` — Receives task updates for active project views.

Events are filtered server-side so clients only receive updates they have permission to access.

### Offline Catch-Up Mechanism
When a client reconnects, it sends the timestamp of its last received event via `activity:catch-up`. The server queries recent matching activities from PostgreSQL and delivers missed events back to the client.

### Background Jobs — node-cron
A lightweight cron job runs every 5 minutes to scan for overdue tasks and emit notification events to assigned developers and project managers.

### Authentication Flow
- **Access Token**: Short-lived JWT (15 minutes) passed in the `Authorization: Bearer` header.
- **Refresh Token**: Long-lived JWT (7 days) stored in an `HttpOnly; Secure; SameSite=Lax` cookie.
- Silent token renewal is handled by Axios response interceptors on `401 Unauthorized` errors.

---

## Database Schema

```
User
  id (uuid PK) | name | email (unique) | password (bcrypt) | role (ADMIN | PROJECT_MANAGER | DEVELOPER)

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

### Database Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| `User` | `email` | User lookup during authentication |
| `User` | `role` | Role-based queries |
| `Project` | `pmId` | PM dashboard and ownership verification |
| `Project` | `clientId` | Client project relationships |
| `Task` | `projectId` | Project board task lookups |
| `Task` | `developerId` | Developer task assignments |
| `Task` | `status` | Status filtering |
| `Task` | `priority` | Priority sorting |
| `Task` | `dueDate` | Deadline filtering and cron scanning |
| `Task` | `isOverdue` | Overdue count aggregation |
| `Activity` | `(projectId, createdAt)` | Project activity timeline |
| `Activity` | `taskId` | Task-level activity history |
| `Activity` | `createdAt DESC` | Activity pagination |
| `Notification` | `(userId, isRead)` | Unread notification counters |
| `Notification` | `createdAt DESC` | Notification inbox ordering |

---

## Getting Started

### Using Docker (Recommended)

1. Clone repository and set up environment:
   ```bash
   git clone https://github.com/Heisme001/velozity-dashboard.git
   cd velozity-dashboard
   cp backend/.env.example backend/.env
   ```

2. Start services:
   ```bash
   docker compose up --build
   ```

3. Seed database:
   ```bash
   docker exec velozity_backend npx ts-node prisma/seed.ts
   ```

4. Open services:
   - **Frontend**: http://localhost:5173
   - **Backend API**: http://localhost:5000/api
   - **Health Check**: http://localhost:5000/health

### Demo Credentials (Password: `Password@123`)

| Role | Email |
|------|-------|
| Admin | `admin@velozity.com` |
| Project Manager 1 | `ravi.pm@velozity.com` |
| Project Manager 2 | `ananya.pm@velozity.com` |
| Developer 1 | `priya.dev@velozity.com` |
| Developer 2 | `siddharth.dev@velozity.com` |
| Developer 3 | `marcus.dev@velozity.com` |
| Developer 4 | `kavya.dev@velozity.com` |

---

## Manual Setup

### 1. Database
```bash
docker run --name velozity_postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgrespassword \
  -e POSTGRES_DB=velozity_db \
  -p 5432:5432 -d postgres:15-alpine
```

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## API Verification Examples

```bash
# Admin login
ADMIN_TOKEN=$(curl -s -c cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@velozity.com","password":"Password@123"}' \
  | jq -r '.data.accessToken')

# PM login
PM_TOKEN=$(curl -s -c cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ravi.pm@velozity.com","password":"Password@123"}' \
  | jq -r '.data.accessToken')

# Developer login
DEV_TOKEN=$(curl -s -c cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"priya.dev@velozity.com","password":"Password@123"}' \
  | jq -r '.data.accessToken')

# Modify task assigned to another developer (expected 403)
curl -s -X PATCH http://localhost:5000/api/tasks/1/status \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"DONE"}'

# Access another PM's project (expected 403)
curl -s http://localhost:5000/api/projects/<project_id> \
  -H "Authorization: Bearer $PM_TOKEN"

# Refresh token verification
curl -s -b cookies.txt -X POST http://localhost:5000/api/auth/refresh | jq .
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL 15, Prisma ORM |
| Real-time | Socket.io |
| Authentication | JWT + HttpOnly Refresh Cookies |
| Validation | Zod |
| Scheduling | node-cron |
| Containerization | Docker, Docker Compose |
