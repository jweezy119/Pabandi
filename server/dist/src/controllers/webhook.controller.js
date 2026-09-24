"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.regenerateSecret = exports.deleteWebhook = exports.updateWebhook = exports.getWebhooks = exports.createWebhook = void 0;
const database_1 = require("../utils/database");
const errorHandler_1 = require("../middleware/errorHandler");
const crypto_1 = __importDefault(require("crypto"));
const createWebhook = async (req, res, next) => {
    try {
        const { targetUrl, subscribedEvents } = req.body;
        // Verify ownership
        const business = await database_1.prisma.business.findUnique({
            where: { ownerId: req.user.id },
        });
        if (!business) {
            throw new errorHandler_1.CustomError('Business not found', 404);
        }
        // Generate signing secret
        const signingSecret = crypto_1.default.randomBytes(32).toString('hex');
        const webhook = await database_1.prisma.webhookEndpoint.create({
            data: {
                businessId: business.id,
                targetUrl,
                subscribedEvents: subscribedEvents || ['*'],
                signingSecret,
            },
        });
        res.status(201).json({
            success: true,
            message: 'Webhook endpoint created successfully',
            data: { webhook },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createWebhook = createWebhook;
const getWebhooks = async (req, res, next) => {
    try {
        const business = await database_1.prisma.business.findUnique({
            where: { ownerId: req.user.id },
        });
        if (!business) {
            throw new errorHandler_1.CustomError('Business not found', 404);
        }
        const webhooks = await database_1.prisma.webhookEndpoint.findMany({
            where: { businessId: business.id },
            orderBy: { createdAt: 'desc' },
        });
        res.json({
            success: true,
            data: { webhooks },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getWebhooks = getWebhooks;
const updateWebhook = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { targetUrl, subscribedEvents, isActive } = req.body;
        const webhook = await database_1.prisma.webhookEndpoint.findUnique({
            where: { id },
            include: { business: true },
        });
        if (!webhook) {
            throw new errorHandler_1.CustomError('Webhook not found', 404);
        }
        if (webhook.business.ownerId !== req.user.id) {
            throw new errorHandler_1.CustomError('Unauthorized', 403);
        }
        const updated = await database_1.prisma.webhookEndpoint.update({
            where: { id },
            data: {
                targetUrl,
                subscribedEvents,
                isActive,
            },
        });
        res.json({
            success: true,
            message: 'Webhook updated successfully',
            data: { webhook: updated },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateWebhook = updateWebhook;
const deleteWebhook = async (req, res, next) => {
    try {
        const { id } = req.params;
        const webhook = await database_1.prisma.webhookEndpoint.findUnique({
            where: { id },
            include: { business: true },
        });
        if (!webhook) {
            throw new errorHandler_1.CustomError('Webhook not found', 404);
        }
        if (webhook.business.ownerId !== req.user.id) {
            throw new errorHandler_1.CustomError('Unauthorized', 403);
        }
        await database_1.prisma.webhookEndpoint.delete({
            where: { id },
        });
        res.json({
            success: true,
            message: 'Webhook deleted successfully',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteWebhook = deleteWebhook;
const regenerateSecret = async (req, res, next) => {
    try {
        const { id } = req.params;
        const webhook = await database_1.prisma.webhookEndpoint.findUnique({
            where: { id },
            include: { business: true },
        });
        if (!webhook) {
            throw new errorHandler_1.CustomError('Webhook not found', 404);
        }
        if (webhook.business.ownerId !== req.user.id) {
            throw new errorHandler_1.CustomError('Unauthorized', 403);
        }
        const newSecret = crypto_1.default.randomBytes(32).toString('hex');
        const updated = await database_1.prisma.webhookEndpoint.update({
            where: { id },
            data: {
                signingSecret: newSecret,
            },
        });
        res.json({
            success: true,
            message: 'Webhook secret regenerated successfully',
            data: { signingSecret: updated.signingSecret },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.regenerateSecret = regenerateSecret;
//# sourceMappingURL=webhook.controller.js.map