import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { authenticate } from '../middleware/auth.middleware';

const prisma = new PrismaClient();
const router = Router();

// ── Business Import Service ────────────────────────────────────────────────
// Pulls real business data from Google Places API and OpenStreetMap

const GOOGLE_PLACES_API = 'https://maps.googleapis.com/maps/api/place';

interface GooglePlace {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: { lat: number; lng: number };
  };
  rating?: number;
  user_ratings_total?: number;
  formatted_phone_number?: string;
  website?: string;
  opening_hours?: { weekday_text: string[] };
  photos?: { photo_reference: string }[];
  types: string[];
  price_level?: number;
}

interface GooglePlaceDetail {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: { location: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
  formatted_phone_number?: string;
  website?: string;
  opening_hours?: { weekday_text: string[] };
  photos?: { photo_reference: string }[];
  types: string[];
  price_level?: number;
  international_phone_number?: string;
}

// Map Google Places types to our business categories
function mapGoogleTypeToCategory(types: string[]): any {
  if (types.includes('restaurant') || types.includes('food')) return 'RESTAURANT';
  if (types.includes('cafe') || types.includes('bakery')) return 'RESTAURANT';
  if (types.includes('bar') || types.includes('night_club')) return 'RESTAURANT';
  if (types.includes('salon') || types.includes('beauty_salon')) return 'SALON';
  if (types.includes('spa') || types.includes('health')) return 'SPA';
  if (types.includes('hospital') || types.includes('doctor') || types.includes('dentist') || types.includes('clinic')) return 'CLINIC';
  if (types.includes('gym') || types.includes('fitness')) return 'FITNESS_CENTER';
  if (types.includes('hotel') || types.includes('lodging')) return 'HOTEL';
  if (types.includes('store') || types.includes('shopping_mall')) return 'EVENT_VENUE';
  return 'RESTAURANT';
}

// Get photo URL from Google Places photo reference
function getPhotoUrl(photoReference: string): string {
  return `${GOOGLE_PLACES_API}/photo?maxwidth=800&photoreference=${photoReference}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
}

// ── Search and Import Businesses ──────────────────────────────────────────

// POST /api/v1/businesses/import/search
// Search for businesses via Google Places and import them
router.post('/import/search', authenticate, async (req: any, res: Response) => {
  try {
    const { query, location, radius = 5000, type } = req.body;
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: 'GOOGLE_PLACES_API_KEY not configured' });
    }

    if (!query && !location) {
      return res.status(400).json({ error: 'query or location required' });
    }

    // Build search query
    let searchQuery = query || 'restaurants';
    if (location) {
      searchQuery += ` in ${location}`;
    }

    // Search Google Places
    const searchUrl = `${GOOGLE_PLACES_API}/textsearch/json`;
    const searchRes = await axios.get(searchUrl, {
      params: {
        query: searchQuery,
        key: apiKey,
        type: type || 'restaurant',
      },
    });

    const results = searchRes.data.results || [];
    
    // Import each result
    const imported = [];
    for (const place of results.slice(0, 10)) {
      const existing = await prisma.business.findFirst({
        where: { googlePlaceId: place.place_id },
      });

      if (!existing) {
        const business = await prisma.business.create({
          data: {
            googlePlaceId: place.place_id,
            name: place.name,
            address: place.formatted_address,
            latitude: place.geometry?.location?.lat || 0,
            longitude: place.geometry?.location?.lng || 0,
            rating: place.rating || 0,
            reviewCount: place.user_ratings_total || 0,
            category: mapGoogleTypeToCategory(place.types || []),
            coverImageUrl: place.photos?.[0] ? getPhotoUrl(place.photos[0].photo_reference) : null,
            isActive: true,
            isClaimed: false,
          },
        });
        imported.push(business);
      }
    }

    res.json({
      success: true,
      data: {
        found: results.length,
        imported: imported.length,
        businesses: imported,
      },
    });
  } catch (e: any) {
    console.error('[BusinessImport] Search failed:', e.message);
    res.status(500).json({ error: 'Import search failed', message: e.message });
  }
});

// POST /api/v1/businesses/import/place
// Import a specific business by Google Place ID
router.post('/import/place', authenticate, async (req: any, res: Response) => {
  try {
    const { placeId } = req.body;
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: 'GOOGLE_PLACES_API_KEY not configured' });
    }

    if (!placeId) {
      return res.status(400).json({ error: 'placeId required' });
    }

    // Check if already imported
    const existing = await prisma.business.findFirst({
      where: { googlePlaceId: placeId },
    });

    if (existing) {
      return res.json({ success: true, data: existing, alreadyImported: true });
    }

    // Get place details from Google
    const detailUrl = `${GOOGLE_PLACES_API}/details/json`;
    const detailRes = await axios.get(detailUrl, {
      params: {
        place_id: placeId,
        key: apiKey,
        fields: 'place_id,name,formatted_address,geometry,rating,user_ratings_total,formatted_phone_number,website,opening_hours,photos,types,price_level,international_phone_number',
      },
    });

    const place = detailRes.data.result;
    if (!place) {
      return res.status(404).json({ error: 'Place not found' });
    }

    // Create business record
    const business = await prisma.business.create({
      data: {
        googlePlaceId: place.place_id,
        name: place.name,
        address: place.formatted_address,
        latitude: place.geometry?.location?.lat || 0,
        longitude: place.geometry?.location?.lng || 0,
        rating: place.rating || 0,
        reviewCount: place.user_ratings_total || 0,
        phone: place.formatted_phone_number || place.international_phone_number,
        website: place.website,
        category: mapGoogleTypeToCategory(place.types || []),
        coverImageUrl: place.photos?.[0] ? getPhotoUrl(place.photos[0].photo_reference) : null,
        isActive: true,
        isClaimed: false,
      },
    });

    res.json({ success: true, data: business, imported: true });
  } catch (e: any) {
    console.error('[BusinessImport] Place import failed:', e.message);
    res.status(500).json({ error: 'Import failed', message: e.message });
  }
});

// POST /api/v1/businesses/import/bulk
// Bulk import businesses from Google Places (admin only)
router.post('/import/bulk', authenticate, async (req: any, res: Response) => {
  try {
    const { cities = ['New York', 'Los Angeles', 'Chicago'], type = 'restaurant' } = req.body;
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: 'GOOGLE_PLACES_API_KEY not configured' });
    }

    let totalImported = 0;
    const errors: string[] = [];

    for (const city of cities) {
      try {
        // Search for businesses in this city
        const searchUrl = `${GOOGLE_PLACES_API}/textsearch/json`;
        const searchRes = await axios.get(searchUrl, {
          params: {
            query: `${type} in ${city}`,
            key: apiKey,
            type,
          },
        });

        const results = searchRes.data.results || [];

        for (const place of results.slice(0, 5)) {
          const existing = await prisma.business.findFirst({
            where: { googlePlaceId: place.place_id },
          });

          if (!existing) {
            await prisma.business.create({
              data: {
                googlePlaceId: place.place_id,
                name: place.name,
                address: place.formatted_address,
                city,
                latitude: place.geometry?.location?.lat || 0,
                longitude: place.geometry?.location?.lng || 0,
                rating: place.rating || 0,
                reviewCount: place.user_ratings_total || 0,
                category: mapGoogleTypeToCategory(place.types || []),
                coverImageUrl: place.photos?.[0] ? getPhotoUrl(place.photos[0].photo_reference) : null,
                isActive: true,
                isClaimed: false,
              },
            });
            totalImported++;
          }
        }
      } catch (cityErr: any) {
        errors.push(`${city}: ${cityErr.message}`);
      }
    }

    res.json({
      success: true,
      data: {
        totalImported,
        errors,
      },
    });
  } catch (e: any) {
    console.error('[BusinessImport] Bulk import failed:', e.message);
    res.status(500).json({ error: 'Bulk import failed', message: e.message });
  }
});

// GET /api/v1/businesses/import/status
// Get import status / stats
router.get('/import/status', authenticate, async (req: any, res: Response) => {
  try {
    const [total, claimed, unclaimed] = await Promise.all([
      prisma.business.count(),
      prisma.business.count({ where: { isClaimed: true } }),
      prisma.business.count({ where: { isClaimed: false } }),
    ]);

    res.json({
      success: true,
      data: {
        totalBusinesses: total,
        claimed,
        unclaimed,
        googleApiKeyConfigured: !!process.env.GOOGLE_PLACES_API_KEY,
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get status' });
  }
});

export default router;
