import { Request, Response, NextFunction } from 'express';
import { stripeService } from '../services/stripe.service';
import { prisma } from '../utils/database';

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
};
