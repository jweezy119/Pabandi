import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { CustomError } from './errorHandler';
import type { CrmContext } from './crmContext.middleware';

// Extend Express globally so passport + our auth middleware agree on the type
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      role: string;
    }
  }
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
  /**
   * Business context, attached by `resolveCrmBusiness`.
   *
   * Declared here rather than via `declare global { namespace Express }` on
   * purpose: ts-node compiles per-file, and a global `Request` augmentation in a
   * separately-imported module can shadow `Express.User` for files that are
   * compiled before the augmentation is in scope. Extending the already-exported
   * `AuthRequest` keeps the augmentation local to the file that declares it.
   */
  crm?: CrmContext;
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new CustomError('No token provided', 401);
    }

    const token = authHeader.substring(7);

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, secret) as {
      id: string;
      email: string;
      role: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
    };

    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new CustomError('Invalid token', 401));
    } else {
      next(error);
    }
  }
};

export const optionalAuthenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, secret) as {
      id: string;
      email: string;
      role: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
    };

    req.user = decoded;
    next();
  } catch (error) {
    // Treat invalid tokens as unauthenticated instead of crashing
    next();
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new CustomError('Authentication required', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new CustomError(
          `Access denied. Required role: ${roles.join(' or ')}`,
          403
        )
      );
    }

    next();
  };
};
