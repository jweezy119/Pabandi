import { AsyncLocalStorage } from 'async_hooks';

/**
 * Request-scoped tenant context.
 *
 * Holds the `businessId` for the current request so that every layer of the
 * application (Prisma, services, controllers) can resolve which tenant is
 * acting without threading the id through every function signature.
 *
 * The context is set by `server/src/middleware/tenant.middleware.ts` (attachTenant)
 * and consumed by `server/src/lib/prisma.ts` (createTenantClient).
 */
export interface TenantContext {
  /** Platform `Business` id — the join key for all cross-layer reads. */
  businessId: string;
}

export const tenantContext = new AsyncLocalStorage<TenantContext>();

/**
 * Run a callback with the given tenant context active.
 *
 * Any code executed inside the callback (including async continuations) can
 * read `tenantContext.getStore()` and see `{ businessId }`.
 */
export function withTenant<T>(businessId: string, cb: () => T): T {
  return tenantContext.run({ businessId }, cb);
}

/**
 * Read the current tenant context.
 *
 * Returns null when called outside of a request that has set the context
 * (e.g. in background jobs, scripts, or tests that didn't wrap their calls).
 */
export function getTenantContext(): TenantContext | null {
  return tenantContext.getStore() ?? null;
}
