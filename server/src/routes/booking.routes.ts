import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { bookingScraperService } from '../services/bookingScraper.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/booking/search
 * Search for hotels on Booking.com via the scraper API.
 * Body: { query: string, checkin?: string, checkout?: string, adults?: number, rooms?: number, currency?: string, page?: number, sort_by?: string }
 */
router.post('/search', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { query, checkin, checkout, adults, rooms, currency, page, sort_by, price_min, price_max, stars, min_review_score } = req.body || {};
    if (!query) return res.status(400).json({ error: 'query is required' });

    const result = await bookingScraperService.searchHotels({
      query,
      checkin,
      checkout,
      adults,
      rooms,
      currency,
      page,
      sort_by,
      price_min,
      price_max,
      stars,
      min_review_score,
    });

    res.json({ success: true, data: result });
  } catch (e: any) {
    logger.error(`[booking] search failed: ${e.message}`);
    res.status(500).json({ error: 'Search failed', message: e.message });
  }
});

/**
 * POST /api/v1/booking/autocomplete
 * Autocomplete location names to Booking.com destination IDs.
 * Body: { query: string, locale?: string }
 */
router.post('/autocomplete', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { query, locale } = req.body || {};
    if (!query) return res.status(400).json({ error: 'query is required' });

    const result = await bookingScraperService.autocomplete(query, locale);
    res.json({ success: true, data: result });
  } catch (e: any) {
    logger.error(`[booking] autocomplete failed: ${e.message}`);
    res.status(500).json({ error: 'Autocomplete failed', message: e.message });
  }
});

/**
 * POST /api/v1/booking/details
 * Get full hotel details including rooms, facilities, photos, policies.
 * Body: { hotel: string (slug or URL), checkin?: string, checkout?: string, adults?: number, rooms?: number, currency?: string }
 */
router.post('/details', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { hotel, checkin, checkout, adults, rooms, currency, locale } = req.body || {};
    if (!hotel) return res.status(400).json({ error: 'hotel is required' });

    const result = await bookingScraperService.getHotelDetails(hotel, checkin, checkout, adults, rooms, currency, locale);
    res.json({ success: true, data: result });
  } catch (e: any) {
    logger.error(`[booking] details failed: ${e.message}`);
    res.status(500).json({ error: 'Details failed', message: e.message });
  }
});

/**
 * POST /api/v1/booking/seed
 * Seed hotels from Booking.com into the local database.
 * Body: { cities?: string[] }
 */
router.post('/seed', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { cities } = req.body || {};
    const defaultCities = ['New York', 'Los Angeles', 'Chicago', 'Miami', 'San Francisco'];
    const citiesToSeed = cities || defaultCities;

    // Find or create a default business
    let business = await prisma.business.findFirst({ where: { name: 'Pabandi Hotels' } });
    if (!business) {
      const user = await prisma.user.findFirst();
      if (!user) return res.status(400).json({ error: 'No users found' });
      business = await prisma.business.create({
        data: {
          name: 'Pabandi Hotels',
          ownerId: user.id,
          category: 'PROPERTY_RENTAL',
          address: '123 Main St',
          city: 'New York',
          country: 'United States',
          phone: '+1 555 123 4567',
          email: 'jay@pabandi.com',
          timezone: 'America/New_York',
          currency: 'USD',
        },
      });
    }

    let seeded = 0;
    for (const city of citiesToSeed) {
      try {
        const result = await bookingScraperService.searchHotels({
          query: city,
          checkin: '2026-09-24',
          checkout: '2026-09-26',
          adults: 2,
          rooms: 1,
          currency: 'USD',
          sort_by: 'popularity',
        });

        for (const hotel of result.results || []) {
          const existing = await prisma.property.findFirst({
            where: { title: hotel.name, city: hotel.location.city },
          });
          if (existing) continue;

          await prisma.property.create({
            data: {
              businessId: business.id,
              title: hotel.name,
              description: `${hotel.rating.word} hotel in ${hotel.location.city}. ${hotel.location.distance_from_center}.`,
              address: hotel.location.address,
              city: hotel.location.city,
              country: hotel.location.country_code.toUpperCase(),
              latitude: hotel.location.latitude,
              longitude: hotel.location.longitude,
              pricePerNight: hotel.price.per_night || hotel.price.total / 2,
              currency: hotel.price.currency,
              coverImageUrl: hotel.image,
              isActive: !hotel.is_sold_out,
              slug: `${hotel.page_name}-${hotel.id}`,
            },
          });
          seeded++;
        }
        await new Promise((r) => setTimeout(r, 1000));
      } catch (e: any) {
        logger.warn(`[booking] seed failed for ${city}: ${e.message}`);
      }
    }

    res.json({ success: true, message: `Seeded ${seeded} hotels` });
  } catch (e: any) {
    logger.error(`[booking] seed failed: ${e.message}`);
    res.status(500).json({ error: 'Seed failed', message: e.message });
  }
});

import { prisma } from '../utils/database';

export default router;
