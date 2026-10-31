import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

/**
 * Daily per-user AI spend cap.
 *
 * The burst limiter (aiRateLimiter) stops stampedes; it does NOT stop the
 * slow bleed: 19 calls a minute, every minute, all day, from one account is
 * thousands of paid completions. Every provider call costs real credits, so
 * an abusive or runaway client is a money outage waiting to happen — the cap
 * makes the worst case per user known and finite.
 *
 * Kept in-process rather than a DB counter: the API commonly runs a single
 * instance; the point is ending unlimited burn, not exact accounting. Multi-
 * instance deployment would undercount slightly — acceptable for a cap.
 */
const DAILY_LIMIT = Number(process.env.AI_DAILY_CALL_LIMIT || 200);

const counts = new Map<string, { day: string; calls: number }>();

const today = () => new Date().toISOString().slice(0, 10);

export const aiSpendGuard = (req: Request, res: Response, next: NextFunction) => {
  const { user } = req as AuthRequest;
  if (!user?.id) {
    // authenticate already ran; a missing user here would be misconfiguration,
    // and failing open on it would silently disable the mergeable cap.
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const day = today();
  const entry = counts.get(user.id);
  if (!entry || entry.day !== day) {
    counts.set(user.id, { day, calls: 1 });
  } else {
    entry.calls += 1;
    if (entry.calls > DAILY_LIMIT) {
      // 429 with a retry the client can actually honor: the counter resets at
      // midnight UTC like a utility meter, not a rolling window.
      return res.status(429).json({
        success: false,
        error: 'Daily AI allowance reached. Resets at midnight UTC.',
        retryAfterUtcMidnight: true,
      });
    }
  }

  // Bounded memory: identities never expire from npm caches here, so the map
  // would grow forever. Prune days after midnight UTC rolls.
  if (counts.size > 5000) {
    for (const [id, e] of counts) {
      if (e.day !== day) counts.delete(id);
    }
  }

  return next();
};
