import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export const checkInService = {
  async generateCheckInToken(reservationId: string) {
    try {
      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: { business: true, customer: true },
      });

      if (!reservation) {
        return { success: false, message: 'Reservation not found' };
      }

      if (reservation.status === 'CANCELLED') {
        return { success: false, message: 'Reservation has been cancelled' };
      }

      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.reservation.update({
        where: { id: reservationId },
        data: {
          qrCode: code,
          qrCodeExpires: expiresAt,
        },
      });

      return {
        success: true,
        code,
        expiresAt,
        businessName: reservation.business.name,
        reservationTime: reservation.reservationTime,
        numberOfGuests: reservation.numberOfGuests,
      };
    } catch (error: any) {
      logger.error(`Failed to generate check-in token: ${error.message}`);
      return { success: false, message: 'Failed to generate check-in token' };
    }
  },

  async verifyCheckIn(data: {
    code: string;
    reservationId?: string;
    lat?: number;
    lng?: number;
    method: 'qr' | 'manual' | 'location' | 'nfc';
    verifiedBy?: string;
  }) {
    try {
      const { code, reservationId, lat, lng, method } = data;

      let reservation;
      if (reservationId) {
        reservation = await prisma.reservation.findUnique({
          where: { id: reservationId },
          include: { business: true, customer: true },
        });
      } else {
        reservation = await prisma.reservation.findFirst({
          where: {
            qrCode: code,
            qrCodeExpires: { gt: new Date() },
          },
          include: { business: true, customer: true },
        });
      }

      if (!reservation) {
        return { success: false, message: 'Invalid or expired check-in code' };
      }

      if (reservation.status === 'CANCELLED') {
        return { success: false, message: 'Reservation has been cancelled' };
      }

      if (reservation.status === 'CHECKED_IN') {
        return { success: false, message: 'Already checked in' };
      }

      const now = new Date();
      const reservationDateTime = new Date(reservation.reservationDate);
      const [hours, minutes] = reservation.reservationTime.split(':').map(Number);
      reservationDateTime.setHours(hours, minutes, 0, 0);
      
      const thirtyMinBefore = new Date(reservationDateTime.getTime() - 30 * 60 * 1000);
      const twoHoursAfter = new Date(reservationDateTime.getTime() + 2 * 60 * 60 * 1000);
      
      if (now < thirtyMinBefore) {
        return { 
          success: false, 
          message: `Too early. Check-in opens at ${thirtyMinBefore.toLocaleTimeString()}` 
        };
      }
      
      if (now > twoHoursAfter) {
        return { success: false, message: 'Check-in window has expired' };
      }

      let locationVerified = false;
      if (lat && lng && reservation.business.latitude && reservation.business.longitude) {
        const distance = calculateDistance(
          lat, lng,
          reservation.business.latitude, reservation.business.longitude
        );
        locationVerified = distance <= 0.2;
      }

      const updated = await prisma.reservation.update({
        where: { id: reservation.id },
        data: {
          status: 'CHECKED_IN',
          checkInDate: now,
          checkInLat: lat,
          checkInLng: lng,
          checkInMethod: method,
        },
      });

      return {
        success: true,
        message: 'Check-in successful!',
        reservation: {
          id: updated.id,
          customerName: updated.customerName,
          reservationTime: updated.reservationTime,
          numberOfGuests: updated.numberOfGuests,
        },
        locationVerified,
        verifiedAt: now,
      };
    } catch (error: any) {
      logger.error(`Check-in verification failed: ${error.message}`);
      return { success: false, message: 'Check-in verification failed' };
    }
  },

  async checkOut(reservationId: string) {
    try {
      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
      });

      if (!reservation) {
        return { success: false, message: 'Reservation not found' };
      }

      if (reservation.status !== 'CHECKED_IN') {
        return { success: false, message: 'Not currently checked in' };
      }

      const updated = await prisma.reservation.update({
        where: { id: reservationId },
        data: {
          status: 'COMPLETED',
          checkOutDate: new Date(),
        },
      });

      return {
        success: true,
        message: 'Check-out successful!',
        duration: updated.checkInDate 
          ? Math.round((new Date().getTime() - updated.checkInDate.getTime()) / 60000) 
          : 0,
      };
    } catch (error: any) {
      logger.error(`Check-out failed: ${error.message}`);
      return { success: false, message: 'Check-out failed' };
    }
  },

  async getCheckInHistory(reservationId: string) {
    try {
      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        select: {
          id: true,
          customerName: true,
          reservationDate: true,
          reservationTime: true,
          status: true,
          checkInDate: true,
          checkOutDate: true,
          checkInLat: true,
          checkInLng: true,
          checkInMethod: true,
          numberOfGuests: true,
        },
      });

      if (!reservation) {
        return { success: false, message: 'Reservation not found' };
      }

      return {
        success: true,
        checkIn: reservation,
      };
    } catch (error: any) {
      logger.error(`Failed to get check-in history: ${error.message}`);
      return { success: false, message: 'Failed to get check-in history' };
    }
  },

  async getActiveCheckIns(businessId: string) {
    try {
      const reservations = await prisma.reservation.findMany({
        where: {
          businessId,
          status: 'CHECKED_IN',
        },
        include: {
          customer: { select: { firstName: true, lastName: true, phone: true } },
        },
        orderBy: { checkInDate: 'desc' },
      });

      return {
        success: true,
        activeCheckIns: reservations.map((r: any) => ({
          id: r.id,
          customerName: r.customerName,
          customerPhone: r.customer?.phone,
          numberOfGuests: r.numberOfGuests,
          checkInTime: r.checkInDate,
          checkInMethod: r.checkInMethod,
        })),
        count: reservations.length,
      };
    } catch (error: any) {
      logger.error(`Failed to get active check-ins: ${error.message}`);
      return { success: false, message: 'Failed to get active check-ins' };
    }
  },
};

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
