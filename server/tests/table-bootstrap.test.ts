import { describe, it, expect } from 'vitest';
import { stripComments, splitStatements } from '../src/utils/ddl';

/**
 * The DDL splitter is what stands between a deploy and a missing-table error,
 * and it runs against raw SQL at boot. These cover the two ways naive splitting
 * breaks: a semicolon inside a comment, and a trailing fragment.
 */
describe('stripComments', () => {
  it('removes full-line comments', () => {
    const sql = ['-- a comment', 'CREATE TABLE x (id TEXT);'].join('\n');
    expect(stripComments(sql).trim()).toBe('CREATE TABLE x (id TEXT);');
  });

  it('leaves code containing a double dash alone', () => {
    const sql = "CREATE TABLE x (a TEXT DEFAULT 'a--b');";
    expect(stripComments(sql).trim()).toBe(sql);
  });
});

describe('splitStatements', () => {
  it('splits on statement boundaries', () => {
    const sql = 'CREATE TABLE a (id TEXT); CREATE INDEX i ON a (id);';
    expect(splitStatements(sql)).toEqual(['CREATE TABLE a (id TEXT)', 'CREATE INDEX i ON a (id)']);
  });

  it('does not split on a semicolon that appears only inside a comment', () => {
    // The failure this prevents: split first, strip second, and the text
    // between the two semicolons becomes a fragment sent as its own query.
    const sql = [
      '-- deleting an invoice leaves the record; losing it would hide revenue.',
      'CREATE TABLE x (id TEXT);',
    ].join('\n');

    expect(splitStatements(sql)).toEqual(['CREATE TABLE x (id TEXT)']);
  });

  it('drops whitespace-only trailing fragments', () => {
    expect(splitStatements('CREATE TABLE x (id TEXT);\n\n   \n')).toEqual(['CREATE TABLE x (id TEXT)']);
  });

  it('returns nothing for an empty file', () => {
    expect(splitStatements('')).toEqual([]);
    expect(splitStatements('-- only a comment\n')).toEqual([]);
  });

  /**
   * The third way naive splitting breaks, and the one that bit us.
   *
   * Postgres has no `ADD CONSTRAINT IF NOT EXISTS`, so an idempotent foreign key
   * has to be a `DO $$ … $$` block — and that block contains semicolons of its own.
   * Splitting on every `;` produced a DO header, a bare `END IF`, and a stray
   * `END $$`: three queries, two of which are syntax errors, thrown at boot on
   * every deploy after the first.
   */
  describe('dollar-quoted blocks', () => {
    const guardedFk = [
      'DO $$ BEGIN',
      "  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'X_fkey') THEN",
      '    ALTER TABLE "X" ADD CONSTRAINT "X_fkey" FOREIGN KEY ("b") REFERENCES "Business"("id");',
      '  END IF;',
      'END $$;',
    ].join('\n');

    it('keeps a guarded DO block as one statement', () => {
      expect(splitStatements(guardedFk)).toHaveLength(1);
    });

    it('does not emit END IF or END $$ as standalone queries', () => {
      // The specific symptom: these fragments are syntactically invalid, so the
      // bootstrap logs a warning and the table never gets its foreign key.
      for (const statement of splitStatements(guardedFk)) {
        expect(statement).not.toMatch(/^END IF$/);
        expect(statement).not.toMatch(/^END \$\$$/);
      }
    });

    it('still splits around the block', () => {
      const sql = `CREATE TABLE x (id TEXT);\n${guardedFk}\nCREATE INDEX i ON x (id);`;
      const parts = splitStatements(sql);
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('CREATE TABLE x (id TEXT)');
      expect(parts[1]).toContain('ADD CONSTRAINT');
      expect(parts[2]).toBe('CREATE INDEX i ON x (id)');
    });

    it('handles a tagged dollar quote', () => {
      // $body$ … $body$ is equally valid and would be split on its semicolons by
      // a splitter that only recognises $$.
      const sql = "DO $body$ BEGIN PERFORM 1; END $body$;";
      expect(splitStatements(sql)).toHaveLength(1);
    });

    it('leaves a semicolon inside a string literal alone', () => {
      // The other place a naive split breaks: 'a;b' is one literal, not two
      // statements.
      expect(splitStatements("INSERT INTO t VALUES ('a;b');")).toHaveLength(1);
    });
  });
});
