import crypto from 'crypto';
import { prisma } from '../utils/database';

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
