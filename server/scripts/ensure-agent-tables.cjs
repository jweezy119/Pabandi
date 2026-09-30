/**
 * ensure-agent-tables.cjs — idempotent schema bootstrap for the agent surface.
 *
 * `AgentMarketplace` is used by agent signup, API-key auth, the passport
 * issuer and the discovery endpoints, but it was never in a Prisma migration —
 * it only existed wherever somebody had run the DDL by hand. A database without
 * it turns every agent call into
 *   `relation "AgentMarketplace" does not exist`
 * while the routes themselves look healthy.
 *
 * Safe to run on every deploy: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT
 * EXISTS only. Run as Render's preDeployCommand:
 *   node scripts/ensure-agent-tables.cjs
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "AgentMarketplace" (
     id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
     name TEXT NOT NULL UNIQUE,
     "ownerEmail" TEXT,
     "displayName" TEXT,
     description TEXT,
     capabilities JSONB DEFAULT '[]'::jsonb,
     status TEXT NOT NULL DEFAULT 'active',
     "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 50,
     "completedTasks" INTEGER NOT NULL DEFAULT 0,
     rating DOUBLE PRECISION NOT NULL DEFAULT 0,
     "apiKeyHash" TEXT,
     "walletAddress" TEXT,
     "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "AgentMarketplace_apiKeyHash_key" ON "AgentMarketplace" ("apiKeyHash") WHERE "apiKeyHash" IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS "AgentMarketplace_ownerEmail_idx" ON "AgentMarketplace" ("ownerEmail")`,
  `CREATE INDEX IF NOT EXISTS "AgentMarketplace_status_idx" ON "AgentMarketplace" ("status")`,
];

async function main() {
  for (const sql of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
    console.log(`ok: ${sql.split('\n')[0].slice(0, 60)}`);
  }
  console.log('agent tables ensured');
}

main()
  .catch((err) => {
    console.error('ensure-agent-tables failed:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
