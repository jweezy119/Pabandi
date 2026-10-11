#!/usr/bin/env node
/**
 * Refuse destructive Prisma commands against anything that is not a local database.
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * `prisma migrate dev` and `prisma db push` are capable of dropping every table
 * in the target. That is their job on a scratch database and a catastrophe on
 * anyone else's.
 *
 * The hazard in this repo was concrete rather than theoretical. `server/.env`
 * pointed at production, so both commands defaulted to production, and the
 * schema had drifted from the database by 67 statements — one of which is
 *
 *     DROP TABLE "AgentMarketplace";
 *
 * With drift present, `migrate dev` detects it and prompts to reset the
 * database. The prompt is the only thing standing between a typo and a wiped
 * production database, and it is one keystroke from a command people run
 * dozens of times a week without reading.
 *
 * So the check happens before Prisma runs, not inside it. This script exits
 * non-zero for any host that is not localhost, which means the destructive
 * command never starts — there is no prompt to accept and nothing half-done.
 *
 * ─── WHY HOSTS ONLY ──────────────────────────────────────────────────────────
 * An allowlist of local hostnames, rather than a check that the hostname is not
 * on some denylist. A denylist has to be updated every time a staging or replica
 * hostname appears, and the failure mode of forgetting is the dangerous one. An
 * allowlist fails closed: an unknown host is refused, so new infrastructure is
 * a deliberate opt-in rather than an oversight.
 *
 * ─── WHAT IT DOES NOT COVER ──────────────────────────────────────────────────
 * It reads DATABASE_URL from the environment the command runs in, so it cannot
 * tell you whether you meant to be in that environment. It is a floor, not a
 * substitute for reading the command you are about to run.
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0', 'host.docker.internal']);

// Load .env the way Prisma does, or this script sees an empty environment and
// refuses every command — including the safe local ones.
//
// dotenv does not override variables that are already set, so an explicitly
// exported DATABASE_URL still wins. That is what makes
// `DATABASE_URL=... npm run db:push` testable, and what lets CI point these
// scripts at its own throwaway container.
require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });

const url = process.env.DATABASE_URL ?? '';

if (!url) {
  console.error('[guard] DATABASE_URL is not set, so this command cannot be checked against anything.');
  console.error('[guard] Refusing. Set a local database URL, or see server/.env.production for the production one.');
  process.exit(1);
}

let host;
let database = '';
try {
  const parsed = new URL(url);
  host = parsed.hostname;
  database = parsed.pathname.replace(/^\//, '');
} catch {
  console.error(`[guard] DATABASE_URL is not a parseable URL: ${url}`);
  process.exit(1);
}

if (LOCAL_HOSTS.has(host)) {
  console.log(`[guard] ${host}/${database} is local — proceeding.`);
  process.exit(0);
}

console.error('');
console.error('  REFUSING: that database is not local.');
console.error('');
console.error(`    host:     ${host}`);
console.error(`    database: ${database}`);
console.error('');
console.error('  This command can DROP TABLES. It will not run against a remote host.');
console.error('');
console.error('  If you mean to migrate production deliberately:');
console.error('      set -a && . ./.env.production && set +a');
console.error('      npx prisma migrate deploy');
console.error('');
process.exit(1);