import { Router, Request, Response, NextFunction } from 'express';
import { whatsAppSmartService } from '../services/whatsapp.smart.service';
import { openwaTemplateService } from '../services/openwa.template.service';
import { authenticate } from '../middleware/auth.middleware';
import { resolvePlatformBusinessId } from '../middleware/tenant.middleware';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

// WHY THIS IS NOW AUTHENTICATED
//
// These routes had no authentication at all, and were unreachable only by accident: a
// sibling registration pointed at a module that does not exist, and `app.use` matched
// subpaths, so `/api/v1/whatsapp` swallowed every `/api/v1/whatsapp/**` request with a
// 500. Removing that dead registration without adding auth first would have turned a
// broken endpoint into an OPEN one — anyone could have driven `smart-action`, which
// sends real WhatsApp messages to a real customer phone number.
//
// So: auth first, then unblock.
router.use(authenticate);

// Adapter: WhatsApp advanced capabilities
router.get('/capabilities', (_req: Request, res: Response) => {
  res.json({ success: true, capabilities: whatsAppSmartService.capabilities() });
});

// ── Strategy 1: "The 30-Second QR Scan" for Business Onboarding ──
// GET /api/v1/whatsapp/connect-qr
// Generates or fetches an OpenWA session QR code for the business owner to scan directly with their phone
router.get('/connect-qr', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = (await resolvePlatformBusinessId(req)) || (req as any).user?.businessId || (req as any).user?.id;
    if (!businessId) {
      return res.status(400).json({ success: false, error: 'Business ID required' });
    }

    const sessionId = `biz_${businessId}`;
    const { openwaService } = await import('../services/openwa.service');

    // 1. Ensure session exists
    let session = await openwaService.getSession(sessionId).catch(() => null);
    if (!session) {
      session = await openwaService.createSession(sessionId).catch(() => null);
    }

    // 2. Fetch QR code
    const qrData = await openwaService.getSessionQrCode(sessionId);

    res.json({
      success: true,
      data: {
        sessionId,
        status: qrData?.status || session?.status || 'qr_ready',
        connected: session?.connected || session?.status === 'connected',
        qr: qrData?.qr || null,
        instructions: [
          '1. Open WhatsApp on your business phone',
          '2. Tap Settings > Linked Devices > Link a Device',
          '3. Point your phone at this QR code to connect instantly (Zero Meta verification required)',
        ],
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── Strategy 2: Interactive WhatsApp Quick-Reply Buttons ──
// POST /api/v1/whatsapp/send-buttons
// Sends interactive quick-reply buttons (e.g. [Pay Deposit] [Reschedule] [Staff])
router.post('/send-buttons', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerPhone, title, bodyText, buttons, footer } = req.body || {};
    if (!customerPhone || !bodyText || !Array.isArray(buttons) || buttons.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'customerPhone, bodyText, and non-empty buttons[] are required',
      });
    }

    const { openwaService } = await import('../services/openwa.service');
    const result = await openwaService.sendButtons(customerPhone, bodyText, buttons, {
      title,
      footer,
    });

    res.json({
      success: true,
      message: 'Interactive buttons dispatched',
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// Adapter: execute a smart WhatsApp action from external systems/CRM
router.post('/smart-action', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { intent, customerPhone, businessPhone, message } = req.body || {};
    if (!intent) {
      return res.status(400).json({ success: false, error: 'intent is required' });
    }

    // Resolve the caller's business from the session and refuse if there is none, rather
    // than acting on behalf of nobody. The service itself does not check, so this is the
    // only thing standing between a logged-in user and a message sent as no business.
    const businessId = await resolvePlatformBusinessId(req);
    if (!businessId) {
      return res.status(403).json({
        success: false,
        error: 'No business is associated with this account. Finish setting up your business first.',
      });
    }

    const reply = await whatsAppSmartService.runSmartAction(intent, {
      customerPhone,
      businessPhone,
      message,
    });
    res.json({ success: true, data: reply });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/whatsapp/outreach/noshow-shield
// Dispatch high-converting Zero-Risk No-Show Shield onboarding message to prospective merchants
router.post('/outreach/noshow-shield', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ownerPhone, ownerName, businessName, depositAmount } = req.body || {};
    if (!ownerPhone || !businessName) {
      return res.status(400).json({ success: false, error: 'ownerPhone and businessName are required' });
    }

    const business = await prisma.business.findFirst({
      where: { OR: [{ name: businessName }, { phone: ownerPhone }] },
    });

    const businessId = business?.id || businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const claimUrl = `${process.env.CLIENT_URL || 'https://pabandi.com'}/business/${businessId}?claim=true`;

    const result = await openwaTemplateService.sendTemplate(ownerPhone, 'noshow_recovery_outreach', {
      ownerName: ownerName || 'Business Owner',
      businessName,
      depositAmount: depositAmount || 'Rs. 500',
      claimUrl,
    });

    res.json({
      success: true,
      message: 'Zero-Risk No-Show Protection outreach dispatched',
      data: {
        recipient: ownerPhone,
        businessName,
        claimUrl,
        sent: result.success,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/whatsapp/settlement/noshow-recovery
// Process a no-show deposit forfeiture: 80% to merchant, 20% platform recovery rake
router.post('/settlement/noshow-recovery', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reservationId, businessPhone, depositAmount, currency } = req.body || {};
    if (!reservationId || !depositAmount) {
      return res.status(400).json({ success: false, error: 'reservationId and depositAmount are required' });
    }

    const grossDeposit = Number(depositAmount);
    if (!Number.isFinite(grossDeposit) || grossDeposit <= 0) {
      return res.status(400).json({ success: false, error: 'depositAmount must be a positive number' });
    }

    const PLATFORM_FEE_RATE = 0.20; // 20% recovery rake on forfeited ghost bookings
    const platformFee = Math.round(grossDeposit * PLATFORM_FEE_RATE * 100) / 100;
    const merchantPayout = Math.round((grossDeposit - platformFee) * 100) / 100;
    const curr = currency || 'USD';

    // Record platform recovery rake in TreasuryPosition
    let treasuryRecord: any = null;
    try {
      treasuryRecord = await prisma.treasuryPosition.create({
        data: {
          bucket: 'OPERATING',
          kind: 'NO_SHOW_RECOVERY',
          amount: platformFee,
          status: 'DEPLOYED',
          meta: {
            source: 'WHATSAPP_NOSHOW_RECOVERY',
            reservationId,
            grossDeposit,
            platformFee,
            merchantPayout,
            feeRate: '20%',
            currency: curr,
            recordedAt: new Date().toISOString(),
          },
        },
      });
      logger.info(`[No-Show Recovery] Captured ${curr} ${platformFee} (20% rake) to TreasuryPosition ${treasuryRecord.id}`);
    } catch (err: any) {
      logger.warn(`[No-Show Recovery] TreasuryPosition write warning: ${err.message}`);
    }

    // Send WhatsApp settlement confirmation to business if phone provided
    if (businessPhone) {
      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: { business: true },
      }).catch(() => null);

      const businessName = reservation?.business?.name || 'Your Business';
      const dateStr = reservation?.reservationDate ? new Date(reservation.reservationDate).toLocaleDateString() : 'Today';
      const timeStr = reservation?.reservationTime || 'Scheduled slot';

      await openwaTemplateService.sendTemplate(businessPhone, 'forfeited_deposit_settlement', {
        businessName,
        reservationDate: dateStr,
        reservationTime: timeStr,
        depositAmount: `${curr} ${grossDeposit}`,
        platformFeeAmount: `${curr} ${platformFee}`,
        payoutAmount: `${curr} ${merchantPayout}`,
        escrowId: reservationId,
      }).catch((e: any) => logger.warn(`[No-Show Recovery] Notification dispatch warning: ${e.message}`));
    }

    res.json({
      success: true,
      message: 'Forfeited deposit successfully recovered and settled',
      data: {
        reservationId,
        grossDeposit,
        platformFee,
        merchantPayout,
        currency: curr,
        treasuryPositionId: treasuryRecord?.id,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── Strategy: Click-to-WhatsApp Bio Links & QR Standee Generator ──
// GET /api/v1/whatsapp/advanced/marketing-links
// Generates ready-to-use wa.me deep links, Instagram bio snippets, and QR codes for physical counters
router.get('/marketing-links', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = (await resolvePlatformBusinessId(req)) || (req as any).user?.businessId || (req as any).user?.id;
    if (!businessId) {
      return res.status(400).json({ success: false, error: 'Business ID required' });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { settings: true },
    });

    const phoneRaw = business?.settings?.whatsappNumber || business?.phone || (req.query.phone as string) || '';
    const cleanPhone = phoneRaw.replace(/[^\d]/g, '');

    const defaultMsg = encodeURIComponent(`Salam! I'd like to book an appointment with ${business?.name || 'you'}.`);
    const waMeUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${defaultMsg}` : 'https://wa.me/?text=Book';
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(waMeUrl)}`;

    res.json({
      success: true,
      data: {
        businessId,
        businessName: business?.name || 'Your Business',
        phone: cleanPhone,
        waMeUrl,
        qrCodeUrl,
        instagramBioSnippet: `📅 Book instantly on WhatsApp: ${waMeUrl}`,
        googleMapsCallout: `Message us on WhatsApp to lock your booking: ${waMeUrl}`,
        counterStandee: {
          headline: `Scan to Book with ${business?.name || 'Us'}`,
          subhead: 'Instant confirmation on your WhatsApp in 30 seconds',
          qrCodeUrl,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
