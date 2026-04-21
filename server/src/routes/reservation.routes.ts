import { Router } from 'express';
import { body } from 'express-validator';
import {
  createReservation,
  getReservation,
  updateReservation,
  cancelReservation,
  getUserReservations,
  completeReservation,
  markNoShow,
} from '../controllers/reservation.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  [
    body('businessId').notEmpty(),
    body('reservationDate').isISO8601(),
    body('reservationTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('numberOfGuests').isInt({ min: 1 }),
    body('customerName').trim().notEmpty(),
    body('customerPhone').isMobilePhone('en-PK'),
  ],
  validateRequest,
  createReservation
);

router.get('/user', getUserReservations);
router.get('/:id', getReservation);
router.put('/:id', updateReservation);
router.post('/:id/cancel', cancelReservation);
router.patch('/:id/complete', completeReservation);
router.patch('/:id/noshow', markNoShow);

export default router;
