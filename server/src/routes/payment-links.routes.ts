import { Router, Request, Response } from 'express';
import { paymentLinksService } from '../services/payment-links.service';
import { optionalAuthenticate } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/payment-links
 * Create a new payment link for a merchant or service worker.
 */
router.post('/', optionalAuthenticate, async (req: Request, res: Response) => {
  try {
    const {
      slug,
      title,
      description,
      amount,
      currency = 'USD',
      merchantName,
      merchantWallet,
      merchantRaastId,
      merchantPhone,
      allowCustomAmount,
      suggestedAmounts,
      redirectUrl,
    } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    const link = paymentLinksService.createLink({
      slug,
      title,
      description,
      amount: amount !== undefined && amount !== null && amount !== '' ? Number(amount) : null,
      currency: String(currency).toUpperCase() as any,
      merchantName,
      merchantWallet,
      merchantRaastId,
      merchantPhone,
      allowCustomAmount: allowCustomAmount !== false,
      suggestedAmounts,
      redirectUrl,
    });

    const origin = req.get('origin') || 'https://pabandi.com';
    const shareableUrl = `${origin}/pay/link/${link.slug}`;
    const whatsappShareText = encodeURIComponent(
      `Pay securely via Pabandi Escrow: ${link.title} (${link.amount ? `${link.amount} ${link.currency}` : 'Flexible amount'})\n${shareableUrl}`
    );
    const whatsappUrl = `https://api.whatsapp.com/send?text=${whatsappShareText}`;

    res.status(201).json({
      success: true,
      data: {
        ...link,
        url: shareableUrl,
        whatsappUrl,
      },
    });
  } catch (error: any) {
    logger.error('[PaymentLinksRoutes] Create error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/payment-links/:slugOrId
 * Resolve payment link details by slug or ID with dynamic on-the-fly resolution.
 */
router.get('/:slugOrId', async (req: Request, res: Response) => {
  try {
    const link = await paymentLinksService.resolveLink(req.params.slugOrId, req.query);
    const origin = req.get('origin') || 'https://pabandi.com';
    const shareableUrl = `${origin}/pay/link/${link.slug}`;
    const whatsappShareText = encodeURIComponent(
      `Pay securely via Pabandi Escrow: ${link.title} - ${shareableUrl}`
    );
    const whatsappUrl = `https://api.whatsapp.com/send?text=${whatsappShareText}`;

    res.json({
      success: true,
      data: {
        ...link,
        url: shareableUrl,
        whatsappUrl,
      },
    });
  } catch (error: any) {
    logger.error('[PaymentLinksRoutes] Resolve error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/payment-links
 * List public or merchant payment links.
 */
router.get('/', (_req: Request, res: Response) => {
  const links = paymentLinksService.getAllLinks();
  res.json({
    success: true,
    data: links,
  });
});

export default router;

