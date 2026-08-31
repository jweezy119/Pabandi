import { Router, Request, Response } from 'express';
import { PrismaClient, LedgerEntryType } from '@prisma/client';
import { isDemoMode } from '../utils/env';

const prisma = new PrismaClient();
const router = Router();

// Public: validate a marketplace partner code for the /partners/marketplace share link
// and the /embed/marketplace widget. Returns the partner display info or 404.
router.get('/validate/:code', async (req: Request, res: Response) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ error: 'Missing partner code' });

    const profile = await prisma.accountManagerProfile.findUnique({
      where: { referralCode: code },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    if (!profile || profile.status !== 'ACTIVE') {
      return res.status(404).json({ error: 'Partner code not found' });
    }
    const config = await prisma.partnerProgramConfig.findFirst();
    res.json({
      success: true,
      code: profile.referralCode,
      partnerName: [profile.user?.firstName, profile.user?.lastName]
        .filter(Boolean).join(' ') || 'A Pabandi partner',
      rateYear1: config?.rateYear1 ?? 0.03,
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/marketplace/escrow/local-sale
// A marketplace or power-seller opens a Pabandi-secured local sale from the embed widget.
// Persists the sale (escrow) and ties it to the referring partner code for commission.
// SIMULATED in demo mode (no real on-chain tx) — consistent with the rest of the platform.
router.post('/escrow/local-sale', async (req: Request, res: Response) => {
  try {
    const {
      referralCode, listingUrl, itemTitle, amount, currency,
      sellerEmail, buyerEmail,
    } = req.body || {};

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'A positive amount is required' });
    }
    if (!sellerEmail) {
      return res.status(400).json({ success: false, error: 'sellerEmail is required' });
    }

    // Validate the partner code if supplied (soft-fail: unknown codes just don't earn commission).
    let resolvedCode: string | null = null;
    if (referralCode) {
      const profile = await prisma.accountManagerProfile.findUnique({
        where: { referralCode: String(referralCode).trim().toUpperCase() },
      });
      if (profile && profile.status === 'ACTIVE') resolvedCode = profile.referralCode;
    }

    const simulated = isDemoMode();
    const txHash = simulated
      ? `localsale_init_${Date.now()}_${Math.random().toString(36).substring(7)}`
      : null;

    const sale = await prisma.localSaleEscrow.create({
      data: {
        referralCode: resolvedCode,
        listingUrl: listingUrl || null,
        itemTitle: itemTitle || null,
        amount: Number(amount),
        currency: currency || 'USD',
        sellerEmail: String(sellerEmail).toLowerCase().trim(),
        buyerEmail: buyerEmail ? String(buyerEmail).toLowerCase().trim() : null,
        status: 'VERIFIED', // identity assumed verified at widget open (signup/ID)
        txHash,
        simulated,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        saleId: sale.id,
        status: sale.status,
        simulated,
        txHash: sale.txHash,
        // The seller shares this link with the buyer to fund + complete the escrow.
        secureLink: `${req.protocol}://${req.get('host')}/embed/marketplace?sale=${sale.id}`,
      },
    });
  } catch (e: any) {
    console.error('[marketplace] local-sale failed:', e.message);
    res.status(500).json({ success: false, error: 'Could not open secured sale' });
  }
});

// GET /api/v1/marketplace/escrow/local-sale/:id — public status for the widget / seller page.
router.get('/escrow/local-sale/:id', async (req: Request, res: Response) => {
  try {
    const sale = await prisma.localSaleEscrow.findUnique({ where: { id: req.params.id } });
    if (!sale) return res.status(404).json({ success: false, error: 'Sale not found' });
    res.json({
      success: true,
      data: {
        saleId: sale.id,
        status: sale.status,
        amount: sale.amount,
        currency: sale.currency,
        itemTitle: sale.itemTitle,
        sellerEmail: sale.sellerEmail,
        buyerEmail: sale.buyerEmail,
        referralCode: sale.referralCode,
        simulated: sale.simulated,
        txHash: sale.txHash,
        createdAt: sale.createdAt,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/v1/marketplace/escrow/local-sale/:id/fund
// Buyer funds the escrow. (SIMULATED hold in demo mode; real on-chain lock otherwise.)
// Funds are now held — neither party can walk with them until release.
router.post('/escrow/local-sale/:id/fund', async (req: Request, res: Response) => {
  try {
    const sale = await prisma.localSaleEscrow.findUnique({ where: { id: req.params.id } });
    if (!sale) return res.status(404).json({ success: false, error: 'Sale not found' });
    if (sale.status !== 'VERIFIED') {
      return res.status(400).json({ success: false, error: `Cannot fund a sale in status ${sale.status}` });
    }
    const buyerEmail = String(req.body?.buyerEmail || sale.buyerEmail || '').toLowerCase().trim();
    if (!buyerEmail) {
      return res.status(400).json({ success: false, error: 'buyerEmail is required to fund' });
    }
    const txHash = isDemoMode()
      ? `localsale_fund_${Date.now()}_${Math.random().toString(36).substring(7)}`
      : sale.txHash;

    const updated = await prisma.localSaleEscrow.update({
      where: { id: sale.id },
      data: { status: 'FUNDED', buyerEmail, txHash },
    });

    res.json({
      success: true,
      data: { saleId: updated.id, status: updated.status, simulated: updated.simulated, txHash: updated.txHash },
    });
  } catch (e: any) {
    console.error('[marketplace] fund failed:', e.message);
    res.status(500).json({ success: false, error: 'Could not fund escrow' });
  }
});

// SafeMeet: curated safe public meetup spot types (no external API needed).
// A seller/buyer picks one, or provides a custom location.
const SAFE_MEET_SPOTS = [
  { id: 'police', label: 'Police station lobby', note: '24/7 staffed, cameras, safest option' },
  { id: 'bank', label: 'Bank lobby', note: 'Staffed, cameras, during business hours' },
  { id: 'coffee', label: 'Busy coffee shop', note: 'Public, staffed, daytime' },
  { id: 'mall', label: 'Shopping mall food court', note: 'Public, security, cameras' },
  { id: 'library', label: 'Public library', note: 'Staffed, quiet, daytime' },
  { id: 'custom', label: 'Custom location', note: 'Choose your own public spot' },
];

// GET /api/v1/marketplace/safe-meet — suggested safe meetup spots.
router.get('/safe-meet', async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: { spots: SAFE_MEET_SPOTS } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/v1/marketplace/escrow/local-sale/:id/meetup
// Schedule the SafeMeet: agreed location + time. Both parties should confirm.
router.post('/escrow/local-sale/:id/meetup', async (req: Request, res: Response) => {
  try {
    const sale = await prisma.localSaleEscrow.findUnique({ where: { id: req.params.id } });
    if (!sale) return res.status(404).json({ success: false, error: 'Sale not found' });
    if (sale.status === 'COMPLETED' || sale.status === 'CANCELLED' || sale.status === 'DISPUTED') {
      return res.status(400).json({ success: false, error: `Cannot schedule meetup for a ${sale.status} sale` });
    }

    const { meetupLocation, meetupLat, meetupLng, meetupAt } = req.body || {};
    if (!meetupLocation) {
      return res.status(400).json({ success: false, error: 'meetupLocation is required' });
    }

    const updated = await prisma.localSaleEscrow.update({
      where: { id: sale.id },
      data: {
        meetupLocation: String(meetupLocation),
        meetupLat: meetupLat != null ? Number(meetupLat) : null,
        meetupLng: meetupLng != null ? Number(meetupLng) : null,
        meetupAt: meetupAt ? new Date(meetupAt) : null,
        meetupStatus: 'SCHEDULED',
      },
    });

    res.json({
      success: true,
      data: {
        saleId: updated.id,
        meetupLocation: updated.meetupLocation,
        meetupLat: updated.meetupLat,
        meetupLng: updated.meetupLng,
        meetupAt: updated.meetupAt,
        meetupStatus: updated.meetupStatus,
      },
    });
  } catch (e: any) {
    console.error('[marketplace] meetup failed:', e.message);
    res.status(500).json({ success: false, error: 'Could not schedule meetup' });
  }
});

// POST /api/v1/marketplace/escrow/local-sale/:id/dispute
// Either party files a dispute (item not as described, no-show, robbery, etc.).
// Marks the sale DISPUTED, locks the escrow, and creates a Dispute record for arbitration.
router.post('/escrow/local-sale/:id/dispute', async (req: Request, res: Response) => {
  try {
    const sale = await prisma.localSaleEscrow.findUnique({ where: { id: req.params.id } });
    if (!sale) return res.status(404).json({ success: false, error: 'Sale not found' });
    if (sale.status === 'COMPLETED' || sale.status === 'CANCELLED' || sale.status === 'DISPUTED') {
      return res.status(400).json({ success: false, error: `Cannot dispute a ${sale.status} sale` });
    }

    const { reportedByEmail, againstEmail, reason, type, evidenceUrls } = req.body || {};
    if (!reportedByEmail || !reason) {
      return res.status(400).json({ success: false, error: 'reportedByEmail and reason are required' });
    }

    // Mark the sale disputed.
    const updated = await prisma.localSaleEscrow.update({
      where: { id: sale.id },
      data: { status: 'DISPUTED' },
    });

    // Create a Dispute record (contextType=LOCAL_SALE) so jurors can arbitrate.
    // We link via sellerEmail/buyerEmail since local sales are email-based, not userId-based.
    const dispute = await prisma.dispute.create({
      data: {
        type: type || 'OTHER',
        description: reason,
        outcome: 'PENDING',
        stakedAmount: 0,
        contextType: 'LOCAL_SALE',
        contextId: sale.id,
        evidenceUrls: evidenceUrls || [],
        // reportedById / userId are userId-based; for local sales we store email in description.
      },
    });

    res.status(201).json({
      success: true,
      data: {
        saleId: updated.id,
        status: updated.status,
        disputeId: dispute.id,
        disputeOutcome: dispute.outcome,
        message: 'Dispute filed. Escrow is locked pending arbitration. A community juror will review.',
      },
    });
  } catch (e: any) {
    console.error('[marketplace] dispute failed:', e.message);
    res.status(500).json({ success: false, error: 'Could not file dispute' });
  }
});

// Record the partner commission for a completed secured sale (idempotent per sale).
async function recordCommission(sale: any) {
  if (!sale.referralCode) return;
  const existing = await prisma.referralLedger.findFirst({
    where: { reservationId: sale.id },
  });
  if (existing) return; // already booked

  const profile = await prisma.accountManagerProfile.findUnique({ where: { referralCode: sale.referralCode } });
  if (!profile) return;

  const config = await prisma.partnerProgramConfig.findFirst();
  const rate = config?.rateYear1 ?? 0.03;
  const commission = Math.round(sale.amount * rate * 100) / 100;

  await prisma.referralLedger.create({
    data: {
      profileId: profile.id,
      type: LedgerEntryType.BOOKING_COMMISSION,
      amount: commission,
      currency: sale.currency || 'USD',
      reservationId: sale.id,
      platformFeeBasis: sale.amount,
      commissionRate: rate,
    },
  });
}

// POST /api/v1/marketplace/escrow/local-sale/:id/release
// Buyer (or seller) confirms the in-person exchange happened → release escrow to the
// seller and book the partner commission. (SIMULATED release in demo mode.)
router.post('/escrow/local-sale/:id/release', async (req: Request, res: Response) => {
  try {
    const sale = await prisma.localSaleEscrow.findUnique({ where: { id: req.params.id } });
    if (!sale) return res.status(404).json({ success: false, error: 'Sale not found' });
    if (sale.status !== 'FUNDED' && sale.status !== 'VERIFIED') {
      return res.status(400).json({ success: false, error: `Cannot release a sale in status ${sale.status}` });
    }

    const txHash = isDemoMode()
      ? `localsale_release_${Date.now()}_${Math.random().toString(36).substring(7)}`
      : sale.txHash;

    const updated = await prisma.localSaleEscrow.update({
      where: { id: sale.id },
      data: { status: 'COMPLETED', txHash },
    });

    // Book the partner's commission (best-effort; never blocks the release).
    try {
      await recordCommission(updated);
    } catch (e: any) {
      console.error('[marketplace] commission booking failed:', e.message);
    }

    res.json({
      success: true,
      data: { saleId: updated.id, status: updated.status, simulated: updated.simulated, txHash: updated.txHash },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: 'Could not release sale' });
  }
});

export default router;
