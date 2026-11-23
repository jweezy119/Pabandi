import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

/**
 * The schema self-check.
 *
 * ─── WHAT IS WORTH TESTING HERE ─────────────────────────────────────────────
 * A health check that always passes is worse than none, because it converts an
 * unknown into a false reassurance. So the tests are mostly about the FAILING
 * path: does it actually detect a missing column, a wrong nullability, and an
 * unreachable database, and does it say which one it hit?
 *
 * The database is faked rather than stubbed at the module level, so the
 * information_schema query is answered by a controllable table of rows. That
 * keeps the assertions about behaviour instead of about query text.
 */

type ColumnRow = {
  table_name: string;
  column_name: string;
  is_nullable: 'YES' | 'NO';
  data_type: string;
};

const queryRaw = vi.fn();

vi.mock('../src/utils/database', () => ({
  prisma: { $queryRaw: queryRaw },
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

let checkSchema: typeof import('../src/services/schema-check.service')['checkSchema'];
let EXPECTED_COLUMNS: typeof import('../src/services/schema-check.service')['EXPECTED_COLUMNS'];

beforeAll(async () => {
  ({ checkSchema, EXPECTED_COLUMNS } = await import('../src/services/schema-check.service'));
});

/** Every expected column present, nullable where required, correctly typed. */
function allPresent(): ColumnRow[] {
  return EXPECTED_COLUMNS.map((c) => ({
    table_name: c.table,
    column_name: c.column,
    is_nullable: (c.nullable ? 'YES' : 'NO') as 'YES' | 'NO',
    data_type: c.dataType ?? 'text',
  }));
}

beforeEach(() => {
  queryRaw.mockReset().mockResolvedValue(allPresent());
});

describe('schema check — the passing case', () => {
  it('reports ok when every expected column is present', async () => {
    const result = await checkSchema();
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.notNullable).toEqual([]);
    expect(result.checked).toBe(EXPECTED_COLUMNS.length);
  });

  it('uses a single query rather than one per column', async () => {
    // Runs on a request path against a remote database. Six round trips to
    // information_schema during a traffic spike would be a self-inflicted
    // outage, so the count is asserted rather than assumed.
    await checkSchema();
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });
});

describe('schema check — the failing case', () => {
  it('detects a missing column and says what the code needed it for', async () => {
    queryRaw.mockResolvedValue(allPresent().filter((r) => r.column_name !== 'retryCount'));

    const result = await checkSchema();
    expect(result.ok).toBe(false);
    expect(result.missing).toHaveLength(1);
    // Not just the name. "retryCount is missing" is a fact; "auto-retry decides
    // whether a failed payment retries or escalates" is a thing someone can act
    // on at 3am.
    expect(result.missing[0]).toMatch(/retryCount/);
    expect(result.missing[0]).toMatch(/retries or escalates/);
  });

  it('detects a column that exists but has the wrong nullability', async () => {
    // Business.raastId is optional. Present-but-NOT NULL is a different failure
    // from absent, and only one of them is fixed by adding a column.
    queryRaw.mockResolvedValue(
      allPresent().map((r) =>
        r.column_name === 'raastId' ? { ...r, is_nullable: 'NO' as const } : r,
      ),
    );

    const result = await checkSchema();
    expect(result.ok).toBe(false);
    expect(result.notNullable).toHaveLength(1);
    expect(result.notNullable[0]).toMatch(/expected nullable/);
    expect(result.missing).toEqual([]);
  });

  it('detects a column that exists but has the wrong type', async () => {
    // dashboardTheme was TEXT for months while the client sent an object: the
    // column was present, so a presence-only check called it healthy and every
    // dashboard save 500'd. Present-but-wrong-type is the same failure as absent.
    queryRaw.mockResolvedValue(
      allPresent().map((r) =>
        r.column_name === 'dashboardTheme' ? { ...r, data_type: 'text' } : r,
      ),
    );

    const result = await checkSchema();
    expect(result.ok).toBe(false);
    expect(result.wrongType).toHaveLength(1);
    expect(result.wrongType[0]).toMatch(/dashboardTheme/);
    expect(result.wrongType[0]).toMatch(/expected jsonb, found text/);
    expect(result.missing).toEqual([]);
  });

  it('reports an unreachable database as a failure, not as healthy', async () => {
    // "Cannot check" must not resolve to "fine". This is the whole reason the
    // check exists: a stale green signal is what let a two-database split go
    // unnoticed.
    queryRaw.mockRejectedValue(new Error('connection refused'));

    const result = await checkSchema();
    expect(result.ok).toBe(false);
    expect(result.missing[0]).toMatch(/could not query information_schema/);
    expect(result.missing[0]).toMatch(/connection refused/);
  });

  it('never throws, because a health check that crashes takes the service down', async () => {
    queryRaw.mockRejectedValue(new Error('boom'));
    await expect(checkSchema()).resolves.toBeDefined();
  });

  it('reports every missing column rather than stopping at the first', async () => {
    queryRaw.mockResolvedValue([]);
    const result = await checkSchema();
    expect(result.missing).toHaveLength(EXPECTED_COLUMNS.length);
  });
});

describe('schema check — what it reports about the target', () => {
  it('names the database host, because that is the question being answered', async () => {
    // Two databases are in play and the deployment never said which. The host is
    // how someone tells them apart; without it the check says only "broken".
    const original = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgresql://u:p@pgm-example.rds.ap-southeast-1.amazonaws.com:5432/pabandi';
    try {
      const result = await checkSchema();
      expect(result.target).toBe('pgm-example.rds.ap-southeast-1.amazonaws.com/pabandi');
    } finally {
      if (original === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = original;
    }
  });

  it('never includes the password in the reported target', async () => {
    const original = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgresql://user:sup3rs3cret@db.example.com:5432/pabandi';
    try {
      const result = await checkSchema();
      expect(result.target).not.toMatch(/sup3rs3cret/);
      expect(result.target).not.toMatch(/user:/);
    } finally {
      if (original === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = original;
    }
  });

  it('degrades to "unknown" rather than throwing on an unparseable URL', async () => {
    const original = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'not-a-url';
    try {
      const result = await checkSchema();
      expect(result.target).toBe('unknown');
      expect(result.ok).toBe(true); // The URL is cosmetic; the check still ran.
    } finally {
      if (original === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = original;
    }
  });
});

describe('the columns being checked are the ones that matter', () => {
  it('covers every column the retry and finality work added', () => {
    const keys = EXPECTED_COLUMNS.map((c) => `${c.table}.${c.column}`);
    expect(keys).toEqual(
      expect.arrayContaining([
        'ReconciliationMatch.retryCount',
        'ReconciliationMatch.settlementStatus',
        'ReconciliationMatch.settlesAt',
        'ReconciliationMatch.originalRail',
      ]),
    );
  });

  it('requires optional business payout columns to be nullable, not merely present', () => {
    // Present-but-NOT NULL still rejects a business with no Raast/IBAN, so a
    // presence-only check would call that healthy.
    const payoutColumns = EXPECTED_COLUMNS.filter(
      (c) => c.table === 'Business' && (c.column === 'raastId' || c.column === 'iban'),
    );
    expect(payoutColumns.length).toBe(2);
    for (const column of payoutColumns) {
      expect(column.nullable, `${column.column} must be checked as nullable`).toBe(true);
    }
  });

  it('explains what each column is for', () => {
    for (const column of EXPECTED_COLUMNS) {
      expect(column.purpose.length, `${column.column} needs a purpose`).toBeGreaterThan(10);
    }
  });

  it('ships every migrated object through the deploy path, not just prisma/migrations', () => {
    // The deploy path runs server/sql/*.sql (ensure-agent-tables.cjs and
    // tableBootstrap.ts), NOT `prisma migrate deploy`. Three 20261122 migrations
    // applied cleanly everywhere and still never reached production because their
    // objects existed only in the migration folder. This asserts the SQL file that
    // carries them is registered in BOTH lists, so it cannot drift out again.
    const fs = require('fs');
    const path = require('path');
    const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

    const hook = read('scripts/ensure-agent-tables.cjs');
    const boot = read('src/utils/tableBootstrap.ts');

    for (const [name, src] of [
      ['ensure-agent-tables.cjs', hook],
      ['tableBootstrap.ts', boot],
    ]) {
      expect(src, `${name} must run shipped-migrations.sql`).toContain('shipped-migrations.sql');
    }

    // And the file must actually carry the objects the check expects.
    const sql = read('sql/shipped-migrations.sql');
    for (const object of [
      '"employeeId"',
      '"checkedInAt"',
      '"checkedOutAt"',
      'dashboardTheme',
      'SMSLog',
      'ChannelMessage',
    ]) {
      expect(sql, `shipped-migrations.sql must create ${object}`).toContain(object);
    }
  });

  it('covers the columns the three 20261122 migrations added', () => {
    // These shipped as migrations only, and CI builds its schema with `db push`,
    // so nothing in the pipeline proves they reached production. This check is
    // the only thing that does.
    const keys = EXPECTED_COLUMNS.map((c) => `${c.table}.${c.column}`);
    expect(keys).toEqual(
      expect.arrayContaining([
        'Booking.employeeId',
        'Booking.checkedInAt',
        'Booking.checkedOutAt',
        'BusinessSettings.dashboardTheme',
        'SMSLog.businessId',
        'MerchantSubscription.tier',
      ]),
    );
  });
});