import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

loadEnv({ path: resolve(process.cwd(), '../../.env'), override: false });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { authRouter } from './routes/auth.js';
import { repoRouter } from './routes/repositories.js';
import { jobsRouter } from './routes/jobs.js';
import { webhookRouter } from './routes/webhooks.js';
import { createAgentWorker } from './queue/worker.js';
import { closeRedisConnection } from './queue/redis.js';

const app = express();
const PORT = parseInt(process.env['PORT'] ?? '3001');

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env['APP_URL'] ?? 'http://localhost:3000',
    credentials: true,
  })
);

// Rate limiting
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// For webhooks, we need the raw body for signature verification
app.use('/webhooks', express.raw({ type: 'application/json' }), (req, _res, next) => {
  if (req.body instanceof Buffer) {
    req.body = JSON.parse(req.body.toString());
  }
  next();
});

app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// Routes
app.use('/auth', authRouter);
app.use('/api/repositories', repoRouter);
app.use('/api/jobs', jobsRouter);
app.use('/webhooks', webhookRouter);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[API Error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 IssuePilot API running on http://localhost:${PORT}`);
});

// Start BullMQ worker
const worker = createAgentWorker();
console.log('⚙️  Agent worker started');

// Graceful shutdown
const shutdown = async () => {
  console.log('\n🔄 Shutting down gracefully...');
  server.close();
  await worker.close();
  await closeRedisConnection();
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
