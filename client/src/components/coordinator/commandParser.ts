import { shortWorkOrderId } from './labels';
import { isFilterEmpty, parseFilterIntent } from './streamFilters';
import type { WorkOrder } from './types';

/**
 * The deterministic command parser (§8 Phase 3).
 *
 * Deliberately not a natural-language model: three intents, matched by regex,
 * with everything else falling through to a silent search (§11 forbids a full
 * NL-to-SQL system). Pure functions only — the parser never touches the API,
 * so the whole grammar can be unit-tested against fixtures.
 *
 * The parser resolves nothing. It returns the *query text* the user typed; the
 * caller resolves that against real data, because only the caller knows how
 * many technicians are called Marcus. That split is what makes ambiguity
 * detectable instead of silently resolved.
 */

export type CommandIntent = 'assign' | 'filter' | 'approve_batch';

export interface AssignIntent {
  kind: 'assign';
  workOrderQuery: string;
  technicianQuery: string;
  whenText: string | null;
  when: Date | null;
}

export interface FilterIntent {
  kind: 'filter';
  filter: ReturnType<typeof parseFilterIntent>;
  /** The words the user typed, kept for the confirmation strip. */
  raw: string;
}

export interface ApproveBatchIntent {
  kind: 'approve_batch';
  filter: ReturnType<typeof parseFilterIntent>;
  raw: string;
}

export type ParsedIntent = AssignIntent | FilterIntent | ApproveBatchIntent;

export type ParseResult = { status: 'intent'; intent: ParsedIntent } | { status: 'unknown' };

const ASSIGN_RE = /^\s*assign\s+(.+?)\s+to\s+(.+)$/i;
const FILTER_RE = /^\s*(?:show|list|filter|find|display)\s+(.+)$/i;
const APPROVE_RE = /^\s*(?:approve|accept|sign\s+off(?:\s+on)?)\s+(?:all\s+)?(?:the\s+)?(.+)$/i;

/** A day word or a clock time. Used to split "Marcus tomorrow 9am". */
const TIME_RE =
  /\b(tomorrow|today|tonight|this\s+week|next\s+week|\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i;

/**
 * Parses a command from free text.
 *
 * Order matters: `assign` first (it is the most specific), then `filter`,
 * then `approve_batch`. Anything unrecognised returns `unknown` so the caller
 * can fall back to search without an error message.
 */
export function parseCommand(input: string, now: Date = new Date()): ParseResult {
  const text = input.trim();
  if (!text) return { status: 'unknown' };

  const assign = ASSIGN_RE.exec(text);
  if (assign) {
    const tail = assign[2].trim();
    const { rest: technicianQuery, whenText } = splitWhen(tail);
    const technicianQueryClean = stripPrepositions(technicianQuery);

    if (technicianQueryClean) {
      return {
        status: 'intent',
        intent: {
          kind: 'assign',
          workOrderQuery: assign[1].trim(),
          technicianQuery: technicianQueryClean,
          whenText,
          when: whenText ? parseWhen(whenText, now) : null,
        },
      };
    }
    // "assign 1425 to" — no technician named. Fall through to search rather
    // than pretending the command was understood.
    return { status: 'unknown' };
  }

  const filter = FILTER_RE.exec(text);
  if (filter) {
    const parsed = parseFilterIntent(filter[1]);
    // A filter with nothing recognizable is not a filter; treat it as a search
    // so "show me the money" does not silently render the whole list.
    if (!isFilterEmpty(parsed)) {
      return { status: 'intent', intent: { kind: 'filter', filter: parsed, raw: filter[1].trim() } };
    }
    return { status: 'unknown' };
  }

  const approve = APPROVE_RE.exec(text);
  if (approve) {
    const qualifier = approve[1].trim();
    const parsed = parseFilterIntent(qualifier);
    const isBlanket = /\b(all|everything|any|outstanding|pending)\b/i.test(qualifier);
    if (!isFilterEmpty(parsed) || isBlanket) {
      return {
        status: 'intent',
        intent: { kind: 'approve_batch', filter: parsed, raw: qualifier },
      };
    }
    return { status: 'unknown' };
  }

  return { status: 'unknown' };
}

/* ── Resolution ─────────────────────────────────────────────────────────── */

/** The subset of a technician the command bar needs. */
export interface CommandTechnician {
  id: string;
  name: string;
  active?: boolean;
}

export interface ResolveContext {
  workOrders: WorkOrder[];
  technicians: CommandTechnician[];
  now?: Date;
}

export interface AmbiguityOption {
  id: string;
  label: string;
}

export type ExecutableCommand =
  | { kind: 'assign'; workOrder: WorkOrder; technician: CommandTechnician; when: Date | null }
  | { kind: 'filter'; filter: ReturnType<typeof parseFilterIntent>; raw: string }
  | { kind: 'approve_batch'; filter: ReturnType<typeof parseFilterIntent>; raw: string };

export type Resolution =
  | { status: 'ok'; command: ExecutableCommand }
  | {
      status: 'ambiguous';
      slot: 'workOrder' | 'technician';
      query: string;
      options: AmbiguityOption[];
      pending: ParsedIntent;
    }
  | {
      status: 'unresolved';
      slot: 'workOrder' | 'technician';
      query: string;
      pending: ParsedIntent;
    };

export function resolveCommand(
  intent: ParsedIntent,
  context: ResolveContext,
  now: Date = new Date(),
): Resolution {
  if (intent.kind !== 'assign') {
    return { status: 'ok', command: intent };
  }

  const workOrderMatches = intent.workOrderQuery
    ? context.workOrders.filter((workOrder) => matchesWorkOrder(workOrder, intent.workOrderQuery))
    : [];

  if (workOrderMatches.length > 1) {
    return {
      status: 'ambiguous',
      slot: 'workOrder',
      query: intent.workOrderQuery,
      options: workOrderMatches.map((workOrder) => ({
        id: workOrder.id,
        label: workOrderLabel(workOrder),
      })),
      pending: intent,
    };
  }

  if (workOrderMatches.length === 0) {
    return {
      status: 'unresolved',
      slot: 'workOrder',
      query: intent.workOrderQuery,
      pending: intent,
    };
  }

  const technicianMatches = context.technicians.filter(
    (technician) =>
      technician.active !== false &&
      matchesTechnician(technician, intent.technicianQuery),
  );

  if (technicianMatches.length > 1) {
    return {
      status: 'ambiguous',
      slot: 'technician',
      query: intent.technicianQuery,
      options: technicianMatches.map((technician) => ({
        id: technician.id,
        label: technician.name,
      })),
      pending: intent,
    };
  }

  if (technicianMatches.length === 0) {
    return {
      status: 'unresolved',
      slot: 'technician',
      query: intent.technicianQuery,
      pending: intent,
    };
  }

  return {
    status: 'ok',
    command: {
      kind: 'assign',
      workOrder: workOrderMatches[0],
      technician: technicianMatches[0],
      when: intent.when ?? (intent.whenText ? parseWhen(intent.whenText, now) : null),
    },
  };
}

function workOrderLabel(workOrder: WorkOrder): string {
  const customer = workOrder.customer?.name ?? 'Unknown customer';
  return `${shortWorkOrderId(workOrder.id)} · ${customer} · ${workOrder.address || workOrder.issueType}`;
}

function matchesWorkOrder(workOrder: WorkOrder, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return false;

  return (
    workOrder.id.toLowerCase().includes(needle) ||
    shortWorkOrderId(workOrder.id).toLowerCase().includes(needle) ||
    (workOrder.customer?.name ?? '').toLowerCase().includes(needle) ||
    workOrder.address.toLowerCase().includes(needle) ||
    workOrder.issueType.toLowerCase().includes(needle)
  );
}

function matchesTechnician(technician: CommandTechnician, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return false;
  return technician.name.toLowerCase().includes(needle);
}

/* ── Time ───────────────────────────────────────────────────────────────── */

function stripPrepositions(text: string): string {
  return text
    .replace(/\s+(at|on|for)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits a trailing time off a technician name: "Marcus Reed tomorrow 9am"
 * → name "Marcus Reed", time text "tomorrow 9am". Anything before the first
 * time token is the name; anything after it is folded back in.
 */
function splitWhen(text: string): { rest: string; whenText: string | null } {
  const match = TIME_RE.exec(text);
  if (!match) return { rest: text.trim(), whenText: null };

  const before = text.slice(0, match.index).trim();
  const after = text.slice(match.index + match[0].length).trim();

  // "tomorrow 9am" is one time phrase split across two tokens, so the trailing
  // part belongs with the time. "Marcus 9am Reed" has a name after the time, so
  // that part belongs with the name.
  const afterIsTime = after !== '' && TIME_RE.test(after);

  const whenText = [match[0], ...(afterIsTime ? [after] : [])].filter(Boolean).join(' ').trim();
  const rest = stripPrepositions(
    [before, ...(afterIsTime ? [] : [after])].filter(Boolean).join(' '),
  );

  return { rest, whenText };
}

/**
 * Deterministic clock parser for the phrases the command bar accepts.
 * Returns null when no explicit time is present — a bare "tomorrow" is not a
 * schedule, and inventing 9:00am would put a time in the confirmation the
 * user never typed.
 */
export function parseWhen(text: string, now: Date = new Date()): Date | null {
  const lower = text.toLowerCase();
  let dayOffset: number | null = null;
  let matched = false;

  if (/\btomorrow\b/.test(lower)) {
    dayOffset = 1;
    matched = true;
  } else if (/\btonight\b/.test(lower)) {
    dayOffset = 0;
    matched = true;
  } else if (/\btoday\b/.test(lower)) {
    dayOffset = 0;
    matched = true;
  } else if (/\bnext\s+week\b/.test(lower)) {
    dayOffset = 7;
    matched = true;
  } else if (/\bthis\s+week\b/.test(lower)) {
    dayOffset = 0;
    matched = true;
  }

  const timeMatch = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/.exec(lower);
  let hour: number | null = null;
  let minute = 0;

  if (timeMatch) {
    matched = true;
    const raw = Number(timeMatch[1]);
    minute = timeMatch[2] ? Number(timeMatch[2]) : 0;
    const meridiem = timeMatch[3];

    if (meridiem === 'am') hour = raw % 12;
    else if (meridiem === 'pm') hour = (raw % 12) + 12;
    else if (raw >= 0 && raw <= 23) hour = raw;

    if (minute < 0 || minute > 59) hour = null;
  }

  if (!matched || hour == null) return null;

  const result = new Date(now);
  result.setDate(result.getDate() + (dayOffset ?? 0));
  result.setHours(hour, minute, 0, 0);
  return result;
}

export function formatWhen(when: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(when);
}
