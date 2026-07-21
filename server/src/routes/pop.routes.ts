import { Router } from 'express';
import { popService } from '../services/pop.service';

const router = Router();

router.post('/intent', async (req, res) => {
  const { userId, reservationId, businessId, meta } = req.body || {};
  if (!userId || !reservationId) return res.status(400).json({ success: false, error: 'userId and reservationId are required' });
  const event = await popService.recordEvent({ userId, reservationId, businessId, eventType: 'INTENT', source: 'buyer', meta });
  res.status(201).json({ success: true, data: event });
});

router.post('/arrived', async (req, res) => {
  const { userId, reservationId, businessId } = req.body || {};
  if (!userId || !reservationId) return res.status(400).json({ success: false, error: 'userId and reservationId are required' });
  const event = await popService.recordEvent({ userId, reservationId, businessId, eventType: 'ARRIVED', source: 'buyer' });
  res.status(201).json({ success: true, data: event });
});

router.post('/no-show', async (req, res) => {
  const { userId, reservationId, businessId } = req.body || {};
  if (!userId || !reservationId) return res.status(400).json({ success: false, error: 'userId and reservationId are required' });
  const event = await popService.recordEvent({ userId, reservationId, businessId, eventType: 'NO_SHOW', source: 'system' });
  res.status(201).json({ success: true, data: event });
});

router.post('/merchant/start', async (req, res) => {
  const { merchantId, reservationId, businessId } = req.body || {};
  if (!merchantId || !reservationId) return res.status(400).json({ success: false, error: 'merchantId and reservationId are required' });
  const event = await popService.recordEvent({ userId: merchantId, reservationId, businessId, eventType: 'MERCHANT_START', source: 'merchant' });
  res.status(201).json({ success: true, data: event });
});

router.post('/merchant/fulfill', async (req, res) => {
  const { merchantId, reservationId, businessId } = req.body || {};
  if (!merchantId || !reservationId) return res.status(400).json({ success: false, error: 'merchantId and reservationId are required' });
  const event = await popService.recordEvent({ userId: merchantId, reservationId, businessId, eventType: 'MERCHANT_FULFILL', source: 'merchant' });
  res.status(201).json({ success: true, data: event });
});

router.get('/reservation/:reservationId', async (req, res) => {
  const events = await popService.getEventsForReservation(req.params.reservationId);
  res.status(200).json({ success: true, data: events });
});

export default router;
