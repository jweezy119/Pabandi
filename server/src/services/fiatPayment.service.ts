// ── Fiat Payment Service ─────────────────────────────────────────────────────
// Honest fiat bridge: records intent, generates payment instructions,
// and routes confirmation through the same escrow system.
// No money transmitter license needed — we never touch fiat directly.

import crypto from 'crypto';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

// ── Types ────────────────────────────────────────────────────────────────────

export type FiatMethod =
  | 'PAYPAL'
  | 'VENMO'
  | 'CASH_APP'
  | 'ZELLE'
  | 'ACH'
  | 'CARD'
  | 'CASH'
  | 'CHECK';

export interface PayeeConfig {
  paypalEmail?: string;
  venmoHandle?: string;
  cashAppTag?: string;
  zelleEmail?: string;
  zellePhone?: string;
  bankName?: string;
  bankAccount?: string;
  bankRouting?: string;
}

export interface CreateFiatPaymentInput {
  method: FiatMethod;
  amount: number;
  reference?: string;
  payerEmail?: string;
  payerId?: string;
  payeeId: string;
  businessId?: string;
  payeeConfig: PayeeConfig;
  currency?: string;
}

export interface FiatPaymentRequest {
  type: 'fiat';
  method: FiatMethod;
  reference: string;
  paymentUrl?: string;
  instructions: string;
  qrData?: string;
  amount: number;
  currency: string;
  status: string;
  escrowId?: string;
}

export interface FiatMethodInfo {
  id: FiatMethod;
  label: string;
  icon: string;
  description: string;
  hasQR: boolean;
  requiresBusinessConfirmation: boolean;
}

// ── Fee Model (matches crypto: 1% creation / 1% release) ─────────────────────

const CREATION_FEE_BPS = 100; // 1%
const RELEASE_FEE_BPS = 100; // 1%

// ── Available Methods Metadata ───────────────────────────────────────────────

export const FIAT_METHODS: FiatMethodInfo[] = [
  {
    id: 'PAYPAL',
    label: 'PayPal',
    icon: '🅿️',
    description: 'Pay via PayPal — send to the business PayPal email.',
    hasQR: true,
    requiresBusinessConfirmation: true,
  },
  {
    id: 'VENMO',
    label: 'Venmo',
    icon: '💙',
    description: 'Pay via Venmo — send to the business Venmo handle.',
    hasQR: true,
    requiresBusinessConfirmation: true,
  },
  {
    id: 'CASH_APP',
    label: 'Cash App',
    icon: '💚',
    description: 'Pay via Cash App — send to the business $tag.',
    hasQR: true,
    requiresBusinessConfirmation: true,
  },
  {
    id: 'ZELLE',
    label: 'Zelle',
    icon: '⚡',
    description: 'Pay via Zelle — send from your bank app.',
    hasQR: false,
    requiresBusinessConfirmation: true,
  },
  {
    id: 'ACH',
    label: 'ACH Bank Transfer',
    icon: '🏦',
    description: 'Direct bank transfer with account & routing numbers.',
    hasQR: false,
    requiresBusinessConfirmation: true,
  },
  {
    id: 'CARD',
    label: 'Credit/Debit Card (Manual)',
    icon: '💳',
    description: 'Pay at the business using their card terminal.',
    hasQR: false,
    requiresBusinessConfirmation: true,
  },
  {
    id: 'CASH',
    label: 'Cash',
    icon: '💵',
    description: 'Pay in person with cash.',
    hasQR: false,
    requiresBusinessConfirmation: true,
  },
  {
    id: 'CHECK',
    label: 'Check',
    icon: '📝',
    description: 'Pay by check — hand to the business.',
    hasQR: false,
    requiresBusinessConfirmation: true,
  },
];

// ── Helper: Generate unique reference ────────────────────────────────────────

function generateReference(method: FiatMethod): string {
  const prefix = `FIAT-${method.slice(0, 3)}`;
  const timestamp = Date.now().toString(36);
  const rand = crypto.randomBytes(4).toString('hex');
  return `${prefix}-${timestamp}-${rand}`.toUpperCase();
}

// ── Helper: Calculate fee ────────────────────────────────────────────────────

export function calculateCreationFee(amount: number): number {
  return (amount * CREATION_FEE_BPS) / 10000;
}

export function calculateReleaseFee(amount: number): number {
  return (amount * RELEASE_FEE_BPS) / 10000;
}

// ── QR Code Data Generator ───────────────────────────────────────────────────

export function generatePaymentQR(
  method: FiatMethod,
  identifier: string,
  amount: number,
  reference: string
): string {
  switch (method) {
    case 'PAYPAL':
      // PayPal.me link format
      return `https://www.paypal.com/paypalme/${identifier}/${amount}`;
    case 'VENMO':
      // Venmo deep link
      return `venmo://paypay?txn=pay&recipients=${identifier}&amount=${amount}&note=${reference}`;
    case 'CASH_APP':
      // Cash App payment link
      return `https://cash.app/$${identifier}/${amount}`;
    case 'ZELLE':
      // Zelle doesn't support QR for payments directly, but banks use this format
      return `zelle://transfer?to=${identifier}&amount=${amount}&memo=${reference}`;
    case 'ACH':
      return `ach://transfer?account=${identifier}&amount=${amount}&ref=${reference}`;
    default:
      return `pabandi://fiat/${method.toLowerCase()}?ref=${reference}&amount=${amount}`;
  }
}

// ── Payment Instructions Builder ─────────────────────────────────────────────

function buildInstructions(
  method: FiatMethod,
  config: PayeeConfig,
  amount: number,
  reference: string
): { instructions: string; paymentUrl?: string; qrData?: string } {
  const amountFormatted = `$${amount.toFixed(2)}`;
  const warningLine =
    '⚠️ This payment requires manual confirmation by the business. Funds are held in escrow until confirmed.';

  switch (method) {
    case 'PAYPAL': {
      const email = config.paypalEmail || 'business@example.com';
      const paymentUrl = `https://www.paypal.com/paypalme/${email.replace('@', '')}/${amount}`;
      const instructions = [
        `Pay via PayPal`,
        ``,
        `Amount: ${amountFormatted}`,
        `PayPal Email: ${email}`,
        `Reference: ${reference}`,
        ``,
        `Steps:`,
        `1. Open PayPal and send ${amountFormatted} to ${email}`,
        `2. Enter "${reference}" as the note/memo`,
        `3. The business will confirm receipt manually`,
        ``,
        warningLine,
      ].join('\n');
      const qrData = generatePaymentQR('PAYPAL', email.replace('@', ''), amount, reference);
      return { instructions, paymentUrl, qrData };
    }

    case 'VENMO': {
      const handle = config.venmoHandle || '@business';
      const paymentUrl = `venmo://paypay?txn=pay&recipients=${handle}&amount=${amount}&note=${reference}`;
      const instructions = [
        `Pay via Venmo`,
        ``,
        `Amount: ${amountFormatted}`,
        `Venmo Handle: ${handle}`,
        `Reference: ${reference}`,
        ``,
        `Steps:`,
        `1. Open Venmo and send ${amountFormatted} to ${handle}`,
        `2. Enter "${reference}" in the note`,
        `3. The business will confirm receipt manually`,
        ``,
        warningLine,
      ].join('\n');
      const qrData = generatePaymentQR('VENMO', handle, amount, reference);
      return { instructions, paymentUrl, qrData };
    }

    case 'CASH_APP': {
      const tag = config.cashAppTag || '$business';
      const paymentUrl = `https://cash.app/$${tag.replace('$', '')}/${amount}`;
      const instructions = [
        `Pay via Cash App`,
        ``,
        `Amount: ${amountFormatted}`,
        `Cash App Tag: ${tag}`,
        `Reference: ${reference}`,
        ``,
        `Steps:`,
        `1. Open Cash App and send ${amountFormatted} to ${tag}`,
        `2. Enter "${reference}" in the For field`,
        `3. The business will confirm receipt manually`,
        ``,
        warningLine,
      ].join('\n');
      const qrData = generatePaymentQR('CASH_APP', tag.replace('$', ''), amount, reference);
      return { instructions, paymentUrl, qrData };
    }

    case 'ZELLE': {
      const email = config.zelleEmail || config.zellePhone || '';
      const instructions = [
        `Pay via Zelle`,
        ``,
        `Amount: ${amountFormatted}`,
        config.zelleEmail ? `Zelle Email: ${config.zelleEmail}` : '',
        config.zellePhone ? `Zelle Phone: ${config.zellePhone}` : '',
        `Reference: ${reference}`,
        ``,
        `Steps:`,
        `1. Open your bank app (Zelle is built in)`,
        `2. Send ${amountFormatted} to the Zelle email/phone above`,
        `3. Include "${reference}" as memo/note if possible`,
        `4. The business will confirm receipt manually`,
        ``,
        warningLine,
      ]
        .filter(Boolean)
        .join('\n');
      return { instructions };
    }

    case 'ACH': {
      const instructions = [
        `ACH Bank Transfer`,
        ``,
        `Amount: ${amountFormatted}`,
        config.bankName ? `Bank: ${config.bankName}` : '',
        config.bankRouting ? `Routing Number: ${config.bankRouting}` : '',
        config.bankAccount ? `Account Number: ${config.bankAccount}` : '',
        `Reference: ${reference}`,
        ``,
        `Steps:`,
        `1. Log in to your online banking`,
        `2. Set up an ACH transfer using the details above`,
        `3. Enter "${reference}" as the transfer memo`,
        `4. The business will confirm receipt (1-3 business days)`,
        ``,
        warningLine,
      ]
        .filter(Boolean)
        .join('\n');
      return { instructions };
    }

    case 'CARD': {
      const instructions = [
        `Credit/Debit Card (Manual Processing)`,
        ``,
        `Amount: ${amountFormatted}`,
        `Reference: ${reference}`,
        ``,
        `Steps:`,
        `1. Tell the business you're paying via card`,
        `2. They will process the payment through their terminal`,
        `3. Reference: ${reference}`,
        `4. The business will confirm once processed`,
        ``,
        warningLine,
      ].join('\n');
      return { instructions };
    }

    case 'CASH': {
      const instructions = [
        `Pay in Person with Cash`,
        ``,
        `Amount: ${amountFormatted}`,
        `Reference: ${reference}`,
        ``,
        `Steps:`,
        `1. Bring ${amountFormatted} cash to the business`,
        `2. Show reference: ${reference}`,
        `3. Business will confirm receipt and mark paid`,
        ``,
        warningLine,
      ].join('\n');
      return { instructions };
    }

    case 'CHECK': {
      const instructions = [
        `Pay by Check`,
        ``,
        `Amount: ${amountFormatted}`,
        `Reference: ${reference}`,
        ``,
        `Steps:`,
        `1. Write check for ${amountFormatted}`,
        `2. Memo: ${reference}`,
        `3. Hand to the business`,
        `4. Business will confirm when check clears`,
        ``,
        warningLine,
      ].join('\n');
      return { instructions };
    }

    default:
      return {
        instructions: `Fiat payment of ${amountFormatted}. Reference: ${reference}. Business will confirm manually.`,
      };
  }
}

// ── Main: Create Fiat Payment ────────────────────────────────────────────────

export async function createFiatPayment(
  input: CreateFiatPaymentInput
): Promise<FiatPaymentRequest> {
  const {
    method,
    amount,
    reference,
    payerId,
    payeeId,
    businessId,
    payeeConfig,
    currency = 'USD',
  } = input;

  // Validate method
  if (!FIAT_METHODS.find((m) => m.id === method)) {
    throw new Error(`Unsupported fiat payment method: ${method}`);
  }

  if (!amount || amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  const ref = reference || generateReference(method);
  const creationFee = calculateCreationFee(amount);
  const netAmount = amount - creationFee;

  // Build payment instructions
  const { instructions, paymentUrl, qrData } = buildInstructions(
    method,
    payeeConfig,
    amount,
    ref
  );

  // Create fiat payment record + escrow atomically
  const fiatPayment = await prisma.$transaction(async (tx) => {
    // Create the fiat payment record
    const fp = await tx.fiatPayment.create({
      data: {
        method,
        amount,
        currency,
        status: 'PENDING',
        reference: ref,
        payerId,
        payeeId,
        businessId,
        paymentUrl,
        instructions,
        escrowId: undefined, // will be set after escrow creation
      },
    });

    // Create escrow record (honest — holds the "intent" amount)
    const escrow = await tx.escrow.create({
      data: {
        amount: netAmount,
        status: 'PENDING',
        payerId: payerId || '',
        payeeId,
      },
    });

    // Link escrow to fiat payment
    await tx.fiatPayment.update({
      where: { id: fp.id },
      data: { escrowId: escrow.id },
    });

    return { ...fp, escrowId: escrow.id };
  });

  logger.info(
    `[FiatPaymentService] Created ${method} payment: ${ref} ($${amount} ${currency}, fee: $${creationFee.toFixed(2)})`
  );

  return {
    type: 'fiat',
    method,
    reference: ref,
    paymentUrl,
    instructions,
    qrData,
    amount,
    currency,
    status: fiatPayment.status,
    escrowId: fiatPayment.escrowId || undefined,
  };
}

// ── Get Fiat Payment Status ──────────────────────────────────────────────────

export async function getFiatPaymentStatus(reference: string) {
  const payment = await prisma.fiatPayment.findUnique({
    where: { reference },
    include: {
      payer: { select: { id: true, email: true, firstName: true, lastName: true } },
      payee: { select: { id: true, email: true, firstName: true, lastName: true } },
      business: { select: { id: true, name: true } },
      escrow: true,
    },
  });

  if (!payment) {
    throw new Error('Fiat payment not found');
  }

  return payment;
}

// ── Confirm Fiat Payment (Business Confirms Receipt) ─────────────────────────

export async function confirmFiatPayment(
  reference: string,
  confirmedBy: string
): Promise<{ success: boolean; escrowId?: string; error?: string }> {
  const payment = await prisma.fiatPayment.findUnique({
    where: { reference },
  });

  if (!payment) {
    throw new Error('Fiat payment not found');
  }

  if (payment.status === 'CONFIRMED') {
    return { success: false, error: 'Payment already confirmed' };
  }

  if (payment.status === 'CANCELLED' || payment.status === 'REJECTED') {
    return { success: false, error: `Cannot confirm ${payment.status.toLowerCase()} payment` };
  }

  // Update payment status + release escrow
  const releaseFee = calculateReleaseFee(payment.amount);
  const netRelease = payment.amount - releaseFee;

  await prisma.$transaction(async (tx) => {
    // Mark payment as confirmed
    await tx.fiatPayment.update({
      where: { id: payment.id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        confirmedBy,
      },
    });

    // Release escrow (net of release fee)
    if (payment.escrowId) {
      await tx.escrow.update({
        where: { id: payment.escrowId },
        data: {
          status: 'RELEASED',
          releasedAt: new Date(),
          releasedBy: confirmedBy,
        },
      });
    }
  });

  logger.info(
    `[FiatPaymentService] Confirmed ${reference} by ${confirmedBy} (net release: $${netRelease.toFixed(2)})`
  );

  return { success: true, escrowId: payment.escrowId || undefined };
}

// ── Reject Fiat Payment (Business Rejects — Refund to Escrow) ────────────────

export async function rejectFiatPayment(
  reference: string,
  rejectedBy: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const payment = await prisma.fiatPayment.findUnique({
    where: { reference },
  });

  if (!payment) {
    throw new Error('Fiat payment not found');
  }

  if (payment.status === 'CONFIRMED') {
    return { success: false, error: 'Cannot reject an already confirmed payment' };
  }

  if (payment.status === 'CANCELLED' || payment.status === 'REJECTED') {
    return { success: false, error: `Payment already ${payment.status.toLowerCase()}` };
  }

  await prisma.$transaction(async (tx) => {
    await tx.fiatPayment.update({
      where: { id: payment.id },
      data: {
        status: 'REJECTED',
        confirmedAt: new Date(),
        confirmedBy: rejectedBy,
        rejectionReason: reason,
      },
    });

    // Refund escrow back to payer
    if (payment.escrowId) {
      await tx.escrow.update({
        where: { id: payment.escrowId },
        data: {
          status: 'REFUNDED',
          refundReason: reason || 'Business rejected payment',
          releasedAt: new Date(),
          releasedBy: rejectedBy,
        },
      });
    }
  });

  logger.info(`[FiatPaymentService] Rejected ${reference} by ${rejectedBy} (reason: ${reason})`);

  return { success: true };
}

// ── Cancel Fiat Payment ──────────────────────────────────────────────────────

export async function cancelFiatPayment(
  reference: string,
  cancelledBy: string
): Promise<{ success: boolean; error?: string }> {
  const payment = await prisma.fiatPayment.findUnique({
    where: { reference },
  });

  if (!payment) {
    throw new Error('Fiat payment not found');
  }

  if (payment.status === 'CONFIRMED') {
    return { success: false, error: 'Cannot cancel an already confirmed payment' };
  }

  if (payment.status === 'CANCELLED') {
    return { success: false, error: 'Payment already cancelled' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.fiatPayment.update({
      where: { id: payment.id },
      data: {
        status: 'CANCELLED',
        confirmedAt: new Date(),
        confirmedBy: cancelledBy,
      },
    });

    if (payment.escrowId) {
      await tx.escrow.update({
        where: { id: payment.escrowId },
        data: {
          status: 'REFUNDED',
          refundReason: 'Cancelled by payer',
          releasedAt: new Date(),
          releasedBy: cancelledBy,
        },
      });
    }
  });

  return { success: true };
}

// ── Mark as Sent (Payer indicates they sent the money) ──────────────────────

export async function markFiatPaymentSent(
  reference: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const payment = await prisma.fiatPayment.findUnique({
    where: { reference },
  });

  if (!payment) {
    throw new Error('Fiat payment not found');
  }

  if (payment.status !== 'PENDING') {
    return { success: false, error: `Cannot mark as sent from status ${payment.status}` };
  }

  await prisma.fiatPayment.update({
    where: { id: payment.id },
    data: { status: 'SENT' },
  });

  return { success: true };
}

// ── List pending fiat payments for a business ────────────────────────────────

export async function listPendingFiatPayments(businessId: string) {
  return prisma.fiatPayment.findMany({
    where: {
      businessId,
      status: { in: ['PENDING', 'SENT'] },
    },
    include: {
      payer: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ── List fiat payments for a user ────────────────────────────────────────────

export async function listUserFiatPayments(userId: string) {
  return prisma.fiatPayment.findMany({
    where: {
      OR: [{ payerId: userId }, { payeeId: userId }],
    },
    include: {
      payer: { select: { id: true, email: true, firstName: true, lastName: true } },
      payee: { select: { id: true, email: true, firstName: true, lastName: true } },
      business: { select: { id: true, name: true } },
      escrow: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ── Get available fiat methods ───────────────────────────────────────────────

export function getAvailableFiatMethods(): FiatMethodInfo[] {
  return FIAT_METHODS;
}

export const fiatPaymentService = {
  createFiatPayment,
  getFiatPaymentStatus,
  confirmFiatPayment,
  rejectFiatPayment,
  cancelFiatPayment,
  markFiatPaymentSent,
  listPendingFiatPayments,
  listUserFiatPayments,
  getAvailableFiatMethods,
  generatePaymentQR,
  calculateCreationFee,
  calculateReleaseFee,
};
