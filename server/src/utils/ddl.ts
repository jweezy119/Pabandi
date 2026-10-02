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
 * equivalent and is not: a `;` inside a comment line would split one statement
 * in half and the fragment would be sent to Postgres as its own query.
 *
 * A naive `.split(';')` is also not sufficient on its own. Postgres has no
 * `ADD CONSTRAINT IF NOT EXISTS`, so a guarded foreign key has to be written as
 *
 *   DO $$ BEGIN
 *     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '…') THEN
 *       ALTER TABLE … ADD CONSTRAINT … ;
 *     END IF;
 *   END $$;
 *
 * and that block contains semicolons of its own. Splitting on every `;` breaks it
 * into a DO header, a bare `END IF`, and a stray `END $$` — three queries, two of
 * which are syntax errors. `splitOnSemicolons` tracks dollar-quote depth instead,
 * so a `;` inside a `$$ … $$` body is treated as part of the statement it belongs
 * to.
 */
export function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let dollarQuoteTag: string | null = null;
  let inString = false;

  const source = stripComments(sql);

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    // Track entering and leaving a dollar-quoted body. `$$` and $tag$ both work;
    // the tag is captured so the matching close is recognised.
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

    // Single-quoted string literals, so a semicolon inside one is not a boundary.
    // Doubled '' is an escaped quote, not a terminator, so it has to be consumed
    // as a pair — otherwise 'it''s' closes at the first quote and reopens at the
    // second, leaving the rest of the literal looking like code.
    if (char === "'" && dollarQuoteTag === null) {
      current += char;
      if (source[i + 1] === "'") {
        current += "'";
        i++;
      } else {
        inString = !inString;
      }
      continue;
    }

    if (char === ';' && dollarQuoteTag === null && !inString) {
      statements.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  statements.push(current.trim());
  return statements.filter(Boolean);
}
