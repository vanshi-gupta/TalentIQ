import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';

export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `No API route matches ${req.method} ${req.originalUrl}.`,
    },
  });
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) return;

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Please check the highlighted fields and try again.',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (error instanceof multer.MulterError) {
    const isSize = error.code === 'LIMIT_FILE_SIZE';
    res.status(400).json({
      error: {
        code: isSize ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR',
        message: isSize ? 'The file is larger than the allowed upload size.' : error.message,
      },
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    });
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  if (/UNIQUE constraint failed/i.test(message)) {
    res.status(409).json({
      error: {
        code: 'DUPLICATE_RECORD',
        message: /email/i.test(message)
          ? 'A candidate with this email already exists.'
          : 'A record with these values already exists.',
      },
    });
    return;
  }

  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'The request body contains invalid JSON.' },
    });
    return;
  }

  const isProduction = process.argv.includes('--production') || process.env.NODE_ENV === 'production';
  if (!isProduction) console.error(error);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on the server. Please try again.',
      ...(isProduction ? {} : { details: message }),
    },
  });
}
