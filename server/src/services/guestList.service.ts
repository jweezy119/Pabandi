import { logger } from '../utils/logger';
import { prisma } from '../utils/database';
import { emailService } from './email.service';



export interface AddToGuestListData {
  userId: string;
  venueId: string;
  eventId?: string;
  date: string;
  partySize: number;
  guestNames: string[];
  email?: string;
  phone?: string;
}

export const guestListService = {
  /**
   * Add an entry to the guest list
   */
  async addToGuestList(data: AddToGuestListData) {
    const { userId, venueId, eventId, date, partySize, guestNames, email, phone } = data;

    // Validate venue exists
    const venue = await prisma.nightlifeVenue.findUnique({
      where: { id: venueId },
    });

    if (!venue || !venue.isActive) {
      throw new Error('Venue not found or inactive');
    }

    // Predict no-show probability
    const noShowProbability = await this.predictNoShow(userId, venueId);

    // Generate unique confirmation code
    const confirmationCode = `GL-${require('crypto').randomBytes(3).toString('hex').toUpperCase()}`;

    const guestListEntry = await prisma.guestList.create({
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
        await emailService.sendGuestListConfirmation(guestListEntry);
      } catch (err: any) {
        logger.warn(`Failed to send guest list confirmation: ${err.message}`);
      }
    }

    return guestListEntry;
  },

  /**
   * Get guest list for a venue on a specific date
   */
  async getGuestList(venueId: string, date?: string) {
    const where: any = { venueId };

    if (date) {
      const targetDate = new Date(date);
      where.date = {
        gte: new Date(targetDate.setHours(0, 0, 0, 0)),
        lte: new Date(targetDate.setHours(23, 59, 59, 999)),
      };
    }

    return prisma.guestList.findMany({
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
  async getGuestListByUser(userId: string) {
    return prisma.guestList.findMany({
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
  async confirmGuestListEntry(id: string) {
    const entry = await prisma.guestList.findUnique({
      where: { id },
    });

    if (!entry) {
      throw new Error('Guest list entry not found');
    }

    return prisma.guestList.update({
      where: { id },
      data: { status: 'CONFIRMED' },
    });
  },

  /**
   * Check in a guest
   */
  async checkInGuest(id: string) {
    const entry = await prisma.guestList.findUnique({
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

    return prisma.guestList.update({
      where: { id },
      data: { status: 'ARRIVED' },
    });
  },

  /**
   * Cancel a guest list entry
   */
  async cancelGuestListEntry(id: string) {
    const entry = await prisma.guestList.findUnique({
      where: { id },
    });

    if (!entry) {
      throw new Error('Guest list entry not found');
    }

    if (entry.status === 'ARRIVED') {
      throw new Error('Cannot cancel an arrived entry');
    }

    return prisma.guestList.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  },

  /**
   * Predict no-show probability based on user history and venue data
   */
  async predictNoShow(userId: string, venueId: string): Promise<number> {
    const userHistory = await prisma.guestList.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 10,
    });

    if (userHistory.length === 0) return 0.3;

    const noShows = userHistory.filter((g) => g.status === 'NO_SHOW').length;
    const noShowRate = noShows / userHistory.length;

    const venueHistory = await prisma.guestList.findMany({
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
