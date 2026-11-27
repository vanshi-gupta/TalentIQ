import type { NextFunction, Request, Response } from 'express';
import { AppError } from './errorHandler.js';
import { SESSION_COOKIE_NAME, verifySessionToken } from '../services/authService.js';
import type { User, UserRole } from '../types.js';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      sessionToken?: string;
    }
  }
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

export function extractTokenFromRequest(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE_NAME] ?? null;
}

export function attachAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractTokenFromRequest(req);
  if (token) {
    const user = verifySessionToken(token);
    if (user) {
      req.user = user;
      req.sessionToken = token;
    }
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new AppError(401, 'UNAUTHORIZED', 'Please sign in to access this resource.'));
    return;
  }
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, 'UNAUTHORIZED', 'Please sign in to access this resource.'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action.'));
      return;
    }
    next();
  };
}

interface RateBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateBucket>();

export function rateLimit(options: { windowMs: number; max: number; keyPrefix: string }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (process.env.NODE_ENV === 'test' && req.headers['x-enable-rate-limit'] !== 'true') {
      next();
      return;
    }
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${options.keyPrefix}:${ip}`;
    const now = Date.now();
    const existing = buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }
    if (existing.count >= options.max) {
      const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      next(new AppError(429, 'RATE_LIMITED', 'Too many requests. Please wait a moment and try again.'));
      return;
    }
    existing.count += 1;
    next();
  };
}
