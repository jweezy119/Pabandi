require('dotenv').config();
import axios from 'axios';
import { prisma } from '../utils/database';
import { BusinessCategory } from '@prisma/client';

interface OsmAddress {
  amenity?: string;
  shop?: string;
  road?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
}

interface OsmSearchItem {
  place_id: number;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name?: string;
  address?: OsmAddress;
}

function resolveCategory(cat: string): BusinessCategory {
  const normalized = cat.toLowerCase();
  if (normalized.includes('salon') || normalized.includes('hair') || normalized.includes('beauty')) {
    return BusinessCategory.SALON;
  }
  if (normalized.includes('spa') || normalized.includes('massage')) {
    return BusinessCategory.SPA;
  }
  if (normalized.includes('clinic') || normalized.includes('doctor') || normalized.includes('health')) {
    return BusinessCategory.CLINIC;
  }
  if (normalized.includes('fitness') || normalized.includes('gym')) {
    return BusinessCategory.FITNESS_CENTER;
  }
  if (normalized.includes('hotel')) {
    return BusinessCategory.HOTEL;
  }
  return BusinessCategory.RESTAURANT;
}

export async function seedOsmBusinesses(city = 'Chicago', category = 'restaurant', limit = 20): Promise<number> {
  const resolvedCategory = resolveCategory(category);
  const queryTerm = `${category} in ${city} IL US`;
  console.log(`[seed-osm] Fetching OSM businesses: "${queryTerm}" (Category: ${resolvedCategory})...`);

  try {
    const res = await axios.get<OsmSearchItem[]>('https://nominatim.openstreetmap.org/search', {
      params: {
        q: queryTerm,
        format: 'json',
        addressdetails: 1,
        limit,
      },
      headers: {
        'User-Agent': 'PabandiApp/1.0 (contact@pabandi.app)',
      },
      timeout: 10000,
    });

    const items = Array.isArray(res.data) ? res.data : [];
    console.log(`[seed-osm] Received ${items.length} items from OpenStreetMap`);

    let createdCount = 0;
    for (const item of items) {
      const addr = item.address || {};
      const name = item.name || item.display_name?.split(',')[0] || `${city} ${category}`;
      const itemCity = addr.city || addr.town || addr.village || city;
      const state = addr.state || 'Illinois';
      const country = addr.country || 'United States';
      const postalCode = addr.postcode || '60601';
      const lat = parseFloat(item.lat) || 41.8781;
      const lng = parseFloat(item.lon) || -87.6298;

      const cleanSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const osmIdStr = String(item.osm_id);
      const slug = `${cleanSlug}-${itemCity.toLowerCase()}-${osmIdStr}`;
      const id = `osm_${osmIdStr}`;
      const externalId = `osm-${item.osm_type || 'node'}-${osmIdStr}`;
      const website = `https://www.openstreetmap.org/${item.osm_type || 'node'}/${osmIdStr}`;

      await prisma.business.upsert({
        where: { id },
        update: {
          name,
          category: resolvedCategory,
          address: item.display_name || `${itemCity}, ${state}`,
          city: itemCity,
          state,
          country,
          postalCode,
          latitude: lat,
          longitude: lng,
          source: 'osm',
          externalId,
          updatedAt: new Date(),
        },
        create: {
          id,
          name,
          category: resolvedCategory,
          address: item.display_name || `${itemCity}, ${state}`,
          city: itemCity,
          state,
          country,
          postalCode,
          phone: '+1 (512) 555-0199',
          email: `info@${cleanSlug.slice(0, 15) || 'business'}.example.com`,
          website,
          latitude: lat,
          longitude: lng,
          rating: 4.8,
          reviewCount: 25,
          trustScore: 85.0,
          karmaScore: 90.0,
          isVerified: true,
          isActive: true,
          isClaimed: true,
          source: 'osm',
          externalId,
          slug,
          timezone: 'America/Chicago',
          currency: 'USD',
          businessTier: 'STANDARD',
        },
      });

      createdCount++;
    }

    console.log(`[seed-osm] Successfully upserted ${createdCount} businesses for ${city} - ${category}`);
    return createdCount;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[seed-osm] Failed: ${msg}`);
    return 0;
  }
}

async function main() {
  const city = process.argv[2] || 'Chicago';
  const category = process.argv[3] || 'restaurant';
  await seedOsmBusinesses(city, category, 20);
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
