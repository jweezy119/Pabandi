import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { unwrapList, readList } from './crmResponse';

/**
 * The error boundary the Activities page kept hitting.
 *
 * `/crm/activities` and `/crm/tasks` answer with a bare array on success and
 * `{ error }` on failure — while every other CRM endpoint uses `{ success, data }`.
 * Two response shapes for one job, and four call sites got it wrong in opposite
 * directions.
 *
 * The reported symptom was the generic error boundary: "This page ran into a
 * problem. Something failed while drawing the page." No console error, nothing
 * actionable. The mechanism:
 *
 *   setActivities(await res.json())          // no status check
 *   const filtered = activities.filter(...)  // next line
 *
 * An expired token returns 401 with `{error}`, so `activities` became an object,
 * `.filter` is not a function, and the render threw. The console said nothing
 * because nothing had failed loudly — the request succeeded in returning an error.
 *
 * The opposite bug: two detail pages read `.data`, which is undefined on a bare
 * array, so those activity timelines were permanently empty and never showed an
 * error at all.
 */

const ok = (body: unknown) => ({ ok: true, json: async () => body });
const fail = () => ({ ok: false, json: async () => ({ error: 'Invalid token' }) });

describe('unwrapList', () => {
  it('accepts the bare array that /crm/activities and /crm/tasks return', () => {
    expect(unwrapList([{ id: 1 }, { id: 2 }])).toHaveLength(2);
  });

  it('accepts the { data } envelope every other endpoint uses', () => {
    expect(unwrapList({ success: true, data: [{ id: 1 }] })).toHaveLength(1);
  });

  it('returns an array for an error body rather than the error body', () => {
    // THE regression. Returning the payload here is what put an object into state
    // and made .filter throw.
    const result = unwrapList({ error: 'Invalid token' });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });

  it('returns an array for null, undefined and nonsense', () => {
    for (const input of [null, undefined, 0, '', 'nope', { data: null }]) {
      expect(Array.isArray(unwrapList(input)), String(input)).toBe(true);
    }
  });
});

describe('readList', () => {
  it('reads the list when the request succeeded', async () => {
    expect((await readList(ok([{ id: 'a' }]))).items).toHaveLength(1);
  });

  it('returns an empty list and ok:false when the request failed', async () => {
    const r = await readList(fail());
    expect(r.items).toEqual([]);
    expect(r.ok).toBe(false);
  });

  it('never puts an error body into state, whatever the status', async () => {
    // Both routers answer errors with a real status code, so this path is
    // defensive rather than expected — but the point is the list, not the flag:
    // an error body reaching state is what made .filter throw.
    const r = await readList(ok({ error: 'No service business enrolled for this account' }));
    expect(r.items).toEqual([]);
    expect(Array.isArray(r.items)).toBe(true);
  });

  it('survives a body that is not JSON', async () => {
    const r = await readList({ ok: true, json: async () => { throw new Error('bad json'); } });
    expect(r.items).toEqual([]);
    expect(r.ok).toBe(false);
  });
});

describe('no call site reads a CRM list by hand any more', () => {
  const root = process.cwd();
  const read = (p: string) => readFileSync(join(root, 'src', p), 'utf8');

  it.each([
    'pages/crm/ContactActivitiesPage.tsx',
    'pages/crm/ContactTasksPage.tsx',
    'pages/contact/ContactClientDetailPage.tsx',
    'pages/contact/ContactDealDetailPage.tsx',
  ])('%s goes through readList for its activities', (file) => {
    const src = read(file);
    expect(src, `${file} should use readList`).toContain('readList');

    // Scoped to the activity/task reads on purpose. The invoices, deals, jobs and
    // files on these same pages DO answer with {data}, so `.data` is right there —
    // a blanket ban would have been wrong.
    const activityRead = /activities?[^\n]*json\(\)[^\n]*/gi.exec(src) || [];
    for (const line of activityRead) {
      expect(line, `${file} reads an activity list without readList`).toContain('readList');
    }

    // And the unchecked-assignment shape that produced the crash.
    expect(src, `${file} still assigns an unchecked json() to state`)
      .not.toMatch(/set\w+\(await \w+Res\.json\(\) \|\| \[\]\)/);
  });
});