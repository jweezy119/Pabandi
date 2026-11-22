/**
 * Schema self-check — verify the database actually has what the code needs.
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * There are two databases in this project's story and nothing in the code or
 * the deployment could say which one the running service was using. `render.yaml`
 * sources `DATABASE_URL` from a Render-managed Postgres named `pabandi-db`;
 * `server/.env` and the manual-migrate workflow point at Aliyun RDS. Both have
 * been migrated at different times.
 *
 * The failure that follows from that is specific and terrible: a commit that
 * adds a column deploys immediately, because Render's autoDeploy is on, and the
 * new code queries that column on requests that reach the affected tables. If
 * it is talking to the other database, every one of those requests fails, and
 * nothing in the logs distinguishes "the database is broken" from "the
 * database is not the one you think it is".
 *
 * So this asks the database directly, and answers a question worth asking
 * before every request rather than only when one breaks.
 *
 * ─── WHAT IT CHECKS ─────────────────────────────────────────────────────────
 * Columns and nullability that running code depends on, not the whole schema.
 * A full diff would report the 67-statement divergence between schema.prisma and
 * the database that is expected and maintained elsewhere; what matters here is
 * whether anything the process actually reads is missing.
 *
 * ─── WHY IT NEVER THROWS ─────────────────────────────────────────────────────
 * A health check that crashes is a health check that takes the service down when
 * the thing it monitors is already broken. Every failure here becomes a value.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

/** A column the running code expects, and how it expects to find it. */
export interface ExpectedColumn {
  table: string;
  column: string;
  nullable?: boolean;
  /**
   * PostgreSQL type name from information_schema, when the SHAPE matters and not
   * just the presence. `dashboardTheme` is the case that justifies this: it
   * existed as TEXT for months while the client sent an object, so a presence
   * check passed and every dashboard save 500'd. A column that is there but is
   * the wrong type is the same failure as a column that is missing.
   */
  dataType?: string;
  /** Why the code needs it. Surfaced in the report so a failure is actionable. */
  purpose: string;
}

/**
 * What the current code reads on ordinary request paths.
 *
 * Grouped by the change that introduced them, because "why does this matter"
 * is otherwise unanswerable from a column name.
 */
export const EXPECTED_COLUMNS: ExpectedColumn[] = [
  // rail-router / payment retry — ReconciliationMatch, added 20261010.
  {
    table: 'ReconciliationMatch',
    column: 'retryCount',
    purpose: 'auto-retry: decides whether a failed payment retries or escalates',
  },
  {
    table: 'ReconciliationMatch',
    column: 'settlementStatus',
    purpose: 'settlement finality: settled vs still inside a chargeback window',
  },
  {
    table: 'ReconciliationMatch',
    column: 'settlesAt',
    purpose: 'settlement finality: when settlement stops being provisional',
  },
  {
    table: 'ReconciliationMatch',
    column: 'originalRail',
    purpose: 'auto-retry: keeps where an invoice first started after a rail switch',
  },

  // Business payout rails — registration and Raast payout paths read these.
  {
    table: 'Business',
    column: 'raastId',
    nullable: true,
    purpose: 'Raast payout destination for a business',
  },
  {
    table: 'Business',
    column: 'iban',
    nullable: true,
    purpose: 'IBAN payout destination for a business',
  },
  {
    table: 'BusinessSettings',
    column: 'allowDisputes',
    purpose: 'business settings: whether disputes are allowed',
  },
  {
    table: 'Booking',
    column: 'depositPaid',
    purpose: 'booking deposit state read by the booking flow',
  },

  // Job assignment — 20261122_booking_job_assignment. The assignee lives on the
  // booking; before this there was nowhere to record it and no double-booking
  // guard at all.
  {
    table: 'Booking',
    column: 'employeeId',
    nullable: true,
    purpose: 'job assignment: which CRM employee a job is booked against',
  },
  {
    table: 'Booking',
    column: 'checkedInAt',
    nullable: true,
    purpose: 'check-in timestamp, read to compute job duration on checkout',
  },
  {
    table: 'Booking',
    column: 'checkedOutAt',
    nullable: true,
    purpose: 'check-out timestamp on a completed job',
  },

  // 20261122_dashboard_theme_json. The column existed as TEXT; the client sends an
  // object, so every dashboard save 500'd while a presence-only check passed.
  {
    table: 'BusinessSettings',
    column: 'dashboardTheme',
    nullable: true,
    dataType: 'jsonb',
    purpose: 'dashboard theme: ModularDashboard saves an object, settings.service reads it back as one',
  },

  // 20261122_sms_models. One column from each restored table: the whole SMS
  // feature 404'd without them.
  {
    table: 'SMSLog',
    column: 'businessId',
    purpose: 'SMS log tenant scoping — an unscoped read leaks another business\'s messages',
  },
  {
    table: 'MerchantSubscription',
    column: 'tier',
    purpose: 'tier gating: SMS reminders are refused on the free and starter plans',
  },
  {
    table: 'BusinessSmsProvider',
    column: 'businessId',
    purpose: 'per-business Twilio credentials used to verify the delivery webhook',
  },
  {
    table: 'ChannelMessage',
    column: 'businessId',
    purpose: 'unified inbox message mirror',
  },
];

export interface SchemaCheckResult {
  ok: boolean;
  /** Present only when ok is false. */
  missing: string[];
  /** Present only when ok is false. Nullability the database does not match. */
  notNullable: string[];
  /** Present only when ok is false. Columns whose type is not what code expects. */
  wrongType: string[];
  /** Host and database name. No password — this is reported, not logged. */
  target: string;
  checked: number;
}

/**
 * Identify which database this process is attached to, for the log line only.
 *
 * Credentials are never included. The host is enough to tell two databases
 * apart, which is the entire question.
 */
function describeTarget(): string {
  const url = process.env.DATABASE_URL ?? '';
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}/${parsed.pathname.replace(/^\//, '')}`;
  } catch {
    return 'unknown';
  }
}

/** Check the expected columns. Never throws. */
export async function checkSchema(): Promise<SchemaCheckResult> {
  const target = describeTarget();
  const missing: string[] = [];
  const notNullable: string[] = [];
  const wrongType: string[] = [];

  try {
    // One round trip for every column, rather than one query per column: this
    // runs on a request path and 6 queries to information_schema on a remote
    // database is 6 round trips.
    const rows = await prisma.$queryRaw<
      Array<{ table_name: string; column_name: string; is_nullable: string; data_type: string }>
    >`
      SELECT table_name, column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND (table_name, column_name) IN (
          ${Prisma.join(EXPECTED_COLUMNS.map((c) => Prisma.sql`(${c.table}, ${c.column})`))}
        )
    `;

    const found = new Map(rows.map((r) => [`${r.table_name}.${r.column_name}`, r]));

    for (const expected of EXPECTED_COLUMNS) {
      const key = `${expected.table}.${expected.column}`;
      const row = found.get(key);
      if (!row) {
        missing.push(`${key} — ${expected.purpose}`);
        continue;
      }
      if (expected.nullable === true && row.is_nullable !== 'YES') {
        notNullable.push(`${key} — expected nullable; ${expected.purpose}`);
      }
      if (expected.dataType && row.data_type !== expected.dataType) {
        wrongType.push(
          `${key} — expected ${expected.dataType}, found ${row.data_type}; ${expected.purpose}`,
        );
      }
    }
  } catch (err) {
    // A database we cannot query is itself the finding. Reported as missing
    // rather than as a distinct state, because from the caller's point of view
    // "cannot check" and "not there" both mean "do not trust this".
    missing.push(`could not query information_schema: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    ok: missing.length === 0 && notNullable.length === 0 && wrongType.length === 0,
    missing,
    notNullable,
    wrongType,
    target,
    checked: EXPECTED_COLUMNS.length,
  };
}

/**
 * Log the check once at boot.
 *
 * The host goes to the log rather than to /health because logs are private and
 * the endpoint is not. This is the line that answers "which database is this
 * service actually using", which is the question that started all of it.
 */
export async function logSchemaCheck(): Promise<SchemaCheckResult> {
  const result = await checkSchema();
  if (result.ok) {
    logger.info(`[SchemaCheck] OK — ${result.checked} columns present. Attached to ${result.target}.`);
  } else {
    logger.error(
      `[SchemaCheck] FAILED against ${result.target}: ` +
        `${result.missing.length} missing, ${result.notNullable.length} wrong nullability, ` +
        `${result.wrongType.length} wrong type.`,
    );
    for (const item of result.missing) logger.error(`[SchemaCheck]   missing: ${item}`);
    for (const item of result.notNullable) logger.error(`[SchemaCheck]   ${item}`);
    for (const item of result.wrongType) logger.error(`[SchemaCheck]   ${item}`);
    logger.error(
      '[SchemaCheck] Running code expects a migration this database has not had. ' +
        'Requests touching these tables will fail until `prisma migrate deploy` has run against THIS database.',
    );
  }
  return result;
}