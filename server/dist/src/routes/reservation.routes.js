"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const reservation_controller_1 = require("../controllers/reservation.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validateRequest_1 = require("../middleware/validateRequest");
const courtCheck_service_1 = require("../services/courtCheck.service");
const pakCheck_service_1 = require("../services/pakCheck.service");
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
/**
 * @openapi
 * /api/v1/reservations:
 *   post:
 *     summary: Create a new reservation
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - businessId
 *               - reservationDate
 *               - reservationTime
 *               - numberOfGuests
 *               - customerName
 *             properties:
 *               businessId:
 *                 type: string
 *               reservationDate:
 *                 type: string
 *                 format: date
 *               reservationTime:
 *                 type: string
 *               numberOfGuests:
 *                 type: integer
 *               customerName:
 *                 type: string
 *     responses:
 *       201:
 *         description: Reservation created successfully
 */
router.post('/', [
    (0, express_validator_1.body)('businessId').notEmpty(),
    (0, express_validator_1.body)('reservationDate').isISO8601(),
    (0, express_validator_1.body)('reservationTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    (0, express_validator_1.body)('numberOfGuests').isInt({ min: 1 }),
    (0, express_validator_1.body)('customerName').trim().notEmpty(),
    (0, express_validator_1.body)('customerPhone').optional({ checkFalsy: true }).isString(),
], validateRequest_1.validateRequest, async (req, res, _next) => {
    // Capture the created reservation id from the JSON response and fire a
    // non-blocking court screening of both parties. We trigger it inside the
    // res.json override (rather than awaiting next()) because createReservation
    // does NOT call next() on the success path — awaiting it would hang.
    // Screening NEVER blocks or fails the booking.
    const originalJson = res.json.bind(res);
    res.json = (body) => {
        const createdId = body?.data?.reservation?.id ||
            body?.data?.id ||
            body?.id ||
            body?.reservation?.id;
        if (createdId) {
            courtCheck_service_1.courtCheckService
                .screenReservation(createdId)
                .catch((e) => logger_1.logger.warn(`[CourtCheck] auto-screen failed for ${createdId}: ${e.message}`));
            // Pakistan / non-US bookings: CourtListener is US-only, so also run the PK
            // BackgroundCheck-based trust screen (never blocks the booking).
            database_1.prisma.reservation
                .findUnique({ where: { id: createdId }, include: { business: true, customer: true } })
                .then((r) => {
                if (!r)
                    return;
                const country = (r.business?.country || '').toLowerCase();
                const isNonUs = !country.includes('united states') && country !== '';
                if (isNonUs) {
                    pakCheck_service_1.pakCheckService
                        .screenPakParty({
                        subjectType: 'LANDLORD',
                        subjectId: r.businessId,
                        name: r.business?.name || 'Landlord',
                        reservationId: createdId,
                        businessId: r.businessId,
                    })
                        .catch((e) => logger_1.logger.warn(`[PakCheck] auto-screen landlord failed for ${createdId}: ${e.message}`));
                    if (r.customerId) {
                        pakCheck_service_1.pakCheckService
                            .screenPakParty({
                            subjectType: 'TENANT',
                            subjectId: r.customerId,
                            name: r.customerName || 'Tenant',
                            reservationId: createdId,
                            customerId: r.customerId,
                        })
                            .catch((e) => logger_1.logger.warn(`[PakCheck] auto-screen tenant failed for ${createdId}: ${e.message}`));
                    }
                }
            })
                .catch((e) => logger_1.logger.warn(`[PakCheck] reservation lookup failed: ${e.message}`));
        }
        return originalJson(body);
    };
    (0, reservation_controller_1.createReservation)(req, res, () => { });
});
/**
 * @openapi
 * /api/v1/reservations/user:
 *   get:
 *     summary: Get reservations for the current user
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user reservations
 */
router.get('/user', reservation_controller_1.getUserReservations);
/**
 * @openapi
 * /api/v1/reservations/{id}:
 *   get:
 *     summary: Get a specific reservation by ID
 *     tags: [Reservations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reservation details
 */
router.get('/:id', reservation_controller_1.getReservation);
router.put('/:id', reservation_controller_1.updateReservation);
router.post('/:id/cancel', reservation_controller_1.cancelReservation);
router.patch('/:id/complete', reservation_controller_1.completeReservation);
router.patch('/:id/noshow', reservation_controller_1.markNoShow);
router.post('/:id/submit-work', reservation_controller_1.submitFreelanceWork);
router.post('/:id/arbitrate', reservation_controller_1.arbitrateFreelanceWork);
exports.default = router;
//# sourceMappingURL=reservation.routes.js.map