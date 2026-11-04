// Solana Payment Intent Page
// Endpoint: POST /api/v1/payments/solana/payment-intent
// Creates a Solana payment intent for escrow funding

import crypto from 'crypto';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { z } from 'zod';

export interface SolanaPaymentIntentRequest {
  escrowId: string;
  amount: number;
  currency: string;
  memo?: string;
}

export interface SolanaPaymentIntentResponse {
  success: boolean;
  paymentIntent: {
    id: string;
    amount: number;
    currency: string;
    status: 'pending';
    memo?: string;
    createdAt: string;
    expiresAt: string;
  };
  paymentAddress: string;
  amountRequired: number;
  error?: string;
}

async function createSolanaPaymentIntent(
  req: { escrowId: string; amount: number; currency: string; memo?: string },
): Promise<SolanaPaymentIntentResponse> {
  // Validate input
  const schema = z.object({
    escrowId: z.string().uuid(),
    amount: z.number().positive(),
    currency: z.string().min(1).max(10),
    memo: z.string().optional(),
  });

  const parsed = schema.safeParse(req);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Invalid request parameters',
      paymentIntent: { id: '', amount: 0, currency: '', status: 'pending', createdAt: '', expiresAt: '' },
      paymentAddress: '',
      amountRequired: 0,
    };
  }

  // Find the escrow
  const escrow = await prisma.escrow.findUnique({
    where: { id: req.escrowId },
  });

  if (!escrow) {
    return {
      success: false,
      error: 'Escrow not found',
      paymentIntent: { id: '', amount: 0, currency: '', status: 'pending', createdAt: '', expiresAt: '' },
      paymentAddress: '',
      amountRequired: 0,
    };
  }

  // Verify amount matches
  if (Math.abs(req.amount - escrow.amount) > 0.01) {
    return {
      success: false,
      error: 'Amount does not match escrow amount',
      paymentIntent: { id: '', amount: 0, currency: '', status: 'pending', createdAt: '', expiresAt: '' },
      paymentAddress: '',
      amountRequired: 0,
    };
  }

  // Create payment intent record (in-memory since no PaymentIntent model exists)
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const paymentIntent = {
    id: `pi_${crypto.randomUUID()}`,
    amount: req.amount,
    currency: req.currency,
    status: 'pending' as const,
    memo: req.memo || undefined,
    createdAt: now,
    expiresAt,
  };

  return {
    success: true,
    paymentIntent: {
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      memo: paymentIntent.memo,
      createdAt: paymentIntent.createdAt.toISOString(),
      expiresAt: paymentIntent.expiresAt.toISOString(),
    },
    paymentAddress: escrow.description || '',
    amountRequired: escrow.amount,
  };
}

export { createSolanaPaymentIntent };
