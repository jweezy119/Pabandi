import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

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
    // 1. Official PrivyClient verification (JWKS-backed signature check).
    //
    // The package-missing case and the token-invalid case must NOT share a
    // catch. They used to: `catch {}` here swallowed every error from
    // verifyAuthToken — including a bad signature — and fell through to step 2,
    // which calls jwt.decode() when PRIVY_VERIFICATION_KEY is unset. jwt.decode
    // checks exp/iss/aud but NEVER the signature, so an attacker who signed
    // their own ES256 token with iss:'privy.io' and this app's aud was accepted
    // as any user they named in `sub`. Verified against this middleware: a
    // forged token reached next() with an attacker-chosen privyUserId.
    //
    // Only MODULE_NOT_FOUND may fall through. Anything else means the token
    // was presented and rejected: that is an authentication failure, not a
    // missing dependency.
    let privyPackageMissing = false;
    let privyPkg: { PrivyClient?: new (a: string, b: string) => {
      verifyAuthToken(t: string, k?: string): Promise<{ userId: string }>;
    } } | undefined;
    try {
      privyPkg = require('@privy-io/server-auth');
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code === 'MODULE_NOT_FOUND') {
        privyPackageMissing = true;
      } else {
        throw err;
      }
    }

    if (!privyPackageMissing && privyPkg?.PrivyClient) {
      const client = new privyPkg.PrivyClient(
        process.env.PRIVY_APP_ID || '',
        process.env.PRIVY_APP_SECRET || ''
      );
      // Empty second arg is deliberate: verifyAuthToken then resolves the key
      // itself from getAppSettings()/JWKS, so a misconfigured env var cannot
      // silently downgrade verification.
      const claims = await client.verifyAuthToken(
        token,
        process.env.PRIVY_VERIFICATION_KEY || undefined
      );
      req.privyUserId = claims.userId;
      return next();
    }

    // 2. Fallback — only reachable when @privy-io/server-auth is not installed.
    //
    // Signature verification is mandatory here. jwt.verify without a key is
    // impossible, and jwt.decode is not verification at all, so a missing
    // PRIVY_VERIFICATION_KEY is a hard 401 rather than an implicit downgrade
    // to accepting unsigned tokens.
    const verificationKey = process.env.PRIVY_VERIFICATION_KEY;
    const appId = process.env.PRIVY_APP_ID;

    if (!verificationKey) {
      logger.error(
        '[PrivyAuth] @privy-io/server-auth is not installed and PRIVY_VERIFICATION_KEY is unset — ' +
          'cannot verify token signatures. Refusing to accept unverifiable tokens.'
      );
      return res.status(401).json({ error: 'Invalid token' });
    }

    const decoded = jwt.verify(token, verificationKey, {
      issuer: 'privy.io',
      ...(appId ? { audience: appId } : {}),
    }) as Record<string, unknown>;

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
