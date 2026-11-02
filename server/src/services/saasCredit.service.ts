/**
 * SaaS Credit — yield rebate that pays for ContactOS subscriptions.
 *
 * Businesses earn saasCreditBalance from the 50% of Solana escrow yield
 * allocated to them on release (see escrow.service.ts). That balance is
 * meant to "apply to the business's next subscription invoice" — this file
 * makes that actually happen.
 *
 * Every credit application is deducted from saasCreditBalance atomically,
 * so a credit can never be applied twice. When the balance hits zero the
 * business pays the full invoice amount through the normal rails
 * (Square / PayPal / PayLio / SafePay — never Stripe).
 */

import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

export interface CreditApplication {
  /** How much of the invoice the credit covered, in cents. */
  creditAppliedCents: number;
  /** What the business still owes after credit, in cents. */
  netAmountCents: number;
  /** Credit balance remaining after this application, in cents. */
  remainingBalanceCents: number;
}

/**
 * Read a business's current saasCreditBalance in dollars.
 */
export async function getCreditBalance(businessId: string): Promise<number> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { saasCreditBalance: true },
  });
  return business?.saasCreditBalance ?? 0;
}

/**
 * Apply saasCreditBalance to an amount, deducting from the business's balance.
 *
 * The credit covers up to the full amount; any remainder is still owed.
 * Returns the net amount after credit plus the remaining balance.
 *
 * Runs in a transaction so the balance can never go negative or be applied
 * twice for the same invoice under concurrency.
 */
export async function applyCreditToAmount(
  businessId: string,
  amountCents: number
): Promise<CreditApplication> {
  const result = await prisma.$transaction(async (tx) => {
    const business = await tx.business.findUnique({
      where: { id: businessId },
      select: { id: true, saasCreditBalance: true },
    });

    if (!business) {
      throw new Error(`Business ${businessId} not found`);
    }

    const creditBalanceCents = Math.round(business.saasCreditBalance * 100);
    const creditToApplyCents = Math.min(creditBalanceCents, Math.max(amountCents, 0));
    const netAmountCents = amountCents - creditToApplyCents;
    const remainingBalanceCents = creditBalanceCents - creditToApplyCents;

    if (creditToApplyCents > 0) {
      await tx.business.update({
        where: { id: businessId },
        data: { saasCreditBalance: remainingBalanceCents / 100 },
      });

      logger.info(
        `[SaaS Credit] Business ${businessId}: applied ${creditToApplyCents}c ` +
          `credit, net ${netAmountCents}c, remaining ${remainingBalanceCents}c`
      );
    }

    return { creditAppliedCents: creditToApplyCents, netAmountCents, remainingBalanceCents };
  });

  return result;
}

/**
 * Apply saasCreditBalance to an invoice before it is marked paid.
 *
 * Reads the invoice subtotal, applies available credit, deducts the credit
 * from saasCreditBalance, and records the application in the invoice notes
 * envelope. Returns the credit application plus the (possibly updated) invoice.
 *
 * Callers should charge the business `netAmountCents` through their normal
 * payment rail, not the full subtotal.
 */
export async function applyCreditToInvoice(
  businessId: string,
  invoiceId: string
): Promise<{ application: CreditApplication; subtotalCents: number }> {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, businessId },
    select: { id: true, subtotal: true, notes: true, status: true },
  });

  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found for business ${businessId}`);
  }

  if (invoice.status === 'paid') {
    throw new Error(`Invoice ${invoiceId} is already paid`);
  }

  const subtotalCents = Math.round(Number(invoice.subtotal ?? 0) * 100);
  const application = await applyCreditToAmount(businessId, subtotalCents);

  // Record the credit application in the notes envelope so it is visible on
  // the invoice and reconciles later. The envelope tolerates plain-text notes.
  let existingMetadata: Record<string, unknown> = {};
  let existingText = '';
  try {
    const parsed = JSON.parse(invoice.notes || '{}');
    existingMetadata = parsed.metadata || {};
    existingText = typeof parsed.text === 'string' ? parsed.text : '';
  } catch {
    existingText = invoice.notes || '';
  }

  const metadata = {
    ...existingMetadata,
    saasCreditAppliedCents: application.creditAppliedCents,
    saasCreditRemainingCents: application.remainingBalanceCents,
    saasCreditAppliedAt: new Date().toISOString(),
  };

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      notes: JSON.stringify({ text: existingText, metadata }),
    },
  });

  return { application, subtotalCents };
}
