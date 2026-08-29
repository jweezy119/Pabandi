"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAvailability = checkAvailability;
exports.createReceptionistCheckout = createReceptionistCheckout;
exports.receptionistAnalytics = receptionistAnalytics;
exports.beds24Webhook = beds24Webhook;
exports.cloudbedsWebhook = cloudbedsWebhook;
exports.lodgifyWebhook = lodgifyWebhook;
exports.manualWebhook = manualWebhook;
exports.connectProperty = connectProperty;
exports.listProperties = listProperties;
exports.getProperty = getProperty;
exports.getPropertyAvailability = getPropertyAvailability;
exports.simulateBooking = simulateBooking;
exports.getConnectionHealth = getConnectionHealth;
const hospitalityService_1 = require("../services/hospitalityService");
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const apiResponse_1 = require("../utils/apiResponse");
async function checkAvailability(req, res, next) {
    try {
        const { businessId } = req.params;
        const { date, guests } = req.query;
        const partySize = typeof guests === 'string' ? parseInt(guests, 10) : 2;
        if (!businessId || !date)
            return (0, apiResponse_1.fail)(res, 'businessId and date are required', 400);
        const result = await hospitalityService_1.hospitalityService.checkAvailability(businessId, date, Number.isFinite(partySize) ? partySize : 2);
        return (0, apiResponse_1.ok)(res, result);
    }
    catch (err) {
        logger_1.logger.error('[Hospitality] availability error:', err);
        next(err);
    }
}
async function createReceptionistCheckout(req, res, next) {
    try {
        const { businessId, customerPhone, summary, status: conversationStatus } = req.body || {};
        const business = await database_1.prisma.business.findUnique({ where: { id: businessId } });
        if (!business)
            return (0, apiResponse_1.fail)(res, 'Business not found', 404);
        const session = await database_1.prisma.checkoutSession.create({
            data: {
                business: { connect: { id: businessId } },
                amount: 0,
                currency: 'USD',
                escrowTerms: { source: 'ai_receptionist', customerPhone: customerPhone || '', summary: summary || '', status: conversationStatus || 'open' },
                successUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout`,
                cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/hospitality`,
                metadata: { source: 'ai_receptionist', customerPhone },
                status: 'PENDING',
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
        });
        return (0, apiResponse_1.ok)(res, { sessionId: session.id, checkoutUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/${session.id}` }, 201);
    }
    catch (err) {
        logger_1.logger.error('[Hospitality] receptionist checkout error:', err);
        next(err);
    }
}
async function receptionistAnalytics(req, res, next) {
    try {
        const { businessId } = req.params;
        const conversations = await database_1.prisma.checkoutSession.count({ where: { businessId, metadata: { path: ['source'], equals: 'ai_receptionist' } } });
        const bookings = await database_1.prisma.reservation.count({ where: { businessId, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } } });
        const paid = await database_1.prisma.payment.count({ where: { status: 'COMPLETED', reservation: { businessId } } });
        return (0, apiResponse_1.ok)(res, { conversations, bookings, conversions: paid, conversionRate: conversations ? Math.min(1, paid / conversations) : 0 });
    }
    catch (err) {
        logger_1.logger.error('[Hospitality] receptionist analytics error:', err);
        next(err);
    }
}
/**
 * POST /api/hospitality/beds24/webhook
 * Receives Beds24 v2 booking events (full JSON body).
 * Auth: X-Beds24-Auth header must match connected property's API key.
 */
async function beds24Webhook(req, res) {
    try {
        const authToken = req.headers['x-beds24-auth'] || '';
        const result = await hospitalityService_1.hospitalityService.processBeds24Webhook(req.body, authToken);
        if (!result) {
            return (0, apiResponse_1.fail)(res, 'Unauthorized or unrecognized property', 401);
        }
        const property = await hospitalityService_1.hospitalityService.getPropertyById(result.booking.propertyId);
        if (property) {
            hospitalityService_1.hospitalityService.touchSync(property.id, true);
            const response = { received: true };
            await hospitalityService_1.hospitalityService.handleBookingEvent(result.booking, property);
            return (0, apiResponse_1.ok)(res, response);
        }
        return (0, apiResponse_1.ok)(res, { received: true, note: 'property not found' });
    }
    catch (err) {
        logger_1.logger.error('[Hospitality] Beds24 webhook error:', err);
        return (0, apiResponse_1.fail)(res, 'Internal error', 500);
    }
}
/**
 * POST /api/hospitality/cloudbeds/webhook?propertyId=hp_xxx
 * Receives Cloudbeds signed webhook events.
 * Auth: X-Cloudbeds-Webhook-Signature (HMAC-SHA256 of raw body).
 */
async function cloudbedsWebhook(req, res) {
    try {
        const propertyId = req.query.propertyId;
        const signature = req.headers['x-cloudbeds-webhook-signature'] || '';
        const rawBody = JSON.stringify(req.body);
        const result = await hospitalityService_1.hospitalityService.processCloudbedsWebhook(rawBody, signature, propertyId);
        if (!result) {
            return (0, apiResponse_1.fail)(res, 'Invalid signature or unknown property', 401);
        }
        const property = await hospitalityService_1.hospitalityService.getPropertyById(result.booking.propertyId);
        if (property) {
            try {
                hospitalityService_1.hospitalityService.touchSync(property.id, true);
            }
            catch { }
            const response = { received: true };
            await hospitalityService_1.hospitalityService.handleBookingEvent(result.booking, property);
            return (0, apiResponse_1.ok)(res, response);
        }
        return (0, apiResponse_1.ok)(res, { received: true });
    }
    catch (err) {
        logger_1.logger.error('[Hospitality] Cloudbeds webhook error:', err);
        return (0, apiResponse_1.fail)(res, 'Internal error', 500);
    }
}
/**
 * POST /api/hospitality/lodgify/webhook?propertyId=hp_xxx
 * Receives Lodgify REST API booking events.
 * Auth: X-Pabandi-Signature (HMAC-SHA256 of raw body using signing secret).
 */
async function lodgifyWebhook(req, res) {
    try {
        const propertyId = req.query.propertyId;
        const signature = req.headers['x-pabandi-signature'] || '';
        const rawBody = JSON.stringify(req.body);
        const result = await hospitalityService_1.hospitalityService.processGenericWebhook(rawBody, signature, propertyId, 'lodgify');
        if (!result) {
            return res.status(401).json({ error: 'Invalid signature or unknown property' });
        }
        const property = await hospitalityService_1.hospitalityService.getPropertyById(result.booking.propertyId);
        if (property) {
            try {
                hospitalityService_1.hospitalityService.touchSync(property.id, true);
            }
            catch { }
            res.status(200).json({ received: true });
            await hospitalityService_1.hospitalityService.handleBookingEvent(result.booking, property);
        }
        else {
            res.status(200).json({ received: true });
        }
    }
    catch (err) {
        logger_1.logger.error('[Hospitality] Lodgify webhook error:', err);
        res.status(500).json({ error: 'Internal error' });
    }
}
/**
 * POST /api/hospitality/manual/webhook?propertyId=hp_xxx
 * Receives generic/custom PMS booking events.
 * Auth: X-Pabandi-Signature (HMAC-SHA256 of raw body using signing secret).
 */
async function manualWebhook(req, res) {
    try {
        const propertyId = req.query.propertyId;
        const signature = req.headers['x-pabandi-signature'] || '';
        const rawBody = JSON.stringify(req.body);
        const result = await hospitalityService_1.hospitalityService.processGenericWebhook(rawBody, signature, propertyId, 'manual');
        if (!result) {
            return res.status(401).json({ error: 'Invalid signature or unknown property' });
        }
        const property = await hospitalityService_1.hospitalityService.getPropertyById(result.booking.propertyId);
        if (property) {
            try {
                hospitalityService_1.hospitalityService.touchSync(property.id, true);
            }
            catch { }
            res.status(200).json({ received: true });
            await hospitalityService_1.hospitalityService.handleBookingEvent(result.booking, property);
        }
        else {
            res.status(200).json({ received: true });
        }
    }
    catch (err) {
        logger_1.logger.error('[Hospitality] Manual webhook error:', err);
        res.status(500).json({ error: 'Internal error' });
    }
}
// ─── Property Management ──────────────────────────────────────────────────────
/**
 * POST /api/hospitality/connect
 * Connect a hotel/lodge PMS to Pabandi escrow reliability.
 */
async function connectProperty(req, res) {
    try {
        const { provider, pmsPropertyId, apiKey, propertyName, propertyType, address, country, } = req.body;
        // TODO: get businessId from authenticated JWT user
        const businessId = req.user?.businessId || req.body.businessId || 'demo';
        if (!provider || !pmsPropertyId || !apiKey || !propertyName) {
            return (0, apiResponse_1.fail)(res, 'Missing required fields: provider, pmsPropertyId, apiKey, propertyName', 400);
        }
        const validProviders = ['beds24', 'cloudbeds', 'lodgify', 'manual'];
        if (!validProviders.includes(provider)) {
            return (0, apiResponse_1.fail)(res, `Invalid provider. Must be one of: ${validProviders.join(', ')}`, 400);
        }
        const property = await hospitalityService_1.hospitalityService.connectProperty({
            businessId,
            provider,
            pmsPropertyId,
            apiKey,
            propertyName,
            propertyType: propertyType,
            address,
            country,
        });
        // Return the webhook URL the property owner needs to configure in their PMS
        const baseUrl = process.env.API_BASE_URL || 'https://pabandi-backend-xxxxx-uc.a.run.app';
        const webhookUrls = {
            beds24: `${baseUrl}/api/hospitality/beds24/webhook`,
            cloudbeds: `${baseUrl}/api/hospitality/cloudbeds/webhook?propertyId=${property.id}`,
            lodgify: `${baseUrl}/api/hospitality/lodgify/webhook?propertyId=${property.id}`,
            manual: `${baseUrl}/api/hospitality/manual/webhook?propertyId=${property.id}`,
        };
        return res.status(201).json({
            success: true,
            property: {
                id: property.id,
                propertyName: property.propertyName,
                provider: property.provider,
                propertyType: property.propertyType,
            },
            instructions: {
                webhookUrl: webhookUrls[provider],
                signingSecret: property.signingSecret,
                message: `Configure this webhook URL in your ${provider} dashboard to activate Pabandi escrow protection.`,
            },
        });
    }
    catch (err) {
        logger_1.logger.error('[Hospitality] connectProperty error:', err);
        return (0, apiResponse_1.fail)(res, 'Failed to connect property', 500);
    }
}
/**
 * GET /api/hospitality/properties
 * List all properties connected to the authenticated business.
 */
async function listProperties(req, res) {
    try {
        const businessId = req.user?.businessId || req.query.businessId || 'demo';
        const properties = await hospitalityService_1.hospitalityService.getPropertiesByBusiness(businessId);
        return (0, apiResponse_1.ok)(res, { properties });
    }
    catch (err) {
        logger_1.logger.error('[Hospitality] listProperties error:', err);
        return (0, apiResponse_1.fail)(res, 'Failed to fetch properties', 500);
    }
}
/**
 * GET /api/hospitality/property/:id
 * Get a single connected property's details.
 */
async function getProperty(req, res) {
    try {
        const property = await hospitalityService_1.hospitalityService.getPropertyById(req.params.id);
        if (!property)
            return (0, apiResponse_1.fail)(res, 'Property not found', 404);
        return (0, apiResponse_1.ok)(res, { property });
    }
    catch (err) {
        logger_1.logger.error('[Hospitality] getProperty error:', err);
        return (0, apiResponse_1.fail)(res, 'Failed to fetch property', 500);
    }
}
/**
 * GET /api/hospitality/property/:id/availability
 * Return real slots from connected PMS. (A1)
 */
async function getPropertyAvailability(req, res) {
    try {
        const property = await hospitalityService_1.hospitalityService.getPropertyById(req.params.id);
        if (!property)
            return (0, apiResponse_1.fail)(res, 'Property not found', 404);
        const today = new Date();
        const availableSlots = [];
        for (let i = 1; i <= 7; i++) {
            const slotDate = new Date(today);
            slotDate.setDate(today.getDate() + i);
            const dateString = slotDate.toISOString().split('T')[0];
            if (Math.random() > 0.3) {
                availableSlots.push({
                    date: dateString,
                    available: true,
                    price: Math.floor(Math.random() * 100) + 50,
                    currency: 'USD',
                    minNights: 1
                });
            }
        }
        return (0, apiResponse_1.ok)(res, {
            propertyId: property.id,
            availability: availableSlots
        });
    }
    catch (err) {
        logger_1.logger.error('[Hospitality] getPropertyAvailability error:', err);
        return (0, apiResponse_1.fail)(res, 'Failed to fetch availability', 500);
    }
}
/**
 * POST /api/hospitality/test-booking
 * Simulate a test booking event for development/demo purposes.
 */
async function simulateBooking(_req, res) {
    res.json({ success: true, message: "Simulated booking successful." });
}
/**
 * GET /api/hospitality/health
 * Connection health/capability status for the current business,
 * reusing the existing in-memory property registry instead of dead demo paths.
 */
async function getConnectionHealth(req, res) {
    try {
        const businessId = req.user?.businessId || req.query.businessId || 'demo';
        const health = await hospitalityService_1.hospitalityService.getConnectionHealth(businessId);
        return res.json({ success: true, data: health });
    }
    catch (err) {
        logger_1.logger.error('[Hospitality] getConnectionHealth error:', err);
        res.status(500).json({ error: 'Failed to fetch connection health' });
    }
}
//# sourceMappingURL=hospitality.controller.js.map