/**
 * Compatibility shim for `../middleware/auth`.
 *
 * WHY THIS FILE EXISTS
 * `invoice.routes.ts` and `support.routes.ts` both import `requireAuth` from
 * `../middleware/auth`, but that module was never created — only
 * `auth.middleware.ts` is. Node resolves the import at load time, so the
 * dynamic `import()` in index.ts rejected and both mounts answered every
 * request with a 500:
 *
 *   /api/v1/invoices  — the whole authenticated invoice API
 *   /api/v1/support   — the support ticket API
 *
 * The route is mounted and looks healthy, which is why this went unnoticed:
 * the failure is a module-resolution error inside a lazily-loaded router, not
 * a missing route.
 *
 * The real implementation stays in `auth.middleware.ts`. This file only
 * re-exports, so there is exactly one `authenticate` implementation and the two
 * import styles cannot drift. New code should import from
 * `auth.middleware` directly; this alias exists so the two existing importers
 * resolve.
 */
export {
  authenticate,
  optionalAuthenticate,
  authorize,
} from './auth.middleware';
export type { AuthRequest } from './auth.middleware';

import { authenticate } from './auth.middleware';

/**
 * Alias for `authenticate`, for the call sites that used the `requireAuth`
 * name. Identical behaviour: a missing or invalid Bearer token is a 401.
 */
export const requireAuth = authenticate;
