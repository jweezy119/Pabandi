import { Request, Response, NextFunction } from 'express';
import { stripeService } from '../services/stripe.service';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { sendLivePayoutRequestToOperator } from '../services/telegram-bot.service';

const GUARANTEED_RATE = 279.50;

export const receiveStripeWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = req.header('stripe-signature') || '';
    const rawBody: Buffer = (req as any).rawBody || Buffer.from('');

    const ok = stripeService.verifyWebhook(signature, rawBody);
    if (!ok) {
      return res.status(401).json({ success: false, error: 'Invalid webhook' });
    }

    const event = (req as any).body || {};
    if (event?.type === 'checkout.session.completed') {
      const session = event?.data?.object || {};
      const reservationId = session?.metadata?.reservation_id || session?.client_reference_id;
      const invoiceId = session?.metadata?.invoiceId || session?.metadata?.invoice_id || 
        (typeof session?.client_reference_id === 'string' && session.client_reference_id.startsWith('inv_')
          ? session.client_reference_id.replace(/^inv_/, '')
          : null);

      // ── 1. CROSS-BORDER INVOICE PAYMENT (Stripe to Raast Flow) ──
      if (invoiceId) {
        try {
          const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: { client: true },
          });

          if (invoice && invoice.status.toLowerCase() !== 'paid') {
            const grossUsd = session.amount_total ? session.amount_total / 100 : Number(invoice.subtotal) || 150;
            const platformFeeUsd = +(grossUsd * 0.03).toFixed(2);
            const netUsdc = +(grossUsd - platformFeeUsd).toFixed(2);
            const pkrAmount = Math.round(netUsdc * GUARANTEED_RATE);

            let metadata: Record<string, any> = {};
            try {
              metadata = JSON.parse(invoice.notes || '{}');
            } catch {
              metadata = { text: invoice.notes };
            }

            const updatedMetadata = {
              ...metadata,
              paidVia: 'STRIPE_CARD',
              stripeSessionId: session.id,
              payerEmail: session.customer_details?.email,
              grossUsd,
              platformFeeUsd,
              netUsdc,
              rate: GUARANTEED_RATE,
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

            // Create offramp intent in PENDING_OFFRAMP status
            const offrampIntent = await prisma.offrampIntent.create({
              data: {
                customerWallet: session.customer_details?.email || 'stripe_international_payer',
                businessId: invoice.businessId || undefined,
                amountUsdc: netUsdc,
                minRatePkr: GUARANTEED_RATE,
                quotePkr: pkrAmount,
                destinationType: destinationAccount.length === 11 ? 'Raast' : 'bank',
                destinationRef: `${bankName} / ${destinationAccount}`,
                lockedTxHash: `stripe_${session.id}`,
                status: 'PENDING_OFFRAMP',
                metadata: {
                  invoiceId: invoice.id,
                  freelancerName,
                  grossUsd,
                  platformFeeUsd,
                },
              },
            });

            logger.info(`[StripeWebhook] Invoice ${invoice.id} paid. Created OfframpIntent ${offrampIntent.id} for Rs. ${pkrAmount}`);

            // Dispatch telegram alert to Operator with inline [Mark as Sent] button
            await sendLivePayoutRequestToOperator({
              amountPkr: pkrAmount,
              destination: `${bankName} / ${destinationAccount}`,
              claimId: offrampIntent.id,
              amountUsdc: netUsdc,
              freelancerName,
            });
          }
        } catch (err: any) {
          logger.error(`[StripeWebhook] Failed cross-border invoice payout dispatch: ${err.message}`);
        }
      }

      // ── 2. RESERVATION DEPOSIT FLOW ──
      if (reservationId) {
        await prisma.checkoutSession.updateMany({
          where: { id: reservationId },
          data: { status: 'PAID', metadata: { ...(session.metadata || {}), stripeSessionId: session.id } },
        });
        // Sitara deposit flow: close the payment + mark the deposit paid so
        // check-in, review, stars, and rewards unlock.
        try {
          const pending = await prisma.payment.findFirst({
            where: { reservationId: String(reservationId), status: 'PENDING' },
            orderBy: { createdAt: 'desc' },
          });
          if (pending) {
            await prisma.payment.update({
              where: { id: pending.id },
              data: {
                status: 'COMPLETED',
                gatewayResponse: {
                  ...((pending.gatewayResponse as Record<string, unknown>) || {}),
                  stripeSessionId: session.id,
                  paidAt: new Date().toISOString(),
                },
              },
            });
          }
          await prisma.reservation.updateMany({
            where: { id: String(reservationId) },
            data: { depositPaid: true },
          });
        } catch (e) {
          console.error('Stripe deposit completion failed:', (e as Error).message);
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
};
