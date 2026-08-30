import { Router } from 'express';
import {
  createBusiness,
  getBusiness,
  getBusinessFull,
  updateBusiness,
  getBusinessReservations,
  getBusinessAnalytics,
  getBusinessReviews,
  claimBusiness,
  getBusinessCustomers,
  generateBookingLink,
  getBusinessBySlug,
  getBusinessServices,
  createBusinessService,
  updateBusinessService,
  deleteBusinessService,
  connectChannex,
  generateApiKey,
  getApiKeys,
  connectStripe,
  requestPayout,
  getPayoutStatus
} from '../controllers/business.controller';
import { authenticate, authorize, optionalAuthenticate } from '../middleware/auth.middleware';
import { rateLimiter } from '../middleware/rateLimiter';
import { cacheService } from '../services/cache.service';
import axios from 'axios';

const router = Router();

// ── Geocode backfill (one-time data fix): fill null lat/lng from city ──
// Guarded by ?key= so it is not an open write endpoint. Geocodes by CITY NAME ALONE
// (the stored `country` field is corrupt — every business says "United States" even
// Karachi/Lahore). Querying the city alone lets Nominatim pick the prominent
// international city, not a same-named US township.
// Modes:
//   ?sync=1&max=N&offset=M  -> process a batch INLINE and return results+errors (debuggable)
//   ?force=1                -> background reprocess ALL businesses (overwrites bad coords)
//   (no sync/force)         -> background process only null-coord businesses
router.post('/geocode-backfill', async (req, res) => {
  const KEY = process.env.GEOCODE_BACKFILL_KEY || 'pabandi-geocode-2026';
  if (req.query.key !== KEY) return res.status(401).json({ success: false, error: 'unauthorized' });
  const { prisma } = await import('../utils/database');
  const force = req.query.force === '1';
  const sync = req.query.sync === '1';
  const max = Math.min(parseInt(String(req.query.max ?? '25'), 10) || 25, 50);
  const offset = parseInt(String(req.query.offset ?? '0'), 10) || 0;
  const where = force ? {} : { OR: [{ latitude: null }, { longitude: null }] };
  const due = await prisma.business.findMany({ where, skip: offset, take: sync ? max : undefined });

  const processOne = async (b: any) => {
    const q = [b.city, b.state].filter(Boolean).join(', ');
    if (!q) return { id: b.id, name: b.name, status: 'skip-no-city' };
    let hit = null, lastErr: any = null;
    for (let attempt = 0; attempt < 3 && !hit; attempt++) {
      try {
        const r = await axios.get('https://nominatim.openstreetmap.org/search', {
          params: { q, format: 'json', limit: 1 },
          headers: { 'User-Agent': 'Pabandi/1.0 (contact@pabandi.com)' },
          timeout: 12000,
        });
        hit = r.data?.[0];
      } catch (e) { lastErr = String(e).slice(0, 120); await new Promise((r) => setTimeout(r, 2000 * (attempt + 1))); }
    }
    if (hit?.lat && hit?.lon) {
      await prisma.business.update({
        where: { id: b.id },
        data: { latitude: parseFloat(hit.lat), longitude: parseFloat(hit.lon) },
      });
      return { id: b.id, name: b.name, city: b.city, lat: parseFloat(hit.lat), lon: parseFloat(hit.lon) };
    }
    return { id: b.id, name: b.name, city: b.city, status: 'no-hit', err: lastErr };
  };

  if (sync) {
    const results = [];
    for (const b of due) {
      results.push(await processOne(b));
      await new Promise((r) => setTimeout(r, 1200)); // Nominatim: 1 req/s
    }
    return res.json({ success: true, processed: results.length, results });
  }

  // background mode
  res.status(202).json({ success: true, message: 'geocode backfill started in background', total: due.length });
  (async () => {
    let done = 0, failed = 0;
    for (const b of due) {
      const r = await processOne(b);
      if (r.status) failed++; else done++;
      await new Promise((rr) => setTimeout(rr, 1200));
    }
    console.log(`[geocode-backfill] done=${done} failed=${failed} of ${due.length}`);
  })();
});

// Public route to get businesses for the homepage/search
// HARDENED: Rate limited to prevent scraping
router.get('/', rateLimiter, async (req, res, next) => {
  try {
    const { prisma } = await import('../utils/database');
    const { category, search, latitude, longitude, googlePlaceId } = req.query;

    // HARDENED: Sanitize search string to prevent malformed queries
    const cleanSearch = search ? String(search).replace(/[^\w\s-]/gi, '').trim() : '';

    // === STEP 0: Exact googlePlaceId lookup (used by NewReservationPage) ===
    // If a specific place was selected, try to resolve it directly in the DB first.
    if (googlePlaceId && String(googlePlaceId)) {
      const existing = await prisma.business.findFirst({
        where: { OR: [{ googlePlaceId: String(googlePlaceId) }, { externalId: String(googlePlaceId) }, { id: String(googlePlaceId) }] },
        include: { googleReviews: true, settings: true },
      });
      if (existing) {
        return res.json({ success: true, data: { businesses: [existing] } });
      }
      // No exact match — fall through to the directory/live lookup so it's never empty.
    }

    let locationIqPOIs: any[] = []; // Supplemental live-site source
    let osmResults: any[] = [];
    const mergedBusinesses: any[] = [];
    const seenIds = new Set<string>();

    // === STEP 1: Seeded DB fallback-first search (claimed + OSM imports) ===
    // We query local DB first so search/map never looks empty, even if live APIs fail.
    {
      const dbWhereCat: any = { isActive: true };
      if (category && category !== 'ALL') {
        dbWhereCat.category = String(category);
      }

      // Real DB-level text search (open-source Postgres `contains`, no external API).
      // When the user typed something, we filter at the database layer by name /
      // description / city / address so genuine matches rank first.
      // NOTE: `category` is a Prisma ENUM — `contains`/insensitive is unsupported on
      // enums, so category matching stays as an exact filter (handled above).
      if (cleanSearch) {
        const terms = String(cleanSearch).trim().split(/\s+/).filter((t) => t.length > 1);
        if (terms.length > 0) {
          dbWhereCat.OR = terms.map((t) => ({
            OR: [
              { name: { contains: t, mode: 'insensitive' } },
              { description: { contains: t, mode: 'insensitive' } },
              { city: { contains: t, mode: 'insensitive' } },
              { address: { contains: t, mode: 'insensitive' } },
            ],
          }));
        }
      }

      // Fetch active businesses matching the text/category filters (capped). If a
      // specific query matched nothing, we keep the query result empty and let the
      // live OSM/Nominatim sources + the directory fallback below fill it in.
      const allSeeded = await prisma.business.findMany({
        where: dbWhereCat,
        include: { googleReviews: true, settings: true },
        orderBy: { createdAt: 'desc' },
        take: 120,
      });

      let seeded = allSeeded;
      // Pure-browse fallback: when there is NO search term at all and we somehow got
      // nothing, show the full active directory rather than a blank page.
      if (!cleanSearch && allSeeded.length === 0) {
        const fallback = await prisma.business.findMany({
          where: { isActive: true },
          include: { googleReviews: true, settings: true },
          orderBy: { createdAt: 'desc' },
          take: 120,
        });
        seeded = fallback;
      }

      for (const b of seeded) {
        const key = b.externalId || b.googlePlaceId || b.id;
        if (seenIds.has(key)) continue;
        seenIds.add(key);
        mergedBusinesses.push(b);
      }
    }

    // Only skip the live (LocationIQ/Overpass) lookups when there is NO specific
    // query (pure browse-all) and the local directory already has enough results.
    // Any real search term or placeId must always go to the live sources so the
    // user actually gets matches for what they typed (this is what made searches
    // appear to "always show no results" / the wrong generic list).
    const hasSpecificQuery = !!cleanSearch || !!googlePlaceId;
    const shouldSkipLiveLookups = !hasSpecificQuery && mergedBusinesses.length >= 12;

    let lat = latitude ? parseFloat(String(latitude)) : null;
    let lng = longitude ? parseFloat(String(longitude)) : null;
    let extractedCity = '';
    let searchKeyword = cleanSearch;

    // If DB didn't satisfy the request, use live APIs to augment results.
    if (!shouldSkipLiveLookups) {
      // Public search fallback: when no explicit query/coords/category are provided,
      // prefer returning nearby sites from LocationIQ so map/search never looks empty.
      const hasQuery = cleanSearch || latitude || longitude || (category && category !== 'ALL');
      const liveSiteQuery = cleanSearch || 'restaurants,cafes,hotels,salons,clinics,gyms,nightclubs,bars';

      if (!hasQuery) {
        // Open-source geocoder (OpenStreetMap Nominatim) — no API key, no cost.
        // Only enrich when we have no coords yet; failures are non-fatal.
        try {
          const geoRes = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: { q: liveSiteQuery, format: 'json', addressdetails: 1, limit: 50 },
            headers: { 'User-Agent': 'PabandiApp/1.0 (contact@pabandi.app)' },
            timeout: 5000,
          });
          if (geoRes.data && geoRes.data.length > 0) {
            locationIqPOIs = geoRes.data;
          }
        } catch (err: any) {
          console.warn('Live-site Nominatim fallback failed:', err.message);
        }
      }

      // Seed coordinates from live-site result if still missing
      if ((lat == null || lng == null) && locationIqPOIs.length > 0) {
        const bestMatch = locationIqPOIs[0];
        lat = parseFloat(bestMatch.lat) || lat;
        lng = parseFloat(bestMatch.lon) || lng;
      }

      // === STEP 2: LocationIQ Search ===
      if (cleanSearch) {
        try {
            const geoRes = await axios.get('https://nominatim.openstreetmap.org/search', {
              params: { q: cleanSearch, format: 'json', addressdetails: 1, limit: 10 },
              headers: { 'User-Agent': 'PabandiApp/1.0 (contact@pabandi.app)' },
              timeout: 5000,
            });

            if (geoRes.data && geoRes.data.length > 0) {
              if (!lat && !lng) {
                const bestMatch = geoRes.data[0];
                lat = parseFloat(bestMatch.lat);
                lng = parseFloat(bestMatch.lon);

                const address = bestMatch.address || {};
                extractedCity = address.city || address.town || address.village || address.county || '';

                if (extractedCity) {
                  const regex = new RegExp(`\\b${extractedCity}\\b`, 'i');
                  searchKeyword = cleanSearch.replace(regex, '').trim();
                }
              }

              const searchLower = cleanSearch.toLowerCase();
              const searchWords = searchLower.split(/\s+/).filter(w => w.length > 2);
              for (const result of geoRes.data) {
                if (!result.display_name) continue;
                const displayLower = result.display_name.toLowerCase();
                const nameMatchesSearch = searchWords.some(word => {
                  if (extractedCity && word.toLowerCase() === extractedCity.toLowerCase()) return false;
                  return displayLower.includes(word);
                });
                const rClass = result.class || '';
                const rType = result.type || '';
                const isKnownPOI = ['amenity', 'shop', 'leisure', 'tourism', 'craft'].includes(rClass) ||
                                  ['restaurant', 'cafe', 'fast_food', 'bar', 'beauty', 'hairdresser', 'massage',
                                   'clinic', 'hospital', 'gym', 'fitness_centre', 'spa'].includes(rType);
                if (nameMatchesSearch || isKnownPOI) {
                  locationIqPOIs.push(result);
                }
              }
            }
        } catch (err: any) {
          console.warn('Nominatim search failed:', err.message);
        }
      }

      // === STEP 3: Overpass API search ===
      const cacheKey = `osm_search:${cleanSearch}:${lat || 'null'}:${lng || 'null'}:${category || 'ALL'}`;
      const cachedOsmResults = cacheService.get(cacheKey);

      if (cachedOsmResults) {
        osmResults = cachedOsmResults;
      } else {
        let overpassQuery = '';
        if (lat && lng) {
          if (searchKeyword && searchKeyword.length > 2) {
            const cleanCategoryKeyword = searchKeyword.replace(/\b(food|restaurant|cafe|place|shop|parlor|store|center|centre|studio|bar|grill|spa|salon)\b/gi, '').trim() || searchKeyword;
            const flexibleNameRegex = searchKeyword.split('').join('.?');

            overpassQuery = `
              [out:json][timeout:10];
              (
                node["name"~"${flexibleNameRegex}",i]["amenity"](around:50000,${lat},${lng});
                node["name"~"${flexibleNameRegex}",i]["shop"](around:50000,${lat},${lng});
                node["name"~"${flexibleNameRegex}",i]["leisure"](around:50000,${lat},${lng});
                node["cuisine"~"${cleanCategoryKeyword}",i]["amenity"](around:50000,${lat},${lng});
                node["shop"~"${cleanCategoryKeyword}",i](around:50000,${lat},${lng});
                node["amenity"~"${cleanCategoryKeyword}",i](around:50000,${lat},${lng});
                node["leisure"~"${cleanCategoryKeyword}",i](around:50000,${lat},${lng});
              );
              out center 20;
            `;
          } else if (!searchKeyword) {
            let typeFilter = 'node["amenity"~"restaurant|cafe|clinic|hospital|fast_food|food_court|bar"]';
            if (category === 'SALON') typeFilter = 'node["shop"~"beauty|hairdresser"]';
            else if (category === 'SPA') typeFilter = 'node["shop"~"massage|beauty|wellness"]';
            else if (category === 'CLINIC') typeFilter = 'node["amenity"~"clinic|hospital|doctor|dentist"]';
            else if (category === 'FITNESS_CENTER') typeFilter = 'node["leisure"~"fitness_centre|sports_centre"]';
            else if (category === 'RESTAURANT') typeFilter = 'node["amenity"~"restaurant|cafe|fast_food|food_court"]';
            else if (category === 'LIVE_SELLER') typeFilter = 'node["shop"~"electronics|clothes|fashion|general"]';
            else if (category === 'FREELANCE') typeFilter = 'node["amenity"]["office"]["shop"]';

            overpassQuery = `
              [out:json][timeout:10];
              (
                ${typeFilter}(around:10000,${lat},${lng});
              );
              out center 25;
            `;
          }
        }

        if (overpassQuery) {
          try {
            const overpassUrl = 'https://overpass-api.de/api/interpreter';
            const overpassRes = await axios.post(overpassUrl, `data=${encodeURIComponent(overpassQuery)}`, {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'PabandiApp/1.0 (contact@pabandi.app)'
              },
              timeout: 10000
            });
            osmResults = (overpassRes.data?.elements || []).filter((el: any) => !!el.id);
          } catch (err: any) {
            console.warn('Overpass search failed (Fallback to local DB):', err.message);
          }
        }

        if (osmResults.length > 0) {
          cacheService.set(cacheKey, osmResults);
        }
      }
    }

    // === STEP 4: Merge LocationIQ POI results ===
    for (const poi of locationIqPOIs) {
      const poiId = (poi.osm_id && poi.osm_type) ? `osm-${poi.osm_type}-${poi.osm_id}` : `liq-${poi.place_id}`;
      if (seenIds.has(poiId)) continue;
      seenIds.add(poiId);

      const addr = poi.address || {};
      const rType = poi.type || '';
      let mappedCat: any = 'RESTAURANT';
      if (['beauty', 'hairdresser'].includes(rType)) mappedCat = 'SALON';
      else if (['massage'].includes(rType)) mappedCat = 'SPA';
      else if (['clinic', 'hospital', 'doctor', 'dentist'].includes(rType)) mappedCat = 'CLINIC';
      else if (['gym', 'fitness_centre', 'sports_centre'].includes(rType)) mappedCat = 'FITNESS_CENTER';

      if (category && category !== 'ALL' && mappedCat !== String(category)) continue;

      const city = addr.city || addr.town || addr.village || extractedCity || 'Unknown City';
      const displayName = poi.display_name || '';
      const nameParts = displayName.split(',');
      const name = nameParts[0]?.trim() || 'Unknown Business';
      const address = nameParts.slice(1, 3).join(',').trim() || displayName;

      let coverImageUrl = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1200';
      if (mappedCat === 'SALON') coverImageUrl = 'https://images.unsplash.com/photo-1600948836101-f9ffda59d250?auto=format&fit=crop&q=80&w=800';
      if (mappedCat === 'SPA') coverImageUrl = 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&q=80&w=800';
      if (mappedCat === 'FITNESS_CENTER') coverImageUrl = 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=800';
      if (mappedCat === 'CLINIC') coverImageUrl = 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&q=80&w=800';

      mergedBusinesses.push({
        id: poiId,
        googlePlaceId: poiId,
        name,
        description: `Found via Pabandi search. Claim this profile to set up Web3 bookings.`,
        category: mappedCat,
        address,
        city,
        phone: '+92 300 0000000',
        email: 'contact@pabandi.com',
        website: null,
        coverImageUrl,
        rating: 4.5,
        reviewCount: 0,
        isVerified: false,
        isClaimed: false,
        isActive: true,
        latitude: parseFloat(poi.lat) || 0,
        longitude: parseFloat(poi.lon) || 0,
        googleReviews: []
      } as any);
    }

    // === STEP 5: Merge Overpass/OSM results ===
    for (const el of osmResults) {
      if (!el.id) continue;
      const osmId = `osm-${el.type || 'node'}-${el.id}`;
      if (seenIds.has(osmId)) continue;
      seenIds.add(osmId);

      const tags = el.tags || {};
      let mappedCat: any = 'RESTAURANT';
      if (tags.shop === 'beauty' || tags.shop === 'hairdresser' || tags.amenity === 'hairdresser') mappedCat = 'SALON';
      else if (tags.shop === 'massage') mappedCat = 'SPA';
      else if (tags.amenity === 'clinic' || tags.amenity === 'hospital' || tags.amenity === 'doctor') mappedCat = 'CLINIC';
      else if (tags.leisure === 'fitness_centre' || tags.amenity === 'gym') mappedCat = 'FITNESS_CENTER';

      if (category && category !== 'ALL' && mappedCat !== String(category)) {
        continue;
      }

      const address = tags['addr:full'] || tags['addr:street'] || tags.display_name || '';
      const addressLower = address.toLowerCase();
      let city = extractedCity || 'Unknown City';
      if (!extractedCity && addressLower) {
        if (addressLower.includes('lahore')) city = 'Lahore';
        else if (addressLower.includes('islamabad')) city = 'Islamabad';
        else if (addressLower.includes('rawalpindi')) city = 'Rawalpindi';
        else if (addressLower.includes('faisalabad')) city = 'Faisalabad';
        else if (addressLower.includes('multan')) city = 'Multan';
        else if (addressLower.includes('peshawar')) city = 'Peshawar';
        else if (addressLower.includes('quetta')) city = 'Quetta';
        else if (addressLower.includes('karachi')) city = 'Karachi';
        else if (addressLower.includes('chicago')) city = 'Chicago';
        else if (addressLower.includes('new york')) city = 'New York';
        else if (addressLower.includes('london')) city = 'London';
      }

      let coverImageUrl = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1200';
      if (mappedCat === 'SALON') coverImageUrl = 'https://images.unsplash.com/photo-1600948836101-f9ffda59d250?auto=format&fit=crop&q=80&w=800';
      if (mappedCat === 'SPA') coverImageUrl = 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&q=80&w=800';
      if (mappedCat === 'FITNESS_CENTER') coverImageUrl = 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=800';
      if (mappedCat === 'CLINIC') coverImageUrl = 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&q=80&w=800';

      const name = tags.name || 'Unknown Business';

      mergedBusinesses.push({
        id: osmId,
        googlePlaceId: osmId,
        name: name,
        description: `Imported OpenStreetMap listing for ${name}. Claim this profile to set up Web3 bookings.`,
        category: mappedCat,
        address: address,
        city: city,
        phone: tags.phone || 'Contact via app',
        email: 'contact@pabandi.com',
        website: tags.website || null,
        coverImageUrl: coverImageUrl,
        rating: 4.5,
        reviewCount: 1,
        isVerified: false,
        isClaimed: false,
        isActive: true,
        latitude: el.lat || null,
        longitude: el.lon || null,
        googleReviews: []
      } as any);
    }

    // If user location was provided, sort by proximity
    if (lat != null && lng != null) {
      const toRad = (v: number) => (v * Math.PI) / 180;
      const R = 6371;
      mergedBusinesses.sort((a: any, b: any) => {
        const aLat = Number(a.latitude);
        const aLng = Number(a.longitude);
        const bLat = Number(b.latitude);
        const bLng = Number(b.longitude);
        if (aLat == null || aLng == null) return 1;
        if (bLat == null || bLng == null) return -1;
        const dLat = toRad(bLat - aLat);
        const dLng = toRad(bLng - aLng);
        const x = Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) *
          Math.sin(dLng / 2) ** 2;
        const d = 2 * R * Math.asin(Math.sqrt(x));
        return d;
      });
    }

    res.json({ success: true, data: { businesses: mergedBusinesses } });
  } catch (error) {
    next(error);
  }
});

// GET /businesses/me — fetch the logged-in owner's business
router.get('/me', authenticate, async (req: any, res, next) => {
  try {
    const { prisma } = await import('../utils/database');
    const business = await prisma.business.findUnique({
      where: { ownerId: req.user.id },
      include: { settings: true, businessHours: true },
    });
    if (!business) {
      return res.json({ success: true, data: { business: null } });
    }
    res.json({ success: true, data: { business } });
  } catch (error) {
    next(error);
  }
});

// Publicly accessible business routes (optional auth)
router.get('/slug/:slug', optionalAuthenticate, getBusinessBySlug);
router.get('/:id/reviews', optionalAuthenticate, getBusinessReviews);
router.get('/:id/services', optionalAuthenticate, getBusinessServices);

// GET /businesses/:id — PUBLIC lookup (sanitized). Powers every profile/booking
// page across the app. Returns owner PII only when the caller owns the business
// or is an admin; everyone else gets a safe public projection.
router.get('/:id', optionalAuthenticate, getBusiness);

// GET /businesses/:id/full — FULL lookup with owner PII. Requires auth.
router.get('/:id/full', authenticate, getBusinessFull);

// All subsequent business routes require authentication
router.use(authenticate);

router.post('/', createBusiness);
router.post('/:id/claim', claimBusiness);
router.put('/:id', authorize('BUSINESS_OWNER', 'ADMIN'), updateBusiness);
router.get('/:id/reservations', getBusinessReservations);
router.get('/:id/analytics', getBusinessAnalytics);
router.get('/:id/customers', getBusinessCustomers);
router.post('/:id/generate-link', generateBookingLink);
router.post('/:id/channex-connect', authorize('BUSINESS_OWNER', 'ADMIN'), connectChannex);
router.post('/:id/stripe-connect', authorize('BUSINESS_OWNER', 'ADMIN'), connectStripe);
router.post('/:id/payouts/raast', authorize('BUSINESS_OWNER', 'ADMIN'), requestPayout);
router.get('/:id/payouts/raast', authorize('BUSINESS_OWNER', 'ADMIN'), getPayoutStatus);

// Business Services Management
router.post('/:id/services', authorize('BUSINESS_OWNER', 'ADMIN'), createBusinessService);
router.put('/:id/services/:serviceId', authorize('BUSINESS_OWNER', 'ADMIN'), updateBusinessService);
router.delete('/:id/services/:serviceId', authorize('BUSINESS_OWNER', 'ADMIN'), deleteBusinessService);

// Developer API Keys Management
router.get('/:id/api-keys', authorize('BUSINESS_OWNER', 'ADMIN'), getApiKeys);
router.post('/:id/api-keys', authorize('BUSINESS_OWNER', 'ADMIN'), generateApiKey);

export default router;
