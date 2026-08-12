/**
 * ensurePrisma.ts — Regenerate the Prisma client at RUNTIME before the
 * @prisma/client singleton is constructed.
 *
 * WHY: Render's build cache (and skipped npm lifecycle scripts) can serve a
 * stale @prisma/client that predates models/columns added after the last
 * `prisma migrate` (e.g. AgentBooking, Web3Agent.prepared). That makes
 * queries on those models throw "Environment variable not found: DATABASE_URL"
 * even though the DB env is present. Regenerating here guarantees the deployed
 * client always matches prisma/schema.prisma.
 *
 * This runs as the FIRST import in utils/database.ts, so it executes before
 * `new PrismaClient()`. Failure is non-fatal (falls back to whatever client
 * exists).
 */
import { execSync } from 'child_process';

try {
  execSync('npx prisma generate', { stdio: 'ignore', timeout: 180_000 });
} catch {
  // Non-fatal: keep going with whatever generated client is present.
}
