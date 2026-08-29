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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestPayout = exports.getPayoutStatus = exports.connectStripe = exports.getApiKeys = exports.generateApiKey = exports.connectChannex = exports.deleteBusinessService = exports.updateBusinessService = exports.createBusinessService = exports.getBusinessServices = exports.getBusinessBySlug = exports.generateBookingLink = exports.getBusinessCustomers = exports.claimBusiness = exports.getBusinessReviews = exports.getBusinessAnalytics = exports.getBusinessReservations = exports.updateBusiness = exports.getBusinessFull = exports.getBusiness = exports.createBusiness = void 0;
const axios_1 = __importDefault(require("axios"));
const database_1 = require("../utils/database");
const errorHandler_1 = require("../middleware/errorHandler");
const client_1 = require("@prisma/client");
const stripe_service_1 = require("../services/stripe.service");
const offramp_service_1 = require("../services/offramp.service");
const osint_service_1 = require("../services/osint.service");
const channex_service_1 = require("../services/channex.service");
const logger_1 = require("../utils/logger");
const crypto_1 = __importDefault(require("crypto"));
const apiResponse_1 = require("../utils/apiResponse");
const createBusiness = async (req, res, next) => {
    try {
        const { name, description, category, address, city, phone, email, website, timezone, refCode, } = req.body;
        // Check if user already has a business
        const existingBusiness = await database_1.prisma.business.findUnique({
            where: { ownerId: req.user.id },
        });
        if (existingBusiness) {
            throw new errorHandler_1.CustomError('User already has a business registered', 409);
        }
        // Normalize category to enum (fallback to OTHER)
        const resolvedCategory = (category && Object.values(client_1.BusinessCategory).includes(category))
            ? category
            : client_1.BusinessCategory.OTHER;
        // Resolve Account Manager Referral
        let referredById;
        if (refCode) {
            const profile = await database_1.prisma.accountManagerProfile.findUnique({
                where: { referralCode: refCode }
            });
            if (profile && profile.status === 'ACTIVE') {
                referredById = profile.id;
            }
        }
        // OSINT Checks are now handled asynchronously after business creation
        // Create business
        const business = await database_1.prisma.business.create({
            data: {
                ownerId: req.user.id,
                name,
                description,
                category: resolvedCategory,
                address,
                city: city || 'Karachi',
                phone,
                email,
                website,
                timezone: timezone || 'Asia/Karachi',
                businessTier: 'STANDARD',
                trustScore: 50.0,
                ...(referredById ? { referredById } : {}),
            },
            include: {
                owner: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });
        // Create default business settings
        await database_1.prisma.businessSettings.create({
            data: {
                businessId: business.id,
            },
        });
        const user = await database_1.prisma.user.update({
            where: { id: req.user.id },
            data: {
                role: client_1.UserRole.BUSINESS_OWNER,
            },
            select: { id: true, role: true },
        });
        // Fire off async OSINT checks (background)
        osint_service_1.osintService.queueOSINTChecks(req.user.id, business.id).catch(err => {
            logger_1.logger.error('Background OSINT check failed', err);
        });
        return (0, apiResponse_1.ok)(res, { business, user }, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.createBusiness = createBusiness;
const getBusiness = async (req, res, next) => {
    try {
        const { id } = req.params;
        let business = await database_1.prisma.business.findFirst({
            where: {
                OR: [
                    { id },
                    { googlePlaceId: id }
                ]
            },
            include: {
                owner: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                businessHours: true,
                tables: {
                    where: { isActive: true },
                },
                settings: true,
                googleReviews: {
                    orderBy: { time: 'desc' }
                },
            },
        });
        // If not found in DB, try fetching dynamically — ONLY for authenticated callers
        // (prevents a public GET from creating rows / hitting external APIs).
        if (!business && req.user) {
            if (id.startsWith('osm-')) {
                try {
                    const parts = id.split('-');
                    const type = parts.length === 3 ? parts[1] : 'node';
                    const osmId = parts.length === 3 ? parts[2] : parts[1];
                    const overpassUrl = 'https://overpass-api.de/api/interpreter';
                    const overpassQuery = `[out:json][timeout:5];${type}(${osmId});out center;`;
                    const overpassRes = await axios_1.default.post(overpassUrl, `data=${encodeURIComponent(overpassQuery)}`, {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'User-Agent': 'PabandiApp/1.0 (contact@pabandi.app)'
                        },
                        timeout: 5000
                    });
                    if (overpassRes.data?.elements && overpassRes.data.elements.length > 0) {
                        const el = overpassRes.data.elements[0];
                        const tags = el.tags || {};
                        let category = client_1.BusinessCategory.RESTAURANT;
                        if (tags.shop === 'beauty' || tags.shop === 'hairdresser' || tags.amenity === 'hairdresser')
                            category = client_1.BusinessCategory.SALON;
                        else if (tags.shop === 'massage')
                            category = client_1.BusinessCategory.SPA;
                        else if (tags.amenity === 'clinic' || tags.amenity === 'hospital' || tags.amenity === 'doctor')
                            category = client_1.BusinessCategory.CLINIC;
                        else if (tags.leisure === 'fitness_centre' || tags.amenity === 'gym')
                            category = client_1.BusinessCategory.FITNESS_CENTER;
                        let coverImageUrl = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1200';
                        if (category === client_1.BusinessCategory.SALON)
                            coverImageUrl = 'https://images.unsplash.com/photo-1600948836101-f9ffda59d250?auto=format&fit=crop&q=80&w=800';
                        if (category === client_1.BusinessCategory.SPA)
                            coverImageUrl = 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&q=80&w=800';
                        if (category === client_1.BusinessCategory.FITNESS_CENTER)
                            coverImageUrl = 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=800';
                        if (category === client_1.BusinessCategory.CLINIC)
                            coverImageUrl = 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&q=80&w=800';
                        const name = tags.name || 'Unknown Business';
                        const address = tags['addr:full'] || tags['addr:street'] || 'Unknown Address';
                        business = await database_1.prisma.business.create({
                            data: {
                                googlePlaceId: id,
                                name: name,
                                address: address,
                                phone: tags.phone || '+92 300 0000000',
                                email: 'contact@example.com',
                                website: tags.website || null,
                                latitude: el.center?.lat || el.lat || null,
                                longitude: el.center?.lon || el.lon || null,
                                category,
                                isClaimed: false,
                                rating: 4.5,
                                reviewCount: 1,
                                city: 'Karachi',
                                description: `Imported OpenStreetMap listing for ${name}. Claim this profile to set up Web3 bookings.`,
                                coverImageUrl,
                                settings: {
                                    create: {}
                                }
                            },
                            include: {
                                owner: { select: { id: true, email: true, firstName: true, lastName: true } },
                                businessHours: true,
                                tables: { where: { isActive: true } },
                                settings: true,
                                googleReviews: { orderBy: { time: 'desc' } },
                            }
                        });
                    }
                }
                catch (osmErr) {
                    console.error('Failed to fetch business from OSM:', osmErr.message);
                }
            }
            else {
                const apiKey = '' /* Google Maps removed: use free OpenStreetMap enrichment instead */;
                if (apiKey) {
                    try {
                        const googleRes = await axios_1.default.get(`https://maps.googleapis.com/maps/api/place/details/json`, {
                            params: {
                                place_id: id,
                                fields: 'name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,types,geometry,photos',
                                key: apiKey,
                            }
                        });
                        if (googleRes.data?.result) {
                            const p = googleRes.data.result;
                            let category = client_1.BusinessCategory.OTHER;
                            if (p.types) {
                                if (p.types.includes('restaurant') || p.types.includes('cafe') || p.types.includes('bakery'))
                                    category = client_1.BusinessCategory.RESTAURANT;
                                else if (p.types.includes('spa') || p.types.includes('beauty_salon') || p.types.includes('hair_care'))
                                    category = client_1.BusinessCategory.SPA;
                                else if (p.types.includes('gym') || p.types.includes('health'))
                                    category = client_1.BusinessCategory.FITNESS_CENTER;
                            }
                            let coverImageUrl = undefined;
                            if (p.photos && p.photos.length > 0) {
                                try {
                                    const photoRes = await axios_1.default.get(`https://maps.googleapis.com/maps/api/place/photo`, {
                                        params: { maxwidth: 1200, photoreference: p.photos[0].photo_reference, key: apiKey },
                                        maxRedirects: 0,
                                        validateStatus: (status) => status >= 200 && status < 400
                                    });
                                    if (photoRes.status === 302 && photoRes.headers.location)
                                        coverImageUrl = photoRes.headers.location;
                                }
                                catch (err) { }
                            }
                            business = await database_1.prisma.business.create({
                                data: {
                                    googlePlaceId: id,
                                    name: p.name || 'Unknown Business',
                                    address: p.formatted_address || 'Unknown Address',
                                    phone: p.international_phone_number || p.formatted_phone_number || 'No phone',
                                    email: 'contact@example.com',
                                    website: p.website || null,
                                    latitude: p.geometry?.location?.lat || null,
                                    longitude: p.geometry?.location?.lng || null,
                                    category: category,
                                    isClaimed: false,
                                    rating: p.rating || null,
                                    reviewCount: p.user_ratings_total || 0,
                                    city: p.formatted_address?.split(',')[1]?.trim() || 'Karachi',
                                    description: 'Auto-generated profile from Google Maps data. Claim this profile to customize it.',
                                    coverImageUrl,
                                    settings: { create: {} }
                                },
                                include: {
                                    owner: { select: { id: true, email: true, firstName: true, lastName: true } },
                                    businessHours: true,
                                    tables: { where: { isActive: true } },
                                    settings: true,
                                    googleReviews: { orderBy: { time: 'desc' } },
                                }
                            });
                        }
                    }
                    catch (apiErr) {
                        console.error('Failed to fetch business from Google Places:', apiErr);
                    }
                }
            }
        }
        if (!business) {
            const notFoundError = new errorHandler_1.CustomError('Business not found', 404);
            notFoundError.code = 'BUSINESS_NOT_FOUND';
            throw notFoundError;
        }
        // Check if user has access
        const hasFullAccess = req.user && (req.user.role === 'ADMIN' || business.ownerId === req.user.id);
        if (!hasFullAccess) {
            // Public view (limited data)
            const publicBusiness = {
                id: business.id,
                name: business.name,
                description: business.description,
                category: business.category,
                address: business.address,
                city: business.city,
                phone: business.phone,
                email: business.email,
                website: business.website,
                logoUrl: business.logoUrl,
                coverImageUrl: business.coverImageUrl,
                businessHours: business.businessHours,
                rating: business.rating,
                reviewCount: business.reviewCount,
                reliabilityScore: business.reliabilityScore,
                isClaimed: business.isClaimed,
                ownerId: business.ownerId,
                googlePlaceId: business.googlePlaceId,
                googleReviews: business.googleReviews,
                latitude: business.latitude,
                longitude: business.longitude,
            };
            return (0, apiResponse_1.ok)(res, { business: publicBusiness });
        }
        return (0, apiResponse_1.ok)(res, { business });
    }
    catch (error) {
        next(error);
    }
};
exports.getBusiness = getBusiness;
// Authenticated full lookup (owner/admin PII + OSM/Google enrichment).
// Alias of getBusiness: for an authenticated caller who owns the business (or is
// ADMIN) it returns the FULL record; for other authenticated callers it returns
// the same sanitized public projection. The public GET /businesses/:id uses the
// same function but is guarded so it never triggers side-effect enrichment.
exports.getBusinessFull = exports.getBusiness;
const updateBusiness = async (req, res, next) => {
    try {
        const { id } = req.params;
        const business = await database_1.prisma.business.findUnique({
            where: { id },
        });
        if (!business) {
            throw new errorHandler_1.CustomError('Business not found', 404);
        }
        if (req.user.role !== 'ADMIN' &&
            business.ownerId !== req.user.id) {
            throw new errorHandler_1.CustomError('Unauthorized', 403);
        }
        const { settings, ...businessData } = req.body;
        const updateData = { ...businessData };
        if (settings) {
            updateData.settings = {
                upsert: {
                    create: settings,
                    update: settings,
                }
            };
        }
        const updated = await database_1.prisma.business.update({
            where: { id },
            data: updateData,
        });
        res.json({
            success: true,
            message: 'Business updated successfully',
            data: { business: updated },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateBusiness = updateBusiness;
const getBusinessReservations = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, date, page = 1, limit = 20 } = req.query;
        // Verify business ownership
        const business = await database_1.prisma.business.findUnique({
            where: { id },
        });
        if (!business) {
            throw new errorHandler_1.CustomError('Business not found', 404);
        }
        if (req.user.role !== 'ADMIN' &&
            business.ownerId !== req.user.id) {
            throw new errorHandler_1.CustomError('Unauthorized', 403);
        }
        const where = { businessId: id };
        if (status) {
            where.status = status;
        }
        if (date) {
            const dateStart = new Date(date);
            dateStart.setHours(0, 0, 0, 0);
            const dateEnd = new Date(date);
            dateEnd.setHours(23, 59, 59, 999);
            where.reservationDate = {
                gte: dateStart,
                lte: dateEnd,
            };
        }
        const [reservations, total] = await Promise.all([
            database_1.prisma.reservation.findMany({
                where,
                include: {
                    customer: {
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true,
                            phone: true,
                        },
                    },
                    table: true,
                },
                orderBy: { reservationDate: 'asc' },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
            }),
            database_1.prisma.reservation.count({ where }),
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
    }
    catch (error) {
        next(error);
    }
};
exports.getBusinessReservations = getBusinessReservations;
const getBusinessAnalytics = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;
        // Verify business ownership
        const business = await database_1.prisma.business.findUnique({
            where: { id },
        });
        if (!business) {
            throw new errorHandler_1.CustomError('Business not found', 404);
        }
        if (req.user.role !== 'ADMIN' &&
            business.ownerId !== req.user.id) {
            throw new errorHandler_1.CustomError('Unauthorized', 403);
        }
        const dateFilter = {};
        if (startDate)
            dateFilter.gte = new Date(startDate);
        if (endDate)
            dateFilter.lte = new Date(endDate);
        const now = new Date();
        const [totalReservations, confirmed, noShows, cancellations, completed, reservationsByStatus, protectedRevenue, unprotectedRevenue, upcomingReservations, allConcluded,] = await Promise.all([
            database_1.prisma.reservation.count({
                where: {
                    businessId: id,
                    reservationDate: dateFilter,
                },
            }),
            database_1.prisma.reservation.count({
                where: {
                    businessId: id,
                    status: 'CONFIRMED',
                    reservationDate: dateFilter,
                },
            }),
            database_1.prisma.reservation.count({
                where: {
                    businessId: id,
                    status: 'NO_SHOW',
                    reservationDate: dateFilter,
                },
            }),
            database_1.prisma.reservation.count({
                where: {
                    businessId: id,
                    status: 'CANCELLED',
                    reservationDate: dateFilter,
                },
            }),
            database_1.prisma.reservation.count({
                where: {
                    businessId: id,
                    status: 'COMPLETED',
                    reservationDate: dateFilter,
                },
            }),
            database_1.prisma.reservation.groupBy({
                by: ['status'],
                where: {
                    businessId: id,
                    reservationDate: dateFilter,
                },
                _count: true,
            }),
            // Protected revenue (deposit captured)
            database_1.prisma.reservation.aggregate({
                where: {
                    businessId: id,
                    depositRequired: true,
                    depositStatus: { in: ['PAID', 'APPLIED_TO_SERVICE', 'REIMBURSED_TO_BUSINESS'] },
                    reservationDate: dateFilter,
                },
                _sum: { depositAmount: true },
            }),
            // Unprotected (no deposit) bookings count
            database_1.prisma.reservation.count({
                where: {
                    businessId: id,
                    depositRequired: false,
                    reservationDate: dateFilter,
                },
            }),
            // Upcoming with risk data
            database_1.prisma.reservation.findMany({
                where: {
                    businessId: id,
                    status: { in: ['PENDING', 'CONFIRMED'] },
                    reservationDate: { gte: now },
                },
                select: {
                    riskScore: true,
                    depositAmount: true,
                    depositRequired: true,
                    numberOfGuests: true,
                    reservationDate: true,
                    reservationTime: true,
                },
                orderBy: { reservationDate: 'asc' },
                take: 50,
            }),
            // All concluded reservations for day-of-week breakdown
            database_1.prisma.reservation.findMany({
                where: {
                    businessId: id,
                    status: { in: ['COMPLETED', 'NO_SHOW'] },
                    reservationDate: dateFilter,
                },
                select: {
                    reservationDate: true,
                    reservationTime: true,
                    status: true,
                    riskScore: true,
                    numberOfGuests: true,
                },
            }),
        ]);
        const noShowRate = totalReservations > 0 ? (noShows / totalReservations) * 100 : 0;
        const cancellationRate = totalReservations > 0 ? (cancellations / totalReservations) * 100 : 0;
        const completionRate = totalReservations > 0 ? (completed / totalReservations) * 100 : 0;
        // ── No-show by day of week ──
        const dayBreakdown = {};
        for (let d = 0; d <= 6; d++)
            dayBreakdown[d] = { total: 0, noShows: 0 };
        for (const r of allConcluded) {
            const day = new Date(r.reservationDate).getDay();
            dayBreakdown[day].total++;
            if (r.status === 'NO_SHOW')
                dayBreakdown[day].noShows++;
        }
        const noShowByDay = Object.entries(dayBreakdown).map(([day, s]) => ({
            day: Number(day),
            total: s.total,
            noShows: s.noShows,
            rate: s.total > 0 ? Math.round((s.noShows / s.total) * 100) : 0,
        }));
        // ── No-show by hour (heatmap) ──
        const hourBreakdown = {};
        for (let h = 0; h <= 23; h++)
            hourBreakdown[h] = { total: 0, noShows: 0 };
        for (const r of allConcluded) {
            const hour = parseInt(r.reservationTime?.split(':')[0] || '12', 10);
            hourBreakdown[hour].total++;
            if (r.status === 'NO_SHOW')
                hourBreakdown[hour].noShows++;
        }
        const noShowByHour = Object.entries(hourBreakdown).map(([h, s]) => ({
            hour: Number(h),
            total: s.total,
            noShows: s.noShows,
            rate: s.total > 0 ? Math.round((s.noShows / s.total) * 100) : 0,
        }));
        // ── Average risk of upcoming ──
        const avgUpcomingRisk = upcomingReservations.length > 0
            ? Math.round(upcomingReservations.reduce((s, r) => s + (r.riskScore || 0), 0) / upcomingReservations.length)
            : 0;
        res.json({
            success: true,
            data: {
                analytics: {
                    totalReservations,
                    confirmed,
                    noShows,
                    cancellations,
                    completed,
                    noShowRate: parseFloat(noShowRate.toFixed(2)),
                    cancellationRate: parseFloat(cancellationRate.toFixed(2)),
                    completionRate: parseFloat(completionRate.toFixed(2)),
                    reservationsByStatus,
                    protectedRevenue: protectedRevenue._sum.depositAmount || 0,
                    unprotectedBookings: unprotectedRevenue,
                    avgUpcomingRisk,
                    noShowByDay,
                    noShowByHour,
                    businessCategory: business.category,
                },
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getBusinessAnalytics = getBusinessAnalytics;
const getBusinessReviews = async (req, res, next) => {
    try {
        const { id } = req.params;
        const business = await database_1.prisma.business.findUnique({
            where: { id },
            include: { googleReviews: true }
        });
        if (!business) {
            throw new errorHandler_1.CustomError('Business not found', 404);
        }
        const apiKey = '' /* Google Maps removed: use free OpenStreetMap enrichment instead */;
        // If business has a Google Place ID, fetch latest reviews from Google
        if (business.googlePlaceId && apiKey) {
            try {
                const googleRes = await axios_1.default.get(`https://maps.googleapis.com/maps/api/place/details/json`, {
                    params: {
                        place_id: business.googlePlaceId,
                        fields: 'reviews,rating,user_ratings_total',
                        key: apiKey,
                    }
                });
                if (googleRes.data?.result) {
                    const { reviews, rating, user_ratings_total } = googleRes.data.result;
                    // Update business rating
                    if (rating || user_ratings_total) {
                        await database_1.prisma.business.update({
                            where: { id },
                            data: {
                                rating: rating || business.rating,
                                reviewCount: user_ratings_total || business.reviewCount,
                            }
                        });
                    }
                    // Sync reviews to database
                    if (reviews && Array.isArray(reviews)) {
                        for (const r of reviews) {
                            const reviewTime = new Date(r.time * 1000); // Google returns Unix timestamp
                            await database_1.prisma.googleReview.upsert({
                                where: { googleReviewId: r.author_url || `${business.id}-${r.time}` },
                                update: {
                                    rating: r.rating,
                                    text: r.text,
                                },
                                create: {
                                    businessId: id,
                                    googleReviewId: r.author_url || `${business.id}-${r.time}`,
                                    authorName: r.author_name,
                                    rating: r.rating,
                                    text: r.text,
                                    time: reviewTime,
                                }
                            });
                        }
                    }
                }
            }
            catch (apiErr) {
                console.error('Failed to sync Google Reviews:', apiErr);
                // We do not fail the request, just fall back to DB reviews
            }
        }
        // Fetch the updated reviews from DB
        const googleReviews = await database_1.prisma.googleReview.findMany({
            where: { businessId: id },
            orderBy: { time: 'desc' }
        });
        const pabandiReviews = await database_1.prisma.pabandiReview.findMany({
            where: { businessId: id },
            orderBy: { createdAt: 'desc' },
            include: {
                customer: {
                    select: {
                        firstName: true,
                        lastName: true,
                        trustScore: true
                    }
                }
            }
        });
        res.json({
            success: true,
            data: {
                reviews: googleReviews,
                pabandiReviews: pabandiReviews
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getBusinessReviews = getBusinessReviews;
const claimBusiness = async (req, res, next) => {
    try {
        const { prisma } = await Promise.resolve().then(() => __importStar(require('../utils/database')));
        const { id } = req.params;
        // Must be authenticated to claim
        if (!req.user || !req.user.id) {
            throw new errorHandler_1.CustomError('Unauthorized to claim business', 401);
        }
        const business = await prisma.business.findUnique({
            where: { id },
        });
        if (!business) {
            throw new errorHandler_1.CustomError('Business not found', 404);
        }
        if (business.isClaimed || business.ownerId) {
            throw new errorHandler_1.CustomError('This business has already been claimed', 400);
        }
        // Instant Claim Logic
        const updatedBusiness = await prisma.business.update({
            where: { id },
            data: {
                ownerId: req.user.id,
                isClaimed: true,
            },
        });
        res.json({
            success: true,
            data: { business: updatedBusiness },
            message: 'Business claimed successfully',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.claimBusiness = claimBusiness;
const getBusinessCustomers = async (req, res, next) => {
    try {
        const { id } = req.params;
        const business = await database_1.prisma.business.findUnique({
            where: { id }
        });
        if (!business) {
            throw new errorHandler_1.CustomError('Business not found', 404);
        }
        if (business.ownerId !== req.user.id && req.user.role !== 'ADMIN') {
            throw new errorHandler_1.CustomError('Not authorized', 403);
        }
        const reservations = await database_1.prisma.reservation.findMany({
            where: { businessId: id },
            // Include User data by joining on customerId if there is a relation.
            // Wait, let's check if Reservation has a relation to User.
            // In schema.prisma: customerId points to User? Let's verify.
            // In schema.prisma: model User { reservations Reservation[] }
            // In Reservation: No explicit relation field "customer User @relation(...)"?
            // Let's check schema.prisma again.
            // Wait, I didn't see the full Reservation model. Let's do raw query or manual join if no relation exists.
        });
        // Actually, let's just query users who have booked.
        // The safest way is to fetch reservations, then fetch users.
        const userIds = Array.from(new Set(reservations.map(r => r.customerId).filter(Boolean)));
        const users = await database_1.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, firstName: true, lastName: true, email: true, phone: true, reliabilityScore: true }
        });
        const userMap = new Map();
        users.forEach(u => userMap.set(u.id, u));
        const customerMap = new Map();
        reservations.forEach(r => {
            const cId = r.customerId;
            if (!cId)
                return;
            const user = userMap.get(cId);
            if (!user)
                return; // fallback to customerName/Phone if needed, but we want the user object
            if (!customerMap.has(cId)) {
                customerMap.set(cId, {
                    user: user,
                    totalBookings: 0,
                    noShowCount: 0,
                    totalSpend: 0,
                    lastBookingDate: r.reservationDate,
                    customerName: r.customerName,
                    customerPhone: r.customerPhone,
                    customerEmail: r.customerEmail
                });
            }
            const stats = customerMap.get(cId);
            stats.totalBookings += 1;
            if (r.status === 'NO_SHOW')
                stats.noShowCount += 1;
            if (r.depositAmount && r.depositPaid)
                stats.totalSpend += r.depositAmount;
            if (new Date(r.reservationDate) > new Date(stats.lastBookingDate)) {
                stats.lastBookingDate = r.reservationDate;
            }
        });
        const customers = Array.from(customerMap.values());
        res.json({
            success: true,
            data: { customers }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getBusinessCustomers = getBusinessCustomers;
const generateBookingLink = async (req, res, next) => {
    try {
        const { id } = req.params;
        const business = await database_1.prisma.business.findUnique({
            where: { id }
        });
        if (!business) {
            throw new errorHandler_1.CustomError('Business not found', 404);
        }
        if (business.ownerId !== req.user.id && req.user.role !== 'ADMIN') {
            throw new errorHandler_1.CustomError('Not authorized', 403);
        }
        // Generate slug from name
        let baseSlug = business.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        if (!baseSlug)
            baseSlug = 'business';
        // Ensure uniqueness
        let slug = baseSlug;
        let count = 1;
        while (true) {
            const existing = await database_1.prisma.business.findFirst({ where: { slug, id: { not: id } } });
            if (!existing)
                break;
            slug = `${baseSlug}-${count}`;
            count++;
        }
        const updated = await database_1.prisma.business.update({
            where: { id },
            data: { slug },
        });
        res.json({
            success: true,
            data: { slug: updated.slug },
            message: 'Booking link generated successfully',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.generateBookingLink = generateBookingLink;
// Public, read-only lookup by slug — returns enough data for the booking
// surface (settings, hours, services, location). Unclaimed but ACTIVE businesses
// are still bookable (the normal case before an owner claims the profile), so we
// do NOT 404 those — only truly missing or deactivated businesses 404.
const getBusinessBySlug = async (req, res, next) => {
    try {
        const { slug } = req.params;
        const business = await database_1.prisma.business.findUnique({
            where: { slug },
            include: {
                settings: true,
                businessHours: true,
                tables: { where: { isActive: true } },
                googleReviews: { orderBy: { time: 'desc' } },
            },
        });
        if (!business || business.isActive === false) {
            throw new errorHandler_1.CustomError('Business not found', 404);
        }
        res.json({
            success: true,
            data: {
                id: business.id,
                name: business.name,
                slug: business.slug,
                description: business.description || null,
                category: business.category || null,
                address: business.address || null,
                city: business.city || null,
                latitude: business.latitude || null,
                longitude: business.longitude || null,
                phone: business.phone || null,
                email: business.email || null,
                website: business.website || null,
                coverImageUrl: business.coverImageUrl || null,
                rating: business.rating || null,
                reviewCount: business.reviewCount || 0,
                isClaimed: business.isClaimed,
                isVerified: business.isVerified,
                trustScore: business.trustScore || 50,
                businessTier: business.businessTier || 'STANDARD',
                settings: business.settings || null,
                businessHours: business.businessHours || [],
                tables: business.tables || [],
                googleReviews: business.googleReviews || [],
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getBusinessBySlug = getBusinessBySlug;
const getBusinessServices = async (req, res, next) => {
    try {
        const { id } = req.params;
        let businessId = id;
        // Support googlePlaceId lookup
        if (id.startsWith('osm-') || id.length > 25) {
            const b = await database_1.prisma.business.findFirst({ where: { OR: [{ id }, { googlePlaceId: id }] } });
            if (b)
                businessId = b.id;
        }
        const services = await database_1.prisma.businessService.findMany({
            where: { businessId, isActive: true },
            orderBy: { createdAt: 'asc' }
        });
        return (0, apiResponse_1.ok)(res, { services });
    }
    catch (error) {
        next(error);
    }
};
exports.getBusinessServices = getBusinessServices;
const createBusinessService = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, price, duration, isActive } = req.body;
        const business = await database_1.prisma.business.findUnique({ where: { id } });
        if (!business || (business.ownerId !== req.user.id && req.user.role !== 'ADMIN')) {
            return (0, apiResponse_1.fail)(res, 'Not authorized', 403);
        }
        const service = await database_1.prisma.businessService.create({
            data: {
                businessId: id,
                name,
                description,
                price: parseFloat(price),
                duration: parseInt(duration),
                isActive: isActive !== undefined ? isActive : true
            }
        });
        return (0, apiResponse_1.ok)(res, { service });
    }
    catch (error) {
        next(error);
    }
};
exports.createBusinessService = createBusinessService;
const updateBusinessService = async (req, res, next) => {
    try {
        const { id, serviceId } = req.params;
        const { name, description, price, duration, isActive } = req.body;
        const business = await database_1.prisma.business.findUnique({ where: { id } });
        if (!business || (business.ownerId !== req.user.id && req.user.role !== 'ADMIN')) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        const existingService = await database_1.prisma.businessService.findUnique({ where: { id: serviceId } });
        if (!existingService || existingService.businessId !== id) {
            return res.status(404).json({ success: false, message: 'Service not found in this business' });
        }
        const service = await database_1.prisma.businessService.update({
            where: { id: serviceId },
            data: {
                ...(name && { name }),
                ...(description !== undefined && { description }),
                ...(price !== undefined && { price: parseFloat(price) }),
                ...(duration !== undefined && { duration: parseInt(duration) }),
                ...(isActive !== undefined && { isActive }),
            }
        });
        return (0, apiResponse_1.ok)(res, { service });
    }
    catch (error) {
        next(error);
    }
};
exports.updateBusinessService = updateBusinessService;
const deleteBusinessService = async (req, res, next) => {
    try {
        const { id, serviceId } = req.params;
        const business = await database_1.prisma.business.findUnique({ where: { id } });
        if (!business || (business.ownerId !== req.user.id && req.user.role !== 'ADMIN')) {
            return (0, apiResponse_1.fail)(res, 'Not authorized', 403);
        }
        const existingService = await database_1.prisma.businessService.findUnique({ where: { id: serviceId } });
        if (!existingService || existingService.businessId !== id) {
            return (0, apiResponse_1.fail)(res, 'Service not found in this business', 404);
        }
        await database_1.prisma.businessService.delete({
            where: { id: serviceId }
        });
        return (0, apiResponse_1.ok)(res, { message: 'Service deleted' });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteBusinessService = deleteBusinessService;
const connectChannex = async (req, res, next) => {
    try {
        const { id } = req.params;
        const business = await database_1.prisma.business.findUnique({ where: { id } });
        if (!business || (business.ownerId !== req.user.id && req.user.role !== 'ADMIN')) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        if (business.category !== 'HOTEL' && business.category !== 'PROPERTY_RENTAL') {
            return res.status(400).json({ success: false, message: 'Only hotels and property rentals can connect to Channex.' });
        }
        if (business.channexPropertyId) {
            return res.status(400).json({ success: false, message: 'Property is already connected to Channex.' });
        }
        const channexPropertyId = await channex_service_1.channexService.provisionProperty(business.id);
        res.json({ success: true, message: 'Successfully provisioned on Channex', data: { channexPropertyId } });
    }
    catch (error) {
        next(error);
    }
};
exports.connectChannex = connectChannex;
const generateApiKey = async (req, res, next) => {
    try {
        const { id } = req.params;
        // Verify ownership
        const business = await database_1.prisma.business.findUnique({ where: { id } });
        if (!business || (business.ownerId !== req.user.id && req.user.role !== 'ADMIN')) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, message: 'Key name is required' });
        }
        const rawKey = crypto_1.default.randomBytes(32).toString('hex');
        const apiKey = `pk_live_${rawKey}`;
        const client = await database_1.prisma.apiClient.create({
            data: {
                name,
                email: business.email || `api-client-${name}@pabandi.local`, // Fallback
                apiKey,
                businessId: business.id,
                tier: 'STARTER',
                callsLimit: 1000
            }
        });
        res.status(201).json({
            success: true,
            message: 'API Key generated successfully. Please copy it now as it will not be shown again.',
            data: {
                id: client.id,
                name: client.name,
                apiKey: client.apiKey,
                createdAt: client.createdAt
            }
        });
    }
    catch (error) {
        if (error?.code === 'P2002') {
            return res.status(409).json({ success: false, message: 'A key with this name/email already exists for your business' });
        }
        next(error);
    }
};
exports.generateApiKey = generateApiKey;
const getApiKeys = async (req, res, next) => {
    try {
        const { id } = req.params;
        // Verify ownership
        const business = await database_1.prisma.business.findUnique({ where: { id } });
        if (!business || (business.ownerId !== req.user.id && req.user.role !== 'ADMIN')) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        const keys = await database_1.prisma.apiClient.findMany({
            where: { businessId: id },
            select: {
                id: true,
                name: true,
                tier: true,
                isActive: true,
                callsUsed: true,
                callsLimit: true,
                createdAt: true,
                // specifically NOT selecting apiKey here so it's masked
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({
            success: true,
            data: { apiKeys: keys }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getApiKeys = getApiKeys;
const connectStripe = async (req, res, next) => {
    try {
        const { id } = req.params;
        const business = await database_1.prisma.business.findUnique({
            where: { id },
        });
        if (!business) {
            throw new errorHandler_1.CustomError('Business not found', 404);
        }
        if (business.ownerId !== req.user?.id && req.user?.role !== 'ADMIN') {
            throw new errorHandler_1.CustomError('Not authorized', 403);
        }
        let accountId = business.stripeAccountId;
        if (!accountId) {
            accountId = await stripe_service_1.stripeService.createConnectAccount(business.id);
            await database_1.prisma.business.update({
                where: { id: business.id },
                data: { stripeAccountId: accountId },
            });
        }
        const onboardingUrl = await stripe_service_1.stripeService.createAccountLink(accountId);
        res.json({
            success: true,
            data: {
                url: onboardingUrl,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.connectStripe = connectStripe;
const getPayoutStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { payoutReference } = req.query;
        if (!payoutReference || typeof payoutReference !== 'string') {
            return (0, apiResponse_1.fail)(res, 'payoutReference query parameter is required', 400);
        }
        const intent = await database_1.prisma.offrampIntent.findFirst({
            where: {
                businessId: id,
                metadata: {
                    path: ['payoutReference'],
                    equals: payoutReference,
                },
            },
            orderBy: { requestedAt: 'desc' },
        });
        if (!intent) {
            return (0, apiResponse_1.fail)(res, 'Payout intent not found', 404);
        }
        const meta = intent.metadata || {};
        return (0, apiResponse_1.ok)(res, {
            intent,
            payout: {
                reference: meta.payoutReference || payoutReference,
                targetRaastId: meta.targetRaastId || null,
                currency: meta.currency || 'PKR',
                status: intent.status,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getPayoutStatus = getPayoutStatus;
const requestPayout = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { amount, targetRaastId, currency } = req.body;
        const business = await database_1.prisma.business.findUnique({
            where: { id },
            include: { owner: { include: { wallet: true } } },
        });
        if (!business) {
            throw new errorHandler_1.CustomError('Business not found', 404);
        }
        if (business.ownerId !== req.user?.id && req.user?.role !== 'ADMIN') {
            throw new errorHandler_1.CustomError('Not authorized', 403);
        }
        if (!amount || !targetRaastId) {
            throw new errorHandler_1.CustomError('Amount and targetRaastId are required', 400);
        }
        // Map the old B2B PayoutRequest to the new OfframpIntent structure.
        // Prefer the business owner's wallet address if available; otherwise fall back
        // to an EVM placeholder so the API flow still completes for unlinked accounts.
        const walletAddress = business.owner?.wallet?.address || '0x0000000000000000000000000000000000000000';
        const intent = await offramp_service_1.offrampService.requestIntent(walletAddress, parseFloat(amount), 270.0, // minRatePkr stub
        'Raast', targetRaastId, business.id);
        const payoutReference = `raast_${business.id}_${Date.now()}`;
        const updatedIntent = await database_1.prisma.offrampIntent.update({
            where: { id: intent.id },
            data: {
                metadata: {
                    ...(intent.metadata || {}),
                    payoutReference,
                    targetRaastId,
                    currency: currency || 'PKR',
                },
            },
        });
        res.json({
            success: true,
            data: {
                intent: updatedIntent,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.requestPayout = requestPayout;
//# sourceMappingURL=business.controller.js.map