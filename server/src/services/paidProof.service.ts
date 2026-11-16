import crypto from 'crypto';
import { prisma } from '../utils/database';
import { sendPaidProofWhatsApp } from './serviceCoordinatorWhatsApp.service';

function generatePublicId(): string {
  return `paid_${crypto.randomBytes(12).toString('hex')}`;
}

export async function createPaidProof(input: {
  bookingId: string;
  workerId: string;
  amount: number;
  currency?: string;
  rail?: string;
  txHash?: string;
  receiptRef?: string;
  status?: string;
}) {
  const existing = await prisma.paidProof.findUnique({ where: { bookingId: input.bookingId } });
  if (existing) return existing;

  return prisma.paidProof.create({
    data: {
      publicId: generatePublicId(),
      bookingId: input.bookingId,
      workerId: input.workerId,
      amount: input.amount,
      currency: input.currency || 'USD',
      rail: input.rail ?? null,
      txHash: input.txHash ?? null,
      receiptRef: input.receiptRef ?? null,
      status: input.status || 'PAID',
    },
  });
}

export async function getPaidProofByPublicId(publicId: string) {
  return prisma.paidProof.findUnique({ where: { publicId } });
}

export async function listPaidProofsForWorker(workerId: string) {
  return prisma.paidProof.findMany({
    where: { workerId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Create the public proof and notify the worker. Every escrow release should
 * go through here so a payout is never without its proof.
 */
export async function issuePaidProof(input: {
  bookingId: string;
  workerId: string;
  amount: number;
  currency?: string;
  rail?: string;
  txHash?: string;
  receiptRef?: string;
  status?: string;
}) {
  const existing = await prisma.paidProof.findUnique({ where: { bookingId: input.bookingId } });
  const proof = existing ?? (await createPaidProof(input));

  if (!existing) {
    const worker = await prisma.user.findUnique({
      where: { id: input.workerId },
      select: { phone: true },
    });

    if (worker?.phone) {
      await sendPaidProofWhatsApp({
        recipientPhone: worker.phone,
        bookingId: input.bookingId,
        amount: proof.amount,
        currency: proof.currency,
        publicId: proof.publicId,
        rail: proof.rail,
        txHash: proof.txHash,
      });
    }
  }

  return proof;
}
