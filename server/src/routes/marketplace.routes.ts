import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
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
        // The seller shares this link with the buyer to complete + fund the escrow.
        secureLink: `${req.protocol}://${req.get('host')}/embed/marketplace?sale=${sale.id}`,
      },
    });
  } catch (e: any) {
    console.error('[marketplace] local-sale failed:', e.message);
    res.status(500).json({ success: false, error: 'Could not open secured sale', detail: e.message });
  }
});

// GET /api/v1/marketplace/escrow/local-sale/:id — public status for the widget.
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
        simulated: sale.simulated,
        txHash: sale.txHash,
        createdAt: sale.createdAt,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/v1/marketplace/escrow/local-sale/:id/release
// Mark the in-person exchange complete → release escrow to the seller (SIMULATED).
// In production this would sign the on-chain release; demo stays off-chain.
router.post('/escrow/local-sale/:id/release', async (req: Request, res: Response) => {
  try {
    const sale = await prisma.localSaleEscrow.findUnique({ where: { id: req.params.id } });
    if (!sale) return res.status(404).json({ success: false, error: 'Sale not found' });

    const txHash = isDemoMode()
      ? `localsale_release_${Date.now()}_${Math.random().toString(36).substring(7)}`
      : sale.txHash;

    const updated = await prisma.localSaleEscrow.update({
      where: { id: sale.id },
      data: { status: 'COMPLETED', txHash },
    });

    res.json({
      success: true,
      data: { saleId: updated.id, status: updated.status, simulated: updated.simulated, txHash: updated.txHash },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: 'Could not release sale' });
  }
});

export default router;
