import { Request, Response, NextFunction } from 'express';
import { popService } from '../services/pop.service';

export const recordPopIntent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, reservationId, businessId, meta } = req.body || {};
    if (!userId || !reservationId) return res.status(400).json({ success: false, error: 'userId and reservationId are required' });
    const event = await popService.recordEvent({ userId, reservationId, businessId, eventType: 'INTENT', source: 'buyer', meta });
    res.status(201).json({ success: true, data: event });
  } catch (error) {
    next(error);
  }
};

export const recordPopArrived = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, reservationId, businessId } = req.body || {};
    if (!userId || !reservationId) return res.status(400).json({ success: false, error: 'userId and reservationId are required' });
    const event = await popService.recordEvent({ userId, reservationId, businessId, eventType: 'ARRIVED', source: 'buyer' });
    res.status(201).json({ success: true, data: event });
  } catch (error) {
    next(error);
  }
};

export const recordPopNoShow = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, reservationId, businessId } = req.body || {};
    if (!userId || !reservationId) return res.status(400).json({ success: false, error: 'userId and reservationId are required' });
    const event = await popService.recordEvent({ userId, reservationId, businessId, eventType: 'NO_SHOW', source: 'system' });
    res.status(201).json({ success: true, data: event });
  } catch (error) {
    next(error);
  }
};

export const recordMerchantStart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { merchantId, reservationId, businessId } = req.body || {};
    if (!merchantId || !reservationId) return res.status(400).json({ success: false, error: 'merchantId and reservationId are required' });
    const event = await popService.recordEvent({ userId: merchantId, reservationId, businessId, eventType: 'MERCHANT_START', source: 'merchant' });
    res.status(201).json({ success: true, data: event });
  } catch (error) {
    next(error);
  }
};

export const recordMerchantFulfill = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { merchantId, reservationId, businessId } = req.body || {};
    if (!merchantId || !reservationId) return res.status(400).json({ success: false, error: 'merchantId and reservationId are required' });
    const event = await popService.recordEvent({ userId: merchantId, reservationId, businessId, eventType: 'MERCHANT_FULFILL', source: 'merchant' });
    res.status(201).json({ success: true, data: event });
  } catch (error) {
    next(error);
  }
};

export const getPopEventsForReservation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const events = await popService.getEventsForReservation(req.params.reservationId);
    res.status(200).json({ success: true, data: events });
  } catch (error) {
    next(error);
  }
};
