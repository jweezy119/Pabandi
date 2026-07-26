import express from 'express';
import { Router, NextFunction, Request, Response } from 'express';
import { stripeService } from '../services/stripe.service';
import { prisma } from '../utils/database';

const router = Router();

router.post(
  '/',
  express.raw({ type: 'application/json', verify: (req: any, _res, buf) => { req.rawBody = buf; } }),
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const signature = req.header('stripe-signature') || '';
      const rawBody: Buffer = req.rawBody || Buffer.from('');

      const ok = stripeService.verifyWebhook(signature, rawBody);
      if (!ok) {
        return res.status(401).json({ success: false, error: 'Invalid webhook' });
      }

      const event = req.body || {};
      if (event?.type === 'checkout.session.completed') {
        const session = event?.data?.object || {};
        const reservationId = session?.metadata?.reservation_id || session?.client_reference_id;
        if (reservationId) {
          await prisma.checkoutSession.updateMany({
            where: { id: reservationId },
            data: { status: 'PAID', metadata: { ...(session.metadata || {}), stripeSessionId: session.id } },
          });
        }
      }

      return res.status(200).json({ received: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
