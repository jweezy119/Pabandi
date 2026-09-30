"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const universal_escrow_service_1 = require("../services/universal-escrow.service");
const logger_1 = require("../utils/logger");
const rateLimit_middleware_1 = require("../middleware/rateLimit.middleware");
const router = (0, express_1.Router)();
const CreateEscrowSchema = zod_1.z.object({
    referenceId: zod_1.z.string().min(1),
    template: zod_1.z.string().default('custom'),
    parties: zod_1.z.array(zod_1.z.object({
        partyId: zod_1.z.string(),
        role: zod_1.z.enum(['buyer', 'seller', 'broker']),
    })),
    amount: zod_1.z.number().positive(),
    currency: zod_1.z.string().default('USDC'),
    conditions: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.enum(['delivery', 'milestone', 'checkin', 'manual']),
        verify: zod_1.z.record(zod_1.z.any()),
    })),
    deadline: zod_1.z.string().optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
});
const StatusUpdateSchema = zod_1.z.object({
    status: zod_1.z.enum(['draft', 'funded', 'in_progress', 'conditions_met', 'released', 'disputed', 'refunded']),
});
router.post('/', rateLimit_middleware_1.writeLimiter, async (req, res) => {
    try {
        const body = CreateEscrowSchema.parse(req.body);
        const escrow = await universal_escrow_service_1.universalEscrowService.create({
            referenceId: body.referenceId,
            template: body.template,
            parties: body.parties,
            amount: body.amount,
            currency: body.currency,
            conditions: body.conditions,
            deadline: body.deadline,
            metadata: body.metadata,
        });
        logger_1.logger.info(`[UniversalEscrow] created ${escrow.referenceId} template=${escrow.template}`);
        return res.status(201).json({
            success: true,
            data: escrow,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: error.errors });
        }
        logger_1.logger.error(`[UniversalEscrow] create error: ${error.message}`);
        return res.status(500).json({ success: false, error: error.message });
    }
});
router.patch('/:referenceId/status', rateLimit_middleware_1.writeLimiter, async (req, res) => {
    try {
        const { referenceId } = req.params;
        const body = StatusUpdateSchema.parse(req.body);
        const escrow = await universal_escrow_service_1.universalEscrowService.updateStatus(referenceId, body.status);
        return res.json({
            success: true,
            data: escrow,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: error.errors });
        }
        logger_1.logger.error(`[UniversalEscrow] status update error: ${error.message}`);
        return res.status(500).json({ success: false, error: error.message });
    }
});
router.get('/:referenceId', rateLimit_middleware_1.apiLimiter, async (req, res) => {
    try {
        const { referenceId } = req.params;
        const escrow = await universal_escrow_service_1.universalEscrowService.getByReference(referenceId);
        if (!escrow) {
            return res.status(404).json({ success: false, error: 'Escrow not found' });
        }
        return res.json({
            success: true,
            data: escrow,
        });
    }
    catch (error) {
        logger_1.logger.error(`[UniversalEscrow] get error: ${error.message}`);
        return res.status(500).json({ success: false, error: error.message });
    }
});
router.get('/party/:partyId', rateLimit_middleware_1.apiLimiter, async (req, res) => {
    try {
        const { partyId } = req.params;
        const escrows = await universal_escrow_service_1.universalEscrowService.listByParty(partyId);
        return res.json({
            success: true,
            data: escrows,
        });
    }
    catch (error) {
        logger_1.logger.error(`[UniversalEscrow] list error: ${error.message}`);
        return res.status(500).json({ success: false, error: error.message });
    }
});
router.get('/templates', (_req, res) => {
    const templates = [
        {
            id: 'freelance',
            label: 'Freelance Project',
            description: 'Milestone-based escrow for freelance work',
            conditions: [
                { type: 'milestone', verify: { milestoneId: 'required' } },
            ],
        },
        {
            id: 'freight',
            label: 'Freight Shipment',
            description: 'Delivery-based escrow for freight',
            conditions: [
                { type: 'delivery', verify: { trackingId: 'required', proof: 'photo' } },
            ],
        },
        {
            id: 'booking',
            label: 'Service Booking',
            description: 'Check-in-based escrow for bookings',
            conditions: [
                { type: 'checkin', verify: { location: 'required' } },
            ],
        },
        {
            id: 'property',
            label: 'Property Lease',
            description: 'Monthly lease deposit escrow',
            conditions: [
                { type: 'manual', verify: { landlordApproval: true } },
            ],
        },
        {
            id: 'goods',
            label: 'Physical Goods',
            description: 'Delivery + inspection escrow',
            conditions: [
                { type: 'delivery', verify: { trackingId: 'required' } },
                { type: 'manual', verify: { inspectionPassed: true } },
            ],
        },
    ];
    return res.json({
        success: true,
        data: templates,
    });
});
exports.default = router;
//# sourceMappingURL=escrow.routes.js.map