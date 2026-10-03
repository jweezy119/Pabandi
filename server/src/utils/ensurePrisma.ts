/**
 * ensurePrisma.ts — Regenerate the Prisma client at RUNTIME before the
 * @prisma/client singleton is constructed.
 *
 * WHY IT EXISTS
 * -------------
 * Render's build cache (and skipped npm lifecycle scripts) can serve a stale
 * @prisma/client that predates models/columns added after the last deploy (e.g.
 * AgentBooking, Web3Agent.prepared). That makes queries on those models throw
 * "Environment variable not found: DATABASE_URL" even though the DB env is present.
 * Regenerating here guarantees the deployed client always matches prisma/schema.prisma.
 *
 * This runs as the FIRST import in utils/database.ts, so it executes before
 * `new PrismaClient()`. Failure is non-fatal (falls back to whatever client exists).
 *
 * WHY IT IS SKIPPED UNDER TEST
 * ---------------------------
 * This is the confirmed root cause of the intermittent suite failure tracked in
 * vitest.config.ts and docs/build-plan.md item 3.2 — the one that reported roughly
 * 1 run in 3 failing with:
 *
 *   Cannot find module '.prisma/client/default'
 *   PrismaClient is not a constructor
 *
 * The old note theorised that "a torn read during prisma generate" was plausible but
 * unconfirmed, and attributed it to worker concurrency. It was neither unconfirmed nor
 * really about workers: this module runs `npx prisma generate` on EVERY import of
 * utils/database.ts, and vitest runs test files in parallel workers. So several workers
 * each spawned a `prisma generate` writing to node_modules/.prisma/client while other
 * workers were reading it. The concurrency was the delivery mechanism; the redundant
 * regeneration was the defect.
 *
 * It only became visible when tests/customer-flow.integration.test.ts started booting
 * the real Express app, which guarantees a generate at a moment when other suites are
 * mid-run. That test did not create the flake — it made an existing one fire reliably,
 * which is how it got caught.
 *
 * Skipping is safe because the client is generated explicitly before the suite runs:
 * verify.yml has a dedicated "Generate Prisma client" step, and `npm run compile` does
 * it locally. If it is somehow missing, the failure is a clear module-not-found rather
 * than a silently wrong client mid-suite.
 */
import { execSync } from 'child_process';

// VITEST is set by vitest itself; NODE_ENV=test covers other runners and direct
// `node --test` invocations. Both are checked because relying on one alone is how this
// would regress again.
const runningUnderTest = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';

if (!runningUnderTest) {
  try {
    execSync('npx prisma generate', { stdio: 'ignore', timeout: 180_000 });
  } catch {
    // Non-fatal: keep going with whatever generated client is present.
  }
}
