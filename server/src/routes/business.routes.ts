import { Router } from 'express';
import {
  createBusiness,
  getBusiness,
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
  connectChannex
} from '../controllers/business.controller';
import { authenticate, authorize, optionalAuthenticate } from '../middleware/auth.middleware';
import { rateLimiter } from '../middleware/rateLimiter';
import { cacheService } from '../services/cache.service';
import axios from 'axios';

const router = Router();

// Public route to get businesses for the homepage/search
// HARDENED: Rate limited to prevent scraping
router.get('/', rateLimiter, async (req, res, next) => {
  try {
    const { prisma } = await import('../utils/database');
    const { googlePlaceId, category, search, latitude, longitude } = req.query;

    let osmResults: any[] = [];
    let locationIqPOIs: any[] = []; // Direct POI results from LocationIQ
    
    // HARDENED: Sanitize search string to prevent malformed queries
    const cleanSearch = search ? String(search).replace(/[^\w\s-]/gi, '').trim() : '';

    let lat = latitude ? parseFloat(String(latitude)) : null;
    let lng = longitude ? parseFloat(String(longitude)) : null;
    let extractedCity = '';
    let searchKeyword = cleanSearch;

    // === STEP 1: LocationIQ Search (finds both places AND businesses/POIs) ===
    if (cleanSearch) {
      try {
        const locationIqKey = process.env.LOCATIONIQ_API_KEY;
        if (locationIqKey) {
          const geoRes = await axios.get(`https://us1.locationiq.com/v1/search.php`, {
            params: {
              key: locationIqKey,
              q: cleanSearch,
              format: 'json',
              addressdetails: 1,
              limit: 10 // Get multiple results to capture POIs
            },
            timeout: 5000
          });
          
          if (geoRes.data && geoRes.data.length > 0) {
            // Use the first result for coordinates if we don't have any
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

            // Collect POI results from LocationIQ
            // LocationIQ often returns null for class/type, so we match by display_name instead
            const searchLower = cleanSearch.toLowerCase();
            const searchWords = searchLower.split(/\s+/).filter(w => w.length > 2);
            for (const result of geoRes.data) {
              if (!result.display_name) continue;
              const displayLower = result.display_name.toLowerCase();
              // Include result if its name contains any meaningful search word (not city names)
              const nameMatchesSearch = searchWords.some(word => {
                // Skip words that are just city/location names we already extracted
                if (extractedCity && word.toLowerCase() === extractedCity.toLowerCase()) return false;
                return displayLower.includes(word);
              });
              // Also include if it's a known POI type
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
        }
      } catch (err: any) {
        console.warn('LocationIQ search failed:', err.message);
      }
    }

    // === STEP 2: Overpass API search (OSM data around coordinates) ===
    const cacheKey = `osm_search:${cleanSearch}:${lat || 'null'}:${lng || 'null'}:${category || 'ALL'}`;
    const cachedOsmResults = cacheService.get(cacheKey);

    if (cachedOsmResults) {
      osmResults = cachedOsmResults;
    } else {
      let overpassQuery = '';
      if (lat && lng) {
        
        if (searchKeyword && searchKeyword.length > 2) {
          const cleanCategoryKeyword = searchKeyword.replace(/\b(food|restaurant|cafe|place|shop|parlor|store|center|centre|studio|bar|grill|spa|salon)\b/gi, '').trim() || searchKeyword;

          // Make name regex tolerant of apostrophes/special chars: "giordanos" -> "giordano.?s"
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
          // Nearby search without specific name, using category
          let typeFilter = 'node["amenity"~"restaurant|cafe|clinic|hospital|fast_food|food_court|bar"]';
          if (category === 'SALON') typeFilter = 'node["shop"~"beauty|hairdresser"]';
          else if (category === 'SPA') typeFilter = 'node["shop"~"massage|beauty|wellness"]';
          else if (category === 'CLINIC') typeFilter = 'node["amenity"~"clinic|hospital|doctor|dentist"]';
          else if (category === 'FITNESS_CENTER') typeFilter = 'node["leisure"~"fitness_centre|sports_centre"]';
          else if (category === 'RESTAURANT') typeFilter = 'node["amenity"~"restaurant|cafe|fast_food|food_court"]';
          
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
          const places = overpassRes.data?.elements || [];
          osmResults = osmResults.concat(places);
        } catch (err: any) {
          console.warn('Overpass search failed (Fallback to local DB):', err.message);
        }
      }

      if (osmResults.length > 0) {
        cacheService.set(cacheKey, osmResults);
      }
    }
    


    // === STEP 3: Prisma DB search (use ORIGINAL cleanSearch, not just searchKeyword) ===
    const where: any = { isActive: true };
    if (googlePlaceId) {
      where.googlePlaceId = String(googlePlaceId);
    }
    if (category && category !== 'ALL') {
      where.category = String(category);
    }
    // Use cleanSearch for DB query so "giordanos" still matches even after city extraction
    const dbSearchTerm = cleanSearch || searchKeyword;
    if (dbSearchTerm) {
      const searchTerms = String(dbSearchTerm)
        .trim()
        .split(/\s+/)
        .filter(term => term.length > 0);
        
      if (searchTerms.length > 0) {
        // Use AND: ALL search terms must match (each term can match any field)
        where.AND = searchTerms.map(term => ({
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
            { address: { contains: term, mode: 'insensitive' } },
            { city: { contains: term, mode: 'insensitive' } }
          ]
        }));
      }
    }
    
    const dbBusinesses = await prisma.business.findMany({ 
      where,
      include: {
        googleReviews: true,
        settings: true
      }
    });

    const mergedBusinesses = [...dbBusinesses];
    const seenIds = new Set(mergedBusinesses.map(b => b.googlePlaceId));

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

// Publicly accessible business routes (with optional auth)
router.get('/slug/:slug', optionalAuthenticate, getBusinessBySlug);
router.get('/:id', optionalAuthenticate, getBusiness);
router.get('/:id/reviews', optionalAuthenticate, getBusinessReviews);
router.get('/:id/services', optionalAuthenticate, getBusinessServices);

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

// Business Services Management
router.post('/:id/services', authorize('BUSINESS_OWNER', 'ADMIN'), createBusinessService);
router.put('/:id/services/:serviceId', authorize('BUSINESS_OWNER', 'ADMIN'), updateBusinessService);
router.delete('/:id/services/:serviceId', authorize('BUSINESS_OWNER', 'ADMIN'), deleteBusinessService);

export default router;
