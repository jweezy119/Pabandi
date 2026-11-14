/**
 * ensurePrisma.ts — Regenerate the Prisma client at RUNTIME before the
 * @prisma/client singleton is constructed.
 *
 * WHY IT EXISTS
 * -------------
 * Render's build cache (and skipped npm lifecycle scripts) can serve a stale
 * @prisma/client that predates models/columns added after the last deploy.
 * Regenerating here guarantees the deployed client always matches prisma/schema.prisma.
 *
 * This runs as the FIRST import in utils/database.ts, so it executes before
 * `new PrismaClient()`. Failure is non-fatal (falls back to whatever client exists).
 *
 * Skipped under test: the client is generated explicitly before the suite runs.
 */
import { execFileSync } from 'child_process';

const runningUnderTest = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';

if (!runningUnderTest) {
  try {
    // Static command, no interpolated input: safe without a shell.
    execFileSync('npx', ['prisma', 'generate'], { stdio: 'ignore', timeout: 180_000 });
  } catch {
    // Non-fatal: keep going with whatever generated client is present.
  }
}
