import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { splitStatements } from '../src/utils/ddl';

/**
 * The deploy hook's SQL splitter must agree with the tested one.
 *
 * `scripts/ensure-agent-tables.cjs` cannot import `src/utils/ddl.ts` — Render's
 * preDeployCommand runs from the repo root before `npm run compile`, so there is no
 * dist/ to import from. So the logic is ported, and this test is what stops the port
 * drifting.
 *
 * WHY IT MATTERS
 * ---------------
 * The hook used a naive `.split(';')`. Postgres has no `ADD CONSTRAINT IF NOT EXISTS`,
 * so guarded foreign keys must be `DO $$ ... $$` blocks, which contain semicolons. The
 * naive split cut them in half and the hook exited 1 with
 * `unterminated dollar-quoted string`.
 *
 * fee-tables.sql had 8 such statements, so the hook was ALREADY dying on fee-tables.sql
 * and never reached any file listed after it. Deploys kept succeeding only because
 * src/utils/tableBootstrap.ts runs the same SQL at boot with the correct splitter — so
 * the deploy hook was silently providing nothing, and a file added to SQL_FILES but not
 * to tableBootstrap.ts would have been a table that never appeared.
 */

// The hook is CommonJS and runs before the build, so exercise it the way Render does.
const require_ = createRequire(import.meta.url);
const hookSrc = readFileSync(new URL('../scripts/ensure-agent-tables.cjs', import.meta.url), 'utf8');

/** Pulls the ported functions out of the hook source and evaluates them. */
function hookSplit(sql: string): string[] {
  const start = hookSrc.indexOf('function stripComments');
  const end = hookSrc.indexOf('function statementsFor');
  expect(start, 'stripComments not found in the hook').toBeGreaterThan(-1);
  expect(end, 'statementsFor not found in the hook').toBeGreaterThan(-1);
  // eslint-disable-next-line no-new-func
  const factory = new Function(`${hookSrc.slice(start, end)}; return splitStatements;`);
  return factory()(sql);
}

describe('the deploy hook and the runtime agree on statement boundaries', () => {
  it('can actually evaluate the ported splitter out of the hook source', () => {
    // A smoke check on the extraction itself: if the anchors below stop matching, every
    // comparison in this file would silently be comparing nothing.
    expect(hookSplit('SELECT 1; SELECT 2;')).toEqual(['SELECT 1', 'SELECT 2']);
  });

  for (const file of [
    'agent-tables.sql',
    'reconciliation-tables.sql',
    'fee-tables.sql',
    'sms-provider-tables.sql',
  ]) {
    it(`splits ${file} identically in both implementations`, () => {
      const sql = readFileSync(new URL(`../sql/${file}`, import.meta.url), 'utf8');
      const fromHook = hookSplit(sql);
      const fromRuntime = splitStatements(sql);

      expect(fromHook.length).toBe(fromRuntime.length);
      expect(fromHook).toEqual(fromRuntime);

      // The specific regression: a `DO $$` block must arrive whole. A split version
      // produces fragments with an odd number of `$$` markers, which Postgres rejects
      // as an unterminated dollar-quoted string.
      const unbalanced = fromHook.filter((s) => ((s.match(/\$\$/g) || []).length % 2) === 1);
      expect(unbalanced, `${file} has statements with unbalanced $$`).toEqual([]);
    });
  }
});

describe('the boundaries that actually broke the hook', () => {
  it('keeps a DO $$ block intact', () => {
    const sql = `CREATE TABLE a (id TEXT);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'x') THEN
    ALTER TABLE "a" ADD CONSTRAINT "x" FOREIGN KEY ("id") REFERENCES "b"("id");
  END IF;
END $$;`;
    const stmts = splitStatements(sql);
    expect(stmts).toHaveLength(2);
    expect(stmts[1]).toMatch(/^DO \$\$/);
    expect(stmts[1]).toMatch(/END \$\$$/);
  });

  it('does not split on a semicolon inside a single-quoted literal', () => {
    const stmts = splitStatements(`INSERT INTO t VALUES ('a;b'); SELECT 1;`);
    expect(stmts).toHaveLength(2);
  });

  it('treats a doubled quote as an escape, not a terminator', () => {
    const stmts = splitStatements(`INSERT INTO t VALUES ('it''s; fine'); SELECT 1;`);
    expect(stmts).toHaveLength(2);
    expect(stmts[0]).toContain("it''s; fine");
  });

  it('strips a comment before splitting, so a semicolon in one cannot split a statement', () => {
    // The failure the original header warned about: strip-after-split looks equivalent
    // and is not.
    const stmts = splitStatements(`-- a comment; with a semicolon\nSELECT 1;`);
    expect(stmts).toEqual(['SELECT 1']);
  });

  it('handles a tagged dollar quote', () => {
    const stmts = splitStatements(`DO $body$ BEGIN NULL; END $body$; SELECT 1;`);
    expect(stmts).toHaveLength(2);
  });
});
