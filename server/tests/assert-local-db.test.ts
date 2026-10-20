import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The database guard, and the two configuration mistakes that made it necessary.
 *
 * ─── WHY THIS FILE IS A TEST AND NOT A COMMENT ───────────────────────────────
 * `server/.env` pointed at production. That made `prisma migrate dev` and
 * `prisma db push` default to a database they can drop, on a schema that has
 * drifted from it by 67 statements — including `DROP TABLE "AgentMarketplace"`.
 * With drift present, `migrate dev` prompts to reset, and the prompt is the
 * only thing between a muscle-memory command and a wiped production database.
 *
 * A guard that nobody runs is a comment. These tests assert it actually refuses,
 * and that the configuration which made the hazard possible has not come back.
 * Configuration drifts silently; a test fails loudly.
 *
 * Nothing here connects to a database. Every case is decided by the URL alone.
 */

const GUARD = join(__dirname, '../scripts/assert-local-db.js');

function runGuard(databaseUrl: string | undefined): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync('node', [GUARD], {
      env: { ...process.env, DATABASE_URL: databaseUrl ?? '' },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, stdout, stderr: '' };
  } catch (err) {
    const e = err as { status: number; stdout: string; stderr: string };
    return { status: e.status, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

describe('assert-local-db guard', () => {
  it('allows a localhost database', () => {
    const result = runGuard('postgresql://user:pass@localhost:5432/pabandi_dev');
    expect(result.status).toBe(0);
  });

  it.each(['127.0.0.1', '[::1]', 'host.docker.internal'])('allows the local host %s', (host) => {
    // IPv6 must be bracketed in a URL. The guard keeps the brackets that WHATWG
    // URL parsing preserves, so '[::1]' is matched rather than '::1'.
    expect(runGuard(`postgresql://user:pass@${host}:5432/db`).status).toBe(0);
  });

  it('refuses a bare unbracketed IPv6 host as unparseable rather than guessing', () => {
    // `postgresql://user:pass@::1:5432/db` is not a valid URL. The right
    // response is to refuse, not to strip characters and assume intent.
    expect(runGuard('postgresql://user:pass@::1:5432/db').status).toBe(1);
  });

  it('refuses the production host by name', () => {
    // The specific host this repo points at. Named rather than generic so that
    // re-adding it to server/.env fails here rather than in production.
    const result = runGuard(
      'postgresql://pabandi:pw@pgm-gs59m04d6wm3r910bo.pgsql.singapore.rds.aliyuncs.com:5432/pabandi',
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/REFUSING/);
  });

  it('refuses any other remote host, because the allowlist fails closed', () => {
    // Not a denylist of known-bad hosts: an unknown host is refused until it is
    // deliberately added. Staging, a replica, a colleague's box — all refused,
    // none of them a special case someone had to remember.
    expect(runGuard('postgresql://user:pass@db.internal.example.com:5432/db').status).toBe(1);
    expect(runGuard('postgresql://user:pass@some-new-staging-host:5432/db').status).toBe(1);
  });

  it('refuses when DATABASE_URL is unset rather than defaulting to anything', () => {
    // "Cannot check" must not resolve to "allowed".
    const result = runGuard(undefined);
    expect(result.status).toBe(1);
  });

  it('refuses an unparseable URL', () => {
    expect(runGuard('not-a-url').status).toBe(1);
  });

  it('names the host it refused, so the message is diagnosable', () => {
    const result = runGuard('postgresql://user:pass@db.internal.example.com:5432/db');
    expect(result.stderr).toMatch(/db\.internal\.example\.com/);
  });
});

describe('database configuration cannot silently regress', () => {
  const envPath = join(__dirname, '../.env');

  it('server/.env does not point at a remote database', () => {
    // The regression guard. This assertion is the whole reason the file exists.
    //
    // A CI checkout has no server/.env — credentials arrive from the platform,
    // not from the repository. The guard exists to protect the developer's
    // real file (the mistake it exists for was a .env pointing at production);
    // without that file there is nothing here to regress, and asserting the
    // file into existence would be testing the repo layout, not the hazard.
    if (!existsSync(envPath)) {
      console.warn('[db-guard] server/.env absent; the local-database guard has nothing to inspect here');
      return;
    }
    const contents = readFileSync(envPath, 'utf8');
    const match = contents.match(/^DATABASE_URL=(.*)$/m);
    expect(match, 'DATABASE_URL must be present in server/.env').toBeTruthy();

    const url = new URL((match as RegExpMatchArray)[1].trim());
    const local = new Set(['localhost', '127.0.0.1', '::1', 'host.docker.internal']);
    expect(
      local.has(url.hostname),
      `server/.env points at ${url.hostname}. Prisma reads this file automatically, so ` +
        '`prisma migrate dev` and `db push` would default to that database. ' +
        'The production URL belongs in server/.env.production, which nothing auto-loads.',
    ).toBe(true);
  });

  it('server/.env.production is gitignored, because it holds the production password', () => {
    // A .gitignore rule that silently stops matching is how credentials get
    // committed. Asserting the rule is present catches that here rather than in
    // a post-mortem.
    const gitignore = readFileSync(join(__dirname, '../../.gitignore'), 'utf8');
    expect(gitignore).toMatch(/^\.env\.production$/m);
  });

  it('the dangerous Prisma scripts are behind the guard', () => {
    // npm run is the documented path to these commands. If someone re-adds a
    // bare `prisma migrate dev`, that bypasses the guard and this fails.
    const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));
    for (const script of ['migrate', 'db:push', 'db:reset']) {
      expect(pkg.scripts[script], `${script} must run the guard first`).toMatch(
        /assert-local-db\.js\s*&&\s*prisma/,
      );
    }
  });

  it('migrate:deploy stays unguarded, because applying pending migrations is the safe direction', () => {
    // Blocking this would defeat the purpose: `migrate deploy` applies only
    // unapplied migrations and runs each in a transaction. It cannot drop a
    // table, and it is the only correct way to reach production.
    const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));
    expect(pkg.scripts['migrate:deploy']).toBe('prisma migrate deploy');
    expect(pkg.scripts['migrate:deploy']).not.toMatch(/assert-local-db/);
  });
});