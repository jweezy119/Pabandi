import { Router } from 'express';
import {
  createBusiness,
  getBusiness,
  updateBusiness,
  getBusinessReservations,
  getBusinessAnalytics,
  getBusinessReviews,
  claimBusiness,
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

    // 1. If coordinates are provided, attempt dynamic Google Places Nearby Search import
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
        
        for (const place of places) {
          const gId = place.place_id;
          if (!gId) continue;
          
          const existing = await prisma.business.findFirst({
            where: { googlePlaceId: gId }
          });
          
          if (!existing) {
            const types = place.types || [];
            let mappedCat: any = 'RESTAURANT';
            if (types.includes('beauty_salon') || types.includes('hair_care')) mappedCat = 'SALON';
            else if (types.includes('spa')) mappedCat = 'SPA';
            else if (types.includes('doctor') || types.includes('hospital') || types.includes('clinic')) mappedCat = 'CLINIC';
            else if (types.includes('gym') || types.includes('fitness_center')) mappedCat = 'FITNESS_CENTER';
            else if (types.includes('event_venue') || types.includes('hall')) mappedCat = 'EVENT_VENUE';
            
            const address = place.vicinity || place.formatted_address || '';
            const addressLower = address.toLowerCase();
            let city = 'Karachi';
            if (addressLower.includes('lahore')) city = 'Lahore';
            else if (addressLower.includes('islamabad')) city = 'Islamabad';
            
            let coverImageUrl = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1200';
            if (place.photos && place.photos.length > 0) {
              coverImageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${place.photos[0].photo_reference}&key=${apiKey}`;
            }
            
            const createdBiz = await prisma.business.create({
              data: {
                name: place.name,
                description: `Imported Google listing for ${place.name}. Claim this profile to set up Web3 bookings.`,
                category: mappedCat,
                address: address,
                city: city,
                phone: place.formatted_phone_number || '+92 300 0000000',
                email: 'contact@pabandi.com',
                coverImageUrl: coverImageUrl,
                googlePlaceId: gId,
                rating: place.rating || 4.5,
                reviewCount: place.user_ratings_total || 1,
                isVerified: false,
                isClaimed: false,
                isActive: true,
                ownerId: null,
                latitude: place.geometry?.location?.lat || lat,
                longitude: place.geometry?.location?.lng || lng,
              }
            });
            
            await prisma.businessSettings.create({
              data: {
                businessId: createdBiz.id
              }
            });
          }
        }
      } catch (nearbyErr) {
        console.error('Failed to import from Google Places Nearby Search:', nearbyErr);
      }
    }

    // 2. If searching, attempt dynamic Google Places import
    if (search && String(search).trim().length > 2 && apiKey) {
      try {
        const queryStr = `${String(search)} Pakistan`;
        const googleUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json`;
        
        const googleRes = await axios.get(googleUrl, {
          params: {
            query: queryStr,
            key: apiKey,
          }
        });
        
        const places = googleRes.data?.results || [];
        
        // Dynamic import
        for (const place of places) {
          const gId = place.place_id;
          if (!gId) continue;
          
          // Check if already in DB
          const existing = await prisma.business.findFirst({
            where: { googlePlaceId: gId }
          });
          
          if (!existing) {
            // Map types to category
            const types = place.types || [];
            let mappedCat: any = 'RESTAURANT';
            if (types.includes('beauty_salon') || types.includes('hair_care')) mappedCat = 'SALON';
            else if (types.includes('spa')) mappedCat = 'SPA';
            else if (types.includes('doctor') || types.includes('hospital') || types.includes('clinic')) mappedCat = 'CLINIC';
            else if (types.includes('gym') || types.includes('fitness_center')) mappedCat = 'FITNESS_CENTER';
            else if (types.includes('event_venue') || types.includes('hall')) mappedCat = 'EVENT_VENUE';
            
            // Map address to city
            const address = place.formatted_address || '';
            const addressLower = address.toLowerCase();
            let city = 'Karachi';
            if (addressLower.includes('lahore')) city = 'Lahore';
            else if (addressLower.includes('islamabad')) city = 'Islamabad';
            else if (addressLower.includes('rawalpindi')) city = 'Rawalpindi';
            else if (addressLower.includes('faisalabad')) city = 'Faisalabad';
            else if (addressLower.includes('multan')) city = 'Multan';
            else if (addressLower.includes('peshawar')) city = 'Peshawar';
            else if (addressLower.includes('quetta')) city = 'Quetta';
            
            // Cover Image
            let coverImageUrl = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1200';
            if (place.photos && place.photos.length > 0) {
              coverImageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${place.photos[0].photo_reference}&key=${apiKey}`;
            } else {
              // category place holders
              if (mappedCat === 'SALON') coverImageUrl = 'https://images.unsplash.com/photo-1600948836101-f9ffda59d250?auto=format&fit=crop&q=80&w=800';
              if (mappedCat === 'SPA') coverImageUrl = 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&q=80&w=800';
              if (mappedCat === 'FITNESS_CENTER') coverImageUrl = 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=800';
              if (mappedCat === 'CLINIC') coverImageUrl = 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&q=80&w=800';
            }
            
            // Create unclaimed business in DB
            const createdBiz = await prisma.business.create({
              data: {
                name: place.name,
                description: `Imported Google listing for ${place.name}. Claim this profile to set up Web3 bookings.`,
                category: mappedCat,
                address: address,
                city: city,
                phone: place.formatted_phone_number || '+92 300 0000000',
                email: 'contact@pabandi.com',
                coverImageUrl: coverImageUrl,
                googlePlaceId: gId,
                rating: place.rating || 4.5,
                reviewCount: place.user_ratings_total || 1,
                isVerified: false,
                isClaimed: false,
                isActive: true,
                ownerId: null,
                latitude: place.geometry?.location?.lat || 24.8607,
                longitude: place.geometry?.location?.lng || 67.0011,
              }
            });
            
            // Create default settings
            await prisma.businessSettings.create({
              data: {
                businessId: createdBiz.id
              }
            });
            
            // Dynamically seed some mock reviews if Google didn't return any local cached ones
            const mockReviews = [
              {
                googleReviewId: `g_mock_${gId}_1`,
                authorName: 'Adnan Ahmed',
                rating: 5,
                text: `Fantastic place! Visited last week. The service at ${place.name} was top-tier. Looking forward to booking through Pabandi.`,
                time: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
                sentimentLabel: 'positive',
              },
              {
                googleReviewId: `g_mock_${gId}_2`,
                authorName: 'Sana Khan',
                rating: 4,
                text: `Very good experience. Highly recommended. Eagerly waiting for them to enable blockchain check-ins.`,
                time: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
                sentimentLabel: 'positive',
              }
            ];
            
            for (const review of mockReviews) {
              await prisma.googleReview.create({
                data: {
                  businessId: createdBiz.id,
                  googleReviewId: review.googleReviewId,
                  authorName: review.authorName,
                  rating: review.rating,
                  text: review.text,
                  time: review.time,
                  sentimentLabel: review.sentimentLabel,
                }
              });
            }
          }
        }
      } catch (googleErr) {
        console.error('Failed to import from Google Places API:', googleErr);
      }
    }
    
    // 2. Fetch local business listings (which now include newly imported ones)
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
    
    const businesses = await prisma.business.findMany({ 
      where,
      include: {
        googleReviews: true
      }
    });
    res.json({ success: true, data: { businesses } });
  } catch (error) {
    next(error);
  }
});

// Publicly accessible business routes (with optional auth)
router.get('/:id', optionalAuthenticate, getBusiness);
router.get('/:id/reviews', optionalAuthenticate, getBusinessReviews);

// All subsequent business routes require authentication
router.use(authenticate);

// GET /businesses/me — fetch the logged-in owner's business
router.get('/me', async (req: any, res, next) => {
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

router.post('/', createBusiness);
router.post('/:id/claim', claimBusiness);
router.put('/:id', authorize('BUSINESS_OWNER', 'ADMIN'), updateBusiness);
router.get('/:id/reservations', getBusinessReservations);
router.get('/:id/analytics', getBusinessAnalytics);

export default router;
