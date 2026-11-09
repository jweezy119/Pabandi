import type { RiskAssessment, RiskBand, WorkOrder, WorkOrderFeatures, WorkOrderStatus } from './types';

/**
 * Turns the API's wire shape into the `WorkOrder` the surface renders.
 *
 * Exists as a named function rather than an inline `.map()` in the page
 * because the list endpoint returns Prisma's `_count` wrapper and a masked
 * customer object, and silently reading the wrong field is exactly the kind
 * of bug that renders an empty-looking card with no error.
 */
export function normalizeWorkOrder(raw: any): WorkOrder {
  const status = (raw.status ?? 'DRAFT') as WorkOrderStatus;

  return {
    id: String(raw.id),
    status,
    priority: raw.priority ?? 'ROUTINE',
    issueType: raw.issueType ?? 'General',
    description: raw.description ?? '',
    address: raw.address ?? '',
    accessNotes: raw.accessNotes ?? null,
    scheduledFor: raw.scheduledFor ?? null,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    completedAt: raw.completedAt ?? null,
    invoiceStatus: raw.invoiceStatus ?? 'NOT_READY',
    customer: raw.customer
      ? {
          id: String(raw.customer.id),
          name: raw.customer.name ?? 'Unknown customer',
          phoneMasked: raw.customer.phoneMasked,
          addressMasked: raw.customer.addressMasked,
        }
      : null,
    assignments: Array.isArray(raw.assignments)
      ? raw.assignments.map((assignment: any) => ({
          id: String(assignment.id),
          assignedAt: assignment.assignedAt ?? new Date().toISOString(),
          acceptedAt: assignment.acceptedAt ?? null,
          declinedAt: assignment.declinedAt ?? null,
          technician: {
            id: String(assignment.technician?.id ?? ''),
            name: assignment.technician?.name ?? 'Unknown technician',
            skills: Array.isArray(assignment.technician?.skills)
              ? assignment.technician.skills
              : [],
            active: Boolean(assignment.technician?.active),
          },
        }))
      : [],
    attachments: Array.isArray(raw.attachments)
      ? raw.attachments.map((attachment: any) => ({
          id: String(attachment.id),
          kind: attachment.kind ?? 'photo',
          url: attachment.url ?? '',
          createdAt: attachment.createdAt ?? new Date().toISOString(),
        }))
      : [],
    // Prisma returns `_count: { auditLog: n }`; the surface wants a flat number.
    auditCount: raw._count?.auditLog ?? 0,
    risk: riskAssessmentFromApi(raw.risk) ?? undefined,
  };
}

/**
 * The predictive payload's wire shape → the client's `RiskAssessment`.
 *
 * The server names things differently (`riskScore` vs `score`,
 * `plain_language` vs `plainLanguage`) and omits the counterfactual range on
 * the point endpoint. The range is collapsed onto the point rather than
 * defaulted to a fabricated spread: a range that has not been computed must
 * not look like a range that has.
 *
 * Returns null when the payload is absent or not a number, so a work order
 * with no score renders no chip at all — §4.1 forbids inventing one.
 */
export function riskAssessmentFromApi(payload: any): RiskAssessment | null {
  if (!payload || typeof payload.riskScore !== 'number') return null;

  const score = payload.riskScore;
  const band = payload.band as RiskBand | undefined;

  return {
    score,
    confidence: typeof payload.confidence === 'number' ? payload.confidence : 0,
    p10: typeof payload.p10 === 'number' ? payload.p10 : score,
    p50: typeof payload.p50 === 'number' ? payload.p50 : score,
    p90: typeof payload.p90 === 'number' ? payload.p90 : score,
    outOfRange: Boolean(payload.outOfRange),
    band: band === 'low' || band === 'medium' || band === 'high' ? band : undefined,
    factors: Array.isArray(payload.factors)
      ? payload.factors
          .filter((factor: any) => factor && typeof factor.plain_language === 'string')
          .map((factor: any) => ({
            factor: String(factor.factor ?? ''),
            impact: Number(factor.impact ?? 0),
            plainLanguage: factor.plain_language,
          }))
      : [],
    features: normalizeFeatures(payload.features),
    policy: payload.policy,
    calibrated: Boolean(payload.calibrated),
  };
}

/**
 * Reads the feature vector, dropping any key the client does not recognise so
 * a server that adds a feature cannot put an unknown slider on screen.
 */
export function normalizeFeatures(raw: any): WorkOrderFeatures | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const read = (key: keyof WorkOrderFeatures, fallback = 0): number => {
    const value = Number(raw[key]);
    return Number.isFinite(value) ? value : fallback;
  };

  return {
    schedule_density: read('schedule_density'),
    lead_time_days: read('lead_time_days'),
    issue_type_complexity: read('issue_type_complexity'),
    technician_skill_match: read('technician_skill_match'),
    technician_experience_years: read('technician_experience_years'),
  };
}
