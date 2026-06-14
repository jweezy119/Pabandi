import { Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { CustomError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { noShowPredictor } from '../services/ai/noShowPredictor';
import { logger } from '../utils/logger';
import { reviewService } from '../services/reviewService';
import { cryptoService } from '../services/cryptoService';
import { reliabilityService } from '../services/reliability.service';
import { paymentRouter } from '../services/payment.router';
import { webhookService } from '../services/webhook.service';
import { notificationService } from '../services/notification.service';
import { conciergeService } from '../services/conciergeService';
import moment from 'moment-timezone';

export const createReservation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      businessId,
      tableId,
      reservationDate,
      reservationTime,
      numberOfGuests,
      customerName,
      customerPhone,
      customerEmail,
      specialRequests,
    } = req.body;

    // Verify business exists and is active (check both id and googlePlaceId)
    let business = await prisma.business.findFirst({
      where: {
        OR: [
          { id: businessId },
          { googlePlaceId: businessId }
        ]
      },
      include: { settings: true },
    });

    // If not found in database, dynamically import from Google Places
    if (!business) {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (apiKey) {
        try {
          const axios = (await import('axios')).default;
          const googleRes = await axios.get(
            `https://maps.googleapis.com/maps/api/place/details/json`, {
              params: {
                place_id: businessId,
                fields: 'name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,types,geometry,photos',
                key: apiKey,
              }
            }
          );
          
          if (googleRes.data?.result) {
            const p = googleRes.data.result;
            
            let category: any = 'RESTAURANT';
            if (p.types) {
              if (p.types.includes('restaurant') || p.types.includes('cafe') || p.types.includes('bakery')) category = 'RESTAURANT';
              else if (p.types.includes('spa') || p.types.includes('beauty_salon') || p.types.includes('hair_care')) category = 'SPA';
              else if (p.types.includes('gym') || p.types.includes('health')) category = 'FITNESS_CENTER';
            }
            
            let coverImageUrl = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1200';
            if (p.photos && p.photos.length > 0) {
              coverImageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${p.photos[0].photo_reference}&key=${apiKey}`;
            }

            business = await prisma.business.create({
              data: {
                googlePlaceId: businessId,
                name: p.name || 'Unknown Business',
                address: p.formatted_address || 'Unknown Address',
                phone: p.international_phone_number || p.formatted_phone_number || '+92 300 0000000',
                email: 'contact@pabandi.com',
                website: p.website || null,
                latitude: p.geometry?.location?.lat || 24.8607,
                longitude: p.geometry?.location?.lng || 67.0011,
                category: category,
                isClaimed: false,
                rating: p.rating || 4.5,
                reviewCount: p.user_ratings_total || 1,
                city: p.formatted_address?.split(',')[1]?.trim() || 'Karachi',
                description: `Imported Google listing for ${p.name}. Claim this profile to set up Web3 bookings.`,
                coverImageUrl,
              },
              include: { settings: true }
            });

            await prisma.businessSettings.create({
              data: {
                businessId: business.id,
              },
            });
          }
        } catch (detailsErr) {
          console.error('Failed to import dynamic place on reservation create:', detailsErr);
        }
      }
    }

    if (!business || !business.isActive) {
      throw new CustomError('Business not found or inactive', 404);
    }

    // Parse reservation date and time
    const tz = business.timezone || 'America/New_York';
    const dateTime = moment.tz(
      `${reservationDate} ${reservationTime}`,
      'YYYY-MM-DD HH:mm',
      tz
    );

    if (!dateTime.isValid() || dateTime.isBefore(moment.tz(tz))) {
      throw new CustomError('Invalid reservation date/time', 400);
    }

    // Check business hours
    const dayOfWeek = dateTime.day();
    const businessHour = await prisma.businessHours.findUnique({
      where: {
        businessId_dayOfWeek: {
          businessId: business.id,
          dayOfWeek,
        },
      },
    });

    if (business.isClaimed && (!businessHour || businessHour.isClosed)) {
      throw new CustomError('Business is closed on this day', 400);
    }

    // Get customer history for AI prediction
    const customerHistory = req.user
      ? await noShowPredictor.getCustomerHistory(req.user.id, business.id)
      : undefined;

    const businessNoShowRate = await noShowPredictor.getBusinessNoShowRate(
      business.id
    );

    // Prepare features for AI prediction
    const features = {
      customerHistory,
      timeFactors: {
        dayOfWeek: dateTime.day(),
        hour: dateTime.hour(),
        isWeekend: [0, 6].includes(dayOfWeek), // Sunday or Saturday
        isHoliday: false, // Could be enhanced with holiday calendar
      },
      bookingFactors: {
        advanceBookingDays: dateTime.diff(moment.tz(tz), 'days'),
        isSameDay: dateTime.isSame(moment.tz(tz), 'day'),
        groupSize: numberOfGuests,
        hasSpecialRequests: !!specialRequests,
      },
      businessFactors: {
        averageNoShowRate: businessNoShowRate,
        businessRating: business.rating || undefined,
        requiresDeposit: business.requireDeposit || false,
      },
    };

    // Get AI prediction
    const prediction = await noShowPredictor.predict(features);

    // Determine if deposit is required
    const settings = business.settings;
    const requireDeposit =
      settings?.autoRequireDeposit &&
      prediction.riskScore >= (settings.aiRiskThreshold || 70);

    let depositAmount = null;
    if (requireDeposit || business.requireDeposit) {
      if (business.depositPercentage) {
        // Calculate based on estimated bill (could be enhanced)
        depositAmount = 1000 * business.depositPercentage; // Placeholder
      } else if (business.depositAmount) {
        depositAmount = business.depositAmount;
      }
    }

    // Determine concierge status and initial reservation status
    const isConcierge = !business.isClaimed;
    const status = isConcierge ? 'PENDING_CONCIERGE' : (settings?.autoConfirm ? 'CONFIRMED' : 'PENDING');

    // Create reservation
    const reservation = await prisma.reservation.create({
      data: {
        businessId: business.id,
        customerId: req.user!.id,
        tableId,
        reservationDate: dateTime.toDate(),
        reservationTime,
        numberOfGuests,
        status,
        isConcierge,
        customerName,
        customerPhone,
        customerEmail: customerEmail || req.user!.email,
        specialRequests,
        noShowProbability: prediction.probability,
        riskScore: prediction.riskScore,
        aiFactors: prediction.factors,
        depositRequired: !!depositAmount || !!req.body.transactionHash,
        depositAmount,
        depositStatus: !!req.body.transactionHash ? 'PAID' : (!!depositAmount ? 'PENDING' : 'NOT_REQUIRED'),
        cryptoDepositTxHash: req.body.transactionHash,
        source: 'web',
      },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
          },
        },
      },
    });

    logger.info(
      `Reservation created: ${reservation.id}, Risk Score: ${prediction.riskScore}`
    );

    let checkoutUrl = null;
    if (depositAmount && (req.body.paymentMethod === 'safepay' || req.body.paymentMethod === 'paypal')) {
      const result = await paymentRouter.createCheckoutUrl(
        depositAmount,
        business.currency || 'USD',
        reservation.id
      );
      checkoutUrl = result.url;
    }

    // Trigger Webhook
    webhookService.dispatch('reservation.created', businessId, {
      reservation,
      checkoutUrl,
      prediction: {
        riskScore: prediction.riskScore,
        requiresDeposit: requireDeposit,
      },
    });

    // Send confirmation notification if not concierge (concierge sends its own once confirmed)
    if (!isConcierge) {
      await notificationService.sendConfirmation(reservation.id);
    } else {
      if (business.phone) {
        logger.info(`[WhatsApp] Sending automated join invitation request to business at phone: ${business.phone}`);
      }
      conciergeService.processReservation(reservation.id);
    }

    res.status(201).json({
      success: true,
      message: 'Reservation created successfully',
      data: {
        reservation,
        checkoutUrl,
        prediction: {
          riskScore: prediction.riskScore,
          requiresDeposit: requireDeposit,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getReservation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        business: true,
        customer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        table: true,
        payments: true,
      },
    });

    if (!reservation) {
      throw new CustomError('Reservation not found', 404);
    }

    // Check authorization
    if (
      req.user!.role !== 'ADMIN' &&
      reservation.customerId !== req.user!.id &&
      reservation.business.ownerId !== req.user!.id
    ) {
      throw new CustomError('Unauthorized', 403);
    }

    res.json({
      success: true,
      data: { reservation },
    });
  } catch (error) {
    next(error);
  }
};

export const updateReservation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation) {
      throw new CustomError('Reservation not found', 404);
    }

    // Check authorization
    if (
      req.user!.role !== 'ADMIN' &&
      reservation.customerId !== req.user!.id &&
      reservation.businessId !==
      (await prisma.business.findUnique({
        where: { ownerId: req.user!.id },
      }))?.id
    ) {
      throw new CustomError('Unauthorized', 403);
    }

    const updated = await prisma.reservation.update({
      where: { id },
      data: updates,
    });

    // Trigger Webhook
    webhookService.dispatch('reservation.updated', updated.businessId, {
      reservation: updated,
    });

    res.json({
      success: true,
      message: 'Reservation updated successfully',
      data: { reservation: updated },
    });
  } catch (error) {
    next(error);
  }
};

export const cancelReservation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation) {
      throw new CustomError('Reservation not found', 404);
    }

    // Check authorization
    if (
      req.user!.role !== 'ADMIN' &&
      reservation.customerId !== req.user!.id
    ) {
      throw new CustomError('Unauthorized', 403);
    }

    // Check cancellation policy
    const business = await prisma.business.findUnique({
      where: { id: reservation.businessId },
    });

    const cancellationHours = business?.cancellationHours || 24;
    const reservationDateTime = moment.tz(
      `${reservation.reservationDate.toISOString().split('T')[0]} ${reservation.reservationTime}`,
      'YYYY-MM-DD HH:mm',
      business?.timezone || 'America/New_York'
    );

    if (
      reservationDateTime.diff(moment(), 'hours') < cancellationHours
    ) {
      throw new CustomError(
        `Reservations must be cancelled at least ${cancellationHours} hours in advance`,
        400
      );
    }

    const cancelled = await prisma.reservation.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    const isLateCancel = reservationDateTime.diff(moment(), 'hours') < (cancellationHours + 12);
    await reliabilityService.updateScoreForReservationActivity(reservation.customerId, 'CANCELLED', isLateCancel);

    // Trigger Webhook
    webhookService.dispatch('reservation.cancelled', cancelled.businessId, {
      reservation: cancelled,
    });

    // Process refunds if deposit was paid
    if (reservation.depositRequired && reservation.depositStatus === 'PAID') {
      try {
        if (reservation.cryptoDepositTxHash) {
          logger.info(`Crypto refund requested manually for reservation ${reservation.id} with txHash ${reservation.cryptoDepositTxHash}`);
        } else {
          // Fiat refund via payment router (Safepay for PKR, PayPal for USD)
          const currency = business?.currency || 'USD';
          await paymentRouter.refundDeposit(currency, reservation.id, reservation.depositAmount || 0);
        }

        // Update reservation to record that deposit is no longer active
        await prisma.reservation.update({
          where: { id: reservation.id },
          data: {
            depositPaid: false,
          },
        });

        // Update payment records associated with this reservation
        await prisma.payment.updateMany({
          where: { reservationId: reservation.id },
          data: {
            status: 'REFUNDED',
            refunded: true,
            refundedAt: new Date(),
            refundAmount: reservation.depositAmount || 0,
          },
        });

        logger.info(`Successfully processed refund of ${business?.currency || 'USD'} ${reservation.depositAmount} for cancelled reservation: ${reservation.id}`);
      } catch (refundError) {
        logger.error(`Error processing refund for reservation ${reservation.id}:`, refundError);
      }
    }

    res.json({
      success: true,
      message: 'Reservation cancelled successfully',
      data: { reservation: cancelled },
    });
  } catch (error) {
    next(error);
  }
};

export const getUserReservations = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const where: any = { customerId: req.user!.id };
    if (status) {
      where.status = status;
    }

    const [reservations, total] = await Promise.all([
      prisma.reservation.findMany({
        where,
        include: {
          business: {
            select: {
              id: true,
              name: true,
              address: true,
              phone: true,
            },
          },
        },
        orderBy: { reservationDate: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.reservation.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        reservations,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const completeReservation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: { business: true },
    });

    if (!reservation) {
      throw new CustomError('Reservation not found', 404);
    }

    // Verify ownership (only business owner or staff can complete)
    if (
      req.user!.role !== 'ADMIN' &&
      reservation.business.ownerId !== req.user!.id
    ) {
      throw new CustomError('Unauthorized', 403);
    }

    if (reservation.status === 'COMPLETED') {
      throw new CustomError('Reservation already completed', 400);
    }

    const updated = await prisma.reservation.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        depositStatus: reservation.depositRequired ? 'APPLIED_TO_SERVICE' : 'NOT_REQUIRED'
      },
    });

    // Trigger Crypto Rewards (User and Business)
    await cryptoService.rewardReservationCompletion(reservation.customerId, reservation.id);
    await cryptoService.rewardBusinessForCompletion(reservation.businessId, reservation.id);

    // Update Scores
    await reviewService.calculateReliabilityScore(reservation.businessId);
    await reliabilityService.updateScoreForReservationActivity(reservation.customerId, 'COMPLETED');

    res.json({
      success: true,
      message: 'Reservation completed and reward issued',
      data: { reservation: updated },
    });
  } catch (error) {
    next(error);
  }
};

export const markNoShow = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: { business: true },
    });

    if (!reservation) {
      throw new CustomError('Reservation not found', 404);
    }

    // Verify ownership
    if (
      req.user!.role !== 'ADMIN' &&
      reservation.business.ownerId !== req.user!.id
    ) {
      throw new CustomError('Unauthorized', 403);
    }

    const updated = await prisma.reservation.update({
      where: { id },
      data: {
        status: 'NO_SHOW',
        depositStatus: reservation.depositRequired ? 'REIMBURSED_TO_BUSINESS' : 'NOT_REQUIRED'
      },
    });

    // PAB reward for business when deposit protection applies
    await cryptoService.rewardBusinessNoShowProtected(reservation.businessId, reservation.id);

    // Update Scores (Business and User)
    await reviewService.calculateReliabilityScore(reservation.businessId);
    await reliabilityService.updateScoreForReservationActivity(reservation.customerId, 'NO_SHOW');

    res.json({
      success: true,
      message: 'Reservation marked as No-Show. Deposit captured and $PAB business reward issued.',
      data: { reservation: updated },
    });
  } catch (error) {
    next(error);
  }
};
