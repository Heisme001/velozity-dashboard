# Velozity — Real-Time Client Project Dashboard

A full-stack, enterprise-grade project management dashboard built for client agencies to track project progress, assign tasks, and monitor team activities in real time with strict role-based access control.

---

## 🌐 Live Application

| Service | Deployment URL | Status |
|---|---|---|
| **Frontend (Vercel)** | `https://velozity-dashboard.vercel.app` | Active |
| **Backend API (Render)** | `https://velozity-dashboard-is1w.onrender.com` | Active |
| **API Health Check** | `https://velozity-dashboard-is1w.onrender.com/health` | Active |

---

## 📝 Submission Explanation (150–250 words)

> **Submission Field Requirement:** The hardest problem solved, real-time role-filtered feed architecture, and one thing done differently.

The most demanding challenge was establishing bulletproof data isolation across the three distinct roles (Admin, Project Manager, Developer) without leaking sensitive details either in database queries or WebSocket streams. Ensuring a developer could only receive real-time feed updates and task items specifically assigned to them—while simultaneously preventing access to other developers' assignments or cross-PM projects—required strict multi-tiered authorization and granular WebSocket room routing (`user:<id>`, `role:ADMIN`). Having built a similar real-time TypeScript dashboard recently, writing the core business logic, schema migrations, and REST APIs felt very familiar and went smoothly.

However, deploying on free-tier infrastructure introduced distinct operational hurdles: Render's free compute spins down on inactivity, causing cold starts and intermittent WebSocket disconnects, while cross-origin HttpOnly cookies required fine-tuned SameSite/Secure headers to work reliably between Vercel and Render.

If I were to do one thing differently, I would decouple the scheduled overdue task runner and WebSocket event dispatching using Redis Pub/Sub and BullMQ instead of in-process node-cron and Socket.io memory adapters. This would allow the backend to scale horizontally across multiple container instances while seamlessly retaining real-time synchronization.

---

## 📐 Architectural Decisions

### 1. Real-Time Library: Socket.io vs. Native WebSocket
- **Decision:** **Socket.io**
- **Justification:** Socket.io provides automatic reconnection, built-in room abstractions (`role:ADMIN`, `user:<id>`, `project:<id>`), and fallback to HTTP long-polling when corporate firewalls or proxy layers block raw WebSocket upgrades. Rooms made role-filtered live event fanout concise, secure, and maintainable.

### 2. Job Scheduling: node-cron vs. Bull Queue
- **Decision:** **node-cron**
- **Justification:** For single-instance agency deployments, `node-cron` offers lightweight scheduling without introducing external infrastructure overhead (like a standalone Redis instance). It runs a periodic sweep every 5 minutes to mark past-due tasks as `isOverdue` and trigger real-time alert broadcasts.
- *Scale-out path:* For distributed multi-server scaling, BullMQ with Redis is documented as the ideal upgrade.

### 3. Token Storage & Authentication Security
- **Decision:** **Dual-Token Architecture (Access Token in Memory/Header + Refresh Token in HttpOnly Cookie)**
- **Justification:** 
  - Short-lived Access Token (15m expiry) is kept in client memory / headers to defend against CSRF attacks.
  - Long-lived Refresh Token (7d expiry) is stored in an `HttpOnly`, `Secure`, `SameSite=None` cookie inaccessible to client JavaScript, mitigating XSS token theft.
  - Automatic silent renewal is orchestrated via Axios response interceptors on `401 Unauthorized` responses.

---

## 🗄️ Database Schema & Indexing Decisions

### Schema Overview

```
User (id [PK, UUID], name, email [UQ], password, role [ADMIN|PROJECT_MANAGER|DEVELOPER], createdAt, updatedAt)
  │
  ├─ 1:N ── Project (pmId)
  ├─ 1:N ── Task (developerId)
  ├─ 1:N ── Activity (userId)
  └─ 1:N ── Notification (userId)

Client (id [PK, UUID], name, email [UQ], company, createdAt, updatedAt)
  │
  └─ 1:N ── Project (clientId)

Project (id [PK, UUID], title, description, clientId [FK], pmId [FK], createdAt, updatedAt)
  │
  ├─ 1:N ── Task (projectId)
  └─ 1:N ── Activity (projectId)

Task (id [PK, Int], title, description, status [TODO|IN_PROGRESS|IN_REVIEW|DONE], priority [LOW|MEDIUM|HIGH|CRITICAL], dueDate, isOverdue, projectId [FK], developerId [FK], createdAt, updatedAt)
  │
  └─ 1:N ── Activity (taskId)

Activity (id [PK, UUID], action, description, oldStatus, newStatus, taskId [FK], projectId [FK], userId [FK], createdAt)

Notification (id [PK, UUID], userId [FK], title, message, link, isRead, createdAt)
```

### Indexing Decisions

| Table | Indexed Column(s) | Indexing Rationale |
|---|---|---|
| `User` | `email` | Primary authentication identifier lookups during login. |
| `User` | `role` | Role-based permission checks and presence counting. |
| `Project` | `pmId` | Scoping projects to their owning Project Manager. |
| `Project` | `clientId` | Fast joins between clients and project portfolios. |
| `Task` | `projectId` | Board and list queries scoped to a specific project. |
| `Task` | `developerId` | Filtering tasks strictly assigned to the authenticated developer. |
| `Task` | `status`, `priority` | Sorting and query filtering by workflow state and urgency. |
| `Task` | `dueDate`, `isOverdue` | High-frequency scanning for the overdue background cron job. |
| `Activity` | `(projectId, createdAt)` | Timeline reconstruction and real-time missed event catch-up. |
| `Activity` | `createdAt DESC` | Global pagination for Admin activity auditing. |
| `Notification` | `(userId, isRead)` | Instant count queries for unread user badge notifications. |

---

## 🚀 Local Setup Instructions

### Option A: Using Docker (Recommended)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Heisme001/velozity-dashboard.git
   cd velozity-dashboard
   ```

2. **Configure environment:**
   ```bash
   cp backend/.env.example backend/.env
   ```

3. **Start all services with Docker Compose:**
   ```bash
   docker compose up --build
   ```

4. **Seed sample data inside the container:**
   ```bash
   docker compose exec backend npx ts-node prisma/seed.ts
   ```

5. **Access the application:**
   - Frontend: [http://localhost:5173](http://localhost:5173)
   - Backend API: [http://localhost:5000/api](http://localhost:5000/api)
   - Health Endpoint: [http://localhost:5000/health](http://localhost:5000/health)

---

### Option B: Manual Local Setup

#### 1. PostgreSQL Database
```bash
docker run --name velozity_postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgrespassword \
  -e POSTGRES_DB=velozity_db \
  -p 5432:5432 -d postgres:15-alpine
```

#### 2. Backend Service
```bash
cd backend
npm install
cp .env.example .env
npx prisma migrate dev --name init
npx ts-node prisma/seed.ts
npm run dev
```

#### 3. Frontend Application
```bash
cd frontend
npm install
npm run dev
```

---

## 👥 Demo Accounts (Password: `Password@123`)

| Role | Email | Permissions Scope |
|---|---|---|
| **Admin** | `admin@velozity.com` | Full global access across all projects, clients, and activity. |
| **Project Manager** | `ravi.pm@velozity.com` | Manages own projects, assigns tasks, receives In-Review notifications. |
| **Project Manager** | `ananya.pm@velozity.com` | Manages separate projects (isolated from Ravi's projects). |
| **Developer** | `priya.dev@velozity.com` | Sees only assigned tasks, updates task statuses, scoped activity feed. |
| **Developer** | `siddharth.dev@velozity.com` | Developer assigned to distinct tasks. |

---

## ⚠️ Known Limitations

1. **Free Tier Cold Starts & Idle Disconnects:**
   Deployments hosted on Render free tier spin down after 15 minutes of inactivity. The initial wake-up request can take 30–50 seconds, during which WebSocket handshakes will temporarily retry before succeeding.
2. **In-Memory Socket Adapter:**
   Socket.io is currently configured with the default memory adapter. Running multiple backend instances requires attaching `@socket.io/redis-adapter` with a Redis broker to share broadcast rooms.
3. **Cross-Origin Cookie Policies on Strict Privacy Browsers:**
   Third-party cookie restrictions in certain browsers (e.g., Safari ITP or Brave) may occasionally block cross-domain refresh token cookies when the frontend (`vercel.app`) and backend (`onrender.com`) are on different root domains.
