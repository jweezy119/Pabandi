import { z } from 'zod';

/**
 * Request schemas for the routes AI agents call directly.
 *
 * These live apart from the route files so that the contract for an
 * agent-facing endpoint is a single exported value. That matters for two
 * reasons specific to this surface:
 *
 *  1. The routes are documented in llms.txt and openapi.yaml. A schema that
 *     lives in the route file has to be read to be discovered; an exported
 *     schema can be introspected and turned into docs mechanically.
 *  2. The same shapes are needed by the MCP tool layer (Phase 4), which does
 *     not go through Express at all. Sharing one schema means the HTTP route
 *     and the MCP tool cannot disagree about what a valid request is.
 *
 * Every schema strips unknown keys (Zod's default for objects), so a handler
 * reached through this middleware can only see fields the schema sanctioned.
 */

// ── Shared primitives ────────────────────────────────────────────────────────

/**
 * Money. Bounded above as well as below: an agent sending `amount: 1e308`
 * should be told no at the edge rather than propagating an Infinity into a
 * balance comparison further in.
 *
 * Precision is capped at 6 decimal places, not 2. The session engine settles in
 * cents (`toCents` in engine.service.ts) because a balance cap has to be exact,
 * but a *price* is not a balance and X402_PRICING contains sub-cent values --
 * `MCP_TOOL_CALL` is 0.001, `ESCROW_INITIATION` is 0.005. Rejecting those here
 * would reject the project's own price schedule.
 *
 * So: accept a precise price, round once when spending. A sub-cent amount
 * rounds to zero at the session layer, which `executeTransaction` then rejects
 * as INVALID_AMOUNT -- the caller is told to accumulate rather than being
 * silently charged nothing.
 */
const amountSchema = z
  .number({ invalid_type_error: 'amount must be a number' })
  .finite('amount must be a finite number')
  .nonnegative('amount must be zero or greater')
  .max(1_000_000, 'amount exceeds the maximum accepted value')
  .refine(
    (n) => {
      // True when n is a whole number of millionths. Comparing against a
      // rounded copy rather than multiplying-and-testing is what avoids
      // 0.1 + 0.2 style failures deciding the branch.
      const scaled = n * 1_000_000;
      return Math.abs(scaled - Math.round(scaled)) < 1e-6;
    },
    { message: 'amount must have at most 6 decimal places' }
  );

/** Cuid or the ids this API actually hands out. Rejects SQL/JS injection shapes. */
const idSchema = z
  .string({ required_error: 'id is required', invalid_type_error: 'id must be a string' })
  .min(1, 'id must not be empty')
  .max(128, 'id must be at most 128 characters')
  .regex(/^[A-Za-z0-9_-]+$/, 'id may contain only letters, digits, hyphens and underscores');

/**
 * Deliberately permissive but bounded. These strings are interpolated into
 * agent-facing copy and stored; an agent that sends 10MB of text should not be
 * able to turn a signup into a storage problem.
 */
const freeText = (max: number) =>
  z.string({ required_error: 'is required', invalid_type_error: 'must be a string' }).max(max);

// ── POST /api/v1/agents/register ─────────────────────────────────────────────

export const agentRegistrationSchema = z.object({
  // Matches the handle grammar the marketplace route already enforced by hand,
  // so no previously-valid signup becomes invalid.
  agentHandle: z
    .string({ required_error: 'agentHandle is required', invalid_type_error: 'agentHandle must be a string' })
    .regex(/^[a-z0-9-]{3,30}$/, 'agentHandle must be 3-30 chars, lowercase alphanumeric + dash'),
  ownerEmail: z
    .string({ required_error: 'ownerEmail is required', invalid_type_error: 'ownerEmail must be a string' })
    .max(254, 'ownerEmail must be at most 254 characters')
    .email('ownerEmail must be a valid email address'),
  name: freeText(120).min(1, 'name must not be empty'),
  capabilities: z
    .array(freeText(64).min(1, 'capability must not be empty'))
    .max(50, 'at most 50 capabilities')
    .optional()
    .default([]),
});

export type AgentRegistration = z.infer<typeof agentRegistrationSchema>;

// ── POST /api/v1/x402/pay ────────────────────────────────────────────────────

/**
 * x402 is the per-request micropayment rail. Phase 4 changes this route to
 * debit an open PabandiSession instead of demanding a fresh wallet signature,
 * so `sessionId` is accepted here from the start and is what the handler will
 * key on. It is required: a session is the only thing permitted to spend.
 */
export const x402PaySchema = z.object({
  amount: amountSchema,
  description: freeText(280).optional(),
  recipientId: idSchema.optional(),
  route: freeText(280).optional(),
  sessionId: idSchema.optional(),
  idempotencyKey: freeText(128).optional(),
});

export type X402Pay = z.infer<typeof x402PaySchema>;

// ── POST /api/v1/engine/session/open ─────────────────────────────────────────

export const engineSessionOpenSchema = z.object({
  ownerType: z.enum(['user', 'agent'], {
    errorMap: () => ({ message: "ownerType must be either 'user' or 'agent'" }),
  }),
  ownerId: idSchema,
  /**
   * Trust Score decides the limit, so letting the caller send it would let the
   * caller pick their own tier. The route resolves it from the passport; this
   * field is accepted only for agents with no passport yet, where it can only
   * lower the limit, never raise it.
   */
  trustScore: z.number().finite().min(0).max(1000).optional(),
  /**
   * Currency or token symbol. 3-5 rather than exactly 3, because the default
   * is USDC -- four characters -- and `length(3)` rejected every session-open
   * until a request supplied its own currency. ISO 4217 codes are 3 (USD);
   * token symbols are 4 (USDC).
   */
  currency: z.string().min(3).max(5).optional().default('USDC'),
});

export type EngineSessionOpen = z.infer<typeof engineSessionOpenSchema>;

// ── POST /api/v1/engine/session/action ───────────────────────────────────────

export const engineSessionActionSchema = z.object({
  sessionId: idSchema,
  actionType: z.enum(['booking', 'invoice_pay', 'escrow'], {
    errorMap: () => ({
      message: "actionType must be one of 'booking', 'invoice_pay', 'escrow'",
    }),
  }),
  amount: amountSchema,
  /** Opaque to the engine; hashed into the receipt so the two can be compared. */
  payload: z.record(z.unknown()).optional().default({}),
  idempotencyKey: freeText(128).optional(),
});

export type EngineSessionAction = z.infer<typeof engineSessionActionSchema>;

// ── POST /api/v1/engine/session/close ────────────────────────────────────────

export const engineSessionCloseSchema = z.object({
  sessionId: idSchema,
  /** Settle the remainder to the beneficiary immediately rather than on expiry. */
  settle: z.boolean().optional().default(false),
});

export type EngineSessionClose = z.infer<typeof engineSessionCloseSchema>;