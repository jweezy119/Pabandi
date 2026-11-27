import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();
const GUARANTEED_RATE = Number(process.env.PLATFORM_FX_RATE_USD_PKR) || 280.00;

/**
 * GET /api/v1/public/magic/:id
 * Resolves a public booking or invoice magic link without requiring authentication.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id?.trim();
    if (!rawId) {
      return res.status(400).json({ success: false, error: 'Magic link ID is required' });
    }

    // IDOR Enumeration Guard: Block sequential integer enumeration (e.g. /1, /2, /3)
    if (/^\d+$/.test(rawId)) {
      return res.status(403).json({
        success: false,
        error: 'Sequential link enumeration is forbidden. Secure magic links must use the unguessable CUID reference.',
      });
    }

    // 0. Check RepairOrder (Agentic US Auto Repair Magic Link Tracker)
    const repairOrder = await prisma.repairOrder
      .findUnique({
        where: { id: rawId },
        include: {
          vehicle: true,
          business: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
              slug: true,
              currency: true,
              trustScore: true,
              fairPriceScore: true,
              communicationScore: true,
              isVerified: true,
            },
          },
        },
      })
      .catch(() => null);

    if (repairOrder) {
      const depositUsd = Number(repairOrder.depositAmount) || Math.max(25, +(Number(repairOrder.totalAmount) * 0.25).toFixed(2));
      const totalUsd = Number(repairOrder.totalAmount) || depositUsd;
      const pkrAmount = Math.round(depositUsd * GUARANTEED_RATE);
      const clientName = repairOrder.clientName || 'Vehicle Owner';
      const bizName = repairOrder.business?.name || 'Pabandi Verified Auto Shop';
      const vehicleLabel = [repairOrder.vehicle?.year, repairOrder.vehicle?.make, repairOrder.vehicle?.model]
        .filter(Boolean)
        .join(' ') || `VIN ${repairOrder.vehicle?.vin || ''}`;
      const shareUrl = `https://pabandi.com/b/${repairOrder.id}`;
      const shareText = `Hi ${clientName}, track your ${vehicleLabel} repair at ${bizName} & approve your Fair-Price Verified estimate: ${shareUrl}`;

      return res.json({
        success: true,
        data: {
          type: 'repair_order',
          id: repairOrder.id,
          title: repairOrder.serviceType || 'Auto Repair Service',
          description: `${vehicleLabel}${repairOrder.vehicle?.vin ? ` · VIN ${repairOrder.vehicle.vin}` : ''}`,
          amount: depositUsd,
          totalAmount: totalUsd,
          depositAmount: depositUsd,
          currency: repairOrder.business?.currency || 'USD',
          usdAmount: depositUsd,
          pkrAmount,
          rate: GUARANTEED_RATE,
          status: repairOrder.status,
          isPaid: repairOrder.depositPaid || repairOrder.status === 'IN_PROGRESS' || repairOrder.status === 'READY',
          isBookedByAgent: repairOrder.isBookedByAgent,
          fairPriceVerified: repairOrder.fairPriceVerified,
          fairPriceReport: repairOrder.fairPriceReport ?? null,
          itemizedEstimate: repairOrder.itemizedEstimate ?? null,
          dviPhotos: Array.isArray(repairOrder.dviPhotos) ? repairOrder.dviPhotos : [],
          visionProofHash: repairOrder.visionProofHash ?? null,
          visionProofReport: repairOrder.visionProofReport ?? null,
          vehicle: repairOrder.vehicle
            ? {
                id: repairOrder.vehicle.id,
                vin: repairOrder.vehicle.vin,
                year: repairOrder.vehicle.year,
                make: repairOrder.vehicle.make,
                model: repairOrder.vehicle.model,
                licensePlate: repairOrder.vehicle.licensePlate,
              }
            : null,
          business: {
            id: repairOrder.business?.id,
            name: bizName,
            logoUrl: repairOrder.business?.logoUrl ?? null,
            slug: repairOrder.business?.slug ?? null,
            trustScore: repairOrder.business?.trustScore ?? 85,
            fairPriceScore: repairOrder.business?.fairPriceScore ?? 85,
            communicationScore: repairOrder.business?.communicationScore ?? 85,
            isVerified: Boolean(repairOrder.business?.isVerified),
          },
          client: {
            name: clientName,
            phone: repairOrder.clientPhone ?? null,
          },
          whatsappShareText: shareText,
          whatsappShareUrl: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
        },
      });
    }

    // 1. Check Invoice by unguessable CUID
    let invoice = await prisma.invoice.findUnique({
      where: { id: rawId },
      include: { client: true },
    });

    if (invoice) {
      const business = invoice.businessId
        ? await prisma.business.findUnique({
            where: { id: invoice.businessId },
            select: { id: true, name: true, logoUrl: true, currency: true, trustScore: true, isVerified: true },
          })
        : null;

      let metadata: Record<string, any> = {};
      try {
        const parsed = JSON.parse(invoice.notes || '{}');
        metadata = parsed.metadata || parsed;
      } catch {
        // Plain text notes
      }

      const usdAmount = Number(invoice.subtotal) || 0;
      const pkrAmount = Math.round(usdAmount * GUARANTEED_RATE);
      const clientName = invoice.client?.name || 'Client';
      const bizName = business?.name || 'Verified Pabandi Merchant';
      const shareUrl = `https://pabandi.com/pay/${invoice.id}`;
      const shareText = `Hi ${clientName}, here is your secure payment link for ${bizName}: ${shareUrl}`;

      return res.json({
        success: true,
        data: {
          type: 'invoice',
          id: invoice.id,
          number: invoice.number,
          title: invoice.number ? `Invoice #${invoice.number}` : 'Professional Invoice',
          description: typeof metadata.text === 'string' ? metadata.text : (invoice.notes || 'Professional Services via Pabandi Escrow'),
          amount: usdAmount,
          currency: (metadata.currency as string) || business?.currency || 'USD',
          usdAmount,
          pkrAmount,
          rate: GUARANTEED_RATE,
          status: invoice.status,
          isPaid: invoice.status.toLowerCase() === 'paid',
          paidAt: invoice.paidAt,
          lpDispatched: Boolean(metadata.lpDispatched),
          platformFeeUsd: +(usdAmount * 0.03).toFixed(2),
          netUsdc: +(usdAmount * 0.97).toFixed(2),
          business: {
            id: business?.id ?? null,
            name: bizName,
            logoUrl: business?.logoUrl ?? null,
            trustScore: business?.trustScore ?? 70,
            isVerified: Boolean(business?.isVerified),
          },
          client: {
            id: invoice.client?.id ?? null,
            name: clientName,
            email: invoice.client?.email ?? null,
            phone: invoice.client?.phone ?? null,
          },
          whatsappShareText: shareText,
          whatsappShareUrl: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
        },
      });
    }

    // 2. Check Booking
    const booking = await prisma.booking.findUnique({
      where: { id: rawId },
      include: {
        business: {
          select: { id: true, name: true, logoUrl: true, slug: true, trustScore: true, isVerified: true, currency: true },
        },
        client: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    });

    if (booking) {
      const meta = (booking.metadata as Record<string, any>) || {};
      const usdAmount = Number(booking.depositAmount) || 25;
      const pkrAmount = Math.round(usdAmount * GUARANTEED_RATE);
      const clientName = booking.client?.name || (meta.customerName as string) || 'Client';
      const bizName = booking.business?.name || 'Verified Pabandi Business';
      const shareUrl = `https://pabandi.com/b/${booking.id}`;
      const shareText = `Hi ${clientName}, here is your secure booking link for ${bizName}: ${shareUrl}`;

      return res.json({
        success: true,
        data: {
          type: 'booking',
          id: booking.id,
          title: booking.serviceType || 'Confirmed Reservation',
          description: booking.depositReason || (meta.notes as string) || `Booking scheduled for ${booking.slotStart}`,
          amount: usdAmount,
          currency: booking.business?.currency || 'USD',
          usdAmount,
          pkrAmount,
          rate: GUARANTEED_RATE,
          status: booking.status,
          isPaid: booking.status === 'confirmed' || booking.depositPaid || booking.depositStatus === 'funded',
          platformFeeUsd: +(usdAmount * 0.03).toFixed(2),
          netUsdc: +(usdAmount * 0.97).toFixed(2),
          business: {
            id: booking.business?.id,
            name: bizName,
            logoUrl: booking.business?.logoUrl,
            slug: booking.business?.slug,
            trustScore: booking.business?.trustScore ?? 70,
            isVerified: Boolean(booking.business?.isVerified),
          },
          client: {
            id: booking.client?.id,
            name: clientName,
            email: booking.client?.email || (meta.customerEmail as string) || null,
            phone: booking.client?.phone || (meta.customerPhone as string) || null,
          },
          whatsappShareText: shareText,
          whatsappShareUrl: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
        },
      });
    }

    // 3. Fallback check for Business by slug or ID
    const biz = await prisma.business.findFirst({
      where: { OR: [{ slug: rawId }, { id: rawId }] },
      select: { id: true, name: true, logoUrl: true, slug: true, trustScore: true, isVerified: true, category: true, depositAmount: true },
    });

    if (biz) {
      const usdAmount = Number(biz.depositAmount) || 25;
      const pkrAmount = Math.round(usdAmount * GUARANTEED_RATE);
      const shareUrl = `https://pabandi.com/b/${biz.slug || biz.id}`;
      const shareText = `Hi there, here is your secure booking link for ${biz.name}: ${shareUrl}`;

      return res.json({
        success: true,
        data: {
          type: 'business_direct',
          id: biz.id,
          slug: biz.slug,
          title: `Direct Booking with ${biz.name}`,
          description: `Instant verified booking via Pabandi Escrow (${biz.category || 'Service'})`,
          amount: usdAmount,
          currency: 'USD',
          usdAmount,
          pkrAmount,
          rate: GUARANTEED_RATE,
          status: 'OPEN',
          isPaid: false,
          business: {
            id: biz.id,
            name: biz.name,
            logoUrl: biz.logoUrl,
            slug: biz.slug,
            trustScore: biz.trustScore ?? 70,
            isVerified: Boolean(biz.isVerified),
          },
          client: null,
          whatsappShareText: shareText,
          whatsappShareUrl: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
        },
      });
    }

    return res.status(404).json({
      success: false,
      error: `No booking or invoice found for reference "${rawId}".`,
    });
  } catch (err: any) {
    logger.error(`[MagicLink] Error fetching entity: ${err.message}`);
    return res.status(500).json({ success: false, error: 'Failed to resolve magic link' });
  }
});

export default router;
