import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { formatBusinessDiscoveryItem } from '../utils/businessDiscovery';
import { assessBookingRisk } from './bookingRisk.service';
import {
  ensureBookingEscrow,
  advanceBookingEscrow,
  releaseOnAttendance,
  refundBookingDeposit,
  getBookingEscrow,
} from './booking-escrow.service';
import { verifyTrustDisclosure } from '../trust/disclosure.service';
import { payoutService } from './payout.service';
import { issuePaidProof } from './paidProof.service';
import { assertAgentSpendAllowed, recordAgentSpend } from './agentKeys.service';

export interface AgentToolUser {
  id: string;
  email: string;
  role: string;
  businessId?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  agentKeyId?: string;
  agentId?: string;
  scopes?: string[];
  spendLimitUsd?: number | null;
  spendUsedUsd?: number;
}

export async function listBusinesses(query: {
  cursor?: string;
  limit?: number;
  city?: string;
  category?: string;
  query?: string;
  search?: string;
  location?: string;
}) {
  const limitNum = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const where: any = { isActive: true };

  const searchText = (query.query || query.search) as string | undefined;
  if (searchText && searchText.trim()) {
    const q = searchText.trim();
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { city: { contains: q, mode: 'insensitive' } },
      { address: { contains: q, mode: 'insensitive' } },
    ];
  }

  const cityText = (query.city || query.location) as string | undefined;
  if (cityText && cityText.trim()) {
    const loc = cityText.trim();
    const locConditions = [
      { city: { contains: loc, mode: 'insensitive' } },
      { state: { contains: loc, mode: 'insensitive' } },
      { address: { contains: loc, mode: 'insensitive' } },
    ];
    if (Array.isArray(where.OR)) {
      where.AND = [{ OR: where.OR }, { OR: locConditions }];
      delete where.OR;
    } else {
      where.OR = locConditions;
    }
  }

  if (query.category && query.category.toUpperCase() !== 'ALL') {
    where.category = query.category.toUpperCase();
  }

  const findArgs: any = {
    where,
    include: { owner: { select: { firstName: true, lastName: true, email: true } } },
    orderBy: { id: 'asc' },
    take: limitNum + 1,
  };

  if (query.cursor && query.cursor.trim()) {
    findArgs.cursor = { id: query.cursor.trim() };
    findArgs.skip = 1;
  }

  const rows = await prisma.business.findMany(findArgs);
  let nextCursor: string | null = null;
  if (rows.length > limitNum) {
    rows.pop();
    nextCursor = rows[rows.length - 1]?.id || null;
  }

  return {
    items: rows.map(formatBusinessDiscoveryItem),
    nextCursor,
    count: rows.length,
  };
}

export async function getBusinessById(businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { owner: { select: { firstName: true, lastName: true, email: true } } },
  });
  if (!business) throw new Error('Business not found');
  return formatBusinessDiscoveryItem(business);
}

export async function createBookingForAgent(
  user: AgentToolUser,
  input: {
    businessId: string;
    slotStart: string;
    slotEnd: string;
    serviceType: string;
    numberOfGuests?: number;
    depositAmount?: number;
  }
) {
  if (!input.businessId || !input.slotStart || !input.slotEnd || !input.serviceType) {
    throw new Error('businessId, slotStart, slotEnd, serviceType are required');
  }

  const depositAmount = input.depositAmount ?? 0;
  if (depositAmount > 0) {
    await assertAgentSpendAllowed(user, depositAmount);
  }

  const business = await prisma.business.findUnique({ where: { id: input.businessId }, select: { id: true, ownerId: true } });
  if (!business) throw new Error('Business not found');

  const existing = await prisma.booking.findFirst({
    where: {
      businessId: input.businessId,
      slotStart: new Date(input.slotStart),
      status: { in: ['pending', 'confirmed'] },
    },
  });
  if (existing) throw new Error('Slot already booked');

  const booking = await prisma.booking.create({
    data: {
      businessId: input.businessId,
      clientId: user.id,
      slotStart: new Date(input.slotStart),
      slotEnd: new Date(input.slotEnd),
      serviceType: input.serviceType,
      depositAmount: input.depositAmount ?? 0,
      depositPaid: false,
      status: 'pending',
    },
  });

  if (depositAmount > 0) {
    await recordAgentSpend(user, depositAmount);
  }

  let risk: any = null;
  try {
    risk = await assessBookingRisk({
      bookingId: booking.id,
      businessId: input.businessId,
      slotStart: booking.slotStart,
      serviceType: input.serviceType,
    });
  } catch (error: any) {
    logger.error('[AgentTools] risk assessment failed:', error?.message || error);
  }

  if (business.ownerId) {
    try {
      await ensureBookingEscrow({
        bookingId: booking.id,
        businessId: input.businessId,
        sellerPartyId: business.ownerId,
        buyerPartyId: user.id,
        amount: input.depositAmount ?? 0,
        currency: 'USD',
        slotStart: booking.slotStart,
        slotEnd: booking.slotEnd,
      });
    } catch (error: any) {
      logger.error('[AgentTools] escrow creation failed:', error?.message || error);
    }
  }

  return { ...booking, risk };
}

export async function getBookingForAgent(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { business: true },
  });
  if (!booking) throw new Error('Booking not found');
  const escrow = await getBookingEscrow(bookingId);
  return { ...booking, escrow };
}

export async function markBookingCheckin(
  user: AgentToolUser,
  bookingId: string,
  input: { locationVerified: boolean; distanceMeters?: number | null; overrideReason?: string | null }
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { business: true },
  });
  if (!booking) throw new Error('Booking not found');
  if (booking.clientId !== user.id && booking.business?.ownerId !== user.id && user.role !== 'ADMIN') {
    throw new Error('Not authorized to check in this booking');
  }

  const ok = await releaseOnAttendance({
    bookingId,
    locationVerified: Boolean(input.locationVerified),
    distanceMeters: input.distanceMeters ?? null,
    overrideReason: input.overrideReason ?? null,
  });
  return { bookingId, advanced: ok, status: ok ? 'conditions_met' : 'unchanged' };
}

export async function releaseBookingEscrow(
  user: AgentToolUser,
  bookingId: string,
  input: { reason?: string; rail?: 'solana_pay' | 'x402' | 'stripe_connect' | 'circle' | 'square' | 'raast'; txHash?: string; receiptRef?: string }
) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { business: true } });
  if (!booking) throw new Error('Booking not found');
  const isOwner = booking.business?.ownerId === user.id;
  if (!isOwner && user.role !== 'ADMIN') throw new Error('Only the business owner or an admin can release escrow');

  const escrowBefore = await getBookingEscrow(bookingId);
  const releaseAmount = escrowBefore?.amount ?? booking.depositAmount ?? 0;
  if (releaseAmount > 0) {
    await assertAgentSpendAllowed(user, releaseAmount);
  }

  const ok = await advanceBookingEscrow(bookingId, 'released', {
    source: 'agent-release',
    reason: input.reason || 'Released by agent after verified completion',
    rail: input.rail,
    txHash: input.txHash,
    receiptRef: input.receiptRef,
  });

  if (ok && releaseAmount > 0) {
    await recordAgentSpend(user, releaseAmount);
  }

  const escrow = await getBookingEscrow(bookingId);
  const workerId = booking.business?.ownerId || user.id;
  const amount = escrow?.amount ?? booking.depositAmount ?? 0;
  const currency = escrow?.currency || 'USD';
  const proof = await issuePaidProof({
    bookingId,
    workerId,
    amount,
    currency,
    rail: input.rail,
    txHash: input.txHash,
    receiptRef: input.receiptRef,
  });

  return { bookingId, released: ok, proof };
}

export async function refundBookingForAgent(user: AgentToolUser, bookingId: string, reason: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { business: true } });
  if (!booking) throw new Error('Booking not found');
  if (booking.clientId !== user.id && booking.business?.ownerId !== user.id && user.role !== 'ADMIN') {
    throw new Error('Not authorized to refund this booking');
  }
  const ok = await refundBookingDeposit(bookingId, reason || 'Refunded by agent');
  return { bookingId, refunded: ok };
}

export async function verifyPassportProof(input: {
  credential?: string;
  payload?: any;
  audienceBusinessId?: string;
  threshold?: number;
}) {
  if (input.credential) {
    return verifyTrustDisclosure(input.credential, {
      audienceBusinessId: input.audienceBusinessId,
      threshold: input.threshold,
    });
  }

  const payload = input.payload;
  if (!payload?.signature) return { valid: false, reason: 'Missing signature' };
  try {
    const { vcPublicJwk } = await import('../trust/vcKeys');
    const jwt = (await import('jsonwebtoken')).default;
    const { createPublicKey } = await import('crypto');
    const jwk = vcPublicJwk();
    const publicKey = createPublicKey({ key: { ...jwk } as any, format: 'jwk' });
    const verified = jwt.verify(payload.signature, publicKey, { algorithms: ['ES256'] }) as Record<string, any>;
    if (verified.subjectId !== payload.subjectId) return { valid: false, reason: 'Subject mismatch' };
    return {
      valid: true,
      verifiedPredicates: Object.entries(verified.predicates ?? {}).map(([k, v]) => `${k} ${String(v)}`),
    };
  } catch (error: any) {
    return { valid: false, reason: error?.message || 'Verification failed' };
  }
}

export async function requestPayoutForAgent(
  user: AgentToolUser,
  input: { amountUsdc: number; method?: 'BANK' | 'CONNECT' | 'LOCAL' | 'CASHAPP'; destinationRef?: string }
) {
  const amount = Number(input.amountUsdc);
  if (amount > 0) {
    await assertAgentSpendAllowed(user, amount);
  }
  const payout = await payoutService.request(user.id, amount, input.method || 'BANK', input.destinationRef);
  if (amount > 0) {
    await recordAgentSpend(user, amount);
  }
  return payout;
}

export async function getPayoutHistoryForAgent(user: AgentToolUser) {
  return payoutService.history(user.id);
}

export const agentTools = {
  listBusinesses,
  getBusinessById,
  createBookingForAgent,
  getBookingForAgent,
  markBookingCheckin,
  releaseBookingEscrow,
  refundBookingForAgent,
  verifyPassportProof,
  requestPayoutForAgent,
  getPayoutHistoryForAgent,
};
