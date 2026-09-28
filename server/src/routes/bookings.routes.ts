import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { trustCore } from '../trust/trust-core';
import { paymentRails } from '../payments/rails';
import { geoService } from '../services/geo.service';

const router = Router();

// ── POST /api/v1/bookings ──
// Public - create a booking from the public booking page
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { businessId, slotStart, slotEnd, serviceType, customerName, customerEmail, customerPhone, notes, customFields, depositAmount, clientAddress, clientLat, clientLng } = req.body;

    if (!businessId || !slotStart || !slotEnd || !serviceType || !customerName || !customerEmail) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Verify business exists and has public booking enabled
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { settings: true },
    });

    if (!business || !business.isActive) {
      return res.status(404).json({ success: false, error: 'Business not found' });
    }

    // Check if slot is available
    const existingBooking = await prisma.booking.findFirst({
      where: {
        businessId,
        slotStart: new Date(slotStart),
        status: { in: ['pending', 'confirmed'] },
      },
    });

    const existingJob = await prisma.crmJob.findFirst({
      where: {
        businessId,
        scheduledDate: new Date(slotStart),
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
      },
    });

    if (existingBooking || existingJob) {
      return res.status(409).json({ success: false, error: 'Slot no longer available' });
    }

    // Geocode client address if provided
    let distanceMiles: number | null = null;
    let driveMinutes: number | null = null;
    let travelFee = 0;
    let depositReason: string | null = null;
    let finalClientLat = clientLat ? parseFloat(clientLat) : null;
    let finalClientLng = clientLng ? parseFloat(clientLng) : null;
    let finalClientAddress = clientAddress || null;

    if (clientAddress && business.serviceLat && business.serviceLng) {
      try {
        const geoResult = await geoService.geocodeAddress(clientAddress);
        finalClientLat = geoResult.lat;
        finalClientLng = geoResult.lng;
        finalClientAddress = geoResult.formatted;

        const distanceCheck = await geoService.isWithinRadius(
          business.serviceLat!,
          business.serviceLng!,
          geoResult.lat,
          geoResult.lng,
          business.serviceRadiusMiles || 25
        );

        distanceMiles = distanceCheck.distanceMiles;
        driveMinutes = distanceCheck.driveMinutes;

        // Check if outside service radius
        if (!distanceCheck.withinRadius) {
          return res.status(400).json({
            success: false,
            error: `SERVICE_AREA_EXCEEDED`,
            message: `Sorry, ${business.name} serves up to ${business.serviceRadiusMiles || 25} miles. Your address is ${distanceCheck.distanceMiles.toFixed(1)} miles away.`,
            distanceMiles: distanceCheck.distanceMiles,
            maxRadiusMiles: business.serviceRadiusMiles || 25,
          });
        }

        // Calculate travel fee if enabled and distance > base radius (e.g., 10 miles)
        if (business.travelFeeEnabled && distanceMiles > 10) {
          const extraMiles = distanceMiles - 10;
          travelFee = Math.round(extraMiles * (business.travelFeePerMile || 0.5) * 100) / 100;
        }

        // Travel-adjusted deposit
        if (distanceMiles > 30) {
          depositReason = 'distance_50';
        } else if (distanceMiles > 15) {
          depositReason = 'distance_20';
        }
      } catch (geoError) {
        console.error('Geocoding error:', geoError);
      }
    }

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        businessId,
        slotStart: new Date(slotStart),
        slotEnd: new Date(slotEnd),
        serviceType,
        depositAmount: depositAmount || 0,
        depositStatus: depositAmount && depositAmount > 0 ? 'required' : null,
        status: 'pending',
        metadata: { customerName, customerEmail, customerPhone, notes, customFields },
        clientAddress: finalClientAddress,
        clientLat: finalClientLat,
        clientLng: finalClientLng,
        distanceMiles,
        driveMinutes,
        travelFee,
        depositReason,
      },
    });

    // Fire trust event: booking.created
    await trustCore.emit('booking.created', {
      bookingId: booking.id,
      businessId,
      serviceType,
      slotStart: booking.slotStart,
      distanceMiles,
      driveMinutes,
      travelFee,
    });

    // If deposit required, generate payment link
    let paymentUrl: string | null = null;
    const totalDeposit = (depositAmount || 0) + travelFee;

    if (totalDeposit > 0) {
      const defaultMethod = await prisma.businessPaymentMethod.findFirst({
        where: { businessId, isDefault: true },
      });

      if (defaultMethod) {
        const rail = paymentRails[defaultMethod.railId];
        if (rail) {
          paymentUrl = rail.getPaymentUrl(defaultMethod.target, {
            amount: totalDeposit,
            reference: `deposit-${booking.id}`,
            currency: business.currency || 'USD',
          });
        }
      }

      await prisma.booking.update({
        where: { id: booking.id },
        data: { paymentRef: `deposit-${booking.id}`, paidVia: defaultMethod?.railId },
      });
    }

    res.json({
      success: true,
      data: {
        booking: {
          id: booking.id,
          slotStart: booking.slotStart,
          slotEnd: booking.slotEnd,
          serviceType: booking.serviceType,
          depositAmount: booking.depositAmount,
          depositStatus: booking.depositStatus,
          status: booking.status,
        },
        paymentUrl,
        redirectUrl: paymentUrl ? `/b/${business.slug}/pay/${booking.id}` : `/b/${business.slug}/confirm/${booking.id}`,
      },
    });
  } catch (e: any) {
    console.error('Create booking error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/v1/bookings/:id ──
// Get booking details (public if pending, auth if confirmed)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        business: {
          select: { id: true, name: true, logoUrl: true, slug: true, trustScore: true, isVerified: true },
        },
        client: {
          select: { id: true, name: true, email: true, phone: true, passportId: true },
        },
        job: {
          select: { id: true, status: true, scheduledDate: true },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    res.json({ success: true, data: booking });
  } catch (e: any) {
    console.error('Get booking error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/v1/bookings/:id/confirm ──
// Public - confirm deposit payment
router.post('/:id/confirm', async (req: Request, res: Response) => {
  try {
    const { paymentRef, transactionHash } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { business: true },
    });

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Booking already processed' });
    }

    // Verify payment (simplified - in production would verify with payment provider)
    const isPaid = paymentRef || transactionHash;

    if (!isPaid && booking.depositAmount && booking.depositAmount > 0) {
      return res.status(400).json({ success: false, error: 'Payment not verified' });
    }

    // Find or create client
    const metadata = booking.metadata as any;
    let client = await prisma.crmClient.findFirst({
      where: { businessId: booking.businessId, email: metadata?.customerEmail },
    });

    if (!client) {
      client = await prisma.crmClient.create({
        data: {
          businessId: booking.businessId,
          name: metadata?.customerName,
          email: metadata?.customerEmail,
          phone: metadata?.customerPhone,
          notes: metadata?.notes,
          customData: metadata?.customFields || {},
        },
      });
    }

    // Update booking with location data
    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        clientId: client.id,
        depositStatus: (booking.depositAmount || 0) + (booking.travelFee || 0) > 0 ? 'funded' : null,
        status: 'confirmed',
        paymentRef: paymentRef || transactionHash,
      },
    });

    // Create CrmJob with location data
    const job = await prisma.crmJob.create({
      data: {
        businessId: booking.businessId,
        clientId: client.id,
        serviceType: booking.serviceType,
        scheduledDate: booking.slotStart,
        scheduledTime: booking.slotStart.toTimeString().slice(0, 5),
        durationMinutes: Math.round((booking.slotEnd.getTime() - booking.slotStart.getTime()) / 60000),
        address: booking.clientAddress || metadata?.customFields?.address,
        notes: metadata?.notes,
        price: 0,
        status: 'SCHEDULED',
        bookingId: booking.id,
      },
    });

    // Link booking to job
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'confirmed' },
    });

    // Fire trust event: deposit.paid (including travel fee)
    const totalDeposit = (booking.depositAmount || 0) + (booking.travelFee || 0);
    if (totalDeposit > 0) {
      await trustCore.emit('deposit.paid', {
        bookingId: booking.id,
        businessId: booking.businessId,
        clientId: client.id,
        amount: totalDeposit,
        travelFee: booking.travelFee || 0,
        distanceMiles: booking.distanceMiles,
      });
    }

    // Fire trust event: booking.confirmed
    await trustCore.emit('booking.confirmed', {
      bookingId: booking.id,
      jobId: job.id,
      businessId: booking.businessId,
      clientId: client.id,
      distanceMiles: booking.distanceMiles,
      driveMinutes: booking.driveMinutes,
    });

    res.json({
      success: true,
      data: {
        booking: updated,
        job: { id: job.id, status: job.status },
        client: { id: client.id, name: client.name },
      },
    });
  } catch (e: any) {
    console.error('Confirm booking error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/v1/bookings/:id/cancel ──
router.post('/:id/cancel', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { business: true, job: true },
    });

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    if (booking.business.ownerId !== req.user!.id) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, error: 'Already cancelled' });
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'cancelled' },
    });

    // Cancel linked job
    if (booking.job) {
      await prisma.crmJob.update({
        where: { id: booking.job.id },
        data: { status: 'CANCELLED' },
      });
    }

    // Fire trust event: booking.cancelled
    await trustCore.emit('booking.cancelled', {
      bookingId: booking.id,
      businessId: booking.businessId,
    });

    res.json({ success: true, message: 'Booking cancelled' });
  } catch (e: any) {
    console.error('Cancel booking error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/v1/bookings/business/:businessId ──
// Authenticated - list bookings for business
router.get('/business/:businessId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.params;
    const { status, startDate, endDate, page = '1', limit = '20' } = req.query;

    const business = await prisma.business.findFirst({
      where: { id: businessId, ownerId: req.user!.id },
    });

    if (!business) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const where: any = { businessId };
    if (status) where.status = status;
    if (startDate && endDate) {
      where.slotStart = { gte: new Date(startDate as string), lte: new Date(endDate as string) };
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, email: true, phone: true } },
          job: { select: { id: true, status: true } },
        },
        orderBy: { slotStart: 'asc' },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
      }),
      prisma.booking.count({ where }),
    ]);

    res.json({
      success: true,
      data: bookings,
      pagination: { page: parseInt(page as string), limit: parseInt(limit as string), total },
    });
  } catch (e: any) {
    console.error('List bookings error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/v1/bookings/:id/attend ──
// Mark booking as attended (from job completion)
router.post('/:id/attend', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { business: true, client: true, job: true },
    });

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    if (booking.business.ownerId !== req.user!.id) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'attended' },
    });

    if (booking.job) {
      await prisma.crmJob.update({
        where: { id: booking.job.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
    }

    // Fire trust event: booking.attended
    if (booking.client?.passportId) {
      await trustCore.emit('booking.attended', {
        bookingId: booking.id,
        clientPassportId: booking.client.passportId,
        businessId: booking.businessId,
      });
    }

    await trustCore.emit('booking.attended', {
      bookingId: booking.id,
      businessId: booking.businessId,
    });

    res.json({ success: true, message: 'Marked as attended' });
  } catch (e: any) {
    console.error('Attend booking error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/v1/bookings/:id/no-show ──
router.post('/:id/no-show', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { business: true, client: true, job: true },
    });

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    if (booking.business.ownerId !== req.user!.id) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'no_show' },
    });

    if (booking.job) {
      await prisma.crmJob.update({
        where: { id: booking.job.id },
        data: { status: 'NO_SHOW' },
      });
    }

    // Fire trust event: booking.no_show
    if (booking.client?.passportId) {
      await trustCore.emit('booking.no_show', {
        bookingId: booking.id,
        clientPassportId: booking.client.passportId,
        businessId: booking.businessId,
      });
    }

    res.json({ success: true, message: 'Marked as no-show' });
  } catch (e: any) {
    console.error('No-show booking error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/v1/bookings/:id/review ──
// Client posts a review after attending
router.post('/:id/review', async (req: Request, res: Response) => {
  try {
    const { rating, title, body, clientPassportId } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { business: true, client: true },
    });

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    if (booking.status !== 'attended') {
      return res.status(400).json({ success: false, error: 'Can only review attended bookings' });
    }

    if (!booking.client?.passportId || booking.client.passportId !== clientPassportId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, error: 'Rating must be 1-5' });
    }

    const existingReview = await prisma.bookingReview.findUnique({
      where: { bookingId: booking.id },
    });

    if (existingReview) {
      return res.status(409).json({ success: false, error: 'Review already exists' });
    }

    const review = await prisma.bookingReview.create({
      data: {
        bookingId: booking.id,
        businessId: booking.businessId,
        clientPassportId,
        rating,
        title,
        body,
        verified: true,
      },
    });

    // Update business rating
    const reviews = await prisma.bookingReview.findMany({
      where: { businessId: booking.businessId },
    });
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    await prisma.business.update({
      where: { id: booking.businessId },
      data: { rating: Math.round(avgRating * 10) / 10, reviewCount: reviews.length },
    });

    // Fire trust event: review.posted
    await trustCore.emit('review.posted', {
      reviewId: review.id,
      bookingId: booking.id,
      businessId: booking.businessId,
      rating,
    });

    res.json({ success: true, data: review });
  } catch (e: any) {
    console.error('Post review error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/v1/bookings/:businessId/reviews ──
// Get reviews for business
router.get('/:businessId/reviews', async (req: Request, res: Response) => {
  try {
    const { businessId } = req.params;
    const { rating, page = '1', limit = '10' } = req.query;

    const where: any = { businessId };
    if (rating) where.rating = parseInt(rating as string);

    const [reviews, total] = await Promise.all([
      prisma.bookingReview.findMany({
        where,
        include: { booking: { select: { serviceType: true, slotStart: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
      }),
      prisma.bookingReview.count({ where }),
    ]);

    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    res.json({
      success: true,
      data: reviews,
      summary: { averageRating: Math.round(avgRating * 10) / 10, totalReviews: total },
      pagination: { page: parseInt(page as string), limit: parseInt(limit as string), total },
    });
  } catch (e: any) {
    console.error('Get reviews error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;