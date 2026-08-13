/**
 * Centralized, LAZY accessors for JWT secrets.
 *
 * WHY: several modules captured `const JWT_SECRET = process.env.JWT_SECRET!` at
 * module-load time. If the env var wasn't present the instant the module was
 * first imported (e.g. during an env-var reconfigure / cold boot), the captured
 * value stayed `undefined` forever, breaking token signing even after the var
 * was later set. Reading it lazily at call time avoids that trap entirely.
 */

import type { Secret } from 'jsonwebtoken';

export function jwtSecret(): Secret {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET not configured');
  return s as Secret;
}

export function jwtRefreshSecret(): Secret {
  const s = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_REFRESH_SECRET / JWT_SECRET not configured');
  return s as Secret;
}

export function jwtExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN || '7d';
}

export function jwtRefreshExpiresIn(): string {
  return process.env.JWT_REFRESH_EXPIRES_IN || '30d';
}
