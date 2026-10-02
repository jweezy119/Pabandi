import { Request, Response, NextFunction } from 'express';
import { squareService } from '../services/squareCheckout.service';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { reconcileIncomingPayment } from '../services/auto-reconciliation.service';

export const createSquareCheckout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { referenceId, amount, currency, redirectUrl, cancelUrl, note, customerEmail } = req.body;
    
    const checkout = await squareService.createCheckout({
      referenceId,
      amount: Math.round(amount * 100), // convert dollars to cents
      currency: currency || 'USD',
      redirectUrl,
      cancelUrl,
      note,
      customerEmail,
    });

    res.json({ success: true, checkout });
  } catch (err) {
    next(err);
  }
};

export const getSquarePayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { paymentId } = req.params;
    const payment = await squareService.getPayment(paymentId);
    res.json({ success: true, payment });
  } catch (err) {
    next(err);
  }
};

export const handleSquareWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    /**
     * Square signs the RAW request bytes and sends the digest in
     * `x-square-hmacsha256-signature`.
     *
     * Two things were wrong here, and either one alone made every webhook
     * fail with 401 no matter how correct the signing key was:
     *
     *  1. The header read was `x-square-signature`, which Square never sends.
     *     The real name is `x-square-hmacsha256-signature` — as
     *     reconciliation.routes.ts already used. So the signature was always
     *     undefined and every delivery was rejected as unsigned.
     *
     *  2. `JSON.stringify(req.body)` re-serialises the parsed body, which is
     *     not guaranteed to be byte-identical to what Square signed — key
     *     order and whitespace come from the parser, not the sender. Square
     *     signs the exact bytes it transmitted, so the digest must be computed
     *     over `req.rawBody`, which index.ts captures via the json verify hook.
     *     Same fix already applied in offramp.controller.ts.
     */
    const signature =
      (req.headers['x-square-hmacsha256-signature'] as string | undefined) ??
      (req.headers['x-square-signature'] as string | undefined);
    const webhookUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

    const rawBody =
      typeof (req as Request & { rawBody?: string }).rawBody === 'string'
        ? (req as Request & { rawBody?: string }).rawBody as string
        : JSON.stringify(req.body ?? {});

    const isValid = await squareService.verifyWebhook(rawBody, signature, webhookUrl);
    if (!isValid) {
      logger.warn(
        `[SquareWebhook] Rejected delivery for ${webhookUrl}: signature mismatch or missing (${signature ? 'signature present but did not match' : 'no signature header'}).`,
      );
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const result = await squareService.processWebhook(req.body);
    
    // Update payment status in DB based on webhook
    if (result.type === 'PAYMENT_UPDATED' && result.status === 'COMPLETED') {
      // A booking deposit is paid by its own per-booking Square link, whose
      // note carries the booking id. Reconciling on amount alone would tie a
      // deposit to some other booking that happened to cost the same, so this
      // is matched exactly, the same way invoices are.
      if (result.bookingId) {
        try {
          const booking = await prisma.booking.findUnique({
            where: { id: result.bookingId },
          });
          if (booking) {
            const expectedCents = Math.round(
              ((booking.depositAmount || 0) + (booking.travelFee || 0)) * 100,
            );
            const paidCents = result.amountCents;

            if (paidCents != null && paidCents !== expectedCents) {
              // Underpayment is a real dispute, not something to paper over by
              // marking the deposit funded. Record it and let a human decide.
              logger.warn(
                `[SquareWebhook] Booking deposit for ${booking.id} collected $${(paidCents / 100).toFixed(2)} but $${(expectedCents / 100).toFixed(2)} was due. Leaving deposit unfunded.`,
              );
              await prisma.booking.update({
                where: { id: booking.id },
                data: { paidVia: 'square' },
              });
            } else {
              await prisma.booking.update({
                where: { id: booking.id },
                data: {
                  depositStatus: 'funded',
                  paidVia: 'square',
                  ...(booking.status === 'pending' ? { status: 'confirmed' } : {}),
                },
              });
              logger.info(`[SquareWebhook] Booking deposit funded for ${booking.id}.`);
            }
          }
        } catch (bookingErr) {
          logger.error(`[SquareWebhook] booking deposit update failed for ${result.bookingId}: ${bookingErr}`);
        }
      }
      // Find payment by Square payment ID and update status
      const payment = await prisma.payment.findUnique({
        where: { transactionId: result.paymentId },
      });
      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'COMPLETED' },
        });
        // Also mark reservation deposit as paid
        if (payment.reservationId) {
          await prisma.reservation.update({
            where: { id: payment.reservationId },
            data: { depositPaid: true },
          });
        }
      }

      // A checkout-linked Payment is already bound to its reservation, but
      // money that arrives outside the checkout flow has no such link. Feed
      // every completed Square payment through reconciliation, which matches
      // on { amount, clientId, within 7 days }. This is idempotent on the
      // Square payment id, so redelivery is a no-op and an already-bound
      // payment just records a 'queued' row a reviewer can dismiss.
      if (process.env.RECONCILIATION_AUTO_MATCH !== 'false') {
        try {
          const amountMajor = result.amountCents != null ? result.amountCents / 100 : null;
          if (amountMajor != null) {
            const outcome = await reconcileIncomingPayment({
              paymentRef: `square:${result.paymentId}`,
              rail: 'square',
              amount: amountMajor,
              paidAt: new Date(),
              clientId: result.clientId ?? undefined,
              // The invoice this checkout was created for, read from the note
              // we wrote at checkout time. Exact, where the amount scan is a
              // guess that can tie with another invoice of the same value.
              invoiceId: result.invoiceId ?? undefined,
              businessId: payment?.businessId ?? undefined,
              currency: result.currency ?? 'USD',
            });
            result.reconciliation = { status: outcome.status, duplicate: outcome.duplicate, reasoning: outcome.reasoning };
          }
        } catch (reconErr) {
          // Reconciliation failure must not fail the webhook: Square retries
          // non-2xx for days, and a retry cannot help if the cause is ours.
          logger.error(`[SquareWebhook] reconciliation failed for ${result.paymentId}: ${reconErr}`);
        }
      }
    }

    res.json({ received: true, result });
  } catch (err) {
    next(err);
  }
};

export const createSquareRefund = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { paymentId, amount, reason } = req.body;
    const refund = await squareService.createRefund(paymentId, Math.round(amount * 100), reason);
    res.json({ success: true, refund });
  } catch (err) {
    next(err);
  }
};
