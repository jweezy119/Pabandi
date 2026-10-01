/**
 * DDL statement splitting for the raw-SQL table bootstrap.
 *
 * Kept in its own module with no imports so it can be unit-tested without
 * pulling in a PrismaClient, and so both the runtime bootstrap and the deploy
 * hook can agree on how a .sql file becomes a list of queries.
 */

/** Remove `--` line comments, leaving string literals untouched. */
export function stripComments(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
}

/**
 * Split a DDL file into individual statements.
 *
 * Comments are stripped BEFORE splitting, not after. Stripping afterwards looks
 * equivalent and is not: a `;` inside a comment line, or the `;` in a
 * `DO $$ ... END IF; ... $$` block, would split one statement in half and the
 * fragment would be sent to Postgres as its own query and rejected.
 */
export function splitStatements(sql: string): string[] {
  return stripComments(sql)
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}
