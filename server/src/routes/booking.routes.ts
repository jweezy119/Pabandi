import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { authenticate } from '../middleware/auth.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { formatBusinessDiscoveryItem } from '../utils/businessDiscovery';

const router = Router();

const OSM_CATEGORY_MAP: Record<string, string> = {
  restaurant: 'RESTAURANT',
  cafe: 'RESTAURANT',
  fast_food: 'RESTAURANT',
  bar: 'RESTAURANT',
  hairdresser: 'SALON',
  beauty: 'SALON',
  clinic: 'CLINIC',
  hospital: 'CLINIC',
  doctor: 'CLINIC',
  dentist: 'CLINIC',
  spa: 'SPA',
  massage: 'SPA',
  gym: 'FITNESS_CENTER',
  fitness_centre: 'FITNESS_CENTER',
};

// GET /api/v1/booking/businesses - List businesses for BookingOS Discovery with cursor pagination
router.get('/businesses', async (req: Request, res: Response) => {
  try {
    const { cursor, limit, city, category, query, search, location } = req.query;

    const limitNum = Math.min(Math.max(parseInt(String(limit || '20'), 10) || 20, 1), 100);

    const where: any = {
      isActive: true,
    };

    const searchText = (query || search) as string | undefined;
    if (searchText && typeof searchText === 'string' && searchText.trim()) {
      const q = searchText.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { address: { contains: q, mode: 'insensitive' } },
      ];
    }

    const cityText = (city || location) as string | undefined;
    if (cityText && typeof cityText === 'string' && cityText.trim()) {
      const loc = cityText.trim();
      const locConditions = [
        { city: { contains: loc, mode: 'insensitive' } },
        { state: { contains: loc, mode: 'insensitive' } },
        { address: { contains: loc, mode: 'insensitive' } },
      ];
      if (Array.isArray(where.OR)) {
        where.AND = [
          { OR: where.OR },
          { OR: locConditions },
        ];
        delete where.OR;
      } else {
        where.OR = locConditions;
      }
    }

    if (category && typeof category === 'string' && category.toUpperCase() !== 'ALL') {
      where.category = category.toUpperCase();
    }

    const findArgs: any = {
      where,
      include: {
        owner: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { id: 'asc' },
      take: limitNum + 1,
    };

    if (cursor && typeof cursor === 'string' && cursor.trim()) {
      findArgs.cursor = { id: cursor.trim() };
      findArgs.skip = 1;
    }

    const dbBusinesses = await prisma.business.findMany(findArgs);

    let nextCursor: string | null = null;
    if (dbBusinesses.length > limitNum) {
      dbBusinesses.pop();
      nextCursor = dbBusinesses[dbBusinesses.length - 1]?.id || null;
    }

    const items = dbBusinesses.map(formatBusinessDiscoveryItem);

    return res.json({
      items,
      nextCursor,
      success: true,
      count: items.length,
      data: items,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Booking] businesses error:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

// POST /api/v1/booking - Create a booking + escrow
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId, slotStart, slotEnd, serviceType, numberOfGuests, depositAmount } = req.body;

    if (!businessId || !slotStart || !slotEnd || !serviceType) {
      return res.status(400).json({ success: false, error: 'businessId, slotStart, slotEnd, serviceType required' });
    }

    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check if slot is already booked
    const existing = await prisma.booking.findFirst({
      where: {
        businessId,
        slotStart: new Date(slotStart),
        status: { in: ['pending', 'confirmed'] },
      },
    });

    if (existing) {
      return res.status(409).json({ success: false, error: 'Slot already booked' });
    }

    // Create the booking
    const booking = await prisma.booking.create({
      data: {
        businessId,
        clientId: req.user.id,
        slotStart: new Date(slotStart),
        slotEnd: new Date(slotEnd),
        serviceType,
        depositAmount: depositAmount ?? 0,
        depositPaid: false,
        status: 'pending',
      },
    });

    return res.json({
      success: true,
      data: booking,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Booking] create error:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

export default router;
