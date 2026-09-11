import { Router, Request, Response } from 'express';
import axios from 'axios';
import { prisma } from '../utils/database';

const router = Router();

// ── API Configuration ─────────────────────────────────────────────────────
const YELP_API_KEY = process.env.YELP_API_KEY || '';
const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY || '';
const OPENMENU_API_KEY = process.env.OPENMENU_API_KEY || '';

const yelpHeaders = { Authorization: `Bearer ${YELP_API_KEY}` };
const foursquareHeaders = { Authorization: `Bearer ${FOURSQUARE_API_KEY}`, Accept: 'application/json' };

// ═══════════════════════════════════════════════════════════════════════════
// DATABASE-BACKED BUSINESS SEARCH (primary source — no API keys required)
// ═══════════════════════════════════════════════════════════════════════════

// Haversine great-circle distance in meters
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => deg * Math.PI / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Frontend category strings → BusinessCategory enum values
const FRONTEND_CAT_TO_BIZ: Record<string, string> = {
  restaurant: 'RESTAURANT',
  bar: 'RESTAURANT',
  cafe: 'RESTAURANT',
  club: 'EVENT_VENUE',
  hotel: 'HOTEL',
  theater: 'EVENT_VENUE',
  museum: 'OTHER',
  salon: 'SALON',
  spa: 'SPA',
  fitness: 'FITNESS_CENTER',
  gym: 'FITNESS_CENTER',
  event: 'EVENT_VENUE',
  venue: 'EVENT_VENUE',
};

// BusinessCategory enum → frontend-friendly category string
const BIZ_TO_FRONTEND_CAT: Record<string, string> = {
  RESTAURANT: 'restaurant',
  SALON: 'salon',
  SPA: 'spa',
  CLINIC: 'clinic',
  FITNESS_CENTER: 'fitness',
  EVENT_VENUE: 'venue',
  HOTEL: 'hotel',
  PROPERTY_RENTAL: 'rental',
  OTHER: 'other',
  HOSPITAL: 'hospital',
  FREELANCE: 'freelance',
  ECOMMERCE: 'ecommerce',
  MARKETPLACE: 'marketplace',
  LIVE_SELLER: 'live_seller',
};

/** Dedup key: normalized name + rounded coordinates */
function dedupKey(v: any): string {
  const name = (v.name || '').toLowerCase().trim();
  const lat = Math.round((v.lat || 0) * 100);
  const lng = Math.round((v.lng || 0) * 100);
  return `${name}|${lat}|${lng}`;
}

/**
 * Search businesses from the Pabandi database — primary discovery source.
 * No external API keys required; ships with real registered businesses.
 */
async function searchBusinesses(
  lat?: number, lng?: number, radiusMeters?: number,
  limit?: number, categories?: string, q?: string
): Promise<any[]> {
  const where: any = { isActive: true };

  // Category filter
  if (categories && categories.trim()) {
    const catList = categories.split(',').map(c => c.trim().toLowerCase());
    const mapped = catList
      .map(c => FRONTEND_CAT_TO_BIZ[c] || c.toUpperCase())
      .filter(Boolean);
    if (mapped.length > 0) {
      where.category = { in: mapped };
    }
  }

  // Text search across name, city, address
  if (q && q.trim()) {
    const search = q.trim();
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
      { address: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Only geo-enabled businesses when doing geo search
  if (lat !== undefined && lng !== undefined && isFinite(lat) && isFinite(lng)) {
    where.latitude = { not: null };
    where.longitude = { not: null };
  }

  const businesses = await prisma.business.findMany({
    where,
    orderBy: { rating: 'desc' },
    take: Math.max(1, limit || 50),
  });

  // Geo filter + distance sort when coordinates provided
  if (lat !== undefined && lng !== undefined && isFinite(lat) && isFinite(lng) && radiusMeters !== undefined && isFinite(radiusMeters)) {
    return businesses
      .map(b => {
        if (b.latitude == null || b.longitude == null) return null;
        const dist = haversineMeters(lat, lng, b.latitude, b.longitude);
        return { ...b, _distance: dist };
      })
      .filter((b): b is any => b != null && b._distance <= radiusMeters)
      .sort((a, b) => (a._distance || 0) - (b._distance || 0))
      .slice(0, limit)
      .map(b => {
        const d = b._distance;
        delete (b as any)._distance;
        return { ...b, distance: d };
      });
  }

  return businesses.slice(0, limit);
}

/** Map a Business record to the venue shape the frontend expects */
function businessToVenue(b: any): any {
  return {
    id: b.id,
    name: b.name,
    category: BIZ_TO_FRONTEND_CAT[b.category] || 'other',
    rating: b.rating || null,
    reviewCount: b.reviewCount || 0,
    price: '',
    phone: b.phone || '',
    address: b.address || '',
    city: b.city || '',
    state: b.state || '',
    lat: b.latitude || null,
    lng: b.longitude || null,
    imageUrl: b.coverImageUrl || b.logoUrl || '',
    isOpenNow: null,
    sources: ['database'],
    amenities: [],
    distance: b.distance || null,
    trustScore: b.trustScore ?? 50,
  };
}

/**
 * Merge database results with external API results.
 * Database results are the primary source; external results enrich or add new entries.
 */
function mergeWithDatabase(
  dbResults: any[],
  yelp: any[],
  fsq: any[],
  osm: any[]
): any[] {
  const merged = new Map<string, any>();

  // Database results first (primary source)
  for (const v of dbResults) {
    const key = dedupKey(v);
    merged.set(key, { ...v, sources: ['database'] });
  }

  // Enrich with external sources
  const externalSources = [
    { data: yelp, label: 'yelp' },
    { data: fsq, label: 'foursquare' },
    { data: osm, label: 'osm' },
  ];

  for (const { data, label } of externalSources) {
    for (const v of data) {
      const key = dedupKey(v);
      const existing = merged.get(key);
      if (existing) {
        // Enrich: fill missing fields from external source
        if (!existing.rating && v.rating != null) existing.rating = v.rating;
        if (!existing.reviewCount && v.reviewCount != null) existing.reviewCount = v.reviewCount;
        if (!existing.phone && v.phone) existing.phone = v.phone;
        if (!existing.website && v.website) existing.website = v.website;
        if (!existing.price && v.price) existing.price = v.price;
        if (!existing.imageUrl && v.imageUrl) existing.imageUrl = v.imageUrl;
        if (!existing.address && v.address) existing.address = v.address;
        if (!existing.city && v.city) existing.city = v.city;
        if (v.hours && !existing.hours) existing.hours = v.hours;
        if (!existing.sources.includes(label)) existing.sources.push(label);
      } else {
        merged.set(key, {
          id: v.id || `ext-${key}`,
          name: v.name || 'Unknown',
          category: v.category || v.cuisine || v.type || 'restaurant',
          rating: v.rating || null,
          reviewCount: v.reviewCount || 0,
          price: v.price || '',
          phone: v.phone || '',
          address: v.address || '',
          city: v.city || '',
          lat: v.lat || null,
          lng: v.lng || null,
          imageUrl: v.imageUrl || '',
          isOpenNow: v.isOpenNow || null,
          sources: [label],
          amenities: v.amenities || v.features || [],
          distance: v.distance || null,
        });
      }
    }
  }

  return Array.from(merged.values());
}
// Lightweight endpoint for Sitara OS discovery — returns real geo-located
// businesses from Foursquare (primary), Yelp (enrichment), and OSM (fallback).
// Frugal: caches aggressively, limits to free-tier-friendly payloads.
router.get('/sitara/discover', async (req: Request, res: Response) => {
  try {
    const { lat, lng, q, radius = 2000, limit = 12, category } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }

    const numLat = Number(lat);
    const numLng = Number(lng);
    const numRadius = Math.min(Number(radius) * 1000, 5000000); // meters, capped at 5000km
    const numLimit = Math.min(Number(limit), 30);

    // Primary: database-backed business search (no API keys required)
    const dbResults = await searchBusinesses(
      numLat, numLng, numRadius, numLimit,
      category as string, q as string
    ).catch(() => []);

    // Secondary: external enrichment (only when keys configured)
    const [yelpResults, fsqResults, osmResults] = await Promise.allSettled([
      searchYelp(String(numLat), String(numLng), q as string, String(numRadius), String(numLimit)),
      searchFoursquare(String(numLat), String(numLng), q as string, String(numRadius), String(numLimit)),
      searchOSM(String(numLat), String(numLng), category as string, String(numRadius), String(numLimit)),
    ]);

    const yelp = yelpResults.status === 'fulfilled' ? yelpResults.value : [];
    const fsq = fsqResults.status === 'fulfilled' ? fsqResults.value : [];
    const osm = osmResults.status === 'fulfilled' ? osmResults.value : [];

    // Merge: database primary, external enrichment
    const merged = mergeWithDatabase(dbResults, yelp, fsq, osm);

    // Slim down payload for frugality — only what Sitara needs
    const slim = merged.slice(0, numLimit).map((v: any) => ({
      id: v.id,
      name: v.name,
      category: v.category || v.cuisine || v.categories?.[0] || v.type || 'restaurant',
      rating: v.rating,
      reviewCount: v.reviewCount,
      price: v.price,
      phone: v.phone,
      address: v.address,
      city: v.city,
      lat: v.lat,
      lng: v.lng,
      imageUrl: v.imageUrl,
      isOpenNow: v.isOpenNow,
      sources: v.sources || [v.source || 'unknown'],
      distance: v.distance,
    }));

    res.json({
      success: true,
      data: slim,
      sources: {
        database: dbResults.length,
        yelp: yelp.length,
        foursquare: fsq.length,
        osm: osm.length,
      },
      cached: false,
    });
  } catch (e: any) {
    console.error('Sitara discover failed:', e.message);
    res.status(500).json({ error: 'Discovery failed', data: [] });
  }
});

// ── Unified Venue Search ──────────────────────────────────────────────────
// Primary: database-backed business search (no API keys required).
// Secondary: external enrichment from Yelp, Foursquare, and OSM when keys exist.
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { lat, lng, q, radius = 5000, limit = 20, categories } = req.query;

    const numLat = lat ? Number(lat) : undefined;
    const numLng = lng ? Number(lng) : undefined;
    const numRadiusMeters = (lat && lng) ? Math.min(Number(radius) * 1000, 5000000) : undefined;
    const numLimit = Math.min(Number(limit), 50);

    // Primary: database-backed business search
    const dbResults = await searchBusinesses(
      numLat, numLng, numRadiusMeters, numLimit,
      categories as string, q as string
    ).catch(() => []);

    // Secondary: external enrichment (only when keys configured)
    const [yelpResults, fsqResults, osmResults] = await Promise.allSettled([
      searchYelp(lat as string, lng as string, q as string, radius as string, limit as string),
      searchFoursquare(lat as string, lng as string, q as string, radius as string, limit as string),
      searchOSM(lat as string, lng as string, categories as string, radius as string, limit as string),
    ]);

    const yelp = yelpResults.status === 'fulfilled' ? yelpResults.value : [];
    const fsq = fsqResults.status === 'fulfilled' ? fsqResults.value : [];
    const osm = osmResults.status === 'fulfilled' ? osmResults.value : [];

    // Merge: database primary, external enrichment
    const merged = mergeWithDatabase(dbResults, yelp, fsq, osm)
      .slice(0, numLimit)
      // Map BusinessCategory → frontend category strings for the venue shape
      .map((v: any) => {
        // Don't double-map: database results already have frontend category.
        // External results need BIZ→frontend mapping (they use source/label not category).
        if (v.sources?.includes('database')) return v;
        return {
          ...v,
          category: v.category || v.cuisine || v.categories?.[0] || v.type || 'restaurant',
        };
      });

    // Map database Business records to venue shape for the frontend
    const venues = merged.map((v: any) => {
      if (v.sources?.includes('database')) {
        return businessToVenue(v);
      }
      return {
        id: v.id,
        name: v.name,
        category: v.category || v.cuisine || v.categories?.[0] || v.type || 'restaurant',
        rating: v.rating,
        reviewCount: v.reviewCount,
        price: v.price,
        phone: v.phone,
        address: v.address,
        city: v.city,
        lat: v.lat,
        lng: v.lng,
        imageUrl: v.imageUrl,
        isOpenNow: v.isOpenNow,
        sources: v.sources || [v.source || 'unknown'],
        distance: v.distance,
        amenities: v.amenities || [],
        trustScore: v.trustScore ?? 50,
      };
    });

    res.json({
      success: true,
      data: venues,
      sources: {
        database: dbResults.length,
        yelp: yelp.length,
        foursquare: fsq.length,
        osm: osm.length,
      },
    });
  } catch (e: any) {
    console.error('Search failed:', e.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ── Venue Details (All Sources) ───────────────────────────────────────────
router.get('/venues/:source/:id', async (req: Request, res: Response) => {
  try {
    const { source, id } = req.params;
    let venue: any = null;

    switch (source) {
      case 'yelp':
        venue = await getYelpBusiness(id);
        break;
      case 'foursquare':
        venue = await getFoursquareVenue(id);
        break;
      case 'osm':
        venue = await getOSMDetails(id);
        break;
      default:
        return res.status(400).json({ error: 'Unknown source' });
    }

    if (!venue) return res.status(404).json({ error: 'Venue not found' });

    // Also try to get menu from OpenMenu
    if (venue.name) {
      venue.menu = await searchOpenMenu(venue.name, venue.lat, venue.lng);
    }

    res.json({ success: true, data: venue });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load venue details' });
  }
});

// ── Get Reviews (Yelp) ────────────────────────────────────────────────────
router.get('/reviews/:source/:id', async (req: Request, res: Response) => {
  try {
    const { source, id } = req.params;
    let reviews: any[] = [];

    if (source === 'yelp') {
      reviews = await getYelpReviews(id);
    } else if (source === 'foursquare') {
      reviews = await getFoursquareTips(id);
    }

    res.json({ success: true, data: reviews });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load reviews' });
  }
});

// ── Get Photos ─────────────────────────────────────────────────────────────
router.get('/photos/:source/:id', async (req: Request, res: Response) => {
  try {
    const { source, id } = req.params;
    let photos: string[] = [];

    if (source === 'yelp') {
      const details = await getYelpBusiness(id);
      photos = details?.photos || [];
    } else if (source === 'foursquare') {
      photos = await getFoursquarePhotos(id);
    }

    res.json({ success: true, data: photos });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load photos' });
  }
});

// ── Get Menu ───────────────────────────────────────────────────────────────
router.get('/menu', async (req: Request, res: Response) => {
  try {
    const { name, lat, lng } = req.query;
    const menu = await searchOpenMenu(name as string, lat as string, lng as string);
    res.json({ success: true, data: menu });
  } catch (e: any) {
    res.json({ success: true, data: null });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// YELP FUSION API (500 calls/day free)
// ═══════════════════════════════════════════════════════════════════════════

async function searchYelp(lat: string, lng: string, q?: string, radius?: string, limit?: string) {
  if (!YELP_API_KEY) return [];

  const params: any = {
    latitude: lat,
    longitude: lng,
    radius: Math.min(Number(radius), 40000), // Max 40k meters
    limit: Math.min(Number(limit), 50),
    sort_by: 'best_match',
  };
  if (q) params.term = q;

  const response = await axios.get('https://api.yelp.com/v3/businesses/search', {
    headers: yelpHeaders,
    params,
  });

  return (response.data?.businesses || []).map((b: any) => ({
    id: b.id,
    source: 'yelp',
    name: b.name,
    imageUrl: b.image_url,
    photos: b.photos || [],
    rating: b.rating,
    reviewCount: b.review_count,
    price: b.price,
    phone: b.display_phone,
    website: b.url,
    categories: b.categories?.map((c: any) => c.title),
    cuisine: b.categories?.[0]?.title,
    address: b.location?.display_address?.join(', '),
    city: b.location?.city,
    state: b.location?.state,
    zip: b.location?.zip_code,
    lat: b.coordinates?.latitude,
    lng: b.coordinates?.longitude,
    distance: b.distance,
    hours: b.hours?.[0]?.open?.map((h: any) => ({
      day: h.day,
      start: h.start,
      end: h.end,
    })),
    isOpenNow: b.hours?.[0]?.is_open_now,
    transactions: b.transactions,
    url: b.url,
    raw: b,
  }));
}

async function getYelpBusiness(id: string) {
  if (!YELP_API_KEY) return null;

  const response = await axios.get(`https://api.yelp.com/v3/businesses/${id}`, {
    headers: yelpHeaders,
  });

  const b = response.data;
  return {
    id: b.id,
    source: 'yelp',
    name: b.name,
    imageUrl: b.image_url,
    photos: b.photos || [],
    rating: b.rating,
    reviewCount: b.review_count,
    price: b.price,
    phone: b.display_phone,
    website: b.url,
    categories: b.categories?.map((c: any) => c.title),
    cuisine: b.categories?.[0]?.title,
    address: b.location?.display_address?.join(', '),
    city: b.location?.city,
    state: b.location?.state,
    zip: b.location?.zip_code,
    lat: b.coordinates?.latitude,
    lng: b.coordinates?.longitude,
    hours: b.hours?.[0]?.open?.map((h: any) => ({
      day: h.day,
      start: h.start,
      end: h.end,
    })),
    isOpenNow: b.hours?.[0]?.is_open_now,
    transactions: b.transactions,
    description: b.description,
    raw: b,
  };
}

async function getYelpReviews(id: string) {
  if (!YELP_API_KEY) return [];

  const response = await axios.get(`https://api.yelp.com/v3/businesses/${id}/reviews`, {
    headers: yelpHeaders,
  });

  return (response.data?.reviews || []).map((r: any) => ({
    id: r.id,
    user: r.user?.name,
    rating: r.rating,
    text: r.text,
    timeCreated: r.time_created,
    url: r.url,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// FOURSQUARE PLACES API (950 calls/day free)
// ═══════════════════════════════════════════════════════════════════════════

async function searchFoursquare(lat: string, lng: string, q?: string, radius?: string, limit?: string) {
  if (!FOURSQUARE_API_KEY) return [];

  const params: any = {
    ll: `${lat},${lng}`,
    radius: Math.min(Number(radius), 100000),
    limit: Math.min(Number(limit), 50),
  };
  if (q) params.query = q;

  const response = await axios.get('https://api.foursquare.com/v3/places/search', {
    headers: foursquareHeaders,
    params,
  });

  return (response.data?.results || []).map((r: any) => ({
    id: r.fsq_id,
    source: 'foursquare',
    name: r.name,
    categories: r.categories?.map((c: any) => c.name),
    cuisine: r.categories?.[0]?.name,
    address: r.location?.formatted_address,
    city: r.location?.locality,
    state: r.location?.region,
    zip: r.location?.postcode,
    lat: r.geocodes?.main?.latitude,
    lng: r.geocodes?.main?.longitude,
    distance: r.distance,
    website: r.website,
    tel: r.tel,
    hours: r.hours?.regular?.map((h: any) => ({
      day: h.day,
      open: h.open,
      close: h.close,
    })),
    popularity: r.popularity,
    price: r.price,
    rating: r.rating ? r.rating / 2 : null, // FSQ uses 0-10, convert to 0-5
    stats: r.stats,
    raw: r,
  }));
}

async function getFoursquareVenue(id: string) {
  if (!FOURSQUARE_API_KEY) return null;

  const response = await axios.get(`https://api.foursquare.com/v3/places/${id}`, {
    headers: foursquareHeaders,
  });

  const r = response.data;
  return {
    id: r.fsq_id,
    source: 'foursquare',
    name: r.name,
    description: r.description,
    categories: r.categories?.map((c: any) => c.name),
    cuisine: r.categories?.[0]?.name,
    address: r.location?.formatted_address,
    city: r.location?.locality,
    state: r.location?.region,
    zip: r.location?.postcode,
    lat: r.geocodes?.main?.latitude,
    lng: r.geocodes?.main?.longitude,
    website: r.website,
    tel: r.tel,
    hours: r.hours?.regular?.map((h: any) => ({
      day: h.day,
      open: h.open,
      close: h.close,
    })),
    popularity: r.popularity,
    price: r.price,
    rating: r.rating ? r.rating / 2 : null,
    stats: r.stats,
    raw: r,
  };
}

async function getFoursquareTips(id: string) {
  if (!FOURSQUARE_API_KEY) return [];

  const response = await axios.get(`https://api.foursquare.com/v3/places/${id}/tips`, {
    headers: foursquareHeaders,
  });

  return (response.data || []).map((t: any) => ({
    id: t.id,
    text: t.text,
    created_at: t.created_at,
    user: t.user?.first_name,
    lang: t.lang,
  }));
}

async function getFoursquarePhotos(id: string) {
  if (!FOURSQUARE_API_KEY) return [];

  const response = await axios.get(`https://api.foursquare.com/v3/places/${id}/photos`, {
    headers: foursquareHeaders,
  });

  return (response.data || []).map((p: any) => `${p.prefix}original${p.suffix}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// OPENSTREETMAP (Free, no API key)
// ═══════════════════════════════════════════════════════════════════════════

// ── Tiny in-memory cache: Overpass is rate-limited per-IP and Render shares
// egress IPs, so repeat loads (refresh, back-nav) must not re-hit it. ──────
const osmCache = new Map<string, { at: number; data: any[] }>();
const OSM_TTL_MS = 5 * 60 * 1000;
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

async function searchOSM(lat: string, lng: string, category?: string, radius?: string, limit?: string) {
  const categoryMap: Record<string, string> = {
    restaurant: 'amenity~"restaurant|fast_food|food_court"',
    bar: 'amenity~"bar|pub|nightclub"',
    cafe: 'amenity~"cafe|bakery"',
    club: 'amenity~"nightclub|club"',
    hotel: 'tourism~"hotel|motel|guest_house"',
    theater: 'amenity~"theatre|cinema"',
    museum: 'tourism~"museum|gallery"',
  };

  const osmTag = categoryMap[category || 'restaurant'] || 'amenity="restaurant"';

  const cacheKey = `${lat},${lng}|${osmTag}|${radius}|${limit}`;
  const cached = osmCache.get(cacheKey);
  if (cached && Date.now() - cached.at < OSM_TTL_MS) return cached.data;

  const query = `
    [out:json][timeout:20];
    (
      node[${osmTag}](around:${radius},${lat},${lng});
      way[${osmTag}](around:${radius},${lat},${lng});
    );
    out center ${limit};
  `;

  const body = `data=${encodeURIComponent(query)}`;
  let lastErr: any = null;
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const response = await axios.post(mirror, body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 20000,
      });
      const mapped = (response.data?.elements || []).map((el: any) => ({
    id: `osm-${el.id}`,
    source: 'osm',
    name: el.tags?.name || 'Unknown',
    type: el.tags?.amenity || el.tags?.tourism || el.tags?.leisure || el.tags?.shop,
    cuisine: el.tags?.cuisine,
    phone: el.tags?.phone || el.tags?.['contact:phone'],
    website: el.tags?.website || el.tags?.['contact:website'],
    email: el.tags?.email || el.tags?.['contact:email'],
    address: el.tags?.['addr:street'] ? `${el.tags['addr:street']}${el.tags['addr:housenumber'] ? ' ' + el.tags['addr:housenumber'] : ''}` : '',
    city: el.tags?.['addr:city'],
    state: el.tags?.['addr:state'],
    zip: el.tags?.['addr:postcode'],
    hours: el.tags?.opening_hours,
    lat: el.lat || el.center?.lat,
    lng: el.lon || el.center?.lon,
    wheelchair: el.tags?.wheelchair,
    outdoor: el.tags?.outdoor_seating,
    delivery: el.tags?.delivery,
    takeaway: el.tags?.takeaway,
    raw: el.tags,
      }));
      osmCache.set(cacheKey, { at: Date.now(), data: mapped });
      // Prune stale entries so the map can't grow unbounded
      if (osmCache.size > 200) {
        const now = Date.now();
        for (const [k, v] of osmCache) if (now - v.at > OSM_TTL_MS) osmCache.delete(k);
      }
      return mapped;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('All Overpass mirrors failed');
}

async function getOSMDetails(id: string) {
  // OSM doesn't have a direct "get by ID" API, so we return basic info
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// OPENMENU API (Free tier available)
// ═══════════════════════════════════════════════════════════════════════════

async function searchOpenMenu(name: string, lat?: string, lng?: string) {
  if (!OPENMENU_API_KEY || !name) return null;

  try {
    const params: any = { name };
    if (lat && lng) {
      params.latitude = lat;
      params.longitude = lng;
    }

    const response = await axios.get('https://api.openmenu.com/v1/menu', {
      params,
      headers: { 'X-API-Key': OPENMENU_API_KEY },
    });

    return {
      restaurantName: response.data?.restaurant_name,
      menus: response.data?.menus?.map((m: any) => ({
        name: m.name,
        sections: m.sections?.map((s: any) => ({
          name: s.name,
          items: s.items?.map((i: any) => ({
            name: i.name,
            description: i.description,
            price: i.price,
          })),
        })),
      })),
    };
  } catch (e) {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MERGE & DEDUPLICATE RESULTS
// ═══════════════════════════════════════════════════════════════════════════

function mergeResults(yelp: any[], fsq: any[], osm: any[]) {
  const merged = new Map<string, any>();

  // Process Foursquare results first (primary source)
  for (const venue of fsq) {
    const key = `${venue.name?.toLowerCase()}_${Math.round(venue.lat * 1000)}_${Math.round(venue.lng * 1000)}`;
    merged.set(key, { ...venue, sources: ['foursquare'] });
  }

  // Merge Yelp results as enrichment
  for (const venue of yelp) {
    const key = `${venue.name?.toLowerCase()}_${Math.round(venue.lat * 1000)}_${Math.round(venue.lng * 1000)}`;
    const existing = merged.get(key);
    if (existing) {
      if (!existing.rating && venue.rating) existing.rating = venue.rating;
      if (!existing.reviewCount && venue.reviewCount) existing.reviewCount = venue.reviewCount;
      if (!existing.website && venue.website) existing.website = venue.website;
      if (!existing.phone && venue.phone) existing.phone = venue.phone;
      if (!existing.price && venue.price) existing.price = venue.price;
      if (!existing.imageUrl && venue.imageUrl) existing.imageUrl = venue.imageUrl;
      existing.sources.push('yelp');
    } else {
      merged.set(key, { ...venue, sources: ['yelp'] });
    }
  }

  // Merge OSM results as fallback
  for (const venue of osm) {
    const key = `${venue.name?.toLowerCase()}_${Math.round(venue.lat * 1000)}_${Math.round(venue.lng * 1000)}`;
    const existing = merged.get(key);
    if (existing) {
      if (!existing.phone && venue.phone) existing.phone = venue.phone;
      if (!existing.website && venue.website) existing.website = venue.website;
      if (!existing.hours && venue.hours) existing.hours = venue.hours;
      if (!existing.address && venue.address) existing.address = venue.address;
      existing.sources.push('osm');
    } else {
      merged.set(key, { ...venue, sources: ['osm'] });
    }
  }

  return Array.from(merged.values());
}

export default router;
