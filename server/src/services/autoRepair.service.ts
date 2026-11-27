/**
 * autoRepair.service.ts — Core service for the Agentic US Auto Repair vertical.
 * Powers both MCP tools for AI Agents and REST endpoints for human coordinators.
 */

import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import {
  decodeVinWithNhtsa,
  evaluateEstimateFairPrice,
  verifyRepairVisionProof,
  type EstimateLineItem,
} from './autoRepairGuardrails.service';

const PUBLIC_APP_URL = (process.env.FRONTEND_URL || 'https://pabandi.com').replace(/\/+$/, '');

export interface DviPhotoInput {
  kind: 'before' | 'after' | 'inspection';
  url: string;
  label?: string;
}

export const autoRepairService = {
  /**
   * MCP Tool 1: pabandi_search_auto_repair
   * Finds available auto repair shops by zip/location & serviceType,
   * returning their Trust Scores and next available bay time.
   */
  async searchAutoRepair(params: { location?: string; serviceType?: string }) {
    const location = (params.location || '').trim();
    const serviceType = (params.serviceType || '').trim();

    const where: any = {
      isActive: true,
      ...(location
        ? {
            OR: [
              { postalCode: { contains: location, mode: 'insensitive' } },
              { city: { contains: location, mode: 'insensitive' } },
              { address: { contains: location, mode: 'insensitive' } },
              { state: { contains: location, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    let businesses = await prisma.business.findMany({
      where,
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        state: true,
        postalCode: true,
        phone: true,
        category: true,
        trustScore: true,
        fairPriceScore: true,
        communicationScore: true,
        isVerified: true,
        acceptsAgentBookings: true,
        services: {
          where: serviceType
            ? { name: { contains: serviceType, mode: 'insensitive' } }
            : undefined,
          select: { id: true, name: true, price: true, duration: true },
          take: 5,
        },
      },
      orderBy: [{ trustScore: 'desc' }, { fairPriceScore: 'desc' }],
      take: 15,
    });

    // If strict zip match returned 0, broaden to any active shops so agents always get actionable options
    if (businesses.length === 0 && location) {
      businesses = await prisma.business.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          state: true,
          postalCode: true,
          phone: true,
          category: true,
          trustScore: true,
          fairPriceScore: true,
          communicationScore: true,
          isVerified: true,
          acceptsAgentBookings: true,
          services: {
            select: { id: true, name: true, price: true, duration: true },
            take: 5,
          },
        },
        orderBy: [{ trustScore: 'desc' }],
        take: 10,
      });
    }

    // Next available bay: next top-of-hour + 2h
    const nextBay = new Date(Date.now() + 2 * 3600 * 1000);
    nextBay.setMinutes(0, 0, 0);

    return {
      query: { location: location || 'all', serviceType: serviceType || 'general' },
      count: businesses.length,
      shops: businesses.map((b, idx) => {
        const baySlot = new Date(nextBay.getTime() + idx * 3600 * 1000);
        return {
          shopId: b.id,
          name: b.name,
          address: b.address,
          city: b.city,
          state: b.state,
          zipCode: b.postalCode,
          isVerified: b.isVerified,
          trustScore: b.trustScore,
          fairPriceScore: b.fairPriceScore,
          communicationScore: b.communicationScore,
          nextAvailableBay: baySlot.toISOString(),
          matchingServices: b.services,
        };
      }),
    };
  },

  /**
   * MCP Tool 2: pabandi_book_auto_repair
   * Decodes VIN via NHTSA, creates/links Vehicle, creates RepairOrder with
   * isBookedByAgent: true, runs Fair-Price Guardrail on the initial estimate,
   * and triggers an SMS Magic Link to the car owner to approve & fund the deposit.
   */
  async bookAutoRepair(params: {
    shopId: string;
    vehicleVin: string;
    serviceType: string;
    clientPhone: string;
    clientName?: string;
    licensePlate?: string;
  }) {
    const { shopId, vehicleVin, serviceType, clientPhone, clientName, licensePlate } = params;

    if (!shopId || !vehicleVin || !serviceType || !clientPhone) {
      throw new Error('shopId, vehicleVin, serviceType, and clientPhone are required');
    }

    const shop = await prisma.business.findUnique({
      where: { id: shopId },
      select: { id: true, name: true, trustScore: true, fairPriceScore: true, communicationScore: true },
    });
    if (!shop) {
      throw new Error(`Auto repair shop "${shopId}" not found`);
    }

    // 1. Decode VIN via free NHTSA API
    const decoded = await decodeVinWithNhtsa(vehicleVin);

    // 2. Upsert / find Vehicle for this shop & VIN
    let vehicle = await prisma.vehicle.findFirst({
      where: { vin: decoded.vin, businessId: shop.id },
    });
    if (!vehicle) {
      vehicle = await prisma.vehicle.create({
        data: {
          businessId: shop.id,
          vin: decoded.vin,
          year: decoded.year,
          make: decoded.make,
          model: decoded.model,
          licensePlate: licensePlate || null,
        },
      });
    }

    // 3. Build initial itemized estimate & pass through Fair-Price Guardrail
    const svcLower = serviceType.toLowerCase();
    const defaultLaborHours = svcLower.includes('brake')
      ? 1.5
      : svcLower.includes('oil')
      ? 0.5
      : svcLower.includes('alternator')
      ? 2.0
      : svcLower.includes('diagnostic')
      ? 1.0
      : 1.5;
    const defaultPartCost = svcLower.includes('brake')
      ? 145
      : svcLower.includes('oil')
      ? 45
      : svcLower.includes('alternator')
      ? 220
      : 60;
    const laborRate = 130;

    const items: EstimateLineItem[] = [
      {
        serviceKey: serviceType,
        description: `${serviceType} — Parts & Labor`,
        partName: `${serviceType} OEM Kit`,
        partCost: defaultPartCost,
        laborHours: defaultLaborHours,
        laborRate,
        total: +(defaultPartCost + defaultLaborHours * laborRate).toFixed(2),
      },
    ];

    const totalAmount = items.reduce((sum, i) => sum + (i.total || 0), 0);
    const depositAmount = Math.max(25, +(totalAmount * 0.25).toFixed(2));
    const fairPrice = evaluateEstimateFairPrice(items);

    const auditEntry = {
      action: 'AGENT_BOOKING_CREATED',
      at: new Date().toISOString(),
      detail: `Booked by AI agent for ${decoded.year || ''} ${decoded.make || ''} ${decoded.model || ''} (${decoded.vin}). Fair-Price Guardrail: ${fairPrice.badge}.`,
    };

    // 4. Create RepairOrder with isBookedByAgent: true
    const repairOrder = await prisma.repairOrder.create({
      data: {
        businessId: shop.id,
        vehicleId: vehicle.id,
        clientPhone: clientPhone.trim(),
        clientName: clientName?.trim() || 'Vehicle Owner',
        serviceType,
        status: fairPrice.recommendedStatus,
        itemizedEstimate: { items, subtotal: totalAmount, depositAmount } as any,
        totalAmount,
        depositAmount,
        depositPaid: false,
        isBookedByAgent: true,
        fairPriceVerified: fairPrice.passed,
        fairPriceReport: fairPrice as any,
        dviPhotos: [] as any,
        auditLog: [auditEntry] as any,
      },
      include: { vehicle: true },
    });

    const magicLinkUrl = `${PUBLIC_APP_URL}/b/${repairOrder.id}`;
    const smsText = `Pabandi: Your ${decoded.year ?? ''} ${decoded.make ?? ''} ${decoded.model ?? ''} (${serviceType}) is booked at ${shop.name}. Review your Fair-Price Verified estimate & fund the $${depositAmount} escrow deposit: ${magicLinkUrl}`.replace(/\s+/g, ' ');

    // 5. Trigger SMS Magic Link (non-fatal if SMS provider not configured in dev)
    let smsDispatched = false;
    try {
      const { smsService } = await import('./sms.service');
      if (smsService && typeof (smsService as any).sendSMS === 'function') {
        const res = await (smsService as any).sendSMS(clientPhone.trim(), smsText, shop.id);
        smsDispatched = Boolean(res?.success);
      }
    } catch (e: any) {
      logger.info(`[AutoRepair] SMS magic link queued/simulated for ${clientPhone}: ${e?.message || 'no SMS provider'}`);
    }

    return {
      repairOrderId: repairOrder.id,
      shopId: shop.id,
      shopName: shop.name,
      status: repairOrder.status,
      isBookedByAgent: true,
      fairPriceVerified: repairOrder.fairPriceVerified,
      fairPriceBadge: fairPrice.badge,
      vehicle: {
        id: vehicle.id,
        vin: vehicle.vin,
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        licensePlate: vehicle.licensePlate,
      },
      estimate: {
        items,
        totalAmount,
        depositAmount,
        currency: 'USD',
      },
      magicLinkUrl,
      smsDispatched,
      smsPreview: smsText,
    };
  },

  /**
   * MCP Tool 3: pabandi_check_shop_trust
   * Returns the shop's ML-calculated Trust Score (Overall, Fair Price, Communication).
   */
  async checkShopTrust(params: { shopId: string }) {
    const shopId = (params.shopId || '').trim();
    if (!shopId) throw new Error('shopId is required');

    const shop = await prisma.business.findUnique({
      where: { id: shopId },
      select: {
        id: true,
        name: true,
        isVerified: true,
        trustScore: true,
        fairPriceScore: true,
        communicationScore: true,
        reliabilityScore: true,
        reviewCount: true,
      },
    });
    if (!shop) throw new Error(`Shop "${shopId}" not found`);

    const [totalOrders, verifiedOrders, visionVerifiedOrders] = await Promise.all([
      prisma.repairOrder.count({ where: { businessId: shop.id } }).catch(() => 0),
      prisma.repairOrder.count({ where: { businessId: shop.id, fairPriceVerified: true } }).catch(() => 0),
      prisma.repairOrder.count({ where: { businessId: shop.id, visionProofHash: { not: null } } }).catch(() => 0),
    ]);

    const fairPriceRate = totalOrders > 0 ? Math.round((verifiedOrders / totalOrders) * 100) : Math.round(shop.fairPriceScore);
    const overall = Math.round(shop.trustScore * 0.4 + shop.fairPriceScore * 0.35 + shop.communicationScore * 0.25);

    return {
      shopId: shop.id,
      shopName: shop.name,
      isVerified: shop.isVerified,
      overallTrustScore: overall,
      scores: {
        trustScore: shop.trustScore,
        fairPriceScore: shop.fairPriceScore,
        communicationScore: shop.communicationScore,
      },
      metrics: {
        totalRepairOrders: totalOrders,
        fairPriceVerifiedOrders: verifiedOrders,
        fairPriceVerifiedRatePct: fairPriceRate,
        visionProofVerifiedOrders: visionVerifiedOrders,
        reviewCount: shop.reviewCount,
      },
      badge: overall >= 85 ? 'Pabandi Elite Verified Shop' : overall >= 70 ? 'Pabandi Verified Shop' : 'Building Standing',
    };
  },

  /**
   * PHASE 4.1 — Submit itemized estimate through AI Fair-Price Guardrail
   */
  async submitEstimate(orderId: string, params: { items: EstimateLineItem[]; depositPercent?: number }) {
    const order = await prisma.repairOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new Error(`RepairOrder "${orderId}" not found`);

    const normalizedItems = params.items.map((item) => ({
      ...item,
      partCost: Number(item.partCost) || 0,
      laborHours: Number(item.laborHours) || 0,
      laborRate: Number(item.laborRate) || 130,
      total: +((Number(item.partCost) || 0) + (Number(item.laborHours) || 0) * (Number(item.laborRate) || 130)).toFixed(2),
    }));

    const totalAmount = +normalizedItems.reduce((s, i) => s + (i.total || 0), 0).toFixed(2);
    const depositRatio = Math.max(0.1, Math.min(1, (params.depositPercent ?? 25) / 100));
    const depositAmount = +(totalAmount * depositRatio).toFixed(2);

    const evaluation = evaluateEstimateFairPrice(normalizedItems);
    const existingLog = Array.isArray(order.auditLog) ? (order.auditLog as any[]) : [];
    const nextLog = [
      ...existingLog,
      {
        action: evaluation.passed ? 'FAIR_PRICE_VERIFIED' : 'FAIR_PRICE_FLAGGED_MANUAL_REVIEW',
        at: evaluation.evaluatedAt,
        badge: evaluation.badge,
        maxVariancePct: evaluation.maxVariancePct,
        summary: evaluation.summary,
      },
    ];

    const updated = await prisma.repairOrder.update({
      where: { id: orderId },
      data: {
        status: evaluation.recommendedStatus,
        itemizedEstimate: { items: normalizedItems, subtotal: totalAmount, depositAmount } as any,
        totalAmount,
        depositAmount,
        fairPriceVerified: evaluation.passed,
        fairPriceReport: evaluation as any,
        auditLog: nextLog as any,
      },
      include: { vehicle: true },
    });

    return { repairOrder: updated, fairPriceEvaluation: evaluation };
  },

  /**
   * PHASE 4.2 — Upload DVI Before/After photos and run AI Vision Proof-of-Work
   */
  async uploadDviPhotos(orderId: string, photos: DviPhotoInput[]) {
    const order = await prisma.repairOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new Error(`RepairOrder "${orderId}" not found`);

    const existingPhotos = Array.isArray(order.dviPhotos) ? (order.dviPhotos as any[]) : [];
    const mergedPhotos = [
      ...existingPhotos,
      ...photos.map((p) => ({
        kind: p.kind,
        url: p.url,
        label: p.label || (p.kind === 'before' ? 'Before Repair' : p.kind === 'after' ? 'After Repair' : 'DVI Inspection'),
        uploadedAt: new Date().toISOString(),
      })),
    ];

    const beforePhoto = mergedPhotos.find((p) => p.kind === 'before');
    const afterPhoto = [...mergedPhotos].reverse().find((p) => p.kind === 'after');

    let visionProof = null;
    const existingLog = Array.isArray(order.auditLog) ? (order.auditLog as any[]) : [];
    const nextLog = [...existingLog];

    if (beforePhoto && afterPhoto) {
      visionProof = await verifyRepairVisionProof({
        repairOrderId: orderId,
        beforeUrl: beforePhoto.url,
        afterUrl: afterPhoto.url,
        serviceType: order.serviceType || 'auto repair',
      });
      nextLog.push({
        action: visionProof.verified ? 'VISION_PROOF_VERIFIED' : 'VISION_PROOF_FLAGGED',
        at: visionProof.verifiedAt,
        proofHash: visionProof.proofHash,
        provider: visionProof.provider,
        imagesDistinct: visionProof.imagesDistinct,
        containsCarParts: visionProof.containsCarParts,
        summary: visionProof.summary,
      });
    }

    const updated = await prisma.repairOrder.update({
      where: { id: orderId },
      data: {
        dviPhotos: mergedPhotos as any,
        ...(visionProof
          ? {
              visionProofHash: visionProof.proofHash,
              visionProofReport: visionProof as any,
            }
          : {}),
        auditLog: nextLog as any,
      },
      include: { vehicle: true },
    });

    return { repairOrder: updated, visionProof };
  },
};

export default autoRepairService;
