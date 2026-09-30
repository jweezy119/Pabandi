import fs from 'fs';
import path from 'path';
import { prisma } from './database';
import { logger } from './logger';

/**
 * Runtime self-heal for the agent onboarding tables.
 *
 * `AgentMarketplace` is written by raw SQL (agent signup, agent API-key auth,
 * passport issuance, the discovery manifests) and has never lived in a Prisma
 * migration, so it is easy to deploy against a database that does not have it —
 * every agent call then fails with `relation "AgentMarketplace" does not exist`
 * while the routes themselves look healthy.
 *
 * Runs once at boot, non-fatally, from the same DDL the deploy hook uses.
 */
// dist/sql when compiled, server/sql when running from source.
const SQL_CANDIDATES = [
  path.join(__dirname, '..', '..', 'sql', 'agent-tables.sql'),
  path.join(__dirname, '..', '..', '..', 'sql', 'agent-tables.sql'),
];

function statements(): string[] {
  const sqlFile = SQL_CANDIDATES.find((p) => fs.existsSync(p));
  if (!sqlFile) {
    logger.warn(
      `[agent-tables] DDL not found (looked in ${SQL_CANDIDATES.join(', ')}) — ` +
      'AgentMarketplace will be missing and agent signup will fail'
    );
    return [];
  }
  try {
    return fs
      .readFileSync(sqlFile, 'utf8')
      .split(';')
      .map((s) =>
        s
          .split('\n')
          .filter((l) => !l.trim().startsWith('--'))
          .join('\n')
          .trim()
      )
      .filter(Boolean);
  } catch (error: unknown) {
    logger.warn(`[agent-tables] could not read DDL: ${error instanceof Error ? error.message : error}`);
    return [];
  }
}

let bootstrapped: Promise<void> | null = null;

export function ensureAgentTables(): Promise<void> {
  if (!bootstrapped) {
    bootstrapped = (async () => {
      const stmts = statements();
      if (stmts.length === 0) {
        throw new Error('no DDL statements found — refusing to report ready');
      }
      for (const sql of stmts) {
        await prisma.$executeRawUnsafe(sql);
      }
      logger.info(`[agent-tables] AgentMarketplace ready (${stmts.length} statements)`);
    })().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`[agent-tables] bootstrap skipped: ${message}`);
      // Do not cache a failed attempt — a later call should retry.
      bootstrapped = null;
    });
  }
  return bootstrapped;
}
