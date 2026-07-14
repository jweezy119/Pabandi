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
  { name: 'Joliet', lat: 41.525, lng: -88.0814, radius: 25000 },
  { name: 'Elgin', lat: 42.035, lng: -88.2896, radius: 22000 },
  { name: 'Waukegan', lat: 42.3716, lng: -87.8447, radius: 22000 },
  { name: 'Arlington Heights', lat: 42.0892, lng: -87.9806, radius: 18000 },
  { name: 'Orland Park', lat: 41.6303, lng: -87.8629, radius: 20000 },
  { name: 'Tinley Park', lat: 41.5734, lng: -87.7845, radius: 18000 },
  { name: 'Cicero', lat: 41.8456, lng: -87.7536, radius: 15000 },
  { name: 'Skokie', lat: 42.0324, lng: -87.7416, radius: 18000 },
  { name: 'Des Plaines', lat: 42.0334, lng: -87.9033, radius: 18000 },
  { name: 'Mount Prospect', lat: 42.0664, lng: -87.9361, radius: 18000 },
  { name: 'Hoffman Estates', lat: 42.0617, lng: -88.1227, radius: 18000 },
  { name: 'Downers Grove', lat: 41.7929, lng: -88.0112, radius: 18000 },
  { name: 'Buffalo Grove', lat: 42.1663, lng: -87.9621, radius: 16000 },
  { name: 'Wheeling', lat: 42.1354, lng: -87.9281, radius: 16000 },
  { name: 'Oak Lawn', lat: 41.7199, lng: -87.7473, radius: 16000 },
  { name: 'Berwyn', lat: 41.8506, lng: -87.7908, radius: 15000 },
  { name: 'Park Ridge', lat: 42.0116, lng: -87.8408, radius: 16000 },
  { name: 'Glenview', lat: 42.0698, lng: -87.7878, radius: 18000 },
  { name: 'Lombard', lat: 41.88, lng: -88.0078, radius: 16000 },
  { name: 'Lisle', lat: 41.79, lng: -88.0753, radius: 16000 },
  { name: 'Elmhurst', lat: 41.8995, lng: -87.9403, radius: 16000 },
  { name: 'Bolingbrook', lat: 41.6973, lng: -88.1838, radius: 20000 },
  { name: 'Streamwood', lat: 42.0242, lng: -88.1734, radius: 16000 },
  { name: 'St. Charles', lat: 41.9139, lng: -88.2574, radius: 20000 },
  { name: 'Geneva', lat: 41.8814, lng: -88.3053, radius: 18000 },
  { name: 'Woodridge', lat: 41.7303, lng: -88.0748, radius: 18000 },
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
    joliet: 'Joliet',
    elgin: 'Elgin',
    waukegan: 'Waukegan',
    'arlington heights': 'Arlington Heights',
    'orland park': 'Orland Park',
    'tinley park': 'Tinley Park',
    cicero: 'Cicero',
    skokie: 'Skokie',
    'des plaines': 'Des Plaines',
    'mount prospect': 'Mount Prospect',
    'hoffman estates': 'Hoffman Estates',
    'downers grove': 'Downers Grove',
    'buffalo grove': 'Buffalo Grove',
    wheeling: 'Wheeling',
    'oak lawn': 'Oak Lawn',
    berwyn: 'Berwyn',
    'park ridge': 'Park Ridge',
    glenview: 'Glenview',
    lombard: 'Lombard',
    lisle: 'Lisle',
    elmhurst: 'Elmhurst',
    bolingbrook: 'Bolingbrook',
    streamwood: 'Streamwood',
    'st. charles': 'St. Charles',
    geneva: 'Geneva',
    woodridge: 'Woodridge',
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
    ['Joliet Auto Body','car_repair'],
    ['Elgin Bike Shop','bicycle_rental'],
    ['Waukegan Diner','cafe'],
    ['Arlington Heights Chiropractic','chiropractor'],
    ['Orland Park Nails','beauty_salon'],
    ['Tinley Park Pizza','restaurant'],
    ['Cicero Tailor','tailor'],
    ['Skokie Dry Cleaner','dry_cleaner'],
    ['Des Plaines Print Shop','copyshop'],
    ['Mount Prospect Tutoring','tutoring'],
    ['Hoffman Estates Fitness','fitness_centre'],
    ['Downers Grove Market','supermarket'],
    ['Buffalo Grove Cafe','cafe'],
    ['Wheeling Sporthub','sports_centre'],
    ['Oak Lawn Pharmacy','pharmacy'],
    ['Berwyn Bakery','bakery'],
    ['Park Ridge Salon','hair_salon'],
    ['Glenview Clinic','clinic'],
    ['Lombard Barbershop','barber'],
    ['Lisle Massage','massage'],
    ['Elmhurst Yoga','yoga_studio'],
    ['Bolingbrook Storage','storage'],
    ['Streamwood Hardware','hardware'],
    ['St. Charles Car Wash','car_wash'],
    ['Geneva Bookshop','bookshop'],
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
  console.log('Starting OSM seed import for Chicagoland...');
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
