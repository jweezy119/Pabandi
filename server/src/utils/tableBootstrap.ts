import fs from 'fs';
import path from 'path';
import { prisma } from './database';
import { logger } from './logger';
import { splitStatements } from './ddl';

/**
 * Runtime self-heal for tables that are created by raw SQL rather than by
 * `prisma migrate deploy`.
 *
 * WHY THIS EXISTS
 * Two classes of table in this schema are not created by a migration:
 *  - AgentMarketplace, written by raw SQL for agent signup, API-key auth,
 *    passport issuance and the discovery manifests.
 *  - ReconciliationMatch, written by the rail webhooks.
 *
 * Nothing in the deploy path runs `prisma migrate deploy` — Render's
 * preDeployCommand runs ensure-agent-tables.cjs, and the Docker CMD is a bare
 * `node dist/src/index.js`. A table that lives only in a migration folder is a
 * table that does not exist in production, and the symptom is always the same:
 * the route is mounted, the handler runs, and every call fails with
 * `relation "X" does not exist` while the service looks healthy.
 *
 * So each of those files is executed here, at boot, non-fatally, and by the
 * same statements the deploy hook uses. Both are idempotent.
 */

// dist/sql when compiled, server/sql when running from source.
const SQL_FILES = ['agent-tables.sql', 'reconciliation-tables.sql'];
const SQL_DIR_CANDIDATES = [
  path.join(__dirname, '..', '..', 'sql'),
  path.join(__dirname, '..', '..', '..', 'sql'),
];

/**
 * Split a DDL file into statements. The splitting rules live in ./ddl so they
 * are testable without a database and shared with the deploy hook.
 */
function statementsFor(fileName: string): { file: string; statements: string[] } {
  const dir = SQL_DIR_CANDIDATES.find((d) => fs.existsSync(path.join(d, fileName)));
  if (!dir) {
    logger.warn(`[table-bootstrap] DDL file ${fileName} not found (looked in ${SQL_DIR_CANDIDATES.join(', ')})`);
    return { file: fileName, statements: [] };
  }
  try {
    const raw = fs.readFileSync(path.join(dir, fileName), 'utf8');
    return { file: fileName, statements: splitStatements(raw) };
  } catch (error: unknown) {
    logger.warn(`[table-bootstrap] could not read ${fileName}: ${error instanceof Error ? error.message : error}`);
    return { file: fileName, statements: [] };
  }
}

let bootstrapped: Promise<void> | null = null;

export function ensureAgentTables(): Promise<void> {
  if (!bootstrapped) {
    bootstrapped = (async () => {
      let total = 0;
      for (const fileName of SQL_FILES) {
        const { statements } = statementsFor(fileName);
        for (const sql of statements) {
          await prisma.$executeRawUnsafe(sql);
        }
        total += statements.length;
        logger.info(`[table-bootstrap] ${fileName} ready (${statements.length} statements)`);
      }
      if (total === 0) {
        throw new Error('no DDL statements found — refusing to report ready');
      }
    })().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`[table-bootstrap] bootstrap skipped: ${message}`);
      // Do not cache a failed attempt — a later call should retry.
      bootstrapped = null;
    });
  }
  return bootstrapped;
}
