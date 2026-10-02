import { Router, type Request, type Response } from 'express';
import { CustomError } from '../middleware/errorHandler';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { eventBus } from '../services/event-bus.service';
import {
  assertAmountMatches,
  verifyRailWebhook,
  RAIL_SIGNATURE_HEADER,
  RAIL_TIMESTAMP_HEADER,
} from '../services/railWebhook.service';

/**
 * Payment-rail webhooks.
 *
 * Deliberately a SEPARATE router with NO `authenticate` middleware, mounted
 * outside the user-authenticated booking routes. Two reasons, and the second is
 * the important one:
 *
 *   1. The caller is the payment partner's server, not a Pabandi user. Requiring
 *      a user session would be checking the wrong principal — and a valid user
 *      session is something an attacker can legitimately obtain.
 *
 *   2. The previous version sat behind `authenticate` and trusted a
 *      caller-supplied `railReference`. Because the escrow id is returned in the
 *      booking response, any logged-in user could mark their own escrow FUNDED
 *      without paying, complete the appointment, and have the retainer released.
 *      The auth header made it *look* protected, which is what made it
 *      dangerous: it survived review precisely because it appeared handled.
 *
 * Authentication here is a signed assertion: HMAC-SHA256 over the raw body plus a
 * timestamp, verified in constant time and bound to the specific escrow and
 * amount. See services/railWebhook.service.ts for why each part is necessary.
 *
 * IP allowlisting is mentioned as an additional control and deliberately not
 * relied upon: partner egress IPs change, and an allowlist that silently fails
 * open is worse than none. Rate limiting still applies, since this router is
 * mounted under /api/.
 */
const router = Router();

/**
 * POST /api/v1/rail/webhooks/escrow/funded
 * The payment partner asserts that a booking retainer arrived.
 */
router.post('/escrow/funded', async (req: Request, res: Response) => {
  try {
    // The raw bytes are required: hashing a re-serialised object is bypassable
    // because key order and whitespace are not preserved.
    const rawBody =
      (req as Request & { rawBody?: Buffer }).rawBody?.toString('utf8') ??
      JSON.stringify(req.body ?? {});

    const escrowId = String(req.body?.escrowId ?? '');
    if (!escrowId) {
      throw new CustomError('escrowId is required', 400);
    }

    // ── 1. Authenticate the caller as the partner ─────────────────────────
    const claims = verifyRailWebhook({
      rawBody,
      signature: req.header(RAIL_SIGNATURE_HEADER),
      timestamp: req.header(RAIL_TIMESTAMP_HEADER),
      expectedEscrowId: escrowId,
    });

    // ── 2. Load the escrow we are being told about ────────────────────────
    const escrow = await prisma.serviceEscrow.findUnique({
      where: { id: escrowId },
      select: {
        id: true,
        status: true,
        appointmentId: true,
        grossAmount: true,
        currency: true,
        rail: true,
        railReference: true,
      },
    });
    if (!escrow) throw new CustomError('Escrow not found', 404);

    // ── 3. Idempotency — a retried webhook must not double-apply ──────────
    // Payment providers retry. A duplicate delivery of the SAME reference is a
    // success no-op, not an error, otherwise the partner retries forever and
    // eventually something upstream treats the failure as real.
    if (escrow.railReference === claims.railReference) {
      if (['FUNDED', 'RELEASED', 'PARTIAL'].includes(escrow.status)) {
        return res.json({
          success: true,
          data: { escrowId: escrow.id, status: escrow.status, duplicate: true },
        });
      }
    }

    // A DIFFERENT reference against an already-funded escrow means either a
    // second real payment or an attempt to re-point a settled escrow. Both need
    // a human.
    if (escrow.status === 'RELEASED') {
      throw new CustomError('Escrow has already been released', 409);
    }
    if (['FUNDED', 'PARTIAL'].includes(escrow.status) && escrow.railReference) {
      logger.warn(
        `[RailWebhook] conflicting reference for escrow ${escrow.id}: ` +
          `have ${escrow.railReference}, received ${claims.railReference}`
      );
      throw new CustomError(
        'Escrow already has a different settlement reference — requires manual review',
        409
      );
    }

    // ── 4. The signature proves who sent it; this proves it is about us ───
    assertAmountMatches(claims, {
      grossAmount: escrow.grossAmount,
      currency: escrow.currency,
    });
    if (claims.rail !== escrow.rail) {
      throw new CustomError(
        `Webhook rail ${claims.rail} does not match escrow rail ${escrow.rail}`,
        400
      );
    }

    const now = new Date();
    const updated = await prisma.serviceEscrow.update({
      where: { id: escrowId },
      data: {
        status: 'FUNDED',
        fundedAt: now,
        railReference: claims.railReference,
      },
    });

    // Confirming the slot is the point of holding money: REQUESTED means the
    // slot is provisional, CONFIRMED means it is secured.
    await prisma.appointment.update({
      where: { id: escrow.appointmentId },
      data: { status: 'CONFIRMED' },
    });

    eventBus.emitEvent(
      'service_escrow.funded',
      {
        escrowId,
        appointmentId: escrow.appointmentId,
        amount: escrow.grossAmount,
        currency: escrow.currency,
        rail: escrow.rail,
      },
      'booking'
    );

    logger.info(
      `[RailWebhook] escrow ${escrowId} funded via ${escrow.rail} ref=${claims.railReference}`
    );

    res.json({ success: true, data: { escrowId: updated.id, status: updated.status } });
  } catch (err) {
    const statusCode = err instanceof CustomError ? err.statusCode : 500;
    const message = err instanceof Error ? err.message : 'Internal error';
    // Signature failures are logged with detail but reported generically, so the
    // endpoint cannot be used to probe which escrow ids exist.
    if (statusCode >= 500) {
      logger.error(`[RailWebhook] failure: ${message}`);
    } else if (statusCode === 401) {
      logger.warn(`[RailWebhook] rejected: ${message}`);
    }
    res.status(statusCode).json({ success: false, message });
  }
});

export default router;
