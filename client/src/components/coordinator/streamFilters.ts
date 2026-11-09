import type { RiskBand, WorkOrder } from './types';

/**
 * The stream filter.
 *
 * Two different things produce one of these: an explicit filter command
 * ("show high-risk leaks this week") and the silent search fallback when the
 * parser does not recognise the input. Sharing the shape means the stream has
 * exactly one way to be narrowed, and the "clear filter" control behaves the
 * same no matter how the filter got there.
 */
export interface StreamFilter {
  timeRange?: 'today' | 'tomorrow' | 'week';
  risk?: RiskBand;
  issueType?: string;
  search?: string;
}

export const EMPTY_FILTER: StreamFilter = {};

export function isFilterEmpty(filter: StreamFilter | undefined): filter is undefined {
  if (!filter) return true;
  return (
    filter.timeRange == null &&
    filter.risk == null &&
    filter.issueType == null &&
    filter.search == null
  );
}

function normalizeRange(range: string): StreamFilter['timeRange'] {
  const compact = range.replace(/[^a-z]/g, '');
  if (compact === 'today' || compact === 'tonight') return 'today';
  if (compact === 'tomorrow') return 'tomorrow';
  if (compact === 'thisweek' || compact === 'nextweek') return 'week';
  return undefined;
}

/**
 * Issue words the filter recognises. Matching is a substring test against the
 * work order's issue type, so "leaks" matches "Active Roof Leak".
 */
const ISSUE_WORDS = [
  'inspection',
  'maintenance',
  'repair',
  'replacement',
  'gutter',
  'cleaning',
  'hvac',
  'roofing',
  'leak',
  'emergency',
  'routine',
];

/**
 * Turns the words after "show" into a filter. Pure and total: anything it
 * does not understand is simply ignored, which is why an explicit filter
 * command never errors — it just narrows less than the user hoped.
 */
export function parseFilterIntent(text: string): StreamFilter {
  const filter: StreamFilter = {};

  const risk = /\b(low|medium|high)[-\s]?risk\b/i.exec(text)?.[1]?.toLowerCase() as
    | RiskBand
    | undefined;
  if (risk) filter.risk = risk;

  const range = normalizeRange(/\b(today|tomorrow|tonight|this\s+week|next\s+week)\b/i.exec(text)?.[1] ?? '');
  if (range) filter.timeRange = range;

  const issue = ISSUE_WORDS.find((word) => text.toLowerCase().includes(word));
  if (issue) filter.issueType = issue;

  return filter;
}

export function describeFilter(filter: StreamFilter): string {
  const parts: string[] = [];
  if (filter.risk) parts.push(`${filter.risk} risk`);
  if (filter.issueType) parts.push(filter.issueType);
  if (filter.timeRange) {
    parts.push(
      filter.timeRange === 'today'
        ? 'today'
        : filter.timeRange === 'tomorrow'
          ? 'tomorrow'
          : 'this week',
    );
  }
  if (filter.search) parts.push(`matching “${filter.search}”`);
  return parts.join(' · ');
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function isWithinRange(date: Date, range: 'today' | 'tomorrow' | 'week'): boolean {
  const target = startOfDay(date);
  const now = startOfDay(new Date());
  const diffDays = Math.round((target.getTime() - now.getTime()) / 86_400_000);

  if (range === 'today') return diffDays === 0;
  if (range === 'tomorrow') return diffDays === 1;
  return diffDays >= 0 && diffDays <= 7;
}

function matchesSearch(workOrder: WorkOrder, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  const haystack = [
    workOrder.id,
    workOrder.customer?.name ?? '',
    workOrder.address,
    workOrder.issueType,
    workOrder.description,
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(needle);
}

export function applyStreamFilter(workOrders: WorkOrder[], filter: StreamFilter): WorkOrder[] {
  if (isFilterEmpty(filter)) return workOrders;

  return workOrders.filter((workOrder) => {
    if (filter.timeRange) {
      const when = workOrder.scheduledFor
        ? new Date(workOrder.scheduledFor)
        : new Date(workOrder.createdAt);
      if (Number.isNaN(when.getTime()) || !isWithinRange(when, filter.timeRange)) return false;
    }

    if (filter.risk && workOrder.risk) {
      const score = workOrder.risk.score;
      const band =
        score < 0.35 ? 'low' : score > 0.7 ? 'high' : 'medium';
      if (band !== filter.risk) return false;
    } else if (filter.risk && !workOrder.risk) {
      // An unscored job cannot be shown as low, medium or high risk.
      return false;
    }

    if (filter.issueType && !workOrder.issueType.toLowerCase().includes(filter.issueType)) {
      return false;
    }

    if (filter.search && !matchesSearch(workOrder, filter.search)) return false;

    return true;
  });
}
