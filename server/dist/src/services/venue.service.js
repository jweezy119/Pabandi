"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.venueService = void 0;
const database_1 = require("../utils/database");
exports.venueService = {
    /**
     * Search venues with filters
     */
    async searchVenues(filters) {
        const where = {};
        if (filters.active !== undefined) {
            where.isActive = filters.active;
        }
        else {
            where.isActive = true;
        }
        if (filters.city) {
            where.city = { contains: filters.city, mode: 'insensitive' };
        }
        if (filters.type) {
            where.type = filters.type;
        }
        if (filters.genre) {
            where.musicGenres = { has: filters.genre };
        }
        if (filters.capacity) {
            where.capacity = { gte: filters.capacity };
        }
        if (filters.amenities && filters.amenities.length > 0) {
            where.amenities = { hasEvery: filters.amenities };
        }
        if (filters.featured !== undefined) {
            where.featured = filters.featured;
        }
        // Date filter: check if venue is open on that day
        if (filters.date) {
            const targetDate = new Date(filters.date);
            const dayOfWeek = targetDate.getDay();
            where.daysOpen = { has: String(dayOfWeek) };
        }
        const venues = await database_1.prisma.bookingVenue.findMany({
            where,
            include: {
                bottlePackages: { where: { isActive: true } },
                tableTypes: { where: { isActive: true } },
                coverCharges: { where: { isActive: true } },
                events: {
                    where: { date: { gte: new Date() } },
                    take: 3,
                    orderBy: { date: 'asc' },
                },
                reviews: {
                    where: { isActive: true },
                    take: 5,
                    orderBy: { createdAt: 'desc' },
                },
            },
            orderBy: { rating: 'desc' },
            take: filters.limit || 50,
            skip: filters.offset || 0,
        });
        return venues;
    },
    /**
     * Get a single venue by ID with all related data
     */
    async getVenueById(id) {
        const venue = await database_1.prisma.bookingVenue.findUnique({
            where: { id },
            include: {
                bottlePackages: { where: { isActive: true } },
                tableTypes: { where: { isActive: true } },
                coverCharges: { where: { isActive: true } },
                events: {
                    where: { date: { gte: new Date() } },
                    orderBy: { date: 'asc' },
                    take: 10,
                },
                reviews: {
                    where: { isActive: true },
                    include: {
                        user: {
                            select: { id: true, firstName: true, lastName: true, profilePictureUrl: true },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                },
            },
        });
        return venue;
    },
    /**
     * Check venue availability for a given date
     */
    async getVenueAvailability(venueId, date) {
        const targetDate = new Date(date);
        const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
        const tableTypes = await database_1.prisma.tableType.findMany({
            where: { venueId, isActive: true },
        });
        const reservations = await database_1.prisma.bottleReservation.findMany({
            where: {
                venueId,
                date: { gte: startOfDay, lte: endOfDay },
                status: { in: ['CONFIRMED', 'PENDING'] },
            },
        });
        const availability = tableTypes.map((table) => {
            const reservedCount = reservations.filter((r) => r.tableTypeId === table.id).length;
            const availableCount = (table.totalCount || 1) - reservedCount;
            return {
                tableTypeId: table.id,
                name: table.name,
                basePrice: table.basePrice,
                minSpend: table.minSpend,
                maxCapacity: table.maxCapacity,
                totalCount: table.totalCount,
                availableCount: Math.max(0, availableCount),
                isAvailable: availableCount > 0,
            };
        });
        return {
            venueId,
            date,
            tables: availability,
        };
    },
    /**
     * Get featured venues, optionally filtered by city
     */
    async getFeaturedVenues(city) {
        const where = { featured: true, isActive: true };
        if (city) {
            where.city = { contains: city, mode: 'insensitive' };
        }
        return database_1.prisma.bookingVenue.findMany({
            where,
            include: {
                bottlePackages: { where: { isActive: true }, take: 3 },
                tableTypes: { where: { isActive: true }, take: 3 },
                events: {
                    where: { date: { gte: new Date() } },
                    take: 3,
                    orderBy: { date: 'asc' },
                },
            },
            orderBy: { rating: 'desc' },
            take: 20,
        });
    },
    /**
     * Find venues near a geographic point
     */
    async getVenuesNearby(lat, lng, radiusKm = 5) {
        // Using Haversine formula approximation via raw query
        // For PostgreSQL, we use the earthdistance or manual calculation
        const venues = await database_1.prisma.$queryRaw `
      SELECT *, (
        6371 * acos(
          cos(radians(${lat})) * cos(radians(lat)) *
          cos(radians(lng) - radians(${lng})) +
          sin(radians(${lat})) * sin(radians(lat))
        )
      ) AS distance
      FROM "NightlifeVenue"
      WHERE "isActive" = true
      HAVING (
        6371 * acos(
          cos(radians(${lat})) * cos(radians(lat)) *
          cos(radians(lng) - radians(${lng})) +
          sin(radians(${lat})) * sin(radians(lat))
        )
      ) <= ${radiusKm}
      ORDER BY distance
      LIMIT 30;
    `;
        return venues;
    },
    /**
     * Create a new venue (admin only)
     */
    async createVenue(data) {
        return database_1.prisma.bookingVenue.create({ data });
    },
    /**
     * Update a venue (admin only)
     */
    async updateVenue(id, data) {
        return database_1.prisma.bookingVenue.update({
            where: { id },
            data,
        });
    },
};
//# sourceMappingURL=venue.service.js.map