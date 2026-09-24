"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkInService = void 0;
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
const prisma = new client_1.PrismaClient();
exports.checkInService = {
    async generateCheckInToken(reservationId) {
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
        }
        catch (error) {
            logger_1.logger.error(`Failed to generate check-in token: ${error.message}`);
            return { success: false, message: 'Failed to generate check-in token' };
        }
    },
    /**
     * Verify check-in and auto-release escrow if deposit was held.
     */
    async verifyCheckIn(data) {
        try {
            const { code, reservationId, lat, lng, method, verifiedBy } = data;
            let reservation;
            if (reservationId) {
                reservation = await prisma.reservation.findUnique({
                    where: { id: reservationId },
                    include: { business: true, customer: true },
                });
            }
            else {
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
                const distance = calculateDistance(lat, lng, reservation.business.latitude, reservation.business.longitude);
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
            // Auto-release escrow if deposit was paid
            let escrowReleased = false;
            let escrowResult = null;
            if (reservation.depositStatus === 'PAID' && reservation.depositAmount) {
                try {
                    const { releaseEscrowToBusiness } = await Promise.resolve().then(() => __importStar(require('./booking.service')));
                    // Find the escrow for this reservation
                    const cryptoPayment = await prisma.cryptoPayment.findFirst({
                        where: {
                            type: 'paylio',
                            metadata: { path: ['reservationId'], equals: reservation.id },
                        },
                    });
                    if (cryptoPayment) {
                        const escrow = await prisma.escrow.findFirst({
                            where: { paymentId: cryptoPayment.id, status: 'HELD' },
                        });
                        if (escrow) {
                            const { releaseEscrowToBusiness } = await Promise.resolve().then(() => __importStar(require('../services/booking.service')));
                            escrowResult = await releaseEscrowToBusiness(escrow.id, verifiedBy || reservation.customerId);
                            escrowReleased = escrowResult.success;
                        }
                    }
                }
                catch (escrowErr) {
                    logger_1.logger.warn(`[CheckIn] Auto-release failed for ${reservation.id}: ${escrowErr.message}`);
                }
            }
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
                escrowReleased,
                escrowDetails: escrowResult
                    ? {
                        netToBusiness: escrowResult.netToBusiness,
                        releaseFee: escrowResult.releaseFee,
                    }
                    : null,
                verifiedAt: now,
            };
        }
        catch (error) {
            logger_1.logger.error(`Check-in verification failed: ${error.message}`);
            return { success: false, message: 'Check-in verification failed' };
        }
    },
    async checkOut(reservationId) {
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
        }
        catch (error) {
            logger_1.logger.error(`Check-out failed: ${error.message}`);
            return { success: false, message: 'Check-out failed' };
        }
    },
    async getCheckInHistory(reservationId) {
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
        }
        catch (error) {
            logger_1.logger.error(`Failed to get check-in history: ${error.message}`);
            return { success: false, message: 'Failed to get check-in history' };
        }
    },
    async getActiveCheckIns(businessId) {
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
                activeCheckIns: reservations.map((r) => ({
                    id: r.id,
                    customerName: r.customerName,
                    customerPhone: r.customer?.phone,
                    numberOfGuests: r.numberOfGuests,
                    checkInTime: r.checkInDate,
                    checkInMethod: r.checkInMethod,
                })),
                count: reservations.length,
            };
        }
        catch (error) {
            logger_1.logger.error(`Failed to get active check-ins: ${error.message}`);
            return { success: false, message: 'Failed to get active check-ins' };
        }
    },
};
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
//# sourceMappingURL=checkin.service.js.map