/**
 * ensure-agent-tables.cjs — idempotent schema bootstrap for the agent surface.
 *
 * Reads sql/agent-tables.sql so the deploy hook and the runtime bootstrap can
 * never drift apart. Safe to run repeatedly: every statement is
 * CREATE ... IF NOT EXISTS.
 *
 *   node scripts/ensure-agent-tables.cjs
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const sqlFile = path.join(__dirname, '..', 'sql', 'agent-tables.sql');

function statements() {
  const sql = fs.readFileSync(sqlFile, 'utf8');
  return sql
    .split(';')
    .map((s) =>
      s
        .split('\n')
        .filter((l) => !l.trim().startsWith('--'))
        .join('\n')
        .trim()
    )
    .filter(Boolean);
}

async function main() {
  for (const sql of statements()) {
    await prisma.$executeRawUnsafe(sql);
    console.log(`ok: ${sql.split('\n')[0].slice(0, 64)}`);
  }
  console.log('agent tables ensured');
}

main()
  .catch((err) => {
    console.error('ensure-agent-tables failed:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
