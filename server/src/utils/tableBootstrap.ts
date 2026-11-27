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
const SQL_FILES = [
  'agent-tables.sql',
  'reconciliation-tables.sql',
  'fee-tables.sql',
  'sms-provider-tables.sql',
  'crm-deal-tenant.sql',
  'availability-tables.sql',
  'customfields-canonical.sql',
  'crm-file-tenant.sql',
  'service-coordinator.sql',
  'auto-repair-tables.sql',
  'crm-task-tenant.sql',
  'crm-outreach-tenant.sql',
  'shipped-migrations.sql',
];
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

/**
 * Outcome of the last bootstrap attempt, exposed on /health.
 *
 * WHY: this bootstrap is the ONLY thing that creates these tables in production,
 * so when the schema is wrong the question is always "did it run, and did it
 * work?" — and until now the only answer lived in a deploy log that needs
 * dashboard access. Three migrations' worth of columns were missing in
 * production for hours while every check that could be run from outside said
 * nothing about the bootstrap at all.
 */
type BootstrapFile = { file: string; statements: number; error?: string };

let lastBootstrap: {
  ranAt: string;
  files: BootstrapFile[];
  error: string | null;
} | null = null;

export function getBootstrapStatus() {
  return lastBootstrap;
}

export function ensureAgentTables(): Promise<void> {
  if (!bootstrapped) {
    bootstrapped = (async () => {
      const ranAt = new Date().toISOString();
      const files: BootstrapFile[] = [];
      let total = 0;
      let firstError: string | null = null;

      for (const fileName of SQL_FILES) {
        try {
          const { statements } = statementsFor(fileName);
          for (const sql of statements) {
            await prisma.$executeRawUnsafe(sql);
          }
          total += statements.length;
          files.push({ file: fileName, statements: statements.length });
          logger.info(`[table-bootstrap] ${fileName} ready (${statements.length} statements)`);
        } catch (error: unknown) {
          // ONE FILE MUST NOT ABORT THE REST.
          //
          // This loop used to let a throw escape, and the caller caught it and
          // stopped — so a single divergent table name in the fifth file meant
          // files six through eleven never ran. That is exactly how
          // shipped-migrations.sql (the file carrying the 20261122 migrations)
          // sat unexecuted in production through several deploys while
          // /health reported the schema as merely "missing columns".
          const message = error instanceof Error ? error.message : String(error);
          files.push({ file: fileName, statements: 0, error: message });
          if (!firstError) firstError = message;
          logger.error(`[table-bootstrap] ${fileName} FAILED: ${message}`);
        }
      }

      lastBootstrap = { ranAt, files, error: firstError };

      if (total === 0) {
        throw new Error('no DDL statements found — refusing to report ready');
      }
      // Resolve, not reject: the per-file outcomes are the result. A rejected
      // promise would make callers treat the whole bootstrap as skipped.
      if (firstError) {
        logger.warn(
          `[table-bootstrap] finished with failures — ${files.filter((f) => f.error).length} of ${files.length} files did not apply.`,
        );
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
