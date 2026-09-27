import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from './config';
import { checkPostgresHealth, prisma } from './services/prisma';
import { checkRedisHealth, redisConnection } from './services/redis';
import { checkElasticsearchHealth, ensureEmailsIndex } from './services/elasticsearch';
import { recoverJobs } from './bootstrap/recoverJobs';
import { createEmailWorker } from './workers/emailWorker';
import { emailQueue } from './queues/emailQueue';
import emailRoutes from './routes/emailRoutes';
import adminRoutes, { serverAdapter } from './routes/adminRoutes';
import authRoutes from './routes/auth';
import slackRoutes from './routes/slack';
import sendersRoutes from './routes/senders';
import { HealthCheckResponse } from '@reachinbox/types';
import passport from 'passport';
import { sessionMiddleware } from './middleware/session';
import { requireAuth } from './middleware/requireAuth';
import './config/passport';

const app = express();

// Trust Render's TLS-terminating reverse proxy so secure cookies work
app.set('trust proxy', 1);

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());

app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

// BullMQ Dashboard
app.use(
  '/admin/queues',
  (req, res, next) => {
    if (typeof req.isAuthenticated === 'function' && req.isAuthenticated()) return next();
    return res.status(401).send(
      '<h2>Please <a href="/api/auth/google">login</a> first</h2>'
    );
  },
  serverAdapter.getRouter()
);
app.use('/admin', adminRoutes);

// Auth routes
app.use('/api/auth', authRoutes);

// Slack OAuth & Status routes
app.use('/api/slack', (req, res, next) => {
  if (req.path === '/oauth/callback') return next();
  return requireAuth(req, res, next);
}, slackRoutes);

// Senders API
app.use('/api/senders', requireAuth, sendersRoutes);

// Email Scheduler API
app.use('/api/emails', requireAuth, emailRoutes);

// Root Info Route
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'ReachInbox Email Job Scheduler API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      schedule: 'POST /api/emails/schedule',
      scheduled: 'GET /api/emails/scheduled',
      sent: 'GET /api/emails/sent',
      search: 'GET /api/emails/search',
      adminQueues: '/admin/queues',
    },
  });
});

// Comprehensive Health Endpoint
app.get('/api/health', async (_req: Request, res: Response) => {
  const [postgres, redis, elasticsearch] = await Promise.all([
    checkPostgresHealth(),
    checkRedisHealth(),
    checkElasticsearchHealth(),
  ]);

  const isHealthy =
    postgres.status === 'healthy' &&
    redis.status === 'healthy' &&
    elasticsearch.status === 'healthy';

  const isDegraded =
    !isHealthy &&
    (postgres.status === 'healthy' ||
      redis.status === 'healthy' ||
      elasticsearch.status === 'healthy');

  const healthResponse: HealthCheckResponse = {
    status: isHealthy ? 'ok' : isDegraded ? 'degraded' : 'down',
    timestamp: new Date().toISOString(),
    services: {
      postgres,
      redis,
      elasticsearch,
    },
  };

  const statusCode = isHealthy ? 200 : isDegraded ? 207 : 503;
  res.status(statusCode).json(healthResponse);
});

let emailWorker: ReturnType<typeof createEmailWorker> | null = null;

async function bootstrap() {
  try {
    // 1. Ensure Elasticsearch Index exists
    await ensureEmailsIndex();

    // 2. Run Crash Recovery before worker starts
    await recoverJobs();

    // 3. Start BullMQ Email Worker
    emailWorker = createEmailWorker();
    console.log(`[ReachInbox] BullMQ Worker started with concurrency: ${config.workerConcurrency}`);

    // 4. Start HTTP Server
    const server = app.listen(config.port, () => {
      console.log(`[ReachInbox Backend] Server listening on http://localhost:${config.port}`);
      console.log(`[ReachInbox Backend] Admin BullMQ Dashboard: http://localhost:${config.port}/admin/queues`);
    });

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n[ReachInbox Backend] Received ${signal}. Gracefully shutting down...`);
      if (emailWorker) {
        await emailWorker.close();
      }
      await emailQueue.close();
      await redisConnection.quit();
      await prisma.$disconnect();
      server.close(() => {
        console.log('[ReachInbox Backend] Server closed.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error: any) {
    console.error('[ReachInbox Backend] Bootstrap fatal error:', error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  bootstrap();
}

export default app;
