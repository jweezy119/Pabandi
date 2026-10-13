/**
 * Reading a list out of a CRM response.
 *
 * WHY THIS EXISTS
 * `/crm/activities` and `/crm/tasks` return a bare array:
 *
 *     res.json(activities)     // success
 *     res.json({ error })      // 401 / 403 / 500
 *
 * Every other CRM endpoint returns `{ success, data }`. Two shapes for one job,
 * and three call sites got it wrong in opposite directions:
 *
 *   - ContactActivitiesPage did `setActivities(await res.json())` with no status
 *     check. A single 401 put `{ error: "Invalid token" }` into state, and the
 *     next line calls `activities.filter(...)` — so an expired token rendered the
 *     error boundary: "This page ran into a problem". The console said nothing
 *     useful and the person was told the page was broken.
 *
 *   - ContactClientDetailPage and ContactDealDetailPage did
 *     `(await res.json()).data || []`, which is correct for the envelope shape
 *     and always undefined for a bare array. Those two activity timelines have
 *     therefore been permanently empty, with no error anywhere.
 *
 * One function, so the next caller does not have to know which endpoint is which.
 */

/** The list inside a CRM response, whichever shape the endpoint uses. */
export function unwrapList(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const body = payload as Record<string, unknown>;
    if (Array.isArray(body.data)) return body.data;
  }
  return [];
}

/**
 * A list from a fetched response, or `[]` when it failed.
 *
 * A failed list read is shown as empty rather than as an error, because the pages
 * already have empty states and "you have no activities" is a less alarming thing
 * to read than a failed request. The status is still worth having, so it is
 * returned rather than swallowed.
 */
export async function readList(res: { ok: boolean; json: () => Promise<unknown> }): Promise<{
  items: any[];
  ok: boolean;
}> {
  if (!res.ok) return { items: [], ok: false };
  try {
    return { items: unwrapList(await res.json()), ok: true };
  } catch {
    return { items: [], ok: false };
  }
}