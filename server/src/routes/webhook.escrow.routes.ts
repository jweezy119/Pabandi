import { Router, NextFunction, Request, Response } from 'express';
import express from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

router.post(
  '/',
  express.raw({ type: 'application/json', verify: (req: any, _res, buf) => { req.rawBody = buf; } }),
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const rawBody: Buffer = req.rawBody || Buffer.from('');
      let payload: any = {};

      try {
        payload = JSON.parse(rawBody.toString('utf-8') || '{}');
      } catch (parseError) {
        logger.warn('[EscrowWebhook] Invalid JSON received');
        return res.status(200).json({ received: true });
      }

      const eventType = String(payload?.event || payload?.event_type || '');
      const escrowTransactionId = String(payload?.transaction_id || payload?.transactionId || '');
      const escrowStatus = String(payload?.status || eventType || 'unknown');
      const escrowId = String(payload?.id || '');

      if (!escrowTransactionId) {
        return res.status(200).json({ received: true });
      }

      await prisma.$transaction(async (tx) => {
        let session = await tx.checkoutSession.findFirst({
          where: {
            OR: [
              { metadata: { path: ['escrowTransactionId'], equals: escrowTransactionId } },
              ...(escrowId ? [{ metadata: { path: ['escrowId'], equals: escrowId } }] : []),
            ],
          },
        });

        if (!session) {
          logger.warn('[EscrowWebhook] No session found for transactionId=%s escrowId=%s', escrowTransactionId, escrowId);
          return;
        }

        await tx.escrowEvent.create({
          data: {
            checkoutSessionId: session.id,
            escrowTransactionId,
            eventType: eventType || 'unknown',
            status: escrowStatus,
            payload,
          },
        });

        const isTerminal = ['released', 'cancelled', 'dispute_opened'].includes(escrowStatus.toLowerCase());
        const status = isTerminal ? escrowStatus.toUpperCase() : session.status;

        await tx.checkoutSession.update({
          where: { id: session.id },
          data: {
            status: status as any,
            metadata: {
              ...(session.metadata as any || {}),
              escrowTransactionId,
              ...(escrowId ? { escrowId } : {}),
              lastEscrowEvent: eventType,
            },
          },
        });

        logger.info('[EscrowWebhook] Persisted event=%s transactionId=%s session=%s', eventType, escrowTransactionId, session.id);
      });

      return res.status(200).json({ received: true });
    } catch (error) {
      logger.error('[EscrowWebhook] Processing error: %s', (error as any)?.message || error);
      return res.status(200).json({ received: true });
    }
  }
);

router.get('/receipt/:escrowTransactionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { escrowTransactionId } = req.params;

    const events = await prisma.escrowEvent.findMany({
      where: { escrowTransactionId },
      orderBy: { createdAt: 'asc' },
    });

    if (!events.length) {
      // fallback: lookup by recent matching metadata to support manual lookup
      const candidate = await prisma.checkoutSession.findFirst({
        where: { metadata: { path: ['escrowTransactionId'], equals: escrowTransactionId } },
        orderBy: { createdAt: 'desc' },
      });

      if (!candidate) {
        return res.status(404).json({ success: false, message: 'No settlement receipt found' });
      }

      const latest = await prisma.escrowEvent.findFirst({
        where: { checkoutSessionId: candidate.id },
        orderBy: { createdAt: 'desc' },
      });

      return res.status(200).json({
        success: true,
        data: {
          checkoutSessionId: candidate.id,
          escrowTransactionId,
          status: candidate.status,
          lastEvent: latest || null,
        },
      });
    }

    const latestEvent = events[events.length - 1];
    const checkoutSessionId = latestEvent.checkoutSessionId;

    const session = await prisma.checkoutSession.findUnique({
      where: { id: checkoutSessionId },
    });

    return res.status(200).json({
      success: true,
      data: {
        checkoutSessionId,
        escrowTransactionId,
        status: session?.status || latestEvent.status,
        eventCount: events.length,
        lastEvent: latestEvent,
        events,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
