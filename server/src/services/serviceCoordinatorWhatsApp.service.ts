import { logger } from '../utils/logger';
import { maskPhone } from '../utils/pii';
import { sendWhatsAppMessage } from './ai.service';

// Forbidden promotional terms as per Meta Utility Template policy
const FORBIDDEN_MARKETING_TERMS = [
  'discount',
  'promo',
  'promotion',
  'offer',
  'deal',
  'sale',
  'claim now',
  'free',
  'save %',
  'limited time',
  'voucher',
  'cashback',
  'coupon',
];

export interface WorkOrderDispatchNotification {
  technicianName: string;
  technicianPhone: string;
  workOrderId: string;
  priority: string;
  issueType: string;
  address: string;
  accessNotes?: string | null;
  appUrl: string;
}

export interface StatusUpdateNotification {
  recipientPhone: string;
  workOrderId: string;
  status: string;
  address: string;
  scheduledTime?: string;
}

// Memory queue for messages when template is pending approval or gateway offline
export interface QueuedMessage {
  id: string;
  recipientPhone: string;
  templateName: string;
  payload: any;
  status: 'QUEUED_PENDING_APPROVAL' | 'SENT' | 'REJECTED_NON_COMPLIANT';
  queuedAt: Date;
  reason?: string;
}

const messageQueue: QueuedMessage[] = [];

/**
 * Validates text strictly against Meta WhatsApp Utility guidelines.
 */
function validateUtilityCompliance(text: string): { compliant: boolean; violation?: string } {
  const lower = text.toLowerCase();
  for (const term of FORBIDDEN_MARKETING_TERMS) {
    if (lower.includes(term)) {
      return {
        compliant: false,
        violation: `Message contains prohibited marketing term: "${term}". Utility messages only.`,
      };
    }
  }
  return { compliant: true };
}

/**
 * Dispatches an approved WhatsApp utility template notification for technician assignment.
 */
export async function sendTechnicianDispatchWhatsApp(
  data: WorkOrderDispatchNotification
): Promise<{ success: boolean; queued: boolean; messageId?: string; error?: string }> {
  const templateText = `[Pabandi Dispatch] Hello ${data.technicianName}, you have been assigned Work Order #${data.workOrderId.slice(-6)} (Priority: ${data.priority}). Issue: ${data.issueType} at ${data.address}.${data.accessNotes ? ` Access: ${data.accessNotes}.` : ''} Review job: ${data.appUrl}`;

  // 1. Strict compliance check
  const compliance = validateUtilityCompliance(templateText);
  if (!compliance.compliant) {
    logger.warn(`[WhatsApp Compliance] Blocked non-compliant message: ${compliance.violation}`);
    return { success: false, queued: false, error: compliance.violation };
  }

  // 2. Check provider readiness
  const isProviderReady = Boolean(process.env.OPENWA_API_KEY || process.env.EVOLUTION_API_KEY);

  if (!isProviderReady) {
    logger.info(`[WhatsApp Queue] OpenWA/Evolution API not configured. Queuing dispatch message for ${maskPhone(data.technicianPhone)}`);
    messageQueue.push({
      id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      recipientPhone: data.technicianPhone,
      templateName: 'WORK_ORDER_ASSIGNED',
      payload: data,
      status: 'QUEUED_PENDING_APPROVAL',
      queuedAt: new Date(),
      reason: 'WhatsApp provider offline or pending template verification',
    });
    return { success: true, queued: true };
  }

  // 3. Send message via existing WhatsApp integration
  try {
    const msgId = await sendWhatsAppMessage(data.technicianPhone, templateText);
    logger.info(`[WhatsApp Dispatch] Sent WorkOrder #${data.workOrderId} notification to ${maskPhone(data.technicianPhone)}`);
    return { success: true, queued: false, messageId: msgId || undefined };
  } catch (err: any) {
    logger.error(`[WhatsApp Dispatch] Failed to send message to ${maskPhone(data.technicianPhone)}:`, err.message);
    messageQueue.push({
      id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      recipientPhone: data.technicianPhone,
      templateName: 'WORK_ORDER_ASSIGNED',
      payload: data,
      status: 'QUEUED_PENDING_APPROVAL',
      queuedAt: new Date(),
      reason: err.message,
    });
    return { success: true, queued: true };
  }
}

/**
 * Returns queued messages for audit/inspection
 */
export function getQueuedWhatsAppMessages(): QueuedMessage[] {
  return [...messageQueue];
}

