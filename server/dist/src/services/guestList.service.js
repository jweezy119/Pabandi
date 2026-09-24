"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.guestListService = void 0;
const logger_1 = require("../utils/logger");
const database_1 = require("../utils/database");
const email_service_1 = require("./email.service");
exports.guestListService = {
    /**
     * Add an entry to the guest list
     */
    async addToGuestList(data) {
        const { userId, venueId, eventId, date, partySize, guestNames, email, phone } = data;
        // Validate venue exists
        const venue = await database_1.prisma.bookingVenue.findUnique({
            where: { id: venueId },
        });
        if (!venue || !venue.isActive) {
            throw new Error('Venue not found or inactive');
        }
        // Predict no-show probability
        const noShowProbability = await this.predictNoShow(userId, venueId);
        // Generate unique confirmation code
        const confirmationCode = `GL-${require('crypto').randomBytes(3).toString('hex').toUpperCase()}`;
        const guestListEntry = await database_1.prisma.guestList.create({
            data: {
                userId,
                venueId,
                eventId,
                date: new Date(date),
                partySize,
                guestNames,
                email,
                phone,
                status: 'CONFIRMED',
                noShowProbability,
                confirmationCode,
            },
            include: {
                venue: {
                    select: { id: true, name: true, address: true, city: true },
                },
            },
        });
        // Send confirmation email if email provided
        if (email) {
            try {
                await email_service_1.emailService.sendGuestListConfirmation(guestListEntry);
            }
            catch (err) {
                logger_1.logger.warn(`Failed to send guest list confirmation: ${err.message}`);
            }
        }
        return guestListEntry;
    },
    /**
     * Get guest list for a venue on a specific date
     */
    async getGuestList(venueId, date) {
        const where = { venueId };
        if (date) {
            const targetDate = new Date(date);
            where.date = {
                gte: new Date(targetDate.setHours(0, 0, 0, 0)),
                lte: new Date(targetDate.setHours(23, 59, 59, 999)),
            };
        }
        return database_1.prisma.guestList.findMany({
            where,
            include: {
                promoter: {
                    select: { id: true, name: true, instagram: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    },
    /**
     * Get guest list entries by user ID
     */
    async getGuestListByUser(userId) {
        return database_1.prisma.guestList.findMany({
            where: { userId },
            include: {
                venue: {
                    select: { id: true, name: true, address: true, city: true, images: true },
                },
            },
            orderBy: { date: 'desc' },
        });
    },
    /**
     * Confirm a guest list entry
     */
    async confirmGuestListEntry(id) {
        const entry = await database_1.prisma.guestList.findUnique({
            where: { id },
        });
        if (!entry) {
            throw new Error('Guest list entry not found');
        }
        return database_1.prisma.guestList.update({
            where: { id },
            data: { status: 'CONFIRMED' },
        });
    },
    /**
     * Check in a guest
     */
    async checkInGuest(id) {
        const entry = await database_1.prisma.guestList.findUnique({
            where: { id },
        });
        if (!entry) {
            throw new Error('Guest list entry not found');
        }
        if (entry.status === 'CANCELLED') {
            throw new Error('Cannot check in a cancelled entry');
        }
        if (entry.status === 'ARRIVED') {
            throw new Error('Guest already checked in');
        }
        return database_1.prisma.guestList.update({
            where: { id },
            data: { status: 'ARRIVED' },
        });
    },
    /**
     * Cancel a guest list entry
     */
    async cancelGuestListEntry(id) {
        const entry = await database_1.prisma.guestList.findUnique({
            where: { id },
        });
        if (!entry) {
            throw new Error('Guest list entry not found');
        }
        if (entry.status === 'ARRIVED') {
            throw new Error('Cannot cancel an arrived entry');
        }
        return database_1.prisma.guestList.update({
            where: { id },
            data: { status: 'CANCELLED' },
        });
    },
    /**
     * Predict no-show probability based on user history and venue data
     */
    async predictNoShow(userId, venueId) {
        const userHistory = await database_1.prisma.guestList.findMany({
            where: { userId },
            orderBy: { date: 'desc' },
            take: 10,
        });
        if (userHistory.length === 0)
            return 0.3;
        const noShows = userHistory.filter((g) => g.status === 'NO_SHOW').length;
        const noShowRate = noShows / userHistory.length;
        const venueHistory = await database_1.prisma.guestList.findMany({
            where: { venueId },
            orderBy: { date: 'desc' },
            take: 50,
        });
        const venueNoShowRate = venueHistory.length > 0
            ? venueHistory.filter((g) => g.status === 'NO_SHOW').length / venueHistory.length
            : 0.2;
        return Math.round(((noShowRate * 0.7) + (venueNoShowRate * 0.3)) * 100) / 100;
    },
};
//# sourceMappingURL=guestList.service.js.map