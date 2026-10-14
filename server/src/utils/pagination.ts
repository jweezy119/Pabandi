import type { Request } from 'express';

/**
 * Pagination for CRM list endpoints.
 *
 * WHY THIS EXISTS
 *
 * Every CRM list was an unbounded `findMany`: clients, deals, jobs, activities and
 * invoices all returned every row the tenant had, and the browser paged the complete
 * array afterwards. At a few thousand clients the dashboard stopped being usable and
 * the database was asked for the whole table on every page load.
 *
 * ── WHY NO PARAMETER MEANS NO LIMIT ──────────────────────────────────────────
 *
 * `page` and `limit` are opt-in. A request without them behaves exactly as before and
 * reports `pagination: null`.
 *
 * That is deliberate rather than lazy. Several callers pass a `clientId` or `dealId`
 * and expect a small, complete list — the client detail page fetches that client's
 * invoices, activities, deals and jobs in parallel, and its timeline paginates
 * client-side. Defaulting to page 1 of 50 would silently truncate those to 50 items
 * and look identical to "you have 50".
 *
 * So the caller opts in. The consequence to watch for is that a list which pages
 * client-side must NOT also be sent `page`/`limit`, or it will page through an
 * already-truncated array. That is the one way this can go wrong, and each migrated
 * page moves its paging to the server in the same change that starts sending the
 * parameters.
 *
 * ── WHY THE COUNT IS CAPPED ──────────────────────────────────────────────────
 *
 * `total` comes from a `count` alongside the page, which is a second query but a
 * cheap one. It is what lets the UI say "showing 41–60 of 1,284" instead of offering a
 * "next" button that eventually leads to an empty page with no explanation.
 */

export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 200;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Pagination {
  skip: number;
  take: number;
  meta: PaginationMeta;
  /** False when the caller sent neither parameter, so nothing was limited. */
  applied: boolean;
}

/**
 * Parse `page` and `limit` off a request.
 *
 * Both are clamped rather than trusted: a negative or zero page would produce a
 * negative offset, and an absent `limit` on a paginated request would mean "all of
 * them" again — which is the bug this exists to fix, so it must not be reachable by
 * omission.
 */
export function parsePagination(query: Record<string, unknown>): Pagination | null {
  const rawPage = query.page;
  const rawLimit = query.limit;

  if (rawPage === undefined && rawLimit === undefined) return null;

  const parsedLimit = Number(rawLimit);
  const parsedPage = Number(rawPage);

  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(Math.floor(parsedLimit), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;

  return {
    skip: (page - 1) * limit,
    take: limit,
    applied: true,
    meta: { page, limit, total: 0, totalPages: 0 },
  };
}

/** Fill in `total` / `totalPages` once the count query has run. */
export function withTotal(pagination: Pagination, total: number): PaginationMeta {
  return {
    ...pagination.meta,
    total,
    totalPages: Math.max(1, Math.ceil(total / pagination.take)),
  };
}

/**
 * Guard against a page number left over from a larger result set.
 *
 * Deleting the last row on page 5 of 5 leaves the user on page 5 with nothing on it
 * and no explanation. Returning the new last page is what every table in the platform
 * does and the only behaviour that is not a dead end.
 */
export function clampPage(page: number, totalPages: number): number {
  return Math.max(1, Math.min(page, totalPages));
}

/** Read pagination off a request, for the handlers that take a typed query. */
export function paginationFrom(req: Request): Pagination | null {
  return parsePagination(req.query as Record<string, unknown>);
}