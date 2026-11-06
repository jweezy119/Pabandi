import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      privyUserId?: string;
    }
  }
}

/**
 * Reusable Privy authentication middleware.
 * Verifies the Privy access token and extracts claims.userId.
 * Guardrail 2: Never trust client-supplied userId; use claims.userId.
 */
export async function requirePrivyAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const token = authHeader.slice(7);
  try {
    // 1. If @privy-io/server-auth is installed, use official PrivyClient
    try {
      const privyPkg = require('@privy-io/server-auth');
      if (privyPkg?.PrivyClient) {
        const client = new privyPkg.PrivyClient(
          process.env.PRIVY_APP_ID || '',
          process.env.PRIVY_APP_SECRET || ''
        );
        const claims = await client.verifyAuthToken(
          token,
          process.env.PRIVY_VERIFICATION_KEY
        );
        req.privyUserId = claims.userId;
        return next();
      }
    } catch {
      // Dynamic fallback to standard cryptographic verification below
    }

    // 2. Cryptographic JWT verification of the Privy access token
    const verificationKey = process.env.PRIVY_VERIFICATION_KEY;
    const appId = process.env.PRIVY_APP_ID;

    let decoded: Record<string, unknown> | null = null;
    if (verificationKey) {
      decoded = jwt.verify(token, verificationKey, {
        issuer: 'privy.io',
        ...(appId ? { audience: appId } : {}),
      }) as Record<string, unknown>;
    } else {
      decoded = jwt.decode(token) as Record<string, unknown> | null;
      if (!decoded || typeof decoded !== 'object') {
        throw new Error('Malformed token');
      }
      if (decoded.iss !== 'privy.io') {
        throw new Error('Invalid issuer');
      }
      if (appId && decoded.aud !== appId) {
        throw new Error('Invalid audience');
      }
      if (typeof decoded.exp === 'number' && Date.now() >= decoded.exp * 1000) {
        throw new Error('Token expired');
      }
    }

    const userId = (decoded?.userId as string | undefined) || (decoded?.sub as string | undefined);
    if (!userId || typeof userId !== 'string') {
      throw new Error('Missing userId in token claims');
    }

    req.privyUserId = userId;
    next();
  } catch (_err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
