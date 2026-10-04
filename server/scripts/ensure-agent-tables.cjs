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

const SQL_FILES = ['agent-tables.sql', 'reconciliation-tables.sql', 'fee-tables.sql', 'sms-provider-tables.sql'];
const SQL_DIR_CANDIDATES = [
  path.join(__dirname, '..', 'sql'),
  path.join(__dirname, '..', 'dist', 'sql'),
];

/**
 * Remove `--` line comments.
 *
 * This must run BEFORE the statement split, not after. Splitting first and
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

/**
 * Split a DDL file into statements.
 *
 * This was `.split(';')`, and that was broken.
 *
 * Postgres has no `ADD CONSTRAINT IF NOT EXISTS`, so a guarded foreign key has to be
 * written as a `DO $$ ... $$` block — and a `DO` block contains semicolons. Splitting
 * on `;` cut those blocks in half and sent the fragments to Postgres, which rejected
 * them with `unterminated dollar-quoted string`. The script then exited 1.
 *
 * fee-tables.sql had 8 such statements and this file has 2, so the hook was already
 * dying on fee-tables.sql and never reached anything after it. The deploy kept going
 * only because src/utils/tableBootstrap.ts runs the SAME sql at boot with a correct
 * splitter — which is why the breakage went unnoticed.
 *
 * The logic below is a faithful port of `splitStatements` in src/utils/ddl.ts, which is
 * the tested implementation. It cannot import that module directly: preDeploy runs from
 * the repo root before `npm run compile`, so there is no dist/ to import from. A test
 * (tests/ddl-splitter.test.ts) asserts the two agree, so the port cannot drift.
 */
function splitStatements(sql) {
  const statements = [];
  let current = '';
  let dollarQuoteTag = null;
  let inString = false;

  const source = stripComments(sql);

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    // Entering and leaving a dollar-quoted body. `$$` and $tag$ both work; the tag is
    // captured so the matching close is recognised.
    if (dollarQuoteTag === null && !inString) {
      const match = source.slice(i).match(/^\$[A-Za-z_]*\$/);
      if (match) {
        dollarQuoteTag = match[0];
        current += match[0];
        i += match[0].length - 1;
        continue;
      }
    } else if (dollarQuoteTag !== null && source.startsWith(dollarQuoteTag, i)) {
      current += dollarQuoteTag;
      i += dollarQuoteTag.length - 1;
      dollarQuoteTag = null;
      continue;
    }

    // Single-quoted literals, so a `;` inside one is not a boundary. A doubled '' is an
    // escaped quote, not a terminator, so it has to be consumed as a pair.
    if (char === "'" && !dollarQuoteTag) {
      if (inString && source[i + 1] === "'") {
        current += "''";
        i += 1;
        continue;
      }
      inString = !inString;
      current += char;
      continue;
    }

    if (char === ';' && !inString && dollarQuoteTag === null) {
      if (current.trim()) statements.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
}

function statementsFor(fileName) {
  const dir = SQL_DIR_CANDIDATES.find((d) => fs.existsSync(path.join(d, fileName)));
  if (!dir) {
    throw new Error(`${fileName} not found (looked in ${SQL_DIR_CANDIDATES.join(', ')})`);
  }
  return splitStatements(fs.readFileSync(path.join(dir, fileName), 'utf8'));
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
