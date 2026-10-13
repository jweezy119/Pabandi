/**
 * The CRM's vocabulary, defined once.
 *
 * WHY THIS FILE EXISTS
 * The same six deal stages were written down in three different files, and one of
 * the three was missing `NEGOTIATION` — a stage the server accepts and the kanban
 * renders. Task priority was a dropdown in the UI and `typeof x === 'string' ? x
 * : 'MEDIUM'` on the server, so "high", "HIGH " and "urgent" all stored as
 * distinct values that no board displays. The client's Status dropdown offered four
 * statuses while the server accepted anything.
 *
 * Those are the same class of bug as the field loss fixed alongside this: a value
 * offered by the UI and a value honoured by the server, quietly disagreeing.
 *
 * WHERE IT LIVES, AND WHY THERE
 * Server-side, because the server is what enforces these rules — `parseStage` and
 * `parseClientStatus` already 400 on anything outside the set. Defining the
 * vocabulary next to the enforcement keeps them from drifting, and lets the client
 * import it through the `@shared` alias (see client/vite.config.ts and the
 * client tsconfig paths) rather than copying it.
 *
 * Nothing in here imports anything: no prisma, no express, no React. It is a leaf
 * module that both bundles and the server can depend on without pulling either
 * into the other's graph.
 *
 * WHAT IS DELIBERATELY NOT HERE
 * Phone and address validation. There is no local format reliable enough to
 * validate against — a Pakistani number, a Nigerian number and a UK number all
 * look like "digits" — and a wrong rejection is worse than an untidy value. Phone
 * stays free text and the UI should give it a good input mode instead of a rule.
 */

// ─── Clients ─────────────────────────────────────────────────────────────────

/**
 * A client's status is an editorial judgement about the relationship, not a
 * computed score: VIP is something a person decides, and at_risk is something they
 * mark when they know something the score does not. That is why this stays a
 * choice in the UI rather than becoming a computed field.
 */
export const CLIENT_STATUSES = ['ACTIVE', 'AT_RISK', 'VIP', 'INACTIVE'] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  ACTIVE: 'Active',
  AT_RISK: 'At risk',
  VIP: 'VIP',
  INACTIVE: 'Inactive',
};

export const CLIENT_STATUS_HELP: Record<ClientStatus, string> = {
  ACTIVE: 'Working with them now.',
  AT_RISK: 'Something has gone wrong — chase it before it costs you the relationship.',
  VIP: 'Your best customers. Worth keeping visible.',
  INACTIVE: 'Not lost, just not trading. Keeps their history and invoices.',
};

/**
 * The client lifecycle stage, computed by trust-core from their history. It is NOT
 * writable: `getClientStage` owns it. Listed here so the UI can render it and be
 * explicit that offering it as an input would be a lie.
 */
export const CLIENT_STAGES = ['lead', 'verified', 'booked', 'repeat', 'vip', 'at_risk'] as const;
export type ClientStage = (typeof CLIENT_STAGES)[number];

export const CLIENT_STAGE_LABELS: Record<ClientStage, string> = {
  lead: 'New lead',
  verified: 'Verified',
  booked: 'Booked',
  repeat: 'Repeat',
  vip: 'VIP',
  at_risk: 'At risk',
};

// ─── Deals ───────────────────────────────────────────────────────────────────

/**
 * Pipeline stages, and the probability each implies.
 *
 * Probability follows the stage by default. "This proposal is 90% likely" is
 * judgement, not arithmetic, and letting the two disagree is how a forecast stops
 * meaning anything — so the stage sets it unless someone deliberately overrides.
 */
export const DEAL_STAGES = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  LEAD: 'Lead',
  QUALIFIED: 'Qualified',
  PROPOSAL: 'Proposal',
  NEGOTIATION: 'Negotiation',
  WON: 'Won',
  LOST: 'Lost',
};

/** What each stage is worth as a share of the pipeline, in percent. */
export const STAGE_PROBABILITY: Record<DealStage, number> = {
  LEAD: 10,
  QUALIFIED: 30,
  PROPOSAL: 60,
  NEGOTIATION: 80,
  WON: 100,
  LOST: 0,
};

/**
 * Stages a deal can be in and still be counted as live pipeline. WON and LOST are
 * excluded deliberately: a forecast that sums closed deals is not a forecast.
 */
export const OPEN_DEAL_STAGES: DealStage[] = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION'];

export function isDealStage(value: unknown): value is DealStage {
  return typeof value === 'string' && (DEAL_STAGES as readonly string[]).includes(value);
}

export function isClientStatus(value: unknown): value is ClientStatus {
  return typeof value === 'string' && (CLIENT_STATUSES as readonly string[]).includes(value);
}

// ─── Jobs ────────────────────────────────────────────────────────────────────

/**
 * Job status is server-owned on create — every job starts SCHEDULED — and only
 * moves through these on an explicit status change. That is why CANCELLED is in
 * the list even though the old jobs filter never offered it: a cancelled job was
 * unreachable from the UI.
 */
export const JOB_STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

// ─── Activities and tasks ────────────────────────────────────────────────────

/**
 * An activity is something that happened. TASK is deliberately absent: tasks have
 * their own endpoint, their own status, priority and completion, so an activity
 * row claiming to be a task would appear on no board and could never complete.
 */
export const ACTIVITY_TYPES = ['NOTE', 'CALL', 'EMAIL', 'MEETING'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  NOTE: 'Note',
  CALL: 'Call',
  EMAIL: 'Email',
  MEETING: 'Meeting',
};

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
};

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
};

/**
 * A task board is ordered by urgency, and the sort is not the reverse of the
 * labels. DONE sorts last whatever its priority: a finished high-priority task
 * is not urgent.
 */
export const TASK_PRIORITY_ORDER: Record<TaskPriority, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

// ─── Invoices ────────────────────────────────────────────────────────────────

export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'overdue', 'defaulted'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
  defaulted: 'Defaulted',
};

// ─── Shape helpers for <select> ──────────────────────────────────────────────

/**
 * `{value, label}` pairs, for the ClaySelect primitive and the plain ones.
 *
 * Exported here so a form never builds its own array of options. A hand-typed
 * option list is exactly how NEGOTIATION went missing from the deal editor: the
 * list looked right, and disagreed with the server in a way nothing surfaced.
 */
export function options<T extends string>(
  values: readonly T[],
  labels: Record<T, string>,
): { value: T; label: string }[] {
  return values.map((v) => ({ value: v, label: labels[v] }));
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * The same shape the CSV importer has always used (crm.service.ts importClients).
 * The bulk importer was the strict path and the single-entry form the lax one,
 * which meant the same address imported cleanly in a spreadsheet and failed by
 * hand — with the inconsistency showing up as a bad address on an invoice months
 * later.
 *
 * Deliberately the same rule the CSV importer has always applied, because these
 * two are the only places an address is checked and a disagreement between them
 * means the same person can import an address by spreadsheet and be refused by
 * hand. It rejects what cannot be an address and is not otherwise clever: plus
 * addressing and multi-part domains pass. Quoted local parts, which are legal, do
 * not — and neither do they on import, so at least the two agree.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/**
 * A human-readable complaint, not just a boolean.
 *
 * Every other field in the CRM fails silently or with a server message the person
 * never sees; an email that will be rejected by the server on save is the easiest
 * place to be specific, because the person can fix it immediately without losing
 * what they typed. Returns null when the field is acceptable — including when it
 * is empty, because email is optional.
 */
export function validateEmailField(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!EMAIL_RE.test(trimmed)) {
    const at = trimmed.indexOf('@');
    if (at < 0) return 'An email address needs an @ — for example name@example.com';
    if (at === 0) return 'There is nothing before the @.';
    if (at === trimmed.length - 1) return 'There is nothing after the @.';
    if (!trimmed.slice(at + 1).includes('.')) {
      return 'That looks like it is missing a domain — for example example.com';
    }
    return 'That is not an email address we can send invoices to.';
  }
  return null;
}

/** The same, for a required name. Returns null when acceptable. */
export function validateNameField(value: string): string | null {
  if (!value.trim()) return 'A name is required — this is what shows on the invoice.';
  return null;
}