import { Request, Response, NextFunction } from 'express';
import type { Prisma } from '@prisma/client';
import { squareService } from '../services/squareCheckout.service';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { reconcileIncomingPayment } from '../services/auto-reconciliation.service';
import { advanceBookingEscrow } from '../services/booking-escrow.service';
import { settleStatementFromSquareInvoice } from '../services/fee-collection.service';
import { assessFeeSafe } from '../services/fee-assessment.service';
import { universalEscrowService } from '../services/universal-escrow.service';
import { sendLivePayoutRequestToOperator } from '../services/telegram-bot.service';
import { parseInvoiceNote } from '../services/square-connection.service';

export const createSquareCheckout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { referenceId, amount, currency, redirectUrl, cancelUrl, note, label, customerEmail } = req.body;
    
    const checkout = await squareService.createCheckout({
      referenceId,
      amount: Math.round(amount * 100), // convert dollars to cents
      currency: currency || 'USD',
      redirectUrl,
      cancelUrl,
      note,
      label,
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

    let rawBody = '';
    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString('utf8');
      try {
        req.body = JSON.parse(rawBody);
      } catch {}
    } else if (Buffer.isBuffer((req as any).rawBody)) {
      rawBody = (req as any).rawBody.toString('utf8');
    } else if (typeof (req as any).rawBody === 'string') {
      rawBody = (req as any).rawBody;
    } else if (typeof req.body === 'string') {
      rawBody = req.body;
      try {
        req.body = JSON.parse(rawBody);
      } catch {}
    } else {
      rawBody = JSON.stringify(req.body ?? {});
    }

    const isValid = await squareService.verifyWebhook(rawBody, signature, webhookUrl);
    if (!isValid) {
      logger.warn(
        `[SquareWebhook] Rejected delivery for ${webhookUrl}: signature mismatch or missing (${signature ? 'signature present but did not match' : 'no signature header'}).`,
      );
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const result = await squareService.processWebhook(req.body);
    
    // A merchant paying their own platform fee is an invoice.payment_made event,
    // not a payment. It settles a MerchantFeeStatement, and it must never fall
    // through to the customer-payment branch below — a fee invoice and a customer
    // deposit of the same amount are different money in opposite directions, and
    // reconciling one as the other would mark a deposit paid because a fee was.
    if (result.type === 'INVOICE_PAYMENT_MADE') {
      // No id means we cannot identify which statement this settles. Acking
      // without guessing is the only safe option: matching on the amount would
      // risk settling one merchant's fee with another's.
      if (!result.invoiceId) {
        logger.warn('[SquareWebhook] invoice.payment_made carried no invoice id; ignoring.');
        return res.json({ received: true, settled: false, reason: 'missing invoice id' });
      }
      try {
        const outcome = await settleStatementFromSquareInvoice(result.invoiceId);
        if (!outcome.settled) {
          logger.info(
            `[SquareWebhook] Invoice payment for ${result.invoiceId} did not settle a statement: ${outcome.reason}.`,
          );
        }
        return res.json({ received: true, settled: outcome.settled, reason: outcome.reason });
      } catch (invoiceErr) {
        // Square retries non-2xx for days, but a retry cannot help if the cause
        // is ours. Log it and ack.
        logger.error(`[SquareWebhook] invoice settlement failed for ${result.invoiceId}: ${invoiceErr}`);
        return res.json({ received: true, settled: false });
      }
    }

    // Update payment status in DB based on webhook
    if (result.type === 'PAYMENT_UPDATED' && result.status === 'COMPLETED') {
      // ── Cross-Border Invoice Payment via Square -> LP Off-Ramp Flow ──
      if (result.invoiceId) {
        try {
          const invoice = await prisma.invoice.findUnique({
            where: { id: result.invoiceId },
            include: { client: true },
          });

          if (invoice && invoice.status.toLowerCase() !== 'paid') {
            const grossUsd = result.amountCents != null ? result.amountCents / 100 : Number(invoice.subtotal) || 150;
            const platformFeeUsd = +(grossUsd * 0.03).toFixed(2);
            const netUsdc = +(grossUsd - platformFeeUsd).toFixed(2);
            const guaranteedRate = 279.50;
            const pkrAmount = Math.round(netUsdc * guaranteedRate);

            let metadata: Record<string, any> = {};
            try {
              metadata = JSON.parse(invoice.notes || '{}');
            } catch {
              metadata = { text: invoice.notes };
            }

            const updatedMetadata = {
              ...metadata,
              paidVia: 'SQUARE_CARD',
              squarePaymentId: result.paymentId,
              grossUsd,
              platformFeeUsd,
              netUsdc,
              rate: guaranteedRate,
              pkrAmount,
              lpDispatched: true,
              dispatchedAt: new Date().toISOString(),
            };

            await prisma.invoice.update({
              where: { id: invoice.id },
              data: {
                status: 'PAID',
                paidAt: new Date(),
                notes: JSON.stringify(updatedMetadata),
              },
            });

            // Look up payee / business destination
            let destinationAccount = 'PK70MEZN0001234567890101';
            let bankName = 'Meezan Bank (Raast)';
            let freelancerName = 'Pakistani Freelancer';

            if (invoice.businessId) {
              const biz = await prisma.business.findUnique({
                where: { id: invoice.businessId },
                include: { owner: true },
              });
              if (biz) {
                freelancerName = biz.name || `${biz.owner?.firstName || ''} ${biz.owner?.lastName || ''}`.trim() || 'Pabandi Freelancer';
                if (biz.owner?.phone) {
                  destinationAccount = biz.owner.phone;
                  bankName = 'Raast ID (Mobile)';
                }
              }
            }

            const offrampIntent = await prisma.offrampIntent.create({
              data: {
                customerWallet: result.clientId || 'square_international_payer',
                businessId: invoice.businessId || undefined,
                amountUsdc: netUsdc,
                minRatePkr: guaranteedRate,
                quotePkr: pkrAmount,
                destinationType: destinationAccount.length === 11 ? 'Raast' : 'bank',
                destinationRef: `${bankName} / ${destinationAccount}`,
                lockedTxHash: `square_${result.paymentId}`,
                status: 'PENDING_OFFRAMP',
                metadata: {
                  invoiceId: invoice.id,
                  freelancerName,
                  grossUsd,
                  platformFeeUsd,
                  paidVia: 'SQUARE_CARD',
                },
              },
            });

            logger.info(
              `[SquareWebhook] Cross-border invoice ${invoice.id} settled. LP Off-Ramp created: ${offrampIntent.id} (Rs. ${pkrAmount})`
            );

            // Send interactive dispatch alert to Operator with inline [Mark as Sent] button
            await sendLivePayoutRequestToOperator({
              amountPkr: pkrAmount,
              destination: `${bankName} / ${destinationAccount}`,
              claimId: offrampIntent.id,
              amountUsdc: netUsdc,
              freelancerName,
            });

            return res.json({
              received: true,
              invoiceSettled: true,
              invoiceId: invoice.id,
              offrampIntentId: offrampIntent.id,
              pkrAmount,
            });
          }
        } catch (invoiceErr: any) {
          logger.error(`[SquareWebhook] Cross-border invoice settlement failed for ${result.invoiceId}: ${invoiceErr.message}`);
        }
      }

      // Agent marketplace escrow funding. Escrows fund only through this
      // branch: the payment's note carries the escrow id we wrote at checkout,
      // the amount must equal the escrow total (a typed amount, but defense in
      // depth against any future dynamic-link reuse), and the escrow must
      // still be AWAITING_PAYMENT — the webhook is the trust boundary, so
      // nothing the browser said earlier can have pre-funded it.
      if (result.escrowId) {
        try {
          const escrow = await prisma.agentEscrow.findUnique({
            where: { id: result.escrowId },
            select: { id: true, projectId: true, status: true, totalAmount: true, project: { select: { metadata: true } } },
          });
          if (!escrow || escrow.status !== 'AWAITING_PAYMENT') {
            logger.info(`[SquareWebhook] escrow ${result.escrowId} not awaiting funding (${escrow?.status ?? 'missing'}); acking.`);
            return res.json({ received: true, funded: false, reason: 'not awaiting payment' });
          }
          const expectedCents = Math.round(escrow.totalAmount * 100);
          if (result.amountCents != null && result.amountCents !== expectedCents) {
            logger.warn(
              `[SquareWebhook] Escrow ${escrow.id} collected $${(result.amountCents / 100).toFixed(2)} but $${(expectedCents / 100).toFixed(2)} was due. Leaving unfunded.`,
            );
            return res.json({ received: true, funded: false, reason: 'amount mismatch' });
          }
          await prisma.$transaction([
            prisma.agentEscrow.update({
              where: { id: escrow.id },
              data: { status: 'FUNDED', fundedAt: new Date() },
            }),
            // Payment provenance lands on the project's metadata — AgentEscrow
            // has no metadata column, and this row is what a reconciliation or
            // refund query reads later. Spread first: hiredPassport and any
            // other keys already on the project survive the webhook.
            prisma.agentProject.update({
              where: { id: escrow.projectId },
              data: {
                metadata: {
                  ...((escrow.project.metadata as Record<string, unknown>) || {}),
                  squarePaymentId: result.paymentId,
                  escrowPaidAt: new Date().toISOString(),
                  amountPaidUsd: escrow.totalAmount,
                } as unknown as Prisma.InputJsonValue,
              },
            }),
          ]);
          logger.info(`[SquareWebhook] Agent escrow ${escrow.id} funded via Square.`);
          return res.json({ received: true, funded: true });
        } catch (escrowErr) {
          logger.error(`[SquareWebhook] escrow funding update failed for ${result.escrowId}: ${escrowErr}`);
          return res.json({ received: true, funded: false });
        }
      }

      if (result.universalEscrowRef) {
        try {
          const uEscrow = await prisma.universalEscrow.findUnique({
            where: { referenceId: result.universalEscrowRef },
          });
          if (!uEscrow) {
            logger.info(`[SquareWebhook] UniversalEscrow ${result.universalEscrowRef} not found; acking.`);
            return res.json({ received: true, funded: false, reason: 'not found' });
          }
          if (uEscrow.status === 'funded') {
            return res.json({ received: true, funded: true, duplicate: true });
          }
          if (uEscrow.status !== 'draft') {
            logger.info(`[SquareWebhook] UniversalEscrow ${uEscrow.referenceId} in state ${uEscrow.status}; acking.`);
            return res.json({ received: true, funded: false, reason: 'not awaiting payment' });
          }
          const expectedCents = Math.round(uEscrow.amount * 100);
          if (result.amountCents != null && result.amountCents !== expectedCents) {
            logger.warn(
              `[SquareWebhook] UniversalEscrow ${uEscrow.referenceId} collected $${(result.amountCents / 100).toFixed(2)} but $${(expectedCents / 100).toFixed(2)} was due. Leaving unfunded.`,
            );
            return res.json({ received: true, funded: false, reason: 'amount mismatch' });
          }

          await universalEscrowService.updateStatus(uEscrow.referenceId, 'funded');

          const existingMeta = (uEscrow.metadata as Record<string, unknown>) || {};
          const fundedAtIso = new Date().toISOString();
          await prisma.universalEscrow.update({
            where: { referenceId: uEscrow.referenceId },
            data: {
              metadata: {
                ...existingMeta,
                squarePaymentId: result.paymentId,
                fundedAt: fundedAtIso,
                amountPaidUsd: uEscrow.amount,
                paidVia: 'square',
              } as unknown as Prisma.InputJsonValue,
            },
          });

          const simulationId =
            (typeof existingMeta.simulationId === 'string' && existingMeta.simulationId) ||
            (uEscrow.referenceId.startsWith('sim-') ? uEscrow.referenceId.slice(4) : null);

          if (simulationId) {
            const sim = await prisma.projectSimulation.findUnique({ where: { id: simulationId } }).catch(() => null);
            if (sim) {
              const prevEstimate = (sim.finalEstimate as Record<string, unknown>) || {};
              await prisma.projectSimulation.update({
                where: { id: simulationId },
                data: {
                  finalEstimate: {
                    ...prevEstimate,
                    escrowStatus: 'funded',
                    escrowReferenceId: uEscrow.referenceId,
                    squarePaymentId: result.paymentId,
                    fundedAt: fundedAtIso,
                  } as unknown as Prisma.InputJsonValue,
                },
              }).catch((simErr) => {
                logger.warn(`[SquareWebhook] Failed to annotate ProjectSimulation ${simulationId}: ${simErr}`);
              });
            }
          }

          logger.info(`[SquareWebhook] UniversalEscrow ${uEscrow.referenceId} funded via Square.`);
          return res.json({ received: true, funded: true, referenceId: uEscrow.referenceId });
        } catch (uEscrowErr) {
          logger.error(`[SquareWebhook] UniversalEscrow funding update failed for ${result.universalEscrowRef}: ${uEscrowErr}`);
          return res.json({ received: true, funded: false });
        }
      }

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
              // The escrow record is what a dispute is later read from, so it
              // has to advance with the payment rather than waiting on the
              // booking status column to be reconciled by hand.
              await advanceBookingEscrow(booking.id, 'funded', {
                source: 'square-webhook',
                facts: { amountCents: result.amountCents, currency: result.currency },
              });
              // Assess the platform fee on the deposit now that it is actually
              // funded. This is the money path that had none: assessFeeSafe was
              // called from the booking flow when the LINK was created and from
              // invoice.service, but not when a Square deposit was PAID. Revenue
              // collected through a direct Square checkout was never billed.
              //
              // An accrual, not a deduction — the deposit settles into the
              // merchant's own Square account, so there is no percentage to take
              // from it. Idempotent on (sourceType, sourceId), so a redelivered
              // Square webhook reuses the existing row rather than double-billing.
              const assessment = await assessFeeSafe({
                businessId: booking.businessId,
                sourceType: 'booking_deposit',
                sourceId: booking.id,
                chargeCents: expectedCents,
              });
              if (assessment) {
                logger.info(
                  `[SquareWebhook] Deposit fee assessed for ${booking.id}: ` +
                    `${assessment.feeCents}c (${assessment.quote.tier})`,
                );
              }

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

export const processSquarePayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourceId, amount, currency = 'USD', referenceId, note, customerEmail } = req.body;
    if (!sourceId) {
      return res.status(400).json({ success: false, error: 'Payment source token (sourceId) is required' });
    }

    const amountCents = Math.round((Number(amount) || 0) * 100);
    if (amountCents <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid payment amount' });
    }

    const payment = await squareService.processPaymentToken({
      sourceId,
      amountCents,
      currency,
      referenceId,
      note,
      customerEmail,
    });

    // Check if this payment settled a cross-border invoice
    const ours = parseInvoiceNote(note || referenceId);
    if (ours?.invoiceId) {
      try {
        const invoice = await prisma.invoice.findUnique({
          where: { id: ours.invoiceId },
          include: { client: true },
        });

        if (invoice && invoice.status.toLowerCase() !== 'paid') {
          const grossUsd = amountCents / 100;
          const platformFeeUsd = +(grossUsd * 0.03).toFixed(2);
          const netUsdc = +(grossUsd - platformFeeUsd).toFixed(2);
          const guaranteedRate = 279.50;
          const pkrAmount = Math.round(netUsdc * guaranteedRate);

          let metadata: Record<string, any> = {};
          try {
            metadata = JSON.parse(invoice.notes || '{}');
          } catch {
            metadata = { text: invoice.notes };
          }

          const updatedMetadata = {
            ...metadata,
            paidVia: 'SQUARE_CARD',
            squarePaymentId: payment.id,
            grossUsd,
            platformFeeUsd,
            netUsdc,
            rate: guaranteedRate,
            pkrAmount,
            lpDispatched: true,
            dispatchedAt: new Date().toISOString(),
          };

          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              status: 'PAID',
              paidAt: new Date(),
              notes: JSON.stringify(updatedMetadata),
            },
          });

          let destinationAccount = 'PK70MEZN0001234567890101';
          let bankName = 'Meezan Bank (Raast)';
          let freelancerName = 'Pakistani Freelancer';

          if (invoice.businessId) {
            const biz = await prisma.business.findUnique({
              where: { id: invoice.businessId },
              include: { owner: true },
            });
            if (biz) {
              freelancerName = biz.name || `${biz.owner?.firstName || ''} ${biz.owner?.lastName || ''}`.trim() || 'Pabandi Freelancer';
              if (biz.owner?.phone) {
                destinationAccount = biz.owner.phone;
                bankName = 'Raast ID (Mobile)';
              }
            }
          }

          const offrampIntent = await prisma.offrampIntent.create({
            data: {
              customerWallet: customerEmail || 'square_international_payer',
              businessId: invoice.businessId || undefined,
              amountUsdc: netUsdc,
              minRatePkr: guaranteedRate,
              quotePkr: pkrAmount,
              destinationType: destinationAccount.length === 11 ? 'Raast' : 'bank',
              destinationRef: `${bankName} / ${destinationAccount}`,
              lockedTxHash: `square_${payment.id}`,
              status: 'PENDING_OFFRAMP',
              metadata: {
                invoiceId: invoice.id,
                freelancerName,
                grossUsd,
                platformFeeUsd,
                paidVia: 'SQUARE_CARD',
              },
            },
          });

          await sendLivePayoutRequestToOperator({
            amountPkr: pkrAmount,
            destination: `${bankName} / ${destinationAccount}`,
            claimId: offrampIntent.id,
            amountUsdc: netUsdc,
            freelancerName,
          });
        }
      } catch (err: any) {
        logger.error(`[SquareProcess] Cross-border payout dispatch error: ${err.message}`);
      }
    }

    return res.json({ success: true, payment });
  } catch (err: any) {
    logger.error(`[SquareProcess] Token processing error: ${err.message}`);
    return res.status(500).json({ success: false, error: err.message || 'Payment processing failed' });
  }
};
