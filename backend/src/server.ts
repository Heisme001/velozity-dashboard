import express from 'express';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { apiRouter } from './routes/api';
import { socketManager } from './socket/socketManager';
import { startOverdueTaskCron } from './cron/overdueJob';
import { errorHandler } from './middleware/errorHandler';

dotenv.config({ override: true });

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

// Dynamic CORS – accepts any origin in dev; in prod set FRONTEND_URL
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, curl, mobile apps)
    // and any web origin.  For production, swap to:
    //   origin: process.env.FRONTEND_URL
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// REST API
app.use('/api', apiRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler (must be last)
app.use(errorHandler);

// Initialize Socket.io
socketManager.init(server);

// Start background cron (overdue task scheduler)
startOverdueTaskCron();

server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Velozity Dashboard Backend running on http://0.0.0.0:${PORT}`);
});
