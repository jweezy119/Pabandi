/**
 * Maps Routes - Geocoding and Location Services
 */

import { Router, Request, Response, NextFunction } from 'express';
import { mapsService } from '../services/maps.service';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import axios from 'axios';

const router = Router();

// =============================================
// Geocode address to coordinates
// GET /api/v1/maps/geocode?address=
// =============================================
router.get('/geocode', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address, q } = req.query;
    const searchAddress = (address || q) as string;
    
    if (!searchAddress) {
      return res.status(400).json({ success: false, error: 'address parameter is required' });
    }

    const results = await mapsService.geocode(searchAddress);
    res.json({ success: true, data: results });
  } catch (error: any) {
    logger.error(`[Maps Routes] Geocode error: ${error.message}`);
    next(error);
  }
});

// =============================================
// Reverse geocode coordinates to address
// GET /api/v1/maps/reverse?lat=&lon=
// =============================================
router.get('/reverse', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lon, lng } = req.query;
    
    if (!lat || (!lon && !lng)) {
      return res.status(400).json({ success: false, error: 'lat and lon/lng parameters are required' });
    }

    const result = await mapsService.reverseGeocode(
      parseFloat(lat as string),
      parseFloat((lon || lng) as string)
    );
    
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error(`[Maps Routes] Reverse error: ${error.message}`);
    next(error);
  }
});

// =============================================
// Find nearby places
// GET /api/v1/maps/nearby?lat=&lon=&category=&radius=
// =============================================
router.get('/nearby', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lon, lng, category, radius, limit } = req.query;
    
    if (!lat || (!lon && !lng)) {
      return res.status(400).json({ success: false, error: 'lat and lon/lng parameters are required' });
    }

    const results = await mapsService.nearby(
      parseFloat(lat as string),
      parseFloat((lon || lng) as string),
      category as string,
      radius ? parseInt(radius as string) : 5000,
      limit ? parseInt(limit as string) : 20
    );
    
    res.json({ success: true, data: results });
  } catch (error: any) {
    logger.error(`[Maps Routes] Nearby error: ${error.message}`);
    next(error);
  }
});

// =============================================
// Calculate travel distance
// GET /api/v1/maps/distance?from=&to=&mode=
// =============================================
router.get('/distance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, to, mode } = req.query;
    
    if (!from || !to) {
      return res.status(400).json({ success: false, error: 'from and to parameters are required' });
    }

    const result = await mapsService.distance(
      from as string,
      to as string,
      (mode as 'driving' | 'walking' | 'cycling') || 'driving'
    );
    
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error(`[Maps Routes] Distance error: ${error.message}`);
    next(error);
  }
});

// =============================================
// Get turn-by-turn directions
// GET /api/v1/maps/directions?from=&to=&mode=
// =============================================
router.get('/directions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, to, mode } = req.query;
    
    if (!from || !to) {
      return res.status(400).json({ success: false, error: 'from and to parameters are required' });
    }

    const result = await mapsService.directions(
      from as string,
      to as string,
      (mode as 'driving' | 'walking' | 'cycling') || 'driving'
    );
    
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error(`[Maps Routes] Directions error: ${error.message}`);
    next(error);
  }
});

// =============================================
// Search businesses in database
// GET /api/v1/maps/businesses?lat=&lng=&category=&radius=
// =============================================
router.get('/businesses', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lng, category, radius } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ success: false, error: 'lat and lng parameters are required' });
    }

    const results = await mapsService.searchNearbyBusinesses(
      parseFloat(lat as string),
      parseFloat(lng as string),
      category as string,
      radius ? parseInt(radius as string) : 5000
    );
    
    res.json({ success: true, data: results });
  } catch (error: any) {
    logger.error(`[Maps Routes] Businesses error: ${error.message}`);
    next(error);
  }
});

// =============================================
// Get timezone for coordinates
// GET /api/v1/maps/timezone?lat=&lng=
// =============================================
router.get('/timezone', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ success: false, error: 'lat and lng parameters are required' });
    }

    const response = await axios.get('https://timeapi.io/api/TimeZone/coordinate', {
      params: { latitude: lat, longitude: lng },
    });

    res.json({
      success: true,
      data: {
        timezone: response.data.timeZone,
        utcOffset: response.data.currentUtcOffset,
        localTime: response.data.time,
      },
    });
  } catch (error: any) {
    logger.error(`[Maps Routes] Timezone error: ${error.message}`);
    next(error);
  }
});

export default router;
