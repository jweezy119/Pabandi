import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * /health is what gets checked after every deploy to answer one question: is the
 * running build the commit I just pushed?
 *
 * It could not answer that. `deployVersion` was a hardcoded string
 * ('2026-09-08-migration-fix-v2') that had not changed while 434 commits landed,
 * so it returned a confident 200 "ok" regardless of what was deployed. A stale
 * green check is worse than no check, because it ends the investigation.
 *
 * These are structural assertions on the source. The real confirmation is
 * comparing `commitSha` against `git rev-parse HEAD` after a deploy, which cannot
 * be done from inside a unit test.
 */

const source = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');

describe('health reports its build identity', () => {
  it('does not hardcode a deploy version', () => {
    // A hardcoded label can never distinguish two deploys, which defeats the point.
    expect(source).not.toMatch(/deployVersion:\s*'/);
    expect(source).toMatch(/deployVersion:\s*process\.env\.RENDER_GIT_COMMIT/);
  });

  it('reports the commit sha separately so it can be compared to HEAD', () => {
    expect(source).toMatch(/commitSha:\s*process\.env\.RENDER_GIT_COMMIT/);
  });

  it('says "unknown" rather than implying a build it cannot confirm', () => {
    // The dangerous failure is a plausible-looking value that is not true. If
    // Render does not inject the sha, the honest answer is that we do not know.
    expect(source).toMatch(/deployVersion:\s*process\.env\.RENDER_GIT_COMMIT \|\| 'unknown'/);
  });

  it('stamps startup time so a stale instance is distinguishable', () => {
    expect(source).toMatch(/PABANDI_STARTED_AT/);
    expect(source).toMatch(/startedAt:\s*process\.env\.PABANDI_STARTED_AT/);
  });
});
