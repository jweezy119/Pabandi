import { PrismaClient } from '@prisma/client';
import { bookingScraperService } from '../src/services/bookingScraper.service';

const prisma = new PrismaClient();

interface SeedCity {
  query: string;
}

const SEED_CITIES: SeedCity[] = [
  { query: 'New York' },
  { query: 'Los Angeles' },
  { query: 'Chicago' },
  { query: 'Miami' },
  { query: 'San Francisco' },
  { query: 'Las Vegas' },
  { query: 'Boston' },
  { query: 'Washington' },
];

async function seedHotels() {
  console.log('🏨 Starting hotel seed from Booking.com...\n');

  // Find or create a default business to own these properties
  let business = await prisma.business.findFirst({
    where: { name: 'Pabandi Hotels' },
  });

  if (!business) {
    // Create a placeholder business
    const user = await prisma.user.findFirst();
    if (!user) {
      console.error('No users found. Create a user first.');
      process.exit(1);
    }
    business = await prisma.business.create({
      data: {
        name: 'Pabandi Hotels',
        ownerId: user.id,
        category: 'PROPERTY_RENTAL',
        address: '123 Main St',
        city: 'New York',
        country: 'United States',
        phone: '+1 555 123 4567',
        email: 'hotels@pabandi.com',
        timezone: 'America/New_York',
        currency: 'USD',
      },
    });
    console.log('Created placeholder business: Pabandi Hotels');
  }

  let totalSeeded = 0;
  let totalErrors = 0;

  for (const city of SEED_CITIES) {
    try {
      console.log(`📍 Searching: ${city.query}`);

      const searchResult = await bookingScraperService.searchHotels({
        query: city.query,
        checkin: '2026-09-24',
        checkout: '2026-09-26',
        adults: 2,
        rooms: 1,
        currency: 'USD',
        locale: 'en-us',
        sort_by: 'popularity',
      });

      const hotels = searchResult.results || [];
      console.log(`   Found ${hotels.length} hotels`);

      for (const hotel of hotels) {
        try {
          // Check if hotel already exists
          const existing = await prisma.property.findFirst({
            where: {
              title: hotel.name,
              city: hotel.location.city,
            },
          });

          if (existing) {
            console.log(`   ⏭️  Skipped (exists): ${hotel.name}`);
            continue;
          }

          const property = await prisma.property.create({
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

          console.log(`   ✅ Seeded: ${property.title} ($${property.pricePerNight}/night)`);
          totalSeeded++;
        } catch (err: any) {
          console.error(`   ❌ Failed to seed ${hotel.name}: ${err.message}`);
          totalErrors++;
        }
      }

      // Rate limit: 1 request per second
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (err: any) {
      console.error(`❌ Failed to search ${city.query}: ${err.message}`);
      totalErrors++;
    }
  }

  console.log(`\n🎉 Seed complete!`);
  console.log(`   Total seeded: ${totalSeeded}`);
  console.log(`   Total errors: ${totalErrors}`);
}

seedHotels()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
