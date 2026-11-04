import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { authenticate } from '../middleware/auth.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/v1/booking/businesses - List businesses for BookingOS Discovery
router.get('/businesses', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { search, category } = req.query;

    const where: any = {
      isActive: true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category;
    }

    const businesses = await prisma.business.findMany({
      where,
      include: {
        owner: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { rating: 'desc' },
    });

    return res.json({
      success: true,
      data: businesses.map((b) => ({
        id: b.id,
        name: b.name,
        category: b.category as string,
        rating: b.rating ?? 0,
        address: b.address,
        city: b.city,
        email: b.email,
        website: b.website,
        ownerName: b.owner ? `${b.owner.firstName || ''} ${b.owner.lastName || ''}`.trim() : undefined,
      })),
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

    // Create escrow record
    const escrow = await prisma.escrow.create({
      data: {
        amount: depositAmount ?? 0,
        status: 'PENDING',
        payerId: req.user.id,
        payeeId: businessId,
        businessId,
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        bookingId: booking.id,
        status: booking.status,
        escrowId: escrow.id,
        escrowStatus: escrow.status,
        amount: escrow.amount,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Booking] create error:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

export default router;
