import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

const CITIES = [
  { name: 'Chicago', lat: 41.8781, lng: -87.6298, radius: 30000 },
  { name: 'Naperville', lat: 41.7508, lng: -88.1535, radius: 25000 },
  { name: 'Aurora', lat: 41.7606, lng: -88.3201, radius: 25000 },
  { name: 'Evanston', lat: 42.0411, lng: -87.6901, radius: 20000 },
  { name: 'Schaumburg', lat: 41.9584, lng: -88.0959, radius: 22000 },
];

const CATEGORY_FILTERS = [
  'node["amenity"~"restaurant|cafe|fast_food|food_court|bar"]',
  'node["shop"~"beauty|hairdresser|massage|wellness|clothes|supermarket|convenience"]',
  'node["amenity"~"clinic|hospital|doctor|dentist|pharmacy"]',
  'node["leisure"~"fitness_centre|sports_centre|park"]',
  'node["tourism"~"hotel|motel|guest_house"]',
  'node["amenity"~"car_rental|car_wash"]',
  'node["office"~"therapist|lawyer|accountant|insurance"]',
];

type OSMNode = {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags: Record<string, string>;
};

type OSMPoi = {
  osmType: string;
  osmId: number;
  name: string;
  category: string;
  address: string;
  city: string;
  phone: string | null;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  reviewCount: number;
};

function categoryFromTags(tags: Record<string, string>): string {
  if (tags.shop === 'beauty' || tags.shop === 'hairdresser' || tags.amenity === 'hairdresser') return 'SALON';
  if (tags.shop === 'massage') return 'SPA';
  if (tags.amenity === 'clinic' || tags.amenity === 'hospital' || tags.amenity === 'doctor' || tags.amenity === 'dentist') return 'CLINIC';
  if (tags.leisure === 'fitness_centre' || tags.amenity === 'gym') return 'FITNESS_CENTER';
  if (tags.tourism === 'hotel' || tags.tourism === 'motel' || tags.tourism === 'guest_house') return 'SHORT_TERM_RENTAL';
  if (tags.amenity === 'restaurant' || tags.amenity === 'cafe' || tags.amenity === 'fast_food' || tags.amenity === 'food_court' || tags.amenity === 'bar') return 'RESTAURANT';
  if (tags.shop) return 'SERVICE';
  if (tags.office) return 'FREELANCE';
  return 'SERVICE';
}

function cityFromAddress(address: string, fallback: string): string {
  const a = address.toLowerCase();
  const mapping: Record<string, string> = {
    chicago: 'Chicago',
    evanston: 'Evanston',
    naperville: 'Naperville',
    aurora: 'Aurora',
    schaumburg: 'Schaumburg',
  };
  for (const [k, v] of Object.entries(mapping)) {
    if (a.includes(k)) return v;
  }
  return fallback;
}

async function fetchOverpass(query: string): Promise<any[]> {
  try {
    const res = await axios.post('https://overpass-api.de/api/interpreter', `data=${encodeURIComponent(query)}`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'PabandiSeeder/1.0 (contact@pabandi.app)' },
      timeout: 30000,
    });
    return res.data?.elements || [];
  } catch (err: any) {
    console.warn('Overpass request failed:', err.message);
    return [];
  }
}

async function fetchOsmNodesForCity(city: { name: string; lat: number; lng: number; radius: number }): Promise<OSMPoi[]> {
  const poiPromises = CATEGORY_FILTERS.map(filter =>
    fetchOverpass(`[out:json][timeout:25];(${filter}(around:${city.radius},${city.lat},${city.lng});node(around:${city.radius},${city.lat},${city.lng})["name"];);out center 60;`)
  );
  const results = await Promise.all(poiPromises);
  const elements = results.flat();

  const nodes: OSMPoi[] = [];
  const seen = new Set<string>();
  for (const el of elements) {
    if ((el as any).type !== 'node') continue;
    const tags = (el as any).tags || {};
    const name = tags.name;
    if (!name) continue;
    const key = `${el.type}-${el.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const address = tags['addr:full'] || [tags['addr:street'], tags['addr:housenumber'], tags['addr:city']].filter(Boolean).join(' ') || name;
    nodes.push({
      osmType: el.type,
      osmId: el.id,
      name,
      category: categoryFromTags(tags),
      address,
      city: cityFromAddress(address, city.name),
      phone: tags.phone || null,
      website: tags.website || null,
      latitude: el.lat ?? null,
      longitude: el.lon ?? null,
      rating: null,
      reviewCount: 0,
    });
  }
  return nodes;
}

async function upsertBusinesses(pois: OSMPoi[]) {
  let created = 0;
  let skipped = 0;
  for (const poi of pois) {
    try {
      const slug = `${poi.name.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}-${poi.city.toLowerCase().replace(/\s+/g, '-')}-${poi.osmId}`;
      const id = `osm-${poi.osmType}-${poi.osmId}`;

      const existing = await prisma.business.findFirst({ where: { OR: [{ source: 'osm', externalId: id }, { slug }] } });
      if (existing) {
        skipped++;
        continue;
      }

      await prisma.business.create({
        data: {
          id,
          source: 'osm',
          externalId: id,
          name: poi.name,
          description: `Imported from OpenStreetMap. Claim this profile to enable trust-first bookings.`,
          category: poi.category as any,
          address: poi.address,
          city: poi.city,
          phone: poi.phone || 'Contact via app',
          email: 'contact@pabandi.com',
          website: poi.website,
          logoUrl: '',
          coverImageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1200',
          rating: 4.5,
          reviewCount: 0,
          trustScore: 48.0,
          isVerified: false,
          isClaimed: false,
          isActive: true,
          latitude: poi.latitude,
          longitude: poi.longitude,
          timezone: 'America/Chicago',
          currency: 'USD',
          bookingAdvanceDays: 30,
          cancellationHours: 24,
          requireDeposit: false,
          businessTier: 'STANDARD',
          karmaScore: 30,
          state: 'IL',
          country: 'United States',
          slug,
        },
      });
      created++;
    } catch (err: any) {
      skipped++;
    }
  }
  return { created, skipped };
}

async function main() {
  console.log('Starting OSM seed import for US Midwest...');
  let totalCreated = 0;
  let totalSkipped = 0;

  for (const city of CITIES) {
    console.log(`Seeding ${city.name}...`);
    const pois = await fetchOsmNodesForCity(city);
    const result = await upsertBusinesses(pois);
    console.log(`${city.name}: candidates=${pois.length}, created=${result.created}, skipped=${result.skipped}`);
    totalCreated += result.created;
    totalSkipped += result.skipped;
  }

  const count = await prisma.business.count({ where: { source: 'osm' } });
  console.log(`Seed complete. created=${totalCreated}, skipped=${totalSkipped}, osm rows=${count}`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
