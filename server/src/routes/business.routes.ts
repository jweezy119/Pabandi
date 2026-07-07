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
  deleteBusinessService
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
    
    // HARDENED: Sanitize search string to prevent malformed Nominatim queries
    const cleanSearch = search ? String(search).replace(/[^\w\s-]/gi, '').trim() : '';

    let lat = latitude ? parseFloat(String(latitude)) : null;
    let lng = longitude ? parseFloat(String(longitude)) : null;
    let extractedCity = '';
    let searchKeyword = cleanSearch;

    if (!lat && !lng && cleanSearch) {
      try {
        const googleMapKey = process.env.GOOGLE_MAPS_API_KEY;
        if (googleMapKey) {
          const geoRes = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleanSearch)}&key=${googleMapKey}`);
          if (geoRes.data.status === 'OK' && geoRes.data.results.length > 0) {
            const bestMatch = geoRes.data.results[0];
            lat = bestMatch.geometry.location.lat;
            lng = bestMatch.geometry.location.lng;
            
            const localityObj = bestMatch.address_components.find((c: any) => c.types.includes('locality'));
            if (localityObj) {
              extractedCity = localityObj.long_name;
              const regex = new RegExp(`\\b${extractedCity}\\b`, 'i');
              searchKeyword = cleanSearch.replace(regex, '').trim();
            }
          }
        }
      } catch (err: any) {
        console.warn('Google Geocode failed during search:', err.message);
      }
    }

    // HARDENED: Generate a unique cache key based on search parameters
    const cacheKey = `osm_search:${cleanSearch}:${lat || 'null'}:${lng || 'null'}:${category || 'ALL'}`;
    const cachedOsmResults = cacheService.get(cacheKey);

    if (cachedOsmResults) {
      osmResults = cachedOsmResults;
    } else {
      // 1. Build Overpass Query
      let overpassQuery = '';
      if (lat && lng) {
        
        if (searchKeyword && searchKeyword.length > 2) {
          // Remove generic terms for cuisine search so "mexican food" becomes "mexican"
          const cuisineKeyword = searchKeyword.replace(/\b(food|restaurant|cafe|place|shop)\b/gi, '').trim() || searchKeyword;
          
          // Search by name around user location (50km radius)
          overpassQuery = `
            [out:json][timeout:10];
            (
              node["name"~"${searchKeyword}",i]["amenity"](around:50000,${lat},${lng});
              node["name"~"${searchKeyword}",i]["shop"](around:50000,${lat},${lng});
              node["name"~"${searchKeyword}",i]["leisure"](around:50000,${lat},${lng});
              node["cuisine"~"${cuisineKeyword}",i]["amenity"](around:50000,${lat},${lng});
            );
            out center 15;
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
      } else {
        // If we don't have a specific location, we skip Overpass to avoid global timeouts
        // The local Prisma database will handle the global text search
        overpassQuery = '';
      }

      if (overpassQuery) {
        try {
          const overpassUrl = 'https://overpass-api.de/api/interpreter';
          const overpassRes = await axios.post(overpassUrl, `data=${encodeURIComponent(overpassQuery)}`, {
            headers: { 
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'PabandiApp/1.0 (contact@pabandi.app)'
            },
            timeout: 10000 // 10-second timeout for Overpass
          });
          const places = overpassRes.data?.elements || [];
          osmResults = osmResults.concat(places);
        } catch (err: any) {
          console.warn('Overpass search failed (Fallback to local DB):', err.message);
        }
      }

      // HARDENED: Save successful API results to memory cache
      if (osmResults.length > 0) {
        cacheService.set(cacheKey, osmResults);
      }
    }
    
    // 1.5 If googlePlaceId (osmId) is provided and does not exist in local DB, attempt dynamic Details import
    if (googlePlaceId) {
      const existing = await prisma.business.findFirst({
        where: { googlePlaceId: String(googlePlaceId) }
      });
      
      if (!existing && String(googlePlaceId).startsWith('osm-')) {
        try {
          const osmId = String(googlePlaceId).replace('osm-', '');
          const overpassUrl = 'https://overpass-api.de/api/interpreter';
          const overpassQuery = `[out:json][timeout:5];node(${osmId});out;`;
          
          const overpassRes = await axios.post(overpassUrl, `data=${encodeURIComponent(overpassQuery)}`, {
            headers: { 
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'PabandiApp/1.0 (contact@pabandi.app)'
            },
            timeout: 5000 // HARDENED: 5-second timeout
          });
          
          if (overpassRes.data?.elements && overpassRes.data.elements.length > 0) {
            const el = overpassRes.data.elements[0];
            const tags = el.tags || {};
            
            let cat: any = 'RESTAURANT';
            if (tags.shop === 'beauty' || tags.shop === 'hairdresser') cat = 'SALON';
            else if (tags.shop === 'massage') cat = 'SPA';
            else if (tags.amenity === 'clinic' || tags.amenity === 'hospital') cat = 'CLINIC';
            else if (tags.leisure === 'fitness_centre') cat = 'FITNESS_CENTER';
            
            let coverImageUrl = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1200';
            if (cat === 'SALON') coverImageUrl = 'https://images.unsplash.com/photo-1600948836101-f9ffda59d250?auto=format&fit=crop&q=80&w=800';
            if (cat === 'SPA') coverImageUrl = 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&q=80&w=800';
            if (cat === 'FITNESS_CENTER') coverImageUrl = 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=800';
            if (cat === 'CLINIC') coverImageUrl = 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&q=80&w=800';

            const name = tags.name || 'Unknown Business';
            const address = tags['addr:full'] || tags['addr:street'] || 'Unknown Address';

            const createdBiz = await prisma.business.create({
              data: {
                googlePlaceId: String(googlePlaceId),
                name: name,
                address: address,
                phone: tags.phone || '+92 300 0000000',
                email: 'contact@pabandi.com',
                website: tags.website || null,
                latitude: el.lat || 24.8607,
                longitude: el.lon || 67.0011,
                category: cat,
                isClaimed: false,
                rating: 4.5,
                reviewCount: 1,
                city: 'Karachi',
                description: `Imported OpenStreetMap listing for ${name}. Claim this profile to set up Web3 bookings.`,
                coverImageUrl,
              }
            });

            await prisma.businessSettings.create({
              data: {
                businessId: createdBiz.id,
              },
            });
          }
        } catch (detailsErr) {
          console.warn('Failed to import dynamic place on OSM details fetch:', (detailsErr as Error).message);
        }
      }
    }

    // Fetch local business listings (which now include newly imported ones)
    const where: any = { isActive: true };
    if (googlePlaceId) {
      where.googlePlaceId = String(googlePlaceId);
    }
    if (category && category !== 'ALL') {
      where.category = String(category);
    }
    if (searchKeyword) {
      const searchTerms = String(searchKeyword)
        .trim()
        .split(/\s+/)
        .filter(term => term.length > 0);
        
      if (searchTerms.length > 0) {
        where.AND = searchTerms.map(term => ({
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
            { address: { contains: term, mode: 'insensitive' } },
            ...(extractedCity ? [] : [{ city: { contains: term, mode: 'insensitive' } }])
          ]
        }));
      }
    }

    if (extractedCity) {
      // If we extracted a city from the query, explicitly require it
      if (where.AND) {
        where.AND.push({ city: { contains: extractedCity, mode: 'insensitive' } });
      } else {
        where.AND = [{ city: { contains: extractedCity, mode: 'insensitive' } }];
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

    for (const el of osmResults) {
      const osmId = `osm-${el.id}`;
      if (!el.id) continue;

      const alreadyIncluded = mergedBusinesses.some(b => b.googlePlaceId === osmId);
      if (alreadyIncluded) continue;

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
        // Fallback parsing if we couldn't get the city from geocoding
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
        phone: tags.phone || '+92 300 0000000',
        email: 'contact@pabandi.com',
        website: tags.website || null,
        coverImageUrl: coverImageUrl,
        rating: 4.5,
        reviewCount: 1,
        isVerified: false,
        isClaimed: false,
        isActive: true,
        latitude: el.lat || 24.8607,
        longitude: el.lon || 67.0011,
        googleReviews: []
      } as any);
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

// Business Services Management
router.post('/:id/services', authorize('BUSINESS_OWNER', 'ADMIN'), createBusinessService);
router.put('/:id/services/:serviceId', authorize('BUSINESS_OWNER', 'ADMIN'), updateBusinessService);
router.delete('/:id/services/:serviceId', authorize('BUSINESS_OWNER', 'ADMIN'), deleteBusinessService);

export default router;
