import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

dotenv.config();

import { connectDB, disconnectDB } from './db.js';
import { requireAuth } from './auth.js';
import { initSocket } from './socket.js';
import { startReminderScheduler } from './reminders.js';
import { User } from './models.js';
import { sanitizeString, validateEmail, validatePassword } from './middleware.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import chatRoutes from './routes/chat.js';
import meetingRoutes from './routes/meetings.js';
import goalRoutes from './routes/goals.js';
import feedbackRoutes from './routes/feedback.js';
import notificationRoutes from './routes/notifications.js';
import statsRoutes from './routes/stats.js';
import matchingRoutes from './routes/matchings.js';
import progressRoutes from './routes/progress.js';

const PORT = process.env.PORT || 5000;

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ALLOWED_ORIGINS
      ? process.env.CORS_ALLOWED_ORIGINS.split(',')
      : ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  })
);

app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    scriptSrc: ["'self'"],
    connectSrc: ["'self'", 'ws://localhost:5000', 'http://localhost:5000'],
    imgSrc: ["'self'", 'data:', 'blob:'],
    frameSrc: ["'self'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    // Report URI for CSP violations
    reportUri: '/api/csp-report',
  },
}));

app.use(cookieParser());

// CSP report rate limiter
const cspLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Too many CSP reports from this IP.' },
});
app.use('/api/csp-report', cspLimiter);
app.post('/api/csp-report', (req, res) => {
  // Validate and limit report payload
  const report = req.body;
  if (!report || !report['csp-report']) {
    return res.status(400).json({ error: 'Invalid CSP report format' });
  }
  // Log only safe metadata; never log full URLs or credentials
  const blockedUri = report['csp-report'].blockedUri ? '[redacted]' : 'N/A';
  console.log('[csp-report] Directive:', report['csp-report'].directive);
  console.log('[csp-report] Effect:', report['csp-report'].effect);
  console.log('[csp-report] Blocked-URI (safe subset):', blockedUri);
  res.status(204).send();
});

// Stricter rate limits for authentication endpoints
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts from this IP, please try again later.' },
});
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many registration attempts from this IP, please try again later.' },
});
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { error: 'Too many password reset attempts from this IP, please try again later.' },
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/auth/forgot', passwordResetLimiter);

// General API rate limit
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP, please try again later.' },
});
app.use('/api', generalLimiter);
app.use(express.json({ limit: '1mb' }));

// Input sanitization middleware
app.use((req, res, next) => {
  // Sanitize string query parameters
  if (req.query && typeof req.query === 'object') {
    for (const key of Object.keys(req.query)) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeString(req.query[key]);
      }
    }
  }
  // Sanitize string body parameters
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeString(req.body[key]);
      }
    }
  }
  next();
});

app.get('/api/health', async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? 'connected' : dbState === 0 ? 'disconnected' : 'connecting/disconnecting';
  res.json({ ok: dbState === 1, database: dbStatus, name: 'App for Hand Holding API' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/matchings', matchingRoutes);
app.use('/api/progress', progressRoutes);

app.get('/api/protected', requireAuth, (req, res) => res.json({ userId: req.userId, role: req.userRole }));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

async function main() {
  await connectDB();

  // Seed only when explicitly enabled. In production, never auto-seed unless
  // SEED is explicitly set to 'true' (prevents accidental demo data creation).
  const seedEnabled =
    process.env.SEED === 'true' ||
    (process.env.NODE_ENV !== 'production' && process.env.SEED !== 'false');
  if (seedEnabled) {
    const count = await User.countDocuments();
    if (count === 0) {
      const { seed } = await import('./seed.js');
      await seed();
    }
  }

  const server = http.createServer(app);
  initSocket(server);
  startReminderScheduler();

  server.listen(PORT, () => {
    console.log(`[server] API + Socket.io listening on http://localhost:${PORT}`);
  });

  const shutdown = async () => {
    server.close();
    await disconnectDB();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});