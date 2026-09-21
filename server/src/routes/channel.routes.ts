import { Router, Request, Response, NextFunction } from 'express';
import { channelRouter } from '../services/channelRouter.service';

const router = Router();

// POST /api/v1/channels/route - Route message to best channel
router.post('/route', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { businessId, customerId, message, channels, parse_mode, buttons } = req.body;

    if (!businessId || !customerId || !message) {
      res.status(400).json({ success: false, error: 'businessId, customerId, and message are required' });
      return;
    }

    const result = await channelRouter.routeMessage(
      businessId,
      customerId,
      message,
      channels,
      { parse_mode, buttons }
    );

    if (!result.success) {
      res.status(502).json({ success: false, error: result.error, channel: result.channel });
      return;
    }

    res.json({ success: true, data: { channel: result.channel, messageId: result.messageId } });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/channels/fallback - Fallback to next channel
router.post('/fallback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { businessId, customerId, message, from, to, parse_mode, buttons } = req.body;

    if (!businessId || !customerId || !message || !from || !to) {
      res.status(400).json({ success: false, error: 'businessId, customerId, message, from, and to are required' });
      return;
    }

    const result = await channelRouter.fallback(
      businessId,
      customerId,
      message,
      from,
      to,
      { parse_mode, buttons }
    );

    if (!result.success) {
      res.status(502).json({ success: false, error: result.error, channel: result.channel });
      return;
    }

    res.json({ success: true, data: { channel: result.channel, messageId: result.messageId } });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/channels/:businessId/messages - Unified inbox
router.get('/:businessId/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { businessId } = req.params;
    const { channel, status, limit, offset } = req.query as {
      channel?: 'WHATSAPP' | 'TELEGRAM' | 'SMS';
      status?: string;
      limit?: string;
      offset?: string;
    };

    const messages = await channelRouter.getUnifiedInbox(businessId, {
      channel,
      status,
      limit: parseInt(limit || '50'),
      offset: parseInt(offset || '0'),
    });

    res.json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/channels/:businessId/stats - Channel analytics
router.get('/:businessId/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { businessId } = req.params;
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };

    const stats = await channelRouter.getChannelStats(
      businessId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );

    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/channels/:businessId/best-times - Best time to send
router.get('/:businessId/best-times', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { businessId } = req.params;
    const bestTimes = await channelRouter.getBestTimeToSend(businessId);
    res.json({ success: true, data: bestTimes });
  } catch (error) {
    next(error);
  }
});

export default router;
