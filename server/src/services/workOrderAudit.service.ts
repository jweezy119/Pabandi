import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export interface AuditParams {
  workOrderId: string;
  actorId: string;
  action: string; // e.g. "CREATED", "STATUS_CHANGE", "ASSIGNED", "ATTACHMENT_ADDED", "COMPLETED", "TRIAGE_RUN"
  before?: any;
  after?: any;
  requestId: string;
}

/**
 * Append-only immutable audit trail for Work Orders.
 * No update or delete methods exist in this service or across any route.
 */
export async function recordWorkOrderAudit(params: AuditParams): Promise<void> {
  try {
    const { workOrderId, actorId, action, before, after, requestId } = params;

    // Sanitize any PII in audit payloads
    const sanitizePayload = (obj: any) => {
      if (!obj || typeof obj !== 'object') return obj;
      const clone = { ...obj };
      if (clone.phone) clone.phone = '[REDACTED]';
      if (clone.customerPhone) clone.customerPhone = '[REDACTED]';
      return clone;
    };

    await prisma.workOrderAudit.create({
      data: {
        workOrderId,
        actorId,
        action,
        before: before ? sanitizePayload(before) : null,
        after: after ? sanitizePayload(after) : null,
        requestId: requestId || `req_${Date.now()}`,
      },
    });

    logger.info(`[AuditLog] WorkOrder ${workOrderId} Action: ${action} by Actor: ${actorId} (Req: ${requestId})`);
  } catch (err: any) {
    // Non-fatal logging to ensure main operation flow is not interrupted
    logger.error(`[AuditLog] Failed to record audit for WorkOrder ${params.workOrderId}:`, err.message);
  }
}

