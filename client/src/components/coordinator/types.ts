import type { IconName } from './icons';

/**
 * The four former tabs, now filters. They live in the left rail rather than
 * in a tab strip because §3 of the spec makes them filters over one stream,
 * not pages — switching one must never look like navigating away.
 */
export type CoordinatorFilterId = 'dispatch' | 'review' | 'radar' | 'team';

export interface CoordinatorFilter {
  id: CoordinatorFilterId;
  /** Visible label. Plain language — "Waiting for your review", not "A2H queue". */
  label: string;
  icon: IconName;
  /** Null means "no badge", not zero. */
  count: number | null;
  /** One sentence for the "?" tooltip. */
  help: string;
  /**
   * Full sentence used as the accessible name when the rail is collapsed to
   * icon-only mode, where the visible label is hidden. Must carry the same
   * meaning as `label` plus `help`, because it is all a screen reader gets.
   */
  description: string;
}

/* ── Work orders ─────────────────────────────────────────────────────────── */

export type WorkOrderStatus =
  | 'DRAFT'
  | 'PENDING_ASSIGNMENT'
  | 'ASSIGNED'
  | 'EN_ROUTE'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ESCALATED';

export type WorkOrderPriority = 'EMERGENCY' | 'URGENT' | 'ROUTINE';

export type InvoiceStatus = 'NOT_READY' | 'READY' | 'INVOICED' | 'PAID';

/**
 * One explanatory factor behind a risk score.
 *
 * `factor` is the machine feature name and is never shown — §4.1 forbids raw
 * SHAP output. `plainLanguage` is the one-sentence explanation the LLM
 * produces per (factor, direction) pair, cached server-side (§7.3).
 */
export interface RiskFactor {
  factor: string;
  /** Signed contribution: positive raises the risk score, negative lowers it. */
  impact: number;
  plainLanguage: string;
}

export type RiskBand = 'low' | 'medium' | 'high';

/**
 * The model's input features, in their own units.
 *
 * The what-if strip needs them: a slider is only meaningful if the client
 * knows where it starts, and the deltas it sends are relative to these values.
 * They are business facts — how many jobs are booked today, how many days of
 * notice — not model internals, so exposing them is safe.
 */
export interface WorkOrderFeatures {
  schedule_density: number;
  lead_time_days: number;
  issue_type_complexity: number;
  technician_skill_match: number;
  technician_experience_years: number;
}

/** The deterministic HITL decision the server reached (§5). */
export type HitlPolicy = 'AUTONOMOUS' | 'ASSISTED' | 'HUMAN_MANDATORY';

/**
 * The predictive payload. Defined here in the shape §7 specifies so Phase 2
 * can render it and Phase 4 only has to supply it.
 *
 * `score` is the probability that this job goes wrong — NOT the probability
 * of on-time completion. §5's HITL matrix only makes sense that way (a score
 * below 0.35 is safe enough to run autonomously), and §4.1's example
 * "71% · High risk" agrees. The §9 demo script's "71% on-time completion
 * likelihood" contradicts both and is treated as a script error.
 */
export interface RiskAssessment {
  /** 0..1, higher means more likely to go wrong. */
  score: number;
  /** 0..1, distance from the decision boundary (§5). */
  confidence: number;
  /** Counterfactual range, not a point estimate (§7.2). */
  p10: number;
  p50: number;
  p90: number;
  /**
   * True when a simulated perturbation moved a feature more than 2 std-dev
   * from the training mean. Such results are greyed out, not hidden (§7.2).
   */
  outOfRange: boolean;
  /** Optional server-computed band; the client falls back to the thresholds. */
  band?: RiskBand;
  factors: RiskFactor[];
  /**
   * The feature values this score was computed from. Present only when the
   * server supplied them; the what-if strip needs them to place its sliders.
   */
  features?: WorkOrderFeatures;
  /** The HITL matrix's decision, so the UI can say what will happen next. */
  policy?: HitlPolicy;
  /**
   * False until the offline calibration has run against real history. The UI
   * says so rather than presenting placeholder weights as a considered score.
   */
  calibrated?: boolean;
}

export interface WorkOrderCustomer {
  id: string;
  name: string;
  phoneMasked?: string;
  addressMasked?: string;
}

export interface WorkOrderTechnician {
  id: string;
  name: string;
  skills: string[];
  active: boolean;
}

export interface WorkOrderAssignment {
  id: string;
  assignedAt: string;
  acceptedAt: string | null;
  declinedAt: string | null;
  technician: WorkOrderTechnician;
}

export interface WorkOrderAttachment {
  id: string;
  kind: string;
  url: string;
  createdAt: string;
}

/**
 * A work order as the surface consumes it. `normalizeWorkOrder` turns the
 * API's wire shape into this; `risk` is absent until Phase 4 supplies it.
 */
export interface WorkOrder {
  id: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  issueType: string;
  description: string;
  address: string;
  accessNotes?: string | null;
  scheduledFor?: string | null;
  createdAt: string;
  completedAt?: string | null;
  invoiceStatus: InvoiceStatus;
  customer: WorkOrderCustomer | null;
  assignments: WorkOrderAssignment[];
  attachments: WorkOrderAttachment[];
  auditCount: number;
  risk?: RiskAssessment;
}

/** The technician currently on the job, or null when unassigned. */
export function assignedTechnician(workOrder: WorkOrder): WorkOrderTechnician | null {
  return workOrder.assignments[0]?.technician ?? null;
}
