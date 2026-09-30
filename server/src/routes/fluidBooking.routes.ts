import { Router, Response } from 'express';
import { authenticate, AuthRequest, optionalAuthenticate } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import { apiLimiter, writeLimiter } from '../middleware/rateLimit.middleware';
import { logger } from '../utils/logger';

const router = Router();

router.get('/availability/:businessId', apiLimiter, async (req, res: Response) => {
  try {
    const { businessId } = req.params;
    const { date, serviceId } = req.query;

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true, name: true, slug: true, logoUrl: true, coverImageUrl: true,
        trustScore: true, isVerified: true, maxConcurrentBookings: true,
        depositAmount: true, depositPercentage: true, requireDeposit: true,
        cancellationHours: true, serviceAddress: true,
      },
    });

    if (!business) return res.status(404).json({ success: false, error: 'Business not found' });

    const services = await prisma.businessService.findMany({
      where: { businessId, isActive: true },
      select: { id: true, name: true, description: true, price: true, duration: true, category: true, imageUrl: true, discountPrice: true },
    });

    const targetDate = date ? new Date(date as string) : new Date();
    const dayOfWeek = targetDate.getDay();
    const dateStr = targetDate.toISOString().split('T')[0];

    const availability = await prisma.businessAvailability.findFirst({
      where: { businessId, dayOfWeek, isActive: true },
    });

    const blackout = await prisma.blackoutDate.findFirst({
      where: { businessId, date: targetDate },
    });

    const existingBookings = await prisma.booking.findMany({
      where: {
        businessId,
        slotStart: { gte: targetDate, lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000) },
        status: { in: ['pending', 'confirmed'] },
      },
    });

    const existingJobs = await prisma.crmJob.findMany({
      where: {
        businessId,
        scheduledDate: { gte: targetDate, lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000) },
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
      },
    });

    const slotCapacity = new Map<string, number>();
    const maxConcurrent = business.maxConcurrentBookings || 1;
    [...existingBookings, ...existingJobs].forEach(item => {
      const key = item.slotStart.toISOString();
      slotCapacity.set(key, (slotCapacity.get(key) || 0) + 1);
    });

    const slots: Array<{
      startTime: string;
      endTime: string;
      available: boolean;
      remainingCapacity: number;
    }> = [];

    if (availability && !blackout) {
      const [startHour, startMin] = availability.startTime.split(':').map(Number);
      const [endHour, endMin] = availability.endTime.split(':').map(Number);
      const slotMinutes = availability.slotMinutes;
      const bufferMinutes = availability.bufferMinutes;

      let current = new Date(targetDate);
      current.setHours(startHour, startMin, 0, 0);
      const endTime = new Date(targetDate);
      endTime.setHours(endHour, endMin, 0, 0);

      while (current < endTime) {
        const slotEnd = new Date(current.getTime() + 60 * 60000);
        if (slotEnd > endTime) break;

        const key = current.toISOString();
        const cap = slotCapacity.get(key) || 0;
        const remaining = Math.max(0, maxConcurrent - cap);

        slots.push({
          startTime: current.toTimeString().slice(0, 5),
          endTime: slotEnd.toTimeString().slice(0, 5),
          available: remaining > 0,
          remainingCapacity: remaining,
        });

        current = new Date(current.getTime() + (slotMinutes + bufferMinutes) * 60000);
      }
    }

    return res.json({
      success: true,
      data: {
        business,
        services,
        date: dateStr,
        availability: availability ? {
          startTime: availability.startTime,
          endTime: availability.endTime,
          slotMinutes: availability.slotMinutes,
          bufferMinutes: availability.bufferMinutes,
        } : null,
        isBlackout: Boolean(blackout),
        slots,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[FluidBooking] availability error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

router.post('/book', optionalAuthenticate, writeLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const {
      businessId, serviceId, date, time, guests, customerName, customerEmail,
      customerPhone, specialRequests, paymentMethod,
    } = req.body;

    if (!businessId || !date || !time || !customerName || !customerEmail) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) return res.status(404).json({ success: false, error: 'Business not found' });

    const slotStart = new Date(`${date}T${time}:00`);
    const service = serviceId
      ? await prisma.businessService.findUnique({ where: { id: serviceId } })
      : null;
    const duration = service?.duration || 60;
    const slotEnd = new Date(slotStart.getTime() + duration * 60000);

    const existingBooking = await prisma.booking.findFirst({
      where: {
        businessId,
        slotStart: slotStart,
        status: { in: ['pending', 'confirmed'] },
      },
    });

    if (existingBooking) {
      return res.status(409).json({ success: false, error: 'This time slot is no longer available' });
    }

    let trustScore = 50;
    let noShowProbability = 0.12;
    let riskScore = 50;
    let depositAmount = business.depositAmount || 0;
    let requiresDeposit = business.requireDeposit;

    if (req.user) {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { reliabilityScore: true, trustScore: true, verificationTier: true },
      });
      if (user) {
        trustScore = user.reliabilityScore || user.trustScore || 50;

        if (trustScore >= 80) {
          noShowProbability = 0.03;
          riskScore = 10;
          requiresDeposit = false;
        } else if (trustScore >= 60) {
          noShowProbability = 0.08;
          riskScore = 30;
          depositAmount = depositAmount * 0.5;
        } else if (trustScore >= 40) {
          noShowProbability = 0.15;
          riskScore = 60;
          depositAmount = depositAmount * 1.5;
        } else {
          noShowProbability = 0.25;
          riskScore = 85;
          depositAmount = depositAmount * 2;
        }
      }
    } else {
      noShowProbability = 0.18;
      riskScore = 70;
      requiresDeposit = true;
      depositAmount = depositAmount || 25;
    }

    const servicePrice = service?.price || 0;
    const serviceDiscount = service?.discountPrice || servicePrice;
    const finalPrice = serviceDiscount;

    const booking = await prisma.booking.create({
      data: {
        businessId,
        clientId: req.user?.id,
        slotStart,
        slotEnd,
        serviceType: service?.name || 'General',
        depositAmount: requiresDeposit ? depositAmount : 0,
        depositStatus: requiresDeposit ? 'required' : null,
        status: 'pending',
        metadata: JSON.stringify({
          customerName,
          customerEmail,
          customerPhone: customerPhone || null,
          serviceId: service?.id,
          guests: guests || 1,
          noShowProbability,
          riskScore,
          aiFactors: {
            trustScore,
            isAuthenticated: Boolean(req.user),
            verificationTier: req.user ? 'ENHANCED' : 'GUEST',
            serviceDuration: duration,
          },
          specialRequests: specialRequests || null,
          source: 'fluid-booking',
        }),
      },
    });

    const meta = booking.metadata as Record<string, any> || {};

    return res.json({
      success: true,
      data: {
        booking: {
          id: booking.id,
          status: booking.status,
          slotStart: booking.slotStart,
          slotEnd: booking.slotEnd,
          depositAmount: booking.depositAmount,
          depositStatus: booking.depositStatus,
          noShowProbability: meta.noShowProbability,
          riskScore: meta.riskScore,
        },
        trust: {
          score: trustScore,
          noShowProbability,
          riskScore,
          tier: trustScore >= 80 ? 'TRUSTED' : trustScore >= 60 ? 'STANDARD' : trustScore >= 40 ? 'CAUTION' : 'HIGH_RISK',
        },
        service: service ? {
          id: service.id,
          name: service.name,
          price: service.price,
          discountPrice: service.discountPrice,
          duration: service.duration,
        } : null,
        payment: requiresDeposit ? {
          amount: depositAmount,
          currency: 'USD',
          methods: ['card', 'solana', 'pab'],
        } : null,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[FluidBooking] book error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

router.get('/booking/:id/status', apiLimiter, async (req, res: Response) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, status: true, slotStart: true, slotEnd: true,
        depositAmount: true, depositPaid: true, depositStatus: true,
        noShowProbability: true, riskScore: true, qrCode: true,
        business: { select: { name: true, address: true } },
      },
    });

    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    return res.json({ success: true, data: booking });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, error: message });
  }
});

export default router;
