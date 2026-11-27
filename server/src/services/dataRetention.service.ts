import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
// Retention is a maintenance job, not a tenant request: use the shared pool so
// it does not open a second set of connections that nothing ever disconnects.
import { prisma } from '../utils/database';

export interface RetentionPolicyConfig {
  name: string;
  description?: string;
  retentionDays: number;
  enabled?: boolean;
  applyToDeletedUsers?: boolean;
}

// Default retention policies (can be overridden via database)
export const DEFAULT_RETENTION_POLICIES: RetentionPolicyConfig[] = [
  {
    name: 'notifications',
    description: 'User notifications and alerts',
    retentionDays: 90,
    enabled: true,
  },
  {
    name: 'sms_logs',
    description: 'SMS delivery logs',
    retentionDays: 365,
    enabled: true,
  },
  {
    name: 'channel_messages',
    description: 'WhatsApp/Telegram/SMS channel messages',
    retentionDays: 365,
    enabled: true,
  },
  {
    name: 'audit_logs',
    description: 'Trust audit trails and agent action audits',
    retentionDays: 2555, // 7 years for compliance
    enabled: true,
    applyToDeletedUsers: true,
  },
  {
    name: 'ledger_entries',
    description: 'Financial ledger entries',
    retentionDays: 2555, // 7 years for tax compliance
    enabled: true,
    applyToDeletedUsers: true,
  },
  {
    name: 'payment_records',
    description: 'Payment, payout, and escrow records',
    retentionDays: 2555, // 7 years for tax compliance
    enabled: true,
    applyToDeletedUsers: true,
  },
  {
    name: 'crm_data',
    description: 'CRM clients, deals, tasks, activities',
    retentionDays: 1095, // 3 years
    enabled: true,
  },
  {
    name: 'booking_history',
    description: 'Completed/cancelled booking records',
    retentionDays: 1095, // 3 years
    enabled: true,
  },
  {
    name: 'dispute_records',
    description: 'Dispute and evidence records',
    retentionDays: 2555, // 7 years for legal
    enabled: true,
    applyToDeletedUsers: true,
  },
  {
    name: 'session_data',
    description: 'Expired session and CSRF tokens',
    retentionDays: 30,
    enabled: true,
  },
  {
    name: 'webhook_logs',
    description: 'Webhook endpoint delivery logs',
    retentionDays: 90,
    enabled: true,
  },
  {
    name: 'simulation_data',
    description: 'Project simulation runs',
    retentionDays: 180,
    enabled: true,
  },
];

/**
 * Initialize default retention policies in database
 */
export async function initializeRetentionPolicies(): Promise<void> {
  for (const policy of DEFAULT_RETENTION_POLICIES) {
    await prisma.dataRetentionPolicy.upsert({
      where: { name: policy.name },
      create: policy,
      update: {
        description: policy.description,
        retentionDays: policy.retentionDays,
        enabled: policy.enabled ?? true,
        applyToDeletedUsers: policy.applyToDeletedUsers ?? false,
      },
    });
  }
  logger.info('Data retention policies initialized');
}

/**
 * Delete old notifications
 */
async function deleteOldNotifications(cutoffDate: Date, includeDeletedUsers: boolean): Promise<number> {
  const where: Prisma.NotificationWhereInput = {
    createdAt: { lt: cutoffDate },
  };
  
  if (!includeDeletedUsers) {
    where.user = { email: { not: { startsWith: 'deleted_' } } };
  }

  const result = await prisma.notification.deleteMany({ where });
  return result.count;
}

/**
 * Delete old SMS logs
 */
async function deleteOldSmsLogs(cutoffDate: Date, includeDeletedUsers: boolean): Promise<number> {
  const where: Prisma.SMSLogWhereInput = {
    createdAt: { lt: cutoffDate },
  };
  
  if (!includeDeletedUsers) {
    where.business = { owner: { email: { not: { startsWith: 'deleted_' } } } };
  }

  const result = await prisma.sMSLog.deleteMany({ where });
  return result.count;
}

/**
 * Delete old channel messages
 */
async function deleteOldChannelMessages(cutoffDate: Date, includeDeletedUsers: boolean): Promise<number> {
  const where: Prisma.ChannelMessageWhereInput = {
    createdAt: { lt: cutoffDate },
  };
  
  if (!includeDeletedUsers) {
    where.business = { owner: { email: { not: { startsWith: 'deleted_' } } } };
  }

  const result = await prisma.channelMessage.deleteMany({ where });
  return result.count;
}

/**
 * Delete old audit logs (TrustAuditTrail)
 */
async function deleteOldAuditLogs(cutoffDate: Date, includeDeletedUsers: boolean): Promise<number> {
  const where: Prisma.TrustAuditTrailWhereInput = {
    createdAt: { lt: cutoffDate },
  };
  
  if (!includeDeletedUsers) {
    where.user = { email: { not: { startsWith: 'deleted_' } } };
  }

  const result = await prisma.trustAuditTrail.deleteMany({ where });
  return result.count;
}

/**
 * Delete old agent action audits
 */
async function deleteOldAgentActionAudits(cutoffDate: Date, includeDeletedUsers: boolean): Promise<number> {
  const where: Prisma.AgentActionAuditWhereInput = {
    createdAt: { lt: cutoffDate },
  };
  
  if (!includeDeletedUsers) {
    // AgentActionAudit has userId directly, need to join via user
    where.userId = { 
      in: await prisma.user.findMany({
        where: { email: { not: { startsWith: 'deleted_' } } },
        select: { id: true }
      }).then(users => users.map(u => u.id))
    };
  }

  const result = await prisma.agentActionAudit.deleteMany({ where });
  return result.count;
}

/**
 * Delete old ledger entries
 */
async function deleteOldLedgerEntries(cutoffDate: Date, includeDeletedUsers: boolean): Promise<number> {
  // Ledger doesn't have direct user relation, skip user filter
  const result = await prisma.ledger.deleteMany({
    where: { createdAt: { lt: cutoffDate } },
  });
  return result.count;
}

/**
 * Delete old payment records (retain for compliance by default)
 * This is a no-op for compliance - payments are retained longer
 */
async function deleteOldPaymentRecords(cutoffDate: Date, includeDeletedUsers: boolean): Promise<number> {
  // Payment records are retained for 7 years by default for tax compliance
  // Only delete if explicitly configured with shorter retention
  return 0;
}

/**
 * Delete old CRM data
 */
async function deleteOldCrmData(cutoffDate: Date, includeDeletedUsers: boolean): Promise<number> {
  let total = 0;

  // CrmClient - has business relation
  const clientWhere: Prisma.CrmClientWhereInput = {
    createdAt: { lt: cutoffDate },
  };
  if (!includeDeletedUsers) {
    clientWhere.business = { owner: { email: { not: { startsWith: 'deleted_' } } } };
  }
  total += (await prisma.crmClient.deleteMany({ where: clientWhere })).count;

  // CrmDeal - uses businessId
  const dealWhere: Prisma.CrmDealWhereInput = {
    createdAt: { lt: cutoffDate },
  };
  if (!includeDeletedUsers) {
    const validBusinessIds = await prisma.business.findMany({
      where: { owner: { email: { not: { startsWith: 'deleted_' } } } },
      select: { id: true }
    }).then(b => b.map(x => x.id));
    dealWhere.businessId = { in: validBusinessIds };
  }
  total += (await prisma.crmDeal.deleteMany({ where: dealWhere })).count;

  // CrmTask - uses businessId
  const taskWhere: Prisma.CrmTaskWhereInput = {
    createdAt: { lt: cutoffDate },
  };
  if (!includeDeletedUsers) {
    const validBusinessIds = await prisma.business.findMany({
      where: { owner: { email: { not: { startsWith: 'deleted_' } } } },
      select: { id: true }
    }).then(b => b.map(x => x.id));
    taskWhere.businessId = { in: validBusinessIds };
  }
  total += (await prisma.crmTask.deleteMany({ where: taskWhere })).count;

  // CrmActivity - uses businessId
  const activityWhere: Prisma.CrmActivityWhereInput = {
    createdAt: { lt: cutoffDate },
  };
  if (!includeDeletedUsers) {
    const validBusinessIds = await prisma.business.findMany({
      where: { owner: { email: { not: { startsWith: 'deleted_' } } } },
      select: { id: true }
    }).then(b => b.map(x => x.id));
    activityWhere.businessId = { in: validBusinessIds };
  }
  total += (await prisma.crmActivity.deleteMany({ where: activityWhere })).count;

  // CrmFile - uses businessId
  const fileWhere: Prisma.CrmFileWhereInput = {
    createdAt: { lt: cutoffDate },
  };
  if (!includeDeletedUsers) {
    const validBusinessIds = await prisma.business.findMany({
      where: { owner: { email: { not: { startsWith: 'deleted_' } } } },
      select: { id: true }
    }).then(b => b.map(x => x.id));
    fileWhere.businessId = { in: validBusinessIds };
  }
  total += (await prisma.crmFile.deleteMany({ where: fileWhere })).count;

  return total;
}

/**
 * Delete old booking history (completed/cancelled)
 */
async function deleteOldBookingHistory(cutoffDate: Date, includeDeletedUsers: boolean): Promise<number> {
  const where: Prisma.BookingWhereInput = {
    status: { in: ['completed', 'cancelled'] },
    updatedAt: { lt: cutoffDate },
  };
  
  if (!includeDeletedUsers) {
    where.business = { owner: { email: { not: { startsWith: 'deleted_' } } } };
  }

  const result = await prisma.booking.deleteMany({ where });
  return result.count;
}

/**
 * Delete old dispute records
 */
async function deleteOldDisputeRecords(cutoffDate: Date, includeDeletedUsers: boolean): Promise<number> {
  let total = 0;

  // Disputes
  const disputeWhere: Prisma.DisputeWhereInput = {
    createdAt: { lt: cutoffDate },
  };
  if (!includeDeletedUsers) {
    disputeWhere.user = { email: { not: { startsWith: 'deleted_' } } };
  }
  total += (await prisma.dispute.deleteMany({ where: disputeWhere })).count;

  // DisputeEvidence (via WorkOrder)
  const evidenceWhere: Prisma.DisputeEvidenceWhereInput = {
    uploadedAt: { lt: cutoffDate },
    workOrder: {
      business: { owner: { email: { not: { startsWith: 'deleted_' } } } },
    },
  };
  if (includeDeletedUsers) {
    delete evidenceWhere.workOrder;
  }
  total += (await prisma.disputeEvidence.deleteMany({ where: evidenceWhere })).count;

  return total;
}

/**
 * Delete old session data (handled by express-session store typically)
 * This is a placeholder for custom session cleanup if needed
 */
async function deleteOldSessionData(cutoffDate: Date): Promise<number> {
  // Sessions are typically cleaned up by the session store
  // This would need a custom session store implementation
  return 0;
}

/**
 * Delete old webhook logs
 */
async function deleteOldWebhookLogs(cutoffDate: Date, includeDeletedUsers: boolean): Promise<number> {
  const where: Prisma.WebhookEndpointWhereInput = {
    updatedAt: { lt: cutoffDate },
  };
  
  if (!includeDeletedUsers) {
    where.business = { owner: { email: { not: { startsWith: 'deleted_' } } } };
  }

  // Note: We don't delete webhook endpoints, just old delivery logs if we had them
  // For now, return 0 as we don't have a separate webhook log model
  return 0;
}

/**
 * Delete old simulation data
 */
async function deleteOldSimulationData(cutoffDate: Date, includeDeletedUsers: boolean): Promise<number> {
  let total = 0;

  const simWhere: Prisma.ProjectSimulationWhereInput = {
    createdAt: { lt: cutoffDate },
  };
  if (!includeDeletedUsers) {
    const validUserIds = await prisma.user.findMany({
      where: { email: { not: { startsWith: 'deleted_' } } },
      select: { id: true }
    }).then(users => users.map(u => u.id));
    simWhere.userId = { in: validUserIds };
  }
  total += (await prisma.projectSimulation.deleteMany({ where: simWhere })).count;

  return total;
}

/**
 * Policy handler mapping
 */
const POLICY_HANDLERS: Record<string, (cutoff: Date, includeDeleted: boolean) => Promise<number>> = {
  notifications: deleteOldNotifications,
  sms_logs: deleteOldSmsLogs,
  channel_messages: deleteOldChannelMessages,
  audit_logs: deleteOldAuditLogs,
  ledger_entries: deleteOldLedgerEntries,
  payment_records: deleteOldPaymentRecords,
  crm_data: deleteOldCrmData,
  booking_history: deleteOldBookingHistory,
  dispute_records: deleteOldDisputeRecords,
  session_data: deleteOldSessionData,
  webhook_logs: deleteOldWebhookLogs,
  simulation_data: deleteOldSimulationData,
};

/**
 * Run data retention for a specific policy
 */
export async function runRetentionPolicy(policyName: string): Promise<{ success: boolean; recordsDeleted: number; error?: string }> {
  const policy = await prisma.dataRetentionPolicy.findUnique({
    where: { name: policyName },
  });

  if (!policy) {
    return { success: false, recordsDeleted: 0, error: `Policy not found: ${policyName}` };
  }

  if (!policy.enabled) {
    return { success: true, recordsDeleted: 0, error: 'Policy disabled' };
  }

  const handler = POLICY_HANDLERS[policyName];
  if (!handler) {
    return { success: false, recordsDeleted: 0, error: `No handler for policy: ${policyName}` };
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

  const startedAt = new Date();
  let recordsDeleted = 0;
  let status: 'SUCCESS' | 'PARTIAL' | 'FAILED' = 'SUCCESS';
  let errorMessage: string | undefined;

  try {
    recordsDeleted = await handler(cutoffDate, policy.applyToDeletedUsers);
  } catch (error) {
    status = 'FAILED';
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Retention policy ${policyName} failed:`, error);
  }

  const completedAt = new Date();

  // Log the run
  await prisma.dataRetentionLog.create({
    data: {
      policyId: policy.id,
      recordsDeleted,
      status,
      errorMessage,
      startedAt,
      completedAt,
      metadata: { cutoffDate: cutoffDate.toISOString() },
    },
  });

  logger.info(`Retention policy ${policyName} completed: ${recordsDeleted} records deleted, status: ${status}`);

  return { success: status !== 'FAILED', recordsDeleted, error: errorMessage };
}

/**
 * Run all enabled retention policies
 */
export async function runAllRetentionPolicies(): Promise<{ results: Record<string, { success: boolean; recordsDeleted: number; error?: string }>; totalDeleted: number }> {
  const policies = await prisma.dataRetentionPolicy.findMany({
    where: { enabled: true },
  });

  const results: Record<string, { success: boolean; recordsDeleted: number; error?: string }> = {};
  let totalDeleted = 0;

  for (const policy of policies) {
    const result = await runRetentionPolicy(policy.name);
    results[policy.name] = result;
    totalDeleted += result.recordsDeleted;
  }

  return { results, totalDeleted };
}

/**
 * Get retention policy status
 */
export async function getRetentionPolicyStatus(): Promise<Array<{
  name: string;
  description: string | null;
  retentionDays: number;
  enabled: boolean;
  applyToDeletedUsers: boolean;
  lastRun: Date | null;
  lastRunStatus: string | null;
  lastRunRecordsDeleted: number;
}>> {
  const policies = await prisma.dataRetentionPolicy.findMany({
    include: {
      logs: {
        orderBy: { startedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { name: 'asc' },
  });

  return policies.map((p) => ({
    name: p.name,
    description: p.description,
    retentionDays: p.retentionDays,
    enabled: p.enabled,
    applyToDeletedUsers: p.applyToDeletedUsers,
    lastRun: p.logs[0]?.startedAt ?? null,
    lastRunStatus: p.logs[0]?.status ?? null,
    lastRunRecordsDeleted: p.logs[0]?.recordsDeleted ?? 0,
  }));
}