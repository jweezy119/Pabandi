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

// ── Strategy 1B: "The 8-Digit Pairing Code" (Zero-Screen Mobile Onboarding) ──
// POST /api/v1/whatsapp/pairing-code
// Enables merchant to link WhatsApp directly from their phone without needing a 2nd screen or camera scan
router.post('/pairing-code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = (await resolvePlatformBusinessId(req)) || (req as any).user?.businessId || (req as any).user?.id;
    const { phoneNumber } = req.body || {};

    if (!phoneNumber) {
      return res.status(400).json({ success: false, error: 'phoneNumber is required (e.g. 03001234567 or +923001234567)' });
    }

    const sessionId = `biz_${businessId || 'default'}`;
    const { openwaService } = await import('../services/openwa.service');

    // Ensure session exists
    let session = await openwaService.getSession(sessionId).catch(() => null);
    if (!session) {
      session = await openwaService.createSession(sessionId).catch(() => null);
    }

    const pairingData = await openwaService.getPairingCode(sessionId, phoneNumber);

    res.json({
      success: true,
      data: {
        sessionId,
        phoneNumber,
        pairingCode: pairingData.pairingCode,
        status: pairingData.status,
        instructions: pairingData.instructions,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── Strategy 1C: Zero-Friction AI 1-Message Onboarding Seeder ──
// POST /api/v1/whatsapp/ai-onboard
// Uses industry presets or natural language extraction to configure services, hours, deposits & Raast in 1-click
router.post('/ai-onboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = (await resolvePlatformBusinessId(req)) || (req as any).user?.businessId || (req as any).user?.id;
    const { presetCategory, rawPrompt, businessName, phone, city, raastId } = req.body || {};

    // 1. Curated industry presets
    const PRESETS: Record<string, { category: any; services: Array<{ name: string; price: number; duration: number }>; hours: string; deposit: number }> = {
      salon: {
        category: 'SALON',
        services: [
          { name: 'Haircut & Styling', price: 1500, duration: 30 },
          { name: 'Beard Trim & Shape', price: 800, duration: 20 },
          { name: 'Deep Cleansing Facial', price: 2500, duration: 45 },
          { name: 'VIP Groom Package', price: 4500, duration: 75 },
        ],
        hours: '11:00 AM - 10:00 PM',
        deposit: 500,
      },
      clinic: {
        category: 'HEALTHCARE',
        services: [
          { name: 'General Doctor Consultation', price: 2000, duration: 20 },
          { name: 'Follow-up Checkup', price: 1000, duration: 15 },
          { name: 'Specialist Assessment', price: 3500, duration: 30 },
        ],
        hours: '04:00 PM - 09:00 PM',
        deposit: 1000,
      },
      fitness: {
        category: 'FITNESS',
        services: [
          { name: '1-on-1 Personal Training Session', price: 2500, duration: 60 },
          { name: 'Custom Diet & Workout Consultation', price: 3000, duration: 45 },
          { name: 'Monthly Transformation Slot', price: 20000, duration: 60 },
        ],
        hours: '07:00 AM - 09:00 PM',
        deposit: 1000,
      },
      car_detailing: {
        category: 'OTHER',
        services: [
          { name: 'Signature Foam Wash & Vacuum', price: 2000, duration: 40 },
          { name: 'Interior Detailing & Leather Care', price: 6000, duration: 90 },
          { name: 'Ceramic Glass Coating', price: 15000, duration: 180 },
        ],
        hours: '09:00 AM - 08:00 PM',
        deposit: 1000,
      },
    };

    const chosen = (presetCategory && PRESETS[presetCategory.toLowerCase()]) || PRESETS.salon;
    const resolvedName = businessName || 'My Business';
    const resolvedCity = city || 'Karachi';
    const resolvedPhone = phone || '03001234567';
    const resolvedRaast = raastId || resolvedPhone;

    // 2. Persist or update Business in Prisma
    let targetBiz: any = null;
    if (businessId) {
      targetBiz = await prisma.business.findUnique({ where: { id: businessId } }).catch(() => null);
    }

    if (!targetBiz) {
      targetBiz = await prisma.business.create({
        data: {
          name: resolvedName,
          category: chosen.category,
          address: `${resolvedCity}, Pakistan`,
          city: resolvedCity,
          country: 'Pakistan',
          currency: 'PKR',
          phone: resolvedPhone,
          requireDeposit: true,
          depositAmount: chosen.deposit,
          timezone: 'Asia/Karachi',
        },
      });
    } else {
      targetBiz = await prisma.business.update({
        where: { id: targetBiz.id },
        data: {
          requireDeposit: true,
          depositAmount: chosen.deposit,
          currency: 'PKR',
          phone: resolvedPhone || targetBiz.phone,
        },
      });
    }

    // 3. Populate services
    const createdServices = [];
    for (const svc of chosen.services) {
      const s = await prisma.businessService.create({
        data: {
          businessId: targetBiz.id,
          name: svc.name,
          price: svc.price,
          duration: svc.duration,
          isActive: true,
          category: presetCategory || 'GENERAL',
        },
      });
      createdServices.push(s);
    }

    // 4. Update BusinessSettings with WhatsApp and FAQ auto-replies
    const settings = await prisma.businessSettings.upsert({
      where: { businessId: targetBiz.id },
      create: {
        businessId: targetBiz.id,
        whatsappNumber: resolvedPhone,
        whatsappInstanceId: `biz_${targetBiz.id}`,
        autoConfirm: false, // Wait for deposit
        autoRequireDeposit: true,
        faqRules: {
          location: `${resolvedName} is located in ${resolvedCity}.`,
          hours: `We are open daily: ${chosen.hours}.`,
          raastId: resolvedRaast,
        },
      },
      update: {
        whatsappNumber: resolvedPhone,
        whatsappInstanceId: `biz_${targetBiz.id}`,
        autoRequireDeposit: true,
        faqRules: {
          location: `${resolvedName} is located in ${resolvedCity}.`,
          hours: `We are open daily: ${chosen.hours}.`,
          raastId: resolvedRaast,
        },
      },
    });

    const cleanPhone = String(resolvedPhone).replace(/[^\d]/g, '');
    const waMeUrl = `https://wa.me/${cleanPhone.startsWith('0') ? '92' + cleanPhone.slice(1) : cleanPhone}?text=Hi!+I'd+like+to+book+an+appointment`;

    res.json({
      success: true,
      message: 'Business profile, services, hours, and WhatsApp bot configured instantly!',
      data: {
        business: targetBiz,
        settings,
        servicesCount: createdServices.length,
        services: createdServices,
        hours: chosen.hours,
        raastId: resolvedRaast,
        waMeUrl,
        customerLink: waMeUrl,
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

// ── Outbound Growth: Invite Business to Onboard via WhatsApp ──
// POST /api/v1/whatsapp/advanced/invite-business
// Sends an interactive pitch to a prospective business with a 1-tap activation button
router.post('/invite-business', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { targetPhone, businessName, category, city } = req.body || {};
    if (!targetPhone || !businessName) {
      return res.status(400).json({ success: false, error: 'targetPhone and businessName are required' });
    }

    const { whatsAppOnboardingService } = await import('../services/whatsapp.onboarding.service');
    const result = await whatsAppOnboardingService.sendOutboundInvite(
      targetPhone,
      businessName,
      category || 'salon',
      city || 'Karachi'
    );

    res.json({
      success: true,
      message: `Onboarding invite dispatched to ${targetPhone} for ${businessName}`,
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
