// Solana Payment Intent Page
// Endpoint: POST /api/v1/payments/solana/payment-intent
// Creates a Solana payment intent for escrow funding

import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';
import { z } from 'zod';

const prisma = new PrismaClient();

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

export async function createSolanaPaymentIntent(
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
    return { success: false, error: 'Invalid request parameters' };
  }

  // Find the escrow
  const escrow = await prisma.escrow.findUnique({
    where: { id: req.escrowId },
    include: {
      agentEscrowContract: true,
    },
  });

  if (!escrow) {
    return { success: false, error: 'Escrow not found' };
  }

  // Verify amount matches
  if (Math.abs(req.amount - escrow.amount) > 0.01) {
    return { success: false, error: 'Amount does not match escrow amount' };
  }

  // Create payment intent record
  const paymentIntent = await prisma.paymentIntent.create({
    data: {
      escrowId: escrow.id,
      amount: req.amount,
      currency: req.currency,
      status: 'pending',
      memo: req.memo || null,
      solanaAddress: escrow.agentEscrowContract?.solanaAddress || undefined,
    },
  });

  return {
    success: true,
    data: {
      paymentIntent: {
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        memo: paymentIntent.memo || undefined,
        createdAt: paymentIntent.createdAt.toISOString(),
        expiresAt: paymentIntent.expiresAt.toISOString(),
      },
      paymentAddress: escrow.agentEscrowContract?.solanaAddress || '',
      amountRequired: escrow.amount,
    },
  };
}

export { solanaPaymentIntent };
