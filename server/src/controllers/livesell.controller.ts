import { Request, Response } from 'express';
import { liveSellerService } from '../services/live-seller.service';
import { LiveSellerPlatform } from '@prisma/client';

export async function getIntegrations(req: Request, res: Response) {
  const businessId = (req as any).businessId;
  if (!businessId) return res.status(400).json({ success: false, error: 'Business profile not found' });
  const data = await liveSellerService.listForBusiness(businessId);
  res.json({ success: true, data });
}

export async function getShowState(req: Request, res: Response) {
  const businessId = (req as any).businessId;
  const platform = req.params.platform.toUpperCase().replace('-', '_') as LiveSellerPlatform;
  const data = await liveSellerService.getShowState(businessId, platform);
  res.json({ success: true, data });
}

export async function patchShowState(req: Request, res: Response) {
  const businessId = (req as any).businessId;
  const platform = req.params.platform.toUpperCase().replace('-', '_') as LiveSellerPlatform;
  const data = await liveSellerService.upsertShowState(businessId, platform, req.body || {});
  res.json({ success: true, data });
}

export async function addOrder(req: Request, res: Response) {
  const businessId = (req as any).businessId;
  const platform = req.params.platform.toUpperCase().replace('-', '_') as LiveSellerPlatform;
  const data = await liveSellerService.addOrder(businessId, platform, req.body || {});
  res.status(201).json({ success: true, data });
}
