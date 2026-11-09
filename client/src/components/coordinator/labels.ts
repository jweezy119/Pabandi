import type { InvoiceStatus, WorkOrderPriority, WorkOrderStatus } from './types';

/**
 * Status and priority are stored as machine enums and shown as plain language.
 * §4.1: a first-time owner should not have to decode "EN_ROUTE".
 *
 * These are display strings only — the enum is what gets sent back to the API.
 */
export const STATUS_LABEL: Record<WorkOrderStatus, string> = {
  DRAFT: 'Draft',
  PENDING_ASSIGNMENT: 'Not assigned yet',
  ASSIGNED: 'Assigned',
  EN_ROUTE: 'On the way',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  ESCALATED: 'Escalated',
};

export const PRIORITY_LABEL: Record<WorkOrderPriority, string> = {
  EMERGENCY: 'Emergency',
  URGENT: 'Urgent',
  ROUTINE: 'Routine',
};

export const INVOICE_LABEL: Record<InvoiceStatus, string> = {
  NOT_READY: 'Not ready to invoice',
  READY: 'Ready to invoice',
  INVOICED: 'Invoiced',
  PAID: 'Paid',
};

/** Priorities that should read as urgent in the UI. */
export function isUrgentPriority(priority: WorkOrderPriority): boolean {
  return priority === 'EMERGENCY' || priority === 'URGENT';
}

/** Attachment kinds are stored lowercase; show them as words. */
export const ATTACHMENT_KIND_LABEL: Record<string, string> = {
  photo: 'Photo',
  report: 'Report',
  signature: 'Signature',
};

export function attachmentLabel(kind: string): string {
  return ATTACHMENT_KIND_LABEL[kind] ?? kind;
}

/**
 * The API identifies work orders by cuid, which no human can read or say out
 * loud. The last six characters are stable and unique enough to refer to a
 * job on a call, and the mono font marks it as an identifier rather than a
 * word (§2).
 */
export function shortWorkOrderId(id: string): string {
  return id.replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase();
}

/** "2026-11-09T09:00:00.000Z" → "Nov 9, 9:00 AM". Data, so callers use mono. */
export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return 'Not scheduled';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Not scheduled';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}
