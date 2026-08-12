/**
 * geoRisk.routes.ts — Geospatial Risk Oracle HTTP surface.
 * Public, stateless: assess a property's intrinsic risk + compute dual-risk rent.
 */
import { Router, Request, Response } from 'express';
import { geoRiskOracle, RiskBand } from '../services/geoRiskOracle.service';

const router = Router();

const BANDS: RiskBand[] = ['A', 'B', 'C', 'D', 'E'];

/** POST /api/v1/geo/assess — assess a property's intrinsic (location) risk. */
router.post('/assess', async (req: Request, res: Response): Promise<any> => {
  const { lat, lng, address, floodZone, crimeRatePer1k, schoolRating } = req.body || {};
  if (lat === undefined && lng === undefined && !address) {
    return res.status(400).json({ success: false, error: 'Provide lat/lng or address' });
  }
  try {
    const result = geoRiskOracle.assessProperty({ lat, lng, address, floodZone, crimeRatePer1k, schoolRating });
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/** GET /api/v1/geo/assess?address=... convenience */
router.get('/assess', async (req: Request, res: Response): Promise<any> => {
  const { lat, lng, address } = req.query as any;
  if (!lat && !lng && !address) {
    return res.status(400).json({ success: false, error: 'Provide lat/lng or address' });
  }
  try {
    const result = geoRiskOracle.assessProperty({
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
      address,
    });
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/v1/geo/price-rent — dual-risk dynamic rent.
 * Body: { baseRentUSD, geoRiskBand, tenantTrustBand }
 */
router.post('/price-rent', async (req: Request, res: Response): Promise<any> => {
  const { baseRentUSD, geoRiskBand, tenantTrustBand } = req.body || {};
  if (typeof baseRentUSD !== 'number' || !BANDS.includes(geoRiskBand) || !BANDS.includes(tenantTrustBand)) {
    return res.status(400).json({ success: false, error: 'baseRentUSD (number), geoRiskBand & tenantTrustBand (A-E) required' });
  }
  try {
    const result = geoRiskOracle.priceWithDualRisk({ baseRentUSD, geoRiskBand, tenantTrustBand });
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
