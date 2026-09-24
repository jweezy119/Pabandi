"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAlertsHandler = getAlertsHandler;
exports.dismissAlertHandler = dismissAlertHandler;
exports.getClientStageHandler = getClientStageHandler;
const errorHandler_1 = require("../middleware/errorHandler");
const database_1 = require("../utils/database");
const alerts_service_1 = require("../services/alerts.service");
const crm_reliability_service_1 = require("../services/crm-reliability.service");
// ─── Alerts ───────────────────────────────────────────────────────────────────
async function getAlertsHandler(req, res, next) {
    try {
        const businessId = req.body?.businessId || req.query?.businessId;
        if (!businessId) {
            throw new errorHandler_1.CustomError('businessId is required', 400);
        }
        const crmBusiness = await database_1.prisma.crmServiceBusiness.findUnique({
            where: { businessId: businessId },
        });
        if (!crmBusiness) {
            throw new errorHandler_1.CustomError('CRM business not found for this business', 404);
        }
        const alerts = await (0, alerts_service_1.getActiveAlerts)(crmBusiness.id);
        res.json({ success: true, data: alerts });
    }
    catch (error) {
        next(error);
    }
}
async function dismissAlertHandler(req, res, next) {
    try {
        const { id: alertId } = req.params;
        const businessId = req.body?.businessId || req.query?.businessId;
        if (!businessId) {
            throw new errorHandler_1.CustomError('businessId is required', 400);
        }
        const crmBusiness = await database_1.prisma.crmServiceBusiness.findUnique({
            where: { businessId: businessId },
        });
        if (!crmBusiness) {
            throw new errorHandler_1.CustomError('CRM business not found for this business', 404);
        }
        const result = await (0, alerts_service_1.dismissAlert)(alertId, crmBusiness.id);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
}
// ─── Client Stage ─────────────────────────────────────────────────────────────
async function getClientStageHandler(req, res, next) {
    try {
        const { id: clientId } = req.params;
        const businessId = req.body?.businessId || req.query?.businessId;
        if (!businessId) {
            throw new errorHandler_1.CustomError('businessId is required', 400);
        }
        const crmBusiness = await database_1.prisma.crmServiceBusiness.findUnique({
            where: { businessId: businessId },
        });
        if (!crmBusiness) {
            throw new errorHandler_1.CustomError('CRM business not found for this business', 404);
        }
        const client = await database_1.prisma.crmClient.findFirst({
            where: { id: clientId, serviceBusinessId: crmBusiness.id },
            include: { jobs: true },
        });
        if (!client) {
            throw new errorHandler_1.CustomError('Client not found', 404);
        }
        // Refresh score + stage and return
        const result = await (0, crm_reliability_service_1.refreshClientTrust)(clientId);
        res.json({
            success: true,
            data: {
                clientId: client.id,
                clientName: client.name,
                stage: result.stage,
                score: result.score,
            },
        });
    }
    catch (error) {
        next(error);
    }
}
//# sourceMappingURL=revenue.controller.js.map