import crypto from 'crypto';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { emailService } from './email.service';

export interface CreateBookingData {
  userId: string;
  venueId: string;
  tableTypeId: string;
  bottlePackageId: string;
  date: string;
  guestCount: number;
  arrivalTime: string;
  specialRequests?: string;
  guestListId?: string;
  promoterId?: string;
  promoCode?: string;
}

export const bottleBookingService = {
  /**
   * Create a new bottle/table booking
   */
  async createBooking(data: CreateBookingData) {
    const { userId, venueId, tableTypeId, bottlePackageId, date, guestCount, arrivalTime, specialRequests, guestListId, promoterId, promoCode } = data;

    // Validate table exists and is available
    const table = await prisma.tableType.findUnique({
      where: { id: tableTypeId },
    });

    if (!table || !table.isActive) {
      throw new Error('Table type not found or inactive');
    }

    // Validate bottle package
    const bottlePackage = await prisma.bottlePackage.findUnique({
      where: { id: bottlePackageId },
    });

    if (!bottlePackage || !bottlePackage.isActive) {
      throw new Error('Bottle package not found or inactive');
    }

    // Validate venue
    const venue = await prisma.nightlifeVenue.findUnique({
      where: { id: venueId },
      include: { coverCharges: { where: { isActive: true } } },
    });

    if (!venue || !venue.isActive) {
      throw new Error('Venue not found or inactive');
    }

    // Check table availability for date
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const existingReservations = await prisma.bottleReservation.findMany({
      where: {
        tableTypeId,
        date: { gte: startOfDay, lte: endOfDay },
        status: { in: ['CONFIRMED', 'PENDING'] },
      },
    });

    const totalCount = table.totalCount || 1;
    if (existingReservations.length >= totalCount) {
      throw new Error('Table not available for the selected date');
    }

    // Calculate base price
    const dynamicMultiplier = await this.calculateDynamicPricing(venueId, date);
    let totalPrice = bottlePackage.basePrice * dynamicMultiplier;
    totalPrice += table.basePrice * dynamicMultiplier;

    // Add cover charge
    let coverChargeAmount = 0;
    if (venue.coverCharges && venue.coverCharges.length > 0) {
      const dayOfWeek = targetDate.getDay();
      const hour = parseInt(arrivalTime.split(':')[0]);

      const applicableCharge = venue.coverCharges.find((c) => {
        if (!c.daysOfWeek.includes(dayOfWeek)) return false;
        const start = parseInt(c.startTime.split(':')[0]);
        const end = parseInt(c.endTime.split(':')[0]);
        if (end < start) return hour >= start || hour <= end;
        return hour >= start && hour <= end;
      });

      if (applicableCharge) {
        coverChargeAmount = applicableCharge.amount * dynamicMultiplier * guestCount;
        totalPrice += coverChargeAmount;
      }
    }

    // Apply promo code if valid
    let promoDiscount = 0;
    let promoCodeRecord = null;

    if (promoCode) {
      promoCodeRecord = await prisma.promoCode.findUnique({
        where: { code: promoCode },
      });

      if (
        promoCodeRecord &&
        promoCodeRecord.isActive &&
        promoCodeRecord.currentUses < promoCodeRecord.maxUses &&
        new Date() >= promoCodeRecord.validFrom &&
        new Date() <= promoCodeRecord.validUntil
      ) {
        if (promoCodeRecord.type === 'PERCENTAGE') {
          promoDiscount = totalPrice * (promoCodeRecord.value / 100);
        } else {
          promoDiscount = promoCodeRecord.value;
        }
        totalPrice = Math.max(0, totalPrice - promoDiscount);
      }
    }

    // Generate unique confirmation code
    const confirmationCode = `BTL-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // Create the reservation
    const booking = await prisma.bottleReservation.create({
      data: {
        userId,
        venueId,
        tableTypeId,
        bottlePackageId,
        date: new Date(date),
        guestCount,
        arrivalTime,
        specialRequests,
        totalPrice,
        status: 'PENDING',
        confirmationCode,
        coverChargeAmount,
        guestListId,
        promoterId: promoterId || promoCodeRecord?.promoterId,
        promoCode: promoCode || undefined,
      },
      include: {
        venue: true,
        tableType: true,
        bottlePackage: true,
      },
    });

    // If promo code was used, increment currentUses and credit promoter
    if (promoCodeRecord && promoDiscount > 0) {
      await prisma.promoCode.update({
        where: { id: promoCodeRecord.id },
        data: { currentUses: { increment: 1 } },
      });

      // Credit promoter if applicable
      if (promoCodeRecord.promoterId) {
        const commission = promoDiscount * 0.5; // 50% of discount as commission
        await this.creditPromoter(promoCodeRecord.promoterId, commission, booking.id);
      }
    }

    // Send booking confirmation email
    try {
      await emailService.sendBookingConfirmation(booking);
    } catch (err: any) {
      logger.warn(`Failed to send booking confirmation email: ${err.message}`);
    }

    return booking;
  },

  /**
   * Calculate dynamic pricing multiplier
   */
  async calculateDynamicPricing(venueId: string, date: string): Promise<number> {
    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();

    let multiplier = 1.0;

    // Day of week multiplier
    const dayMultipliers: Record<number, number> = {
      0: 0.7, 1: 0.6, 2: 0.7, 3: 0.8, 4: 1.0, 5: 1.3, 6: 1.5,
    };
    multiplier *= dayMultipliers[dayOfWeek] || 1.0;

    // Check for events
    const events = await prisma.nightlifeEvent.findMany({
      where: {
        venueId,
        date: {
          gte: new Date(targetDate.setHours(0, 0, 0, 0)),
          lt: new Date(targetDate.setHours(23, 59, 59, 999)),
        },
      },
    });

    if (events.length > 0) {
      const maxEventMultiplier = Math.max(...events.map((e) => e.coverChargeMultiplier || 1.0));
      multiplier *= maxEventMultiplier;
    }

    // Demand-based pricing
    const reservations = await prisma.bottleReservation.count({
      where: {
        venueId,
        date: {
          gte: new Date(targetDate.setHours(0, 0, 0, 0)),
          lt: new Date(targetDate.setHours(23, 59, 59, 999)),
        },
        status: { in: ['CONFIRMED', 'PENDING'] },
      },
    });

    const venue = await prisma.nightlifeVenue.findUnique({ where: { id: venueId } });
    if (venue && venue.capacity > 0) {
      const demandRatio = reservations / (venue.capacity * 0.3);
      if (demandRatio > 0.8) multiplier *= 1.3;
      else if (demandRatio > 0.5) multiplier *= 1.1;
    }

    // Seasonality
    const month = targetDate.getMonth();
    const seasonMultipliers = [1.0, 1.0, 1.1, 1.1, 1.2, 1.3, 1.3, 1.2, 1.1, 1.0, 1.1, 1.2];
    multiplier *= seasonMultipliers[month];

    return Math.round(multiplier * 100) / 100;
  },

  /**
   * Confirm a booking
   */
  async confirmBooking(bookingId: string) {
    const booking = await prisma.bottleReservation.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.status !== 'PENDING') {
      throw new Error(`Cannot confirm booking with status: ${booking.status}`);
    }

    return prisma.bottleReservation.update({
      where: { id: bookingId },
      data: { status: 'CONFIRMED' },
      include: {
        venue: true,
        tableType: true,
        bottlePackage: true,
      },
    });
  },

  /**
   * Cancel a booking
   */
  async cancelBooking(bookingId: string) {
    const booking = await prisma.bottleReservation.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.status === 'CANCELLED') {
      throw new Error('Booking is already cancelled');
    }

    if (booking.status === 'COMPLETED') {
      throw new Error('Cannot cancel a completed booking');
    }

    return prisma.bottleReservation.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED' },
      include: {
        venue: true,
        tableType: true,
        bottlePackage: true,
      },
    });
  },

  /**
   * Get all bookings for a user
   */
  async getUserBookings(userId: string) {
    return prisma.bottleReservation.findMany({
      where: { userId },
      include: {
        venue: {
          select: { id: true, name: true, address: true, city: true, images: true },
        },
        tableType: { select: { id: true, name: true, basePrice: true } },
        bottlePackage: { select: { id: true, name: true, bottleType: true, basePrice: true } },
      },
      orderBy: { date: 'desc' },
    });
  },

  /**
   * Get a single booking by ID
   */
  async getBookingById(bookingId: string) {
    return prisma.bottleReservation.findUnique({
      where: { id: bookingId },
      include: {
        venue: true,
        tableType: true,
        bottlePackage: true,
        guestList: true,
        promoter: true,
      },
    });
  },

  /**
   * Check in a booking (mark as arrived/completed)
   */
  async checkInBooking(bookingId: string, staffId?: string) {
    const booking = await prisma.bottleReservation.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.status !== 'CONFIRMED') {
      throw new Error(`Cannot check in booking with status: ${booking.status}`);
    }

    return prisma.bottleReservation.update({
      where: { id: bookingId },
      data: { status: 'COMPLETED' },
      include: {
        venue: true,
        tableType: true,
        bottlePackage: true,
      },
    });
  },

  /**
   * Credit promoter commission
   */
  async creditPromoter(promoterId: string, amount: number, bookingId: string) {
    const promoter = await prisma.promoter.findUnique({
      where: { id: promoterId },
    });

    if (!promoter) {
      logger.warn(`Promoter ${promoterId} not found for commission credit`);
      return null;
    }

    // Create a ledger entry for the commission
    // Note: Using ReferralLedger as the wallet/commission tracking mechanism
    const ledgerEntry = await prisma.referralLedger.create({
      data: {
        profileId: promoter.userId, // Using userId as profileId for promoter commissions
        type: 'BOOKING_COMMISSION',
        amount,
        currency: 'USD',
        reservationId: bookingId,
        commissionRate: 0.1, // 10% default
      },
    });

    // Send commission notification
    try {
      await emailService.sendPromoterCommissionNotification(promoter, amount, bookingId);
    } catch (err: any) {
      logger.warn(`Failed to send promoter commission notification: ${err.message}`);
    }

    return ledgerEntry;
  },
};
