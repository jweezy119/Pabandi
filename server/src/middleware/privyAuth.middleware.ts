import { Request, Response, NextFunction } from 'express';
import { PrivyClient } from '@privy-io/server-auth';

declare global {
  namespace Express {
    interface Request {
      privyUserId?: string;
    }
  }
}

const appId = process.env.PRIVY_APP_ID || '';
const appSecret = process.env.PRIVY_APP_SECRET || '';

export const privy = new PrivyClient(appId, appSecret);

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
    const claims = await privy.verifyAuthToken(
      token,
      process.env.PRIVY_VERIFICATION_KEY
    );
    req.privyUserId = claims.userId;
    next();
  } catch (_err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
