"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const router = (0, express_1.Router)();
// GET /api/v1/public/properties — public listing/search
router.get('/properties', async (req, res) => {
    try {
        const { city, state, minPrice, maxPrice, bedrooms, bathrooms, status, propertyType, limit = 20, offset = 0 } = req.query;
        const where = {};
        if (city)
            where.city = { contains: city, mode: 'insensitive' };
        if (state)
            where.state = { contains: state, mode: 'insensitive' };
        if (status)
            where.status = status;
        if (minPrice || maxPrice) {
            where.rentAmount = {};
            if (minPrice)
                where.rentAmount.gte = Number(minPrice);
            if (maxPrice)
                where.rentAmount.lte = Number(maxPrice);
        }
        const properties = await prisma.propertyManagerProperty.findMany({
            where,
            include: {
                manager: { include: { user: { select: { firstName: true, lastName: true, profilePictureUrl: true } } } },
                photos: { where: { isCover: true }, take: 1 },
                amenities: { include: { amenity: true } },
                ratePlans: { where: { isActive: true } },
                _count: { select: { reviews: true, units: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: Number(limit),
            skip: Number(offset),
        });
        const total = await prisma.propertyManagerProperty.count({ where });
        res.json({ success: true, data: properties, meta: { total, limit: Number(limit), offset: Number(offset) } });
    }
    catch (e) {
        console.error('[public] properties search failed:', e.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/v1/public/properties/:id — public property detail
router.get('/properties/:id', async (req, res) => {
    try {
        const property = await prisma.propertyManagerProperty.findUnique({
            where: { id: req.params.id },
            include: {
                manager: { include: { user: { select: { firstName: true, lastName: true, profilePictureUrl: true, email: true } } } },
                photos: { orderBy: { sortOrder: 'asc' } },
                amenities: { include: { amenity: true } },
                ratePlans: { where: { isActive: true } },
                units: { include: { photos: { orderBy: { sortOrder: 'asc' } }, amenities: { include: { amenity: true } }, availabilities: { where: { date: { gte: new Date() } }, orderBy: { date: 'asc' }, take: 90 } } },
                reviews: { where: { isPublished: true }, orderBy: { createdAt: 'desc' }, take: 20 },
            },
        });
        if (!property)
            return res.status(404).json({ error: 'Property not found' });
        res.json({ success: true, data: property });
    }
    catch (e) {
        console.error('[public] property detail failed:', e.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/v1/public/properties/:id/availability — public availability check
router.get('/properties/:id/availability', async (req, res) => {
    try {
        const { start, end, unitId } = req.query;
        const where = { propertyId: req.params.id };
        if (unitId)
            where.unitId = unitId;
        if (start && end) {
            where.date = { gte: new Date(start), lte: new Date(end) };
        }
        const availabilities = await prisma.propertyAvailability.findMany({ where, orderBy: { date: 'asc' } });
        res.json({ success: true, data: availabilities });
    }
    catch (e) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/v1/public/amenities — global amenity list
router.get('/amenities', async (_req, res) => {
    try {
        const amenities = await prisma.amenity.findMany({ orderBy: { name: 'asc' } });
        res.json({ success: true, data: amenities });
    }
    catch (e) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=public.property.routes.js.map