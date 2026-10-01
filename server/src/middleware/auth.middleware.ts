import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { CustomError } from './errorHandler';
import { tenantContext } from '../lib/prisma';

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      role: string;
      businessId?: string;
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
    /**
     * The tenant this request may act on. Signed into the JWT at login and
     * re-signed on every mode switch, so the client and the server agree on
     * which business a session belongs to.
     */
    businessId?: string;
    /**
     * Legacy alias for the same value. Older tokens were issued before the
     * claim was renamed, so both are accepted when resolving a tenant.
     */
    activeBusinessId?: string;
    /** The account mode the token was issued for. */
    mode?: string;
  };
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
      businessId?: string;
      activeBusinessId?: string;
      activeMode?: string;
      mode?: string;
    };

    // Older tokens carried the tenant as `activeBusinessId`; current ones carry
    // it as `businessId`. Normalise so every downstream reader sees one field
    // regardless of which token version presented.
    const businessId = decoded.businessId ?? decoded.activeBusinessId;
    req.user = { ...decoded, businessId };

    if (businessId) {
      tenantContext.run({ businessId }, () => next());
    } else {
      next();
    }
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
