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
} from '../controllers/business.controller';
import { authenticate, authorize, optionalAuthenticate } from '../middleware/auth.middleware';

const router = Router();

import axios from 'axios';

// Public route to get businesses for the homepage/search
router.get('/', async (req, res, next) => {
  try {
    const { prisma } = await import('../utils/database');
    const { googlePlaceId, category, search, latitude, longitude } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    let googleResults: any[] = [];

    // 1. If coordinates are provided, attempt Google Places Nearby Search
    if (latitude && longitude && apiKey) {
      try {
        const lat = parseFloat(String(latitude));
        const lng = parseFloat(String(longitude));
        const googleUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json`;
        
        let googleType = 'restaurant';
        if (category === 'SALON') googleType = 'beauty_salon';
        else if (category === 'SPA') googleType = 'spa';
        else if (category === 'CLINIC') googleType = 'doctor';
        else if (category === 'FITNESS_CENTER') googleType = 'gym';

        const googleRes = await axios.get(googleUrl, {
          params: {
            location: `${lat},${lng}`,
            radius: 5000, // 5km
            key: apiKey,
            type: googleType
          }
        });
        
        const places = googleRes.data?.results || [];
        googleResults = googleResults.concat(places);
      } catch (nearbyErr) {
        console.error('Failed to query Google Places Nearby Search:', nearbyErr);
      }
    }

    // 2. If searching, attempt Google Places Text Search
    if (search && String(search).trim().length > 2 && apiKey) {
      try {
        const googleUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json`;
        const params: any = {
          query: String(search),
          key: apiKey,
        };
        
        if (latitude && longitude) {
          params.location = `${latitude},${longitude}`;
          params.radius = 50000; // 50km radius
        } else {
          params.query = `${String(search)} Pakistan`;
        }

        const googleRes = await axios.get(googleUrl, { params });
        
        const places = googleRes.data?.results || [];
        googleResults = googleResults.concat(places);
      } catch (googleErr) {
        console.error('Failed to query Google Places API:', googleErr);
      }
    }
    
    // 1.5 If googlePlaceId is provided and does not exist in local DB, attempt dynamic Details import
    if (googlePlaceId && apiKey) {
      const existing = await prisma.business.findFirst({
        where: { googlePlaceId: String(googlePlaceId) }
      });
      
      if (!existing) {
        try {
          const googleRes = await axios.get(
            `https://maps.googleapis.com/maps/api/place/details/json`, {
              params: {
                place_id: String(googlePlaceId),
                fields: 'name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,types,geometry,photos',
                key: apiKey,
              }
            }
          );
          
          if (googleRes.data?.result) {
            const p = googleRes.data.result;
            
            let cat: any = 'RESTAURANT';
            if (p.types) {
              if (p.types.includes('restaurant') || p.types.includes('cafe') || p.types.includes('bakery')) cat = 'RESTAURANT';
              else if (p.types.includes('spa') || p.types.includes('beauty_salon') || p.types.includes('hair_care')) cat = 'SPA';
              else if (p.types.includes('gym') || p.types.includes('health')) cat = 'FITNESS_CENTER';
            }
            
            let coverImageUrl = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1200';
            if (p.photos && p.photos.length > 0) {
              coverImageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${p.photos[0].photo_reference}&key=${apiKey}`;
            }

            const createdBiz = await prisma.business.create({
              data: {
                googlePlaceId: String(googlePlaceId),
                name: p.name || 'Unknown Business',
                address: p.formatted_address || 'Unknown Address',
                phone: p.international_phone_number || p.formatted_phone_number || '+92 300 0000000',
                email: 'contact@pabandi.com',
                website: p.website || null,
                latitude: p.geometry?.location?.lat || 24.8607,
                longitude: p.geometry?.location?.lng || 67.0011,
                category: cat,
                isClaimed: false,
                rating: p.rating || 4.5,
                reviewCount: p.user_ratings_total || 1,
                city: p.formatted_address?.split(',')[1]?.trim() || 'Karachi',
                description: `Imported Google listing for ${p.name}. Claim this profile to set up Web3 bookings.`,
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
          console.error('Failed to import dynamic place on details fetch:', detailsErr);
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
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { description: { contains: String(search), mode: 'insensitive' } },
        { city: { contains: String(search), mode: 'insensitive' } }
      ];
    }
    
    const dbBusinesses = await prisma.business.findMany({ 
      where,
      include: {
        googleReviews: true
      }
    });

    const mergedBusinesses = [...dbBusinesses];

    for (const place of googleResults) {
      const gId = place.place_id;
      if (!gId) continue;

      const alreadyIncluded = mergedBusinesses.some(b => b.googlePlaceId === gId);
      if (alreadyIncluded) continue;

      const types = place.types || [];
      let mappedCat: any = 'RESTAURANT';
      if (types.includes('beauty_salon') || types.includes('hair_care')) mappedCat = 'SALON';
      else if (types.includes('spa')) mappedCat = 'SPA';
      else if (types.includes('doctor') || types.includes('hospital') || types.includes('clinic')) mappedCat = 'CLINIC';
      else if (types.includes('gym') || types.includes('fitness_center')) mappedCat = 'FITNESS_CENTER';
      else if (types.includes('event_venue') || types.includes('hall')) mappedCat = 'EVENT_VENUE';

      if (category && category !== 'ALL' && mappedCat !== String(category)) {
        continue;
      }

      const address = place.vicinity || place.formatted_address || '';
      const addressLower = address.toLowerCase();
      let city = 'Karachi';
      if (addressLower.includes('lahore')) city = 'Lahore';
      else if (addressLower.includes('islamabad')) city = 'Islamabad';
      else if (addressLower.includes('rawalpindi')) city = 'Rawalpindi';
      else if (addressLower.includes('faisalabad')) city = 'Faisalabad';
      else if (addressLower.includes('multan')) city = 'Multan';
      else if (addressLower.includes('peshawar')) city = 'Peshawar';
      else if (addressLower.includes('quetta')) city = 'Quetta';

      let coverImageUrl = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1200';
      if (place.photos && place.photos.length > 0) {
        coverImageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${place.photos[0].photo_reference}&key=${apiKey}`;
      } else {
        if (mappedCat === 'SALON') coverImageUrl = 'https://images.unsplash.com/photo-1600948836101-f9ffda59d250?auto=format&fit=crop&q=80&w=800';
        if (mappedCat === 'SPA') coverImageUrl = 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&q=80&w=800';
        if (mappedCat === 'FITNESS_CENTER') coverImageUrl = 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=800';
        if (mappedCat === 'CLINIC') coverImageUrl = 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&q=80&w=800';
      }

      mergedBusinesses.push({
        id: gId,
        googlePlaceId: gId,
        name: place.name,
        description: `Imported Google listing for ${place.name}. Claim this profile to set up Web3 bookings.`,
        category: mappedCat,
        address: address,
        city: city,
        phone: place.formatted_phone_number || '+92 300 0000000',
        email: 'contact@pabandi.com',
        website: place.website || null,
        coverImageUrl: coverImageUrl,
        rating: place.rating || 4.5,
        reviewCount: place.user_ratings_total || 1,
        isVerified: false,
        isClaimed: false,
        isActive: true,
        latitude: place.geometry?.location?.lat || 24.8607,
        longitude: place.geometry?.location?.lng || 67.0011,
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
router.get('/:id', optionalAuthenticate, getBusiness);
router.get('/:id/reviews', optionalAuthenticate, getBusinessReviews);

// All subsequent business routes require authentication
router.use(authenticate);



router.post('/', createBusiness);
router.post('/:id/claim', claimBusiness);
router.put('/:id', authorize('BUSINESS_OWNER', 'ADMIN'), updateBusiness);
router.get('/:id/reservations', getBusinessReservations);
router.get('/:id/analytics', getBusinessAnalytics);
router.get('/:id/customers', getBusinessCustomers);

export default router;
