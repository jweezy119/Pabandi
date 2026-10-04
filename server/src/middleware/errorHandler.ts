import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export class CustomError extends Error implements AppError {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Log error
  logger.error({
    error: {
      message: err.message,
      stack: err.stack,
      statusCode,
      path: req.path,
      method: req.method,
    },
  });

  // Send error response
  res.status(statusCode).json({
    success: false,
    message,
    // Carried through so a refusal can be actionable. A schedule clash attaches the
    // clashing jobs to the error; without this the client sees a bare 409 and cannot tell
    // the user what is in the way. Only ever set by the code that raises it.
    ...(Array.isArray((err as unknown as { conflicts?: unknown })?.conflicts)
      ? { conflicts: (err as unknown as { conflicts: unknown[] }).conflicts }
      : {}),
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      error: err,
    }),
  });
};
