/**
 * ensure-agent-tables.cjs — idempotent schema bootstrap for the deploy hook.
 *
 * Reads sql/*.sql so the deploy hook and the runtime bootstrap can never drift
 * apart. Safe to run repeatedly: every statement is CREATE ... IF NOT EXISTS,
 * CREATE INDEX IF NOT EXISTS, or a guarded DO $$ block.
 *
 * Both files are staged into the image by scripts/build-assets.js
 * (server/sql → dist/sql), which is why this resolves the directory rather
 * than assuming the repo root is present.
 *
 *   node scripts/ensure-agent-tables.cjs
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const SQL_FILES = ['agent-tables.sql', 'reconciliation-tables.sql', 'fee-tables.sql'];
const SQL_DIR_CANDIDATES = [
  path.join(__dirname, '..', 'sql'),
  path.join(__dirname, '..', 'dist', 'sql'),
];

/**
 * Remove `--` line comments.
 *
 * This must run BEFORE the semicolon split, not after. Splitting first and
 * stripping second looks equivalent and is not: a `;` inside a comment line
 * splits a statement in half, and the fragment is then sent to Postgres as its
 * own query and rejected.
 */
function stripComments(sql) {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
}

function statementsFor(fileName) {
  const dir = SQL_DIR_CANDIDATES.find((d) => fs.existsSync(path.join(d, fileName)));
  if (!dir) {
    throw new Error(`${fileName} not found (looked in ${SQL_DIR_CANDIDATES.join(', ')})`);
  }
  return stripComments(fs.readFileSync(path.join(dir, fileName), 'utf8'))
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  for (const fileName of SQL_FILES) {
    const stmts = statementsFor(fileName);
    for (const sql of stmts) {
      await prisma.$executeRawUnsafe(sql);
      console.log(`ok: ${sql.split('\n')[0].slice(0, 64)}`);
    }
    console.log(`${fileName} ensured (${stmts.length} statements)`);
  }
  console.log('all raw-SQL tables ensured');
}

main()
  .catch((err) => {
    console.error('ensure-agent-tables failed:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
