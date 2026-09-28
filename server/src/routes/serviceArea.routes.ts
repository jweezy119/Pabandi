import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { geoService } from '../services/geo.service';

const router = Router();

router.use(authenticate);

// ── GET /api/v1/service-area ──
// Get business service area settings
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.query.businessId as string || req.user?.businessId;
    if (!businessId) {
      return res.status(400).json({ success: false, error: 'businessId required' });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        serviceAddress: true,
        serviceLat: true,
        serviceLng: true,
        serviceRadiusMiles: true,
        travelFeeEnabled: true,
        travelFeePerMile: true,
        maxTravelMinutes: true,
        latitude: true,
        longitude: true,
      },
    });

    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found' });
    }

    if (business.ownerId !== req.user!.id) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    res.json({ success: true, data: business });
  } catch (e: any) {
    console.error('Get service area error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── PUT /api/v1/service-area ──
// Update service area settings
router.put('/', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.body.businessId || req.user?.businessId;
    if (!businessId) {
      return res.status(400).json({ success: false, error: 'businessId required' });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true },
    });

    if (!business || business.ownerId !== req.user!.id) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const {
      serviceAddress,
      serviceLat,
      serviceLng,
      serviceRadiusMiles,
      travelFeeEnabled,
      travelFeePerMile,
      maxTravelMinutes,
    } = req.body;

    const updated = await prisma.business.update({
      where: { id: businessId },
      data: {
        serviceAddress,
        serviceLat: serviceLat ? parseFloat(serviceLat) : null,
        serviceLng: serviceLng ? parseFloat(serviceLng) : null,
        serviceRadiusMiles: serviceRadiusMiles ? parseFloat(serviceRadiusMiles) : null,
        travelFeeEnabled: travelFeeEnabled === true || travelFeeEnabled === 'true',
        travelFeePerMile: travelFeePerMile ? parseFloat(travelFeePerMile) : null,
        maxTravelMinutes: maxTravelMinutes ? parseInt(maxTravelMinutes, 10) : null,
      },
      select: {
        id: true,
        serviceAddress: true,
        serviceLat: true,
        serviceLng: true,
        serviceRadiusMiles: true,
        travelFeeEnabled: true,
        travelFeePerMile: true,
        maxTravelMinutes: true,
      },
    });

    res.json({ success: true, data: updated });
  } catch (e: any) {
    console.error('Update service area error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/v1/service-area/geocode ──
// Geocode an address for the service area
router.post('/geocode', async (req: AuthRequest, res: Response) => {
  try {
    const { address } = req.body;
    if (!address) {
      return res.status(400).json({ success: false, error: 'address required' });
    }

    const result = await geoService.geocodeAddress(address);
    res.json({ success: true, data: result });
  } catch (e: any) {
    console.error('Geocode error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/v1/service-area/autocomplete ──
// Autocomplete address suggestions
router.post('/autocomplete', async (req: AuthRequest, res: Response) => {
  try {
    const { input, businessId } = req.body;
    if (!input) {
      return res.status(400).json({ success: false, error: 'input required' });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId || req.user?.businessId },
      select: { serviceLat: true, serviceLng: true },
    });

    const results = await geoService.autocompleteAddress(input, {
      bias: business?.serviceLat && business?.serviceLng ? { lat: business.serviceLat, lng: business.serviceLng } : undefined,
      limit: 5,
    });

    res.json({ success: true, data: results });
  } catch (e: any) {
    console.error('Autocomplete error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/v1/service-area/map ──
// Get static map URL for the service area
router.get('/map', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.query.businessId as string || req.user?.businessId;
    if (!businessId) {
      return res.status(400).json({ success: false, error: 'businessId required' });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { serviceLat: true, serviceLng: true, serviceRadiusMiles: true, serviceAddress: true },
    });

    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found' });
    }

    if (!business.serviceLat || !business.serviceLng) {
      return res.status(400).json({ success: false, error: 'Service area not configured' });
    }

    const mapUrl = await geoService.getStaticMapUrl({
      center: { lat: business.serviceLat, lng: business.serviceLng },
      zoom: 11,
      width: 600,
      height: 400,
      markers: [
        { lat: business.serviceLat, lng: business.serviceLng, color: 'C97B5B', icon: 'building' },
      ],
    });

    res.json({ success: true, data: { mapUrl, radiusMiles: business.serviceRadiusMiles || 25 } });
  } catch (e: any) {
    console.error('Service area map error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;