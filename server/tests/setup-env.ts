/**
 * Test environment defaults.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * A test that passed locally and failed in CI, with an error that pointed nowhere near
 * the cause:
 *
 *   register failed: {"success":false,"message":"secretOrPrivateKey must have a value"}
 *
 * `auth.controller.ts` reads its secrets at MODULE SCOPE:
 *
 *   const JWT_SECRET = process.env.JWT_SECRET!;
 *   const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
 *
 * The integration test set JWT_SECRET but not JWT_REFRESH_SECRET, so the refresh token
 * was signed with undefined and jsonwebtoken threw. It passed locally because
 * server/.env supplies both. CI has no .env, because .env is not committed.
 *
 * So the test was exercising a code path that only worked thanks to a developer's
 * uncommitted file. That is the same failure mode as the deploy drift and the two-day
 * site staleness earlier in this project: something that is true on one machine and
 * assumed everywhere.
 *
 * Every default here is assigned ONLY when the variable is absent, so a real value from
 * the environment always wins. Nothing is overridden.
 *
 * This is a setupFile, so it runs before any test module is imported — which is the
 * only point at which it can help, given the module-scope reads above.
 */

function defaultIfMissing(name: string, value: string) {
  if (!process.env[name]) {
    process.env[name] = value;
  }
}

/**
 * Load `server/.env` so DATABASE_URL is visible to tests.
 *
 * ─── WHY ────────────────────────────────────────────────────────────────────
 * The integration suites read `process.env.DATABASE_URL` directly and refuse to
 * run unless the database name matches /test|integration|ci/. In CI that worked
 * because the job sets DATABASE_URL in its own env. Locally nothing did, so
 * every integration suite failed with `Refusing to run ... "<unknown>"` —
 * eleven files, which had been easy to misread as "the DB is broken" when in
 * fact it was "there is no database configured".
 *
 * ─── WHY THIS IS SAFE ───────────────────────────────────────────────────────
 * Loading .env here does not weaken the tests' own guard. That guard is
 * evaluated inside each suite at runtime and still requires a disposable
 * database name, so a .env pointing at production would be refused by
 * `assertIsolatedDatabase()` — exactly as it is today when DATABASE_URL is
 * simply absent. This only turns "no configuration" into "the configuration
 * on this machine", and adds a second check rather than removing one.
 *
 * `.env` is also no longer able to point at production — the production URL
 * lives in `.env.production`, which nothing loads automatically. See
 * `scripts/assert-local-db.js`.
 *
 * dotenv does not override variables already set, so an explicitly exported
 * DATABASE_URL (as CI does) still wins. That is what keeps CI deterministic
 * and stops it from silently preferring a developer's local file.
 */
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });
} catch {
  // No .env is a supported setup — CI provides the environment directly, and
  // unit tests need no database at all. The integration suites will say so with
  // a clearer message than anything this file could produce.
}

// Signing keys. Both are read at module scope with no fallback, so a missing value is a
// runtime 500 rather than a clear startup error.
defaultIfMissing('JWT_SECRET', 'test-jwt-secret');
defaultIfMissing('JWT_REFRESH_SECRET', 'test-jwt-refresh-secret');

// Registration sends a welcome email. There is no provider in CI, and the email service
// is mocked per-suite — but the key must exist so nothing treats it as "unconfigured"
// and takes a different branch than production would.
defaultIfMissing('RESEND_API_KEY', 'test-dummy-key');

// On-chain attestation is disabled in tests rather than left to fail loudly: several
// suites assert fail-closed behaviour when the keypair is missing, and a real keypair
// would change which branch they take.
defaultIfMissing('SOLANA_ATTESTATION_KEYPAIR', '');

// Never let a test reach a real provider by accident.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
