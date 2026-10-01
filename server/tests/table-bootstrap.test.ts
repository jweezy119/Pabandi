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
});
