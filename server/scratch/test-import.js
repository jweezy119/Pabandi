require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

async function testImport() {
  const search = "Df khaane";
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  console.log("Using API Key:", apiKey);
  
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
    console.log(`Found ${places.length} places.`);
    
    for (const place of places) {
      console.log("Found place:", place.name, "ID:", place.place_id);
      const gId = place.place_id;
      if (!gId) continue;
      
      const existing = await prisma.business.findFirst({
        where: { googlePlaceId: gId }
      });
      console.log("Existing in DB:", !!existing);
      
      if (!existing) {
        const types = place.types || [];
        let mappedCat = 'RESTAURANT';
        if (types.includes('beauty_salon') || types.includes('hair_care')) mappedCat = 'SALON';
        else if (types.includes('spa')) mappedCat = 'SPA';
        else if (types.includes('doctor') || types.includes('hospital') || types.includes('clinic')) mappedCat = 'CLINIC';
        else if (types.includes('gym') || types.includes('fitness_center')) mappedCat = 'FITNESS_CENTER';
        else if (types.includes('event_venue') || types.includes('hall')) mappedCat = 'EVENT_VENUE';
        
        const address = place.formatted_address || '';
        const addressLower = address.toLowerCase();
        let city = 'Karachi';
        if (addressLower.includes('lahore')) city = 'Lahore';
        else if (addressLower.includes('islamabad')) city = 'Islamabad';
        
        let coverImageUrl = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1200';
        if (place.photos && place.photos.length > 0) {
          coverImageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${place.photos[0].photo_reference}&key=${apiKey}`;
        }
        
        console.log("Creating business with category:", mappedCat);
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
        console.log("Successfully created business:", createdBiz.name, createdBiz.id);
        
        await prisma.businessSettings.create({
          data: {
            businessId: createdBiz.id
          }
        });
        console.log("Successfully created business settings.");
      }
    }
  } catch (error) {
    console.error("Error during testImport:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testImport();
