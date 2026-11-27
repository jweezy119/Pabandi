import { Router, Request, Response } from 'express';
import { decodeVinWithNhtsa } from '../services/autoRepairGuardrails.service';

const router = Router();

/**
 * GET /api/v1/vehicles/decode-vin/:vin
 * Decodes a vehicle VIN using the free US NHTSA API and returns Year, Make, Model.
 */
router.get('/decode-vin/:vin', async (req: Request, res: Response) => {
  try {
    const vin = String(req.params.vin || '').trim();
    if (!vin) {
      return res.status(400).json({ success: false, error: 'VIN parameter is required' });
    }
    const decoded = await decodeVinWithNhtsa(vin);
    return res.json({ success: true, data: decoded });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: err?.message || 'Failed to decode VIN',
    });
  }
});

export default router;
