import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import express, { type Express } from 'express';
import { createApp, addErrorHandler } from './app.js';
import { closeDatabase, initDatabase } from './database.js';

const isProduction = process.argv.includes('--production') || process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT || 5173);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('[TalentIQ] PORT must be an integer between 1 and 65535.');
  process.exit(1);
}

async function start(): Promise<void> {
  initDatabase();
  const app: Express = createApp();
  const httpServer = createServer(app);

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
      },
      appType: 'custom',
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        next();
        return;
      }
      try {
        const templatePath = path.resolve(process.cwd(), 'index.html');
        const template = fs.readFileSync(templatePath, 'utf-8');
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (error) {
        vite.ssrFixStacktrace(error as Error);
        next(error);
      }
    });
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    const indexPath = path.join(distPath, 'index.html');
    if (!fs.existsSync(indexPath)) {
      console.error('[TalentIQ] Production build not found. Run "npm run build" first.');
      process.exit(1);
    }
    app.use(
      express.static(distPath, {
        index: false,
        maxAge: '1h',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
        },
      }),
    );
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(indexPath);
    });
  }

  addErrorHandler(app);
  httpServer.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[TalentIQ] Port ${port} is already in use. Set PORT in .env to a free port.`);
    } else {
      console.error('[TalentIQ] Server error:', error);
    }
    process.exit(1);
  });
  httpServer.listen(port, '0.0.0.0', () => {
    console.log('');
    console.log('  TalentIQ is running');
    console.log(`  → http://localhost:${port}`);
    console.log(`  → API health: http://localhost:${port}/api/health`);
    if (!isProduction) console.log('  → One server · API + Vite middleware · HMR enabled');
    console.log('');
  });

  const shutdown = (signal: string) => {
    console.log(`\n[TalentIQ] ${signal} received. Shutting down…`);
    httpServer.close(() => {
      closeDatabase();
      process.exit(0);
    });
    setTimeout(() => {
      closeDatabase();
      process.exit(0);
    }, 4000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((error) => {
  console.error('[TalentIQ] Failed to start:', error);
  process.exit(1);
});
