import express, { type Express } from 'express';
import helmet from 'helmet';
import { getDb } from './database.js';
import { attachAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRouter from './routes/auth.js';
import candidatesRouter from './routes/candidates.js';
import jobsRouter from './routes/jobs.js';
import resumesRouter from './routes/resumes.js';
import analyticsRouter from './routes/analytics.js';
import matchesRouter from './routes/matches.js';
import settingsRouter from './routes/settings.js';
import aiRouter from './routes/ai.js';
import paymentsRouter from './routes/payments.js';
import screeningRouter from './routes/screening.js';
import candidatePortalRouter from './routes/candidatePortal.js';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );

  // Capture raw request body exclusively for Razorpay webhook HMAC verification before JSON parsing.
  app.use('/api/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(attachAuth);

  app.get('/api/health', (_req, res) => {
    let database = 'unavailable';
    try {
      getDb().prepare('SELECT 1 AS ok').get();
      database = 'ok';
    } catch {
      database = 'unavailable';
    }
    res.status(200).json({
      status: 'ok',
      service: 'TalentIQ API',
      version: '2.0.0',
      database,
      aiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      razorpayConfigured: Boolean(process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim()),
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/candidates', candidatesRouter);
  app.use('/api/jobs', jobsRouter);
  app.use('/api/resumes', resumesRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/matches', matchesRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/screening', screeningRouter);
  app.use('/api/candidate', candidatePortalRouter);
  app.use('/api', notFoundHandler);

  return app;
}

export function addErrorHandler(app: Express): void {
  app.use(errorHandler);
}
