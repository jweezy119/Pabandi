import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import {
  createReservation,
  getReservation,
  updateReservation,
  cancelReservation,
  getUserReservations,
  completeReservation,
  markNoShow,
  submitFreelanceWork,
  arbitrateFreelanceWork
} from '../controllers/reservation.controller';
import { authenticate } from '../middleware/auth.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validateRequest';
import { courtCheckService } from '../services/courtCheck.service';
import { logger } from '../utils/logger';

const router = Router();

router.use(authenticate);

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
router.post(
  '/',
  [
    body('businessId').notEmpty(),
    body('reservationDate').isISO8601(),
    body('reservationTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('numberOfGuests').isInt({ min: 1 }),
    body('customerName').trim().notEmpty(),
    body('customerPhone').optional({ checkFalsy: true }).isString(),
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    // Capture the created reservation id from the JSON response and fire a
    // non-blocking court screening of both parties. We trigger it inside the
    // res.json override (rather than awaiting next()) because createReservation
    // does NOT call next() on the success path — awaiting it would hang.
    // Screening NEVER blocks or fails the booking.
    const originalJson = res.json.bind(res);
    (res as any).json = (body: any) => {
      const createdId =
        body?.data?.reservation?.id ||
        body?.data?.id ||
        body?.id ||
        body?.reservation?.id;
      if (createdId) {
        courtCheckService
          .screenReservation(createdId)
          .catch((e) =>
            logger.warn(`[CourtCheck] auto-screen failed for ${createdId}: ${e.message}`)
          );
      }
      return originalJson(body);
    };
    createReservation(req, res, () => {});
  }
);

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
router.get('/user', getUserReservations);

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
router.get('/:id', getReservation);

router.put('/:id', updateReservation);
router.post('/:id/cancel', cancelReservation);
router.patch('/:id/complete', completeReservation);
router.patch('/:id/noshow', markNoShow);
router.post('/:id/submit-work', submitFreelanceWork);
router.post('/:id/arbitrate', arbitrateFreelanceWork);

export default router;
