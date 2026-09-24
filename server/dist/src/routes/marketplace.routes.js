"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// ── GET /api/v1/marketplace/listings ────────────────────────────────────────
// Public: browse & search listings.
router.get('/listings', async (req, res) => {
    try {
        const { type, category, city, state, q, minPrice, maxPrice, condition, sort = 'newest', page = '1', limit = '20', } = req.query;
        const where = { status: 'ACTIVE' };
        if (type)
            where.type = type.toUpperCase();
        if (category)
            where.category = category.toLowerCase();
        if (city)
            where.city = { contains: city, mode: 'insensitive' };
        if (state)
            where.state = { contains: state, mode: 'insensitive' };
        if (condition)
            where.condition = condition.toUpperCase();
        if (minPrice || maxPrice) {
            where.price = {};
            if (minPrice)
                where.price.gte = parseFloat(minPrice);
            if (maxPrice)
                where.price.lte = parseFloat(maxPrice);
        }
        if (q) {
            where.OR = [
                { title: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
                { tags: { has: q } },
            ];
        }
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;
        let orderBy = { createdAt: 'desc' };
        if (sort === 'price_asc')
            orderBy = { price: 'asc' };
        else if (sort === 'price_desc')
            orderBy = { price: 'desc' };
        else if (sort === 'popular')
            orderBy = { viewCount: 'desc' };
        const [listings, total] = await Promise.all([
            database_1.prisma.marketplaceListing.findMany({
                where, orderBy, skip, take: limitNum,
                include: { seller: { select: { id: true, firstName: true, lastName: true, trustScore: true, createdAt: true } } },
            }),
            database_1.prisma.marketplaceListing.count({ where }),
        ]);
        res.json({
            success: true,
            data: {
                items: listings,
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    }
    catch (e) {
        logger_1.logger.error('Marketplace search failed:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});
// ── GET /api/v1/marketplace/listings/:id ────────────────────────────────────
router.get('/listings/:id', async (req, res) => {
    try {
        const listing = await database_1.prisma.marketplaceListing.findUnique({
            where: { id: req.params.id },
            include: { seller: { select: { id: true, firstName: true, lastName: true, trustScore: true, walletAddress: true, createdAt: true } } },
        });
        if (!listing)
            return res.status(404).json({ success: false, error: 'Listing not found' });
        // Increment view count.
        await database_1.prisma.marketplaceListing.update({ where: { id: listing.id }, data: { viewCount: { increment: 1 } } });
        res.json({ success: true, data: listing });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// ── POST /api/v1/marketplace/listings ───────────────────────────────────────
// Create a listing (auth optional — guest can list with email only).
router.post('/listings', async (req, res) => {
    try {
        const { title, description, type = 'ITEM', category, condition = 'GOOD', price, currency = 'USD', city, state, zip, latitude, longitude, imageUrls, sellerEmail, sellerName, tags, availableFrom, availableTo, } = req.body;
        if (!title || !price || !sellerEmail) {
            return res.status(400).json({ success: false, error: 'title, price, and sellerEmail are required' });
        }
        const listing = await database_1.prisma.marketplaceListing.create({
            data: {
                title, description, type: type.toUpperCase(), category: category?.toLowerCase(),
                condition: condition.toUpperCase(), price: parseFloat(price), currency,
                city, state, zip, latitude: latitude ? parseFloat(latitude) : undefined,
                longitude: longitude ? parseFloat(longitude) : undefined,
                imageUrls: imageUrls || [], sellerEmail, sellerName, tags: tags || [],
                availableFrom: availableFrom ? new Date(availableFrom) : undefined,
                availableTo: availableTo ? new Date(availableTo) : undefined,
            },
        });
        res.status(201).json({ success: true, data: listing });
    }
    catch (e) {
        logger_1.logger.error('Create listing failed:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});
// ── PATCH /api/v1/marketplace/listings/:id ──────────────────────────────────
router.patch('/listings/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const allowed = ['title', 'description', 'price', 'condition', 'status', 'imageUrls', 'tags', 'availableFrom', 'availableTo'];
        const data = {};
        for (const k of allowed) {
            if (req.body[k] !== undefined)
                data[k] = req.body[k];
        }
        const listing = await database_1.prisma.marketplaceListing.update({ where: { id }, data });
        res.json({ success: true, data: listing });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// ── DELETE /api/v1/marketplace/listings/:id ─────────────────────────────────
router.delete('/listings/:id', async (req, res) => {
    try {
        await database_1.prisma.marketplaceListing.update({ where: { id: req.params.id }, data: { status: 'DELETED' } });
        res.json({ success: true, message: 'Listing deleted' });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// ── POST /api/v1/marketplace/listings/:id/book ──────────────────────────────
// Book a viewing / service slot.
router.post('/listings/:id/book', async (req, res) => {
    try {
        const { id } = req.params;
        const { buyerEmail, buyerName, scheduledAt, notes } = req.body;
        if (!buyerEmail || !scheduledAt) {
            return res.status(400).json({ success: false, error: 'buyerEmail and scheduledAt are required' });
        }
        const listing = await database_1.prisma.marketplaceListing.findUnique({ where: { id } });
        if (!listing)
            return res.status(404).json({ success: false, error: 'Listing not found' });
        const booking = await database_1.prisma.marketplaceBooking.create({
            data: {
                listingId: id, buyerEmail, buyerName, scheduledAt: new Date(scheduledAt), notes,
            },
        });
        // TODO: notify seller via email/notification
        res.status(201).json({ success: true, data: booking });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// ── GET /api/v1/marketplace/categories ──────────────────────────────────────
// Public: category metadata with counts.
router.get('/categories', async (_req, res) => {
    try {
        const categories = await database_1.prisma.marketplaceListing.groupBy({
            by: ['category'],
            where: { status: 'ACTIVE' },
            _count: { category: true },
        });
        res.json({ success: true, data: categories });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=marketplace.routes.js.map