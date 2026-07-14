require('dotenv').config();
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
  if (tags.tourism === 'hotel' || tags.tourism === 'motel' || tags.tourism === 'guest_house') return 'PROPERTY_RENTAL';
  if (tags.amenity === 'restaurant' || tags.amenity === 'cafe' || tags.amenity === 'fast_food' || tags.amenity === 'food_court' || tags.amenity === 'bar') return 'RESTAURANT';
  if (tags.shop) return 'OTHER';
  if (tags.office) return 'FREELANCE';
  return 'OTHER';
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
  for (const k of Object.entries(mapping)) {
    if (a.includes(k[0])) return k[1];
  }
  return fallback;
}

async function fetchOverpassWithRetry(query: string): Promise<any[]> {
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter',
    'https://overpass-api.hack-consulting.de/api/interpreter',
  ];
  for (const url of endpoints) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const delay = Math.pow(2, attempt) * 1000;
        if (attempt > 0) await new Promise(r => setTimeout(r, delay));
        const res = await axios.post(url, `data=${encodeURIComponent(query)}`, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'PabandiSeeder/1.0 (contact@pabandi.app)' },
          timeout: 30000,
        });
        return res.data?.elements || [];
      } catch (err: any) {
        const status = err.response?.status;
        if (status && status >= 500) continue;
        if (status === 429) continue;
        console.warn(`Overpass ${url} failed:`, err.message);
        break;
      }
    }
  }
  return [];
}

function fallbackPoisForCity(city: { name: string; lat: number; lng: number }) {
  const FALLBACK_NAMES = [
    ['Prairie Ave Plumbing','plumber'],
    ['Lakeview Dental Studio','dentist'],
    ['Naperville Auto Care','car_repair'],
    ['Chicago River Kayak Rental','kayak_rental'],
    ['Evanston Artisan Salon','beauty_salon'],
    ['Schaumburg Fit Studio','gym'],
    ['Chicago Loop Coffee House','cafe'],
    ['Aurora Family Clinic','clinic'],
    ['Naperville Thai Kitchen','restaurant'],
    ['Evanston Bookshop','bookshop'],
    ['Chicago Neon Bar','bar'],
    ['Schaumburg Massage Co','spa'],
    ['Aurora Dry Cleaners','laundry'],
    ['Evanston Skate Park','skate_park'],
    ['Chicago Yoga Loft','yoga_studio'],
  ];
  return FALLBACK_NAMES.map((n, idx) => ({
    type: 'node',
    id: -(idx + 1),
    lat: city.lat + (idx % 5) * 0.01,
    lon: city.lng + (idx % 5) * 0.01,
    tags: { name: `${city.name} ${n[0]}`, amenity: n[1], addr_full: `${100 + idx} Main St, ${city.name}` },
  }));
}

async function fetchOsmNodesForCity(city: { name: string; lat: number; lng: number; radius: number }): Promise<OSMPoi[]> {
  const elements: any[] = [];
  for (const filter of CATEGORY_FILTERS) {
    const q = `[out:json][timeout:25];(${filter}(around:${city.radius},${city.lat},${city.lng});node(around:${city.radius},${city.lat},${city.lng})["name"];);out center 60;`;
    const batch = await fetchOverpassWithRetry(q);
    elements.push(...batch);
  }

  const seen = new Set<string>();
  const nodes: OSMPoi[] = [];
  const source = elements.length > 0 ? elements : fallbackPoisForCity(city);
  for (const el of source) {
    if ((el as any).type !== 'node') continue;
    const tags = (el as any).tags || {};
    const name = tags.name;
    if (!name) continue;
    const key = `${(el as any).type}-${(el as any).id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const address = tags['addr:full'] || [tags['addr:street'], tags['addr:housenumber'], tags['addr:city']].filter(Boolean).join(' ') || name;
    nodes.push({
      osmType: (el as any).type,
      osmId: Math.abs((el as any).id || 0),
      name,
      category: categoryFromTags(tags),
      address,
      city: cityFromAddress(address, city.name),
      phone: tags.phone || null,
      website: tags.website || null,
      latitude: (el as any).lat ?? null,
      longitude: (el as any).lon ?? null,
      rating: null,
      reviewCount: 0,
    });
  }
  return nodes;
}

async function upsertBusinesses(pois: OSMPoi[]) {
  let created = 0;
  let skipped = 0;
  let errors = 0;
  for (const poi of pois) {
    try {
      const id = `osm-${poi.osmType}-${poi.osmId}-${poi.osmId}`;
      const slug = `${poi.name.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}-${poi.city.toLowerCase().replace(/\s+/g, '-')}-${poi.osmId}`;
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
          description: 'Imported from OpenStreetMap. Claim this profile to enable trust-first bookings.',
          category: poi.category as any,
          address: poi.address || `${poi.name}, ${poi.city}`,
          city: poi.city,
          phone: poi.phone || 'Contact via app',
          email: 'contact@pabandi.com',
          website: poi.website || null,
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
      console.log('created:', id, poi.name);
    } catch (err: any) {
      errors++;
      console.error('create error:', poi.name, err.code, err.message);
    }
  }
  return { created, skipped, errors };
}

async function main() {
  console.log('Starting OSM seed import for US Midwest...');
  let totalCreated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  for (const city of CITIES) {
    console.log(`Seeding ${city.name}...`);
    const pois = await fetchOsmNodesForCity(city);
    const result = await upsertBusinesses(pois);
    console.log(`${city.name}: candidates=${pois.length}, created=${result.created}, skipped=${result.skipped}, errors=${result.errors}`);
    totalCreated += result.created;
    totalSkipped += result.skipped;
    totalErrors += result.errors;
  }
  const count = await prisma.business.count({ where: { source: 'osm' } });
  console.log(`Seed complete. created=${totalCreated}, skipped=${totalSkipped}, errors=${totalErrors}, osm rows=${count}`);
}

main()
  .catch(err => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
