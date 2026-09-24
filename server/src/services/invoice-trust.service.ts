import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { eventBus } from './event-bus.service';
import { trustAuditWriter } from './trustAuditWriter';

// Helper to compute decay factor for a paymentScore event
function paymentScoreDecayFactor(ageDays: number): number {
  // 180-day half-life: decayFactor = 0.5^(ageDays / 180)
  return Math.pow(0.5, ageDays / 180);
}

// Map event types to deltas for paymentScore
const PAYMENT_SCORE_DELTAS: Record<string, number> = {
  'invoice.sent': 0,            // log only, no score change
  'invoice.paid_on_time': 50,   // positive delta
  'invoice.paid_late': -10,     // negative small delta
  'invoice.overdue': -30,       // negative significant delta (cron)
  'invoice.defaulted': -100,    // negative significant delta
};

// Determine the paymentScore delta for an invoice status change
async function getPaymentScoreDelta(
  oldStatus: string,
  newStatus: string,
  timestamp: Date,
  isPaidOnTime?: boolean,
  isOverdue?: boolean,
  isDefaulted?: boolean
): { delta: number; eventType: string } {
  const now = new Date();
  const ageMs = now.getTime() - timestamp.getTime();
  const ageDays = Math.max(0, ageMs / (1000 * 60 * 60 * 24));

  let eventType: string;
  let baseDelta: number;

  // Determine event type based on status transition
  if (newStatus === 'sent' && oldStatus !== 'sent') {
    eventType = 'invoice.sent';
    baseDelta = PAYMENT_SCORE_DELTAS['invoice.sent'];
  } else if (newStatus === 'paid') {
    if (isPaidOnTime !== false) {
      // default to paid_on_time if not explicitly late
      eventType = 'invoice.paid_on_time';
      baseDelta = PAYMENT_SCORE_DELTAS['invoice.paid_on_time'];
    } else {
      eventType = 'invoice.paid_late';
      baseDelta = PAYMENT_SCORE_DELTAS['invoice.paid_late'];
    }
  } else if (newStatus === 'overdue') {
    eventType = 'invoice.overdue';
    baseDelta = PAYMENT_SCORE_DELTAS['invoice.overdue'];
  } else if (newStatus === 'defaulted') {
    eventType = 'invoice.defaulted';
    baseDelta = PAYMENT_SCORE_DELTAS['invoice.defaulted'];
  } else {
    // No score change for other transitions
    return { delta: 0, eventType: '' };
  }

  const decay = paymentScoreDecayFactor(ageDays);
  const delta = Math.round(baseDelta * decay);

  return { delta, eventType };
}

// Get passportId (TrustPassport id) for a client (CrmClient)
async function getPassportIdForClient(clientId: string): Promise<string | null> {
  // Traverse: CrmClient -> serviceBusiness -> Business -> owner -> TrustPassport (by userId)
  const client = await prisma.crmClient.findUnique({
    where: { id: clientId },
    select: { serviceBusinessId: true },
  });
  if (!client) return null;

  const serviceBusiness = await prisma.crmServiceBusiness.findUnique({
    where: { id: client.serviceBusinessId },
    select: { businessId: true },
  });
  if (!serviceBusiness) return null;

  const business = await prisma.business.findUnique({
    where: { id: serviceBusiness.businessId },
    select: { ownerId: true },
  });
  if (!business?.ownerId) return null;

  const trustPassport = await prisma.trustPassport.findUnique({
    where: { userId: business.ownerId },
    select: { id: true },
  });
  return trustPassport?.id ?? null;
}

// Check if an invoice event has already been recorded
async function invoiceEventExists(invoiceId: string, eventType: string): Promise<boolean> {
  const event = await prisma.invoiceTrustEvent.findFirst({
    where: { invoiceId, eventType },
  });
  return !!event;
}

// Record a new invoice event
async function recordInvoiceEvent(invoiceId: string, passportId: string, eventType: string): Promise<void> {
  await prisma.invoiceTrustEvent.create({
    data: {
      invoiceId,
      passportId,
      eventType,
      scoreBefore: previousScore,
      scoreAfter: newScore,
    },
  });
}

// Update paymentScore for a passportId with a delta, applying decay factor
async function updatePaymentScore(
  passportId: string,
  delta: number,
  eventType: string,
  eventTimestamp: Date,
  auditComponent: string = 'PAYMENT_INVOICE'
): Promise<void> {
  const now = new Date();
  const ageMs = now.getTime() - eventTimestamp.getTime();
  const ageDays = Math.max(0, ageMs / (1000 * 60 * 60 * 24));

  const passport = await prisma.trustPassport.findUnique({
    where: { id: passportId },
  });
  if (!passport) {
    logger.error(`[InvoiceTrust] TrustPassport not found for id ${passportId}`);
    return;
  }

  const previousScore = passport.paymentScore;
  const decay = paymentScoreDecayFactor(ageDays);
  const adjustedDelta = Math.round(delta * decay);
  const newScore = Math.max(0, Math.min(1000, (previousScore ?? 500) + adjustedDelta));

  // Log audit entry
  await trustAuditWriter.enqueue({
    userId: passport.userId ?? '',
    previousScore: previousScore ?? 500,
    newScore,
    changeReason: `Invoice event: ${eventType}`,
    component: auditComponent,
    severity: delta > 0 ? 'positive' : 'negative',
    weightUsed: decay,
    metadata: { invoiceEventType: eventType, ageDays },
    methodology: '1.0.0',
  });

  // Update paymentScore in TrustPassport
  await prisma.trustPassport.update({
    where: { id: passportId },
    data: { paymentScore: newScore },
  });

  logger.info(
    `[InvoiceTrust] Updated paymentScore for passport ${passportId} from ${previousScore} to ${newScore} (delta=${adjustedDelta}, decay=${decay.toFixed(4)})`
  );
}

// Process an invoice status change
async function processInvoiceStatusChange(
  invoiceId: string,
  clientId: string,
  oldStatus: string,
  newStatus: string,
  timestamp: Date,
  isPaidOnTime: boolean = true,
  isOverdue: boolean = false,
  isDefaulted: boolean = false
): Promise<void> {
  // Get passportId for the client
  const passportId = await getPassportIdForClient(clientId);
  if (!passportId) {
    logger.warn(`[InvoiceTrust] No passportId found for client ${clientId}`);
    return;
  }

  // Determine delta and event type
  const { delta, eventType } = getPaymentScoreDelta(
    oldStatus,
    newStatus,
    timestamp,
    isPaidOnTime,
    isOverdue,
    isDefaulted
  );

  // If no delta, skip (e.g., invoice.sent)
  if (delta === 0 && eventType !== 'invoice.sent') return;

  // Check idempotency
  const exists = await invoiceEventExists(invoiceId, eventType);
  if (exists) {
    logger.info(`[InvoiceTrust] Event already recorded: invoiceId=${invoiceId}, eventType=${eventType}`);
    return;
  }

  // Record the event
  await recordInvoiceEvent(invoiceId, passportId, eventType);

  // Emit event via event bus (for other consumers)
  eventBus.emitEvent(eventType, {
    invoiceId,
    passportId,
    clientId,
    timestamp,
    delta,
  });

  // Update paymentScore (only for events that affect score)
  if (delta !== 0) {
    await updatePaymentScore(passportId, delta, eventType, timestamp);
  }
}

export const invoiceTrustService = {
  processInvoiceStatusChange,
};
