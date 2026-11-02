import { z } from 'zod';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Input contracts for the gig/booking money surface.
 *
 * Before this module, `req.body` flowed from the router straight into Prisma
 * create() and the escrow services. A crafted body could carry oversized
 * strings, negative budgets, absurd stake values, or extra keys that downstream
 * spreads would happily persist. Every schema below strips unknown keys
 * (`.strip()` default) and caps string length and numeric ranges at values no
 * legitimate client exceeds.
 */

const shortText = (max = 200) => z.string().trim().min(1).max(max);
const optShortText = (max = 500) => z.string().trim().max(max).optional();

/** Positive, sane money: no negatives, no trillion-dollar bids. */
const usd = z.number().positive().max(1_000_000);

export const createGigSchema = z.object({
  title: shortText(160),
  description: z.string().trim().min(1).max(4000),
  category: shortText(80),
  requiredSkills: z.array(shortText(40)).max(20).optional(),
  budgetUsd: usd,
  estimatedHours: z.number().int().min(0).max(10_000).optional(),
  demandGrowthPct: z.number().min(-100).max(10_000).optional(),
});

export const autogenGigSchema = z.object({
  skill: shortText(80),
  budgetUsd: usd.optional(),
  deadlineDays: z.number().int().min(0).max(365).optional(),
  referralCode: z.string().trim().max(40).optional().nullable(),
  clientWallet: z.string().trim().max(88).optional().nullable(),
  description: optShortText(300),
  // Never accepted over HTTP — see rejectSecretKeyMiddleware in gig.routes.ts.
  payerSecretB64: z.never().optional(),
});

export const agentRegisterSchema = z.object({
  profileId: z.string().trim().min(1).max(120),
  walletAddress: z.string().trim().min(32).max(64),
  // Encrypted at rest server-side; shape-checked only (base64 blob of any length).
  encryptedPrivateKey: z.string().trim().min(16).max(4096),
  category: shortText(60),
  skills: z.array(shortText(40)).max(20).optional(),
  ownerUserId: z.string().trim().max(120).optional(),
  trustScore: z.number().min(0).max(100).optional(),
  startingPab: z.number().min(0).max(5_000).optional(),
});

export const bidSchema = z.object({
  agentId: z.string().trim().min(6).max(64),
  quoteUsd: usd.optional(),
  stakePab: z.number().min(0).max(2_000).optional(),
  passportToken: z.string().max(16_384).optional(),
  // Legacy alias some SDK callers send; harmless but not trusted.
  payerSecretB64: z.never().optional(),
});

export const claimSchema = z.object({
  agentId: z.string().trim().max(64).optional(),
  claimerWallet: z.string().trim().max(64).optional(),
  passportToken: z.string().max(16_384).optional(),
  payerSecretB64: z.never().optional(),
});

export const completeGigSchema = z.object({
  txHash: z.string().trim().max(200).optional(),
  payerSecretB64: z.never().optional(),
});

export const faucetSchema = z.object({
  amountPab: z.number().int().min(1).max(1_000), // hard ceiling: 1k PAB per request, was 10k
});

export const acceptBidSchema = z.object({
  clientWallet: z.string().trim().max(64).optional(),
  // The raw Solana secret key is NEVER accepted from the wire — deposits use the
  // server-held business wallet. Clients that sent it previously were handing
  // their key to the open internet.
  payerSecretB64: z.never().optional(),
});

/** Public booking create (public booking page). */
export const createBookingSchema = z.object({
  businessId: z.string().trim().min(6).max(64),
  slotStart: z.string().trim().min(8).max(40),
  slotEnd: z.string().trim().min(8).max(40),
  serviceType: z.string().trim().min(1).max(160),
  customerName: z.string().trim().min(1).max(120),
  customerEmail: z.string().trim().email().max(200),
  customerPhone: optShortText(40),
  notes: optShortText(2000),
  customFields: z.record(z.unknown()).optional(),
  depositAmount: usd.optional(),
  clientAddress: optShortText(300),
  clientLat: z.number().min(-90).max(90).optional(),
  clientLng: z.number().min(-180).max(180).optional(),
});

/** Wrap a zod schema as an Express middleware that answers 400 on failure. */
export function validate(schema: z.ZodTypeAny): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const detail = parsed.error.issues
        .slice(0, 4)
        .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
        .join(' | ');
      res.status(400).json({ success: false, error: `Invalid request: ${detail}` });
      return;
    }
    req.body = parsed.data;
    next();
  };
}
