import { Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { CustomError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { noShowPredictor } from '../services/ai/noShowPredictor';
import { logger } from '../utils/logger';
import { reviewService } from '../services/reviewService';
import { cryptoService } from '../services/cryptoService';
import { reliabilityService } from '../services/reliability.service';
import { safepayService } from '../services/safepay.service';
import { webhookService } from '../services/webhook.service';
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

    // Verify business exists and is active
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { settings: true },
    });

    if (!business || !business.isActive) {
      throw new CustomError('Business not found or inactive', 404);
    }

    // Parse reservation date and time
    const tz = business.timezone || 'Asia/Karachi';
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
          businessId,
          dayOfWeek,
        },
      },
    });

    if (!businessHour || businessHour.isClosed) {
      throw new CustomError('Business is closed on this day', 400);
    }

    // Get customer history for AI prediction
    const customerHistory = req.user
      ? await noShowPredictor.getCustomerHistory(req.user.id, businessId)
      : undefined;

    const businessNoShowRate = await noShowPredictor.getBusinessNoShowRate(
      businessId
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

    // Create reservation
    const reservation = await prisma.reservation.create({
      data: {
        businessId,
        customerId: req.user!.id,
        tableId,
        reservationDate: dateTime.toDate(),
        reservationTime,
        numberOfGuests,
        status: settings?.autoConfirm ? 'CONFIRMED' : 'PENDING',
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
    if (depositAmount && req.body.paymentMethod === 'safepay') {
       checkoutUrl = await safepayService.createCheckoutUrl(depositAmount, reservation.id);
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

    // TODO: Send confirmation notification

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
      business?.timezone || 'Asia/Karachi'
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

    // TODO: Process refunds if deposit was paid

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

    // Update Scores (Business and User)
    await reviewService.calculateReliabilityScore(reservation.businessId);
    await reliabilityService.updateScoreForReservationActivity(reservation.customerId, 'NO_SHOW');

    res.json({
      success: true,
      message: 'Reservation marked as No-Show. Deposit captured for business protection.',
      data: { reservation: updated },
    });
  } catch (error) {
    next(error);
  }
};
