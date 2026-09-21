import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, AuthRequest, optionalAuthenticate } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import type { BusinessCategory } from '@prisma/client';

const router = Router();

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${base}-${rand}`;
}

// ── POST /api/v1/onboarding/complete ───────────────────────────────────────
router.post('/complete', optionalAuthenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { profile, services, availability, employees } = req.body;

    if (!profile?.businessName || !profile?.ownerName) {
      return res.status(400).json({ success: false, error: 'Business name and owner name are required' });
    }

    const slug = generateSlug(profile.businessName);
    const userId = req.user?.id || null;

    const business = await prisma.business.create({
      data: {
        ownerId: userId,
        name: profile.businessName,
        email: profile.email || null,
        phone: profile.phone || null,
        city: profile.city || '',
        address: profile.address || profile.city || '',
        category: 'CLEANING' as BusinessCategory,
        slug,
        isActive: true,
      },
    });

    if (services && services.length > 0) {
      for (const s of services) {
        await prisma.cleaningService.create({
          data: {
            businessId: business.id,
            name: s.name,
            price: s.price,
            durationHours: s.duration,
            description: s.description || null,
          },
        });
      }
    }

    if (availability?.days?.length > 0) {
      for (const day of availability.days) {
        await prisma.cleaningAvailability.create({
          data: {
            businessId: business.id,
            dayOfWeek: day,
            startTime: availability.startTime || '08:00',
            endTime: availability.endTime || '18:00',
            slotMinutes: availability.slotMinutes || 60,
            bufferMinutes: availability.bufferMinutes || 15,
          },
        });
      }
    }

    if (employees && employees.length > 0) {
      for (const e of employees) {
        await prisma.cleaningEmployee.create({
          data: {
            businessId: business.id,
            name: e.name,
            phone: e.phone || null,
            payRate: e.payRate || null,
            payType: e.payType || 'HOURLY',
          },
        });
      }
    }

    logger.info(`[Onboarding] Business created: ${business.id} (${slug})`);

    return res.status(201).json({
      success: true,
      data: {
        businessId: business.id,
        slug,
        bookingUrl: `https://pabandi.com/b/${slug}`,
      },
    });
  } catch (err: any) {
    logger.error('[Onboarding] Complete error:', err.message);
    return res.status(500).json({ success: false, error: 'Onboarding failed' });
  }
});

// ── GET /api/v1/business/:slug/public ─────────────────────────────────────
router.get('/business/:slug/public', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;

    const business = await prisma.business.findUnique({
      where: { slug },
      include: {
        cleaningServices: { where: { active: true } },
        cleaningAvailability: { where: { active: true } },
      },
    });

    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found' });
    }

    return res.json({
      success: true,
      data: {
        id: business.id,
        name: business.name,
        city: business.city,
        logoUrl: business.logoUrl,
        phone: business.phone,
        email: business.email,
        services: (business as any).cleaningServices || [],
        availability: (business as any).cleaningAvailability || [],
      },
    });
  } catch (err: any) {
    logger.error('[Onboarding] Public fetch error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch business' });
  }
});

// ── POST /api/v1/bookings/customer ────────────────────────────────────────
router.post('/bookings/customer', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      businessSlug,
      serviceId,
      serviceName,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      bookingDate,
      bookingTime,
      depositAmount,
    } = req.body;

    if (!businessSlug || !customerName || !customerPhone || !bookingDate || !bookingTime) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const business = await prisma.business.findUnique({
      where: { slug: businessSlug },
    });

    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found' });
    }

    let customer = await prisma.cleaningCustomer.findFirst({
      where: {
        businessId: business.id,
        OR: [
          { email: customerEmail || undefined },
          { phone: customerPhone },
        ],
      },
    });

    if (!customer) {
      customer = await prisma.cleaningCustomer.create({
        data: {
          businessId: business.id,
          name: customerName,
          email: customerEmail || null,
          phone: customerPhone,
          address: customerAddress || null,
          totalBookings: 1,
          totalSpent: depositAmount || 0,
        },
      });
    } else {
      await prisma.cleaningCustomer.update({
        where: { id: customer.id },
        data: {
          totalBookings: { increment: 1 },
          totalSpent: { increment: depositAmount || 0 },
        },
      });
    }

    const booking = await prisma.reservation.create({
      data: {
        businessId: business.id,
        customerId: customer.id,
        reservationDate: new Date(bookingDate),
        reservationTime: bookingTime,
        numberOfGuests: 1,
        customerName,
        customerPhone,
        customerEmail,
        status: 'PENDING' as any,
        depositAmount: depositAmount || 0,
        depositRequired: !!depositAmount,
        source: 'customer_page',
        notes: serviceId ? `Service: ${serviceName || serviceId}` : undefined,
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        bookingId: booking.id,
        bookingReference: booking.id.slice(0, 8).toUpperCase(),
        status: 'PENDING',
        businessName: business.name,
      },
    });
  } catch (err: any) {
    logger.error('[Onboarding] Customer booking error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to create booking' });
  }
});

export default router;
