// Sitara OS — Frugal Open-Source API Service
// Wraps free/open APIs: Nominatim (OSM), Overpass API, OpenRouteService, Resend.
// All external calls are lazy-loaded, rate-limited, and gracefully degraded.

// ── Types ──────────────────────────────────────────────────────────────────

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
  type?: string;
}

export interface ReverseGeocodeResult {
  displayName: string;
  address?: Record<string, string>;
}

export interface POIResult {
  name: string;
  lat: number;
  lng: number;
  category: string;
  tags: Record<string, string>;
}

export interface DiscoveredBusiness {
  name: string;
  lat: number;
  lng: number;
  category: string;
  tags: Record<string, string>;
  phone?: string;
  website?: string;
  email?: string;
  address?: string;
}

export interface RouteResult {
  distance: number; // meters
  duration: number; // seconds
  geometry?: any;
}

export interface DistanceMatrixResult {
  distances: number[][];
  durations: number[][];
}

export interface IsochroneResult {
  type: 'FeatureCollection';
  features: any[];
}

export interface BookingConfirmationEmail {
  to: string;
  businessName: string;
  date: string;
  time: string;
  guests: number;
}

export interface PromoEmail {
  to: string;
  businessName: string;
  promoTitle: string;
  promoDescription: string;
}

// ── BusinessCategory enum (mirrors Prisma schema) ─────────────────────────

export enum BusinessCategory {
  RESTAURANT = 'RESTAURANT',
  SALON = 'SALON',
  SPA = 'SPA',
  CLINIC = 'CLINIC',
  FITNESS_CENTER = 'FITNESS_CENTER',
  EVENT_VENUE = 'EVENT_VENUE',
  HOTEL = 'HOTEL',
  PROPERTY_RENTAL = 'PROPERTY_RENTAL',
  OTHER = 'OTHER',
}

// ── Category mapping from OSM tags ────────────────────────────────────────

const CATEGORY_TO_OSM: Record<string, string> = {
  [BusinessCategory.RESTAURANT]: 'amenity~"restaurant|fast_food|food_cood_court"',
  [BusinessCategory.SALON]: 'shop~"hairdresser|beauty"',
  [BusinessCategory.SPA]: 'leisure~"spa|fitness_centre"',
  [BusinessCategory.CLINIC]: 'amenity~"clinic|doctors|hospital"',
  [BusinessCategory.FITNESS_CENTER]: 'leisure~"fitness_centre|sports_centre"',
  [BusinessCategory.EVENT_VENUE]: 'amenity~"events_venue|conference_centre|theatre"',
  [BusinessCategory.HOTEL]: 'tourism~"hotel|motel|guest_house"',
  [BusinessCategory.PROPERTY_RENTAL]: 'building~"apartments|commercial"',
  [BusinessCategory.OTHER]: 'amenity',
};

const TAG_TO_CATEGORY: Record<string, BusinessCategory> = {
  restaurant: BusinessCategory.RESTAURANT,
  fast_food: BusinessCategory.RESTAURANT,
  food_court: BusinessCategory.RESTAURANT,
  hairdresser: BusinessCategory.SALON,
  beauty: BusinessCategory.SALON,
  spa: BusinessCategory.SPA,
  fitness_centre: BusinessCategory.FITNESS_CENTER,
  sports_centre: BusinessCategory.FITNESS_CENTER,
  clinic: BusinessCategory.CLINIC,
  doctors: BusinessCategory.CLINIC,
  hospital: BusinessCategory.CLINIC,
  events_venue: BusinessCategory.EVENT_VENUE,
  conference_centre: BusinessCategory.EVENT_VENUE,
  theatre: BusinessCategory.EVENT_VENUE,
  cinema: BusinessCategory.EVENT_VENUE,
  hotel: BusinessCategory.HOTEL,
  motel: BusinessCategory.HOTEL,
  guest_house: BusinessCategory.HOTEL,
  bar: BusinessCategory.OTHER,
  cafe: BusinessCategory.RESTAURANT,
  pub: BusinessCategory.OTHER,
  nightclub: BusinessCategory.OTHER,
  shop: BusinessCategory.OTHER,
  supermarket: BusinessCategory.OTHER,
  bank: BusinessCategory.OTHER,
  pharmacy: BusinessCategory.OTHER,
};

// ── Rate limiter (simple in-memory queue) ─────────────────────────────────

let lastRequestTime = 0;
const MIN_INTERVAL_MS = 1000; // 1 req/sec for Nominatim

async function rateLimited<T>(fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastRequestTime));
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestTime = Date.now();
  return fn();
}

// ── In-memory cache (geocode, 1 hour TTL) ─────────────────────────────────

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const geocodeCache = new Map<string, { result: any; timestamp: number }>();

function cacheGet<T>(key: string): T | null {
  const entry = geocodeCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return entry.result as T;
  }
  if (entry) geocodeCache.delete(key);
  return null;
}

function cacheSet<T>(key: string, value: T): void {
  geocodeCache.set(key, { result: value, timestamp: Date.now() });
}

// ── Constants ─────────────────────────────────────────────────────────────

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const OVERPASS_BASE = 'https://overpass-api.de/api/interpreter';
const ORS_BASE = 'https://api.openrouteservice.org';
const RESEND_BASE = 'https://api.resend.com';

const USER_AGENT = 'Pabandi/1.0 (contact@pabandi.com)';
const REQUEST_TIMEOUT = 10000; // 10s

// ── Nominatim: Forward geocoding ──────────────────────────────────────────

export async function geocodeAddress(address: string): Promise<GeocodeResult[]> {
  const cached = cacheGet<GeocodeResult[]>(`geo:${address}`);
  if (cached) return cached;

  return rateLimited(async () => {
    try {
      const axios = (await import('axios')).default;
      const response = await axios.get(`${NOMINATIM_BASE}/search`, {
        params: {
          q: address,
          format: 'json',
          limit: 5,
          addressdetails: 1,
        },
        headers: {
          'User-Agent': USER_AGENT,
          'Accept-Language': 'en',
        },
        timeout: REQUEST_TIMEOUT,
      });

      const results: GeocodeResult[] = (response.data || []).map((item: any) => ({
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        displayName: item.display_name,
        type: item.type,
      }));

      cacheSet(`geo:${address}`, results);
      return results;
    } catch (err: any) {
      console.warn(`[SitaraApi] geocodeAddress failed: ${err?.message || err}`);
      return [];
    }
  });
}

// ── Nominatim: Reverse geocoding ──────────────────────────────────────────

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  const cacheKey = `revgeo:${lat.toFixed(5)},${lng.toFixed(5)}`;
  const cached = cacheGet<ReverseGeocodeResult>(cacheKey);
  if (cached) return cached;

  return rateLimited(async () => {
    try {
      const axios = (await import('axios')).default;
      const response = await axios.get(`${NOMINATIM_BASE}/reverse`, {
        params: {
          lat,
          lon: lng,
          format: 'json',
          addressdetails: 1,
        },
        headers: {
          'User-Agent': USER_AGENT,
          'Accept-Language': 'en',
        },
        timeout: REQUEST_TIMEOUT,
      });

      const result: ReverseGeocodeResult = {
        displayName: response.data.display_name,
        address: response.data.address,
      };
      cacheSet(cacheKey, result);
      return result;
    } catch (err: any) {
      console.warn(`[SitaraApi] reverseGeocode failed: ${err?.message || err}`);
      return null;
    }
  });
}

// ── Nominatim: POI search ─────────────────────────────────────────────────

export async function searchPOI(
  query: string,
  lat?: number,
  lng?: number,
  radius?: number
): Promise<POIResult[]> {
  return rateLimited(async () => {
    try {
      const axios = (await import('axios')).default;
      const params: Record<string, any> = {
        q: query,
        format: 'json',
        limit: 20,
        addressdetails: 1,
      };

      if (lat != null && lng != null) {
        const viewRadius = radius ?? 10000;
        params.viewbox = `${lng - 0.1},${lat + 0.1},${lng + 0.1},${lat - 0.1}`;
        params.bounded = 1;
      }

      const response = await axios.get(`${NOMINATIM_BASE}/search`, {
        params,
        headers: {
          'User-Agent': USER_AGENT,
          'Accept-Language': 'en',
        },
        timeout: REQUEST_TIMEOUT,
      });

      return (response.data || []).map((item: any) => ({
        name: item.display_name.split(',')[0] || query,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        category: item.type || item.class || 'poi',
        tags: {
          osmType: item.type,
          osmClass: item.class,
          osmId: String(item.osm_id || ''),
          importance: String(item.importance || ''),
        },
      }));
    } catch (err: any) {
      console.warn(`[SitaraApi] searchPOI failed: ${err?.message || err}`);
      return [];
    }
  });
}

// ── Overpass API: Business discovery ──────────────────────────────────────

export async function discoverBusinesses(
  lat: number,
  lng: number,
  radius: number,
  category?: string
): Promise<DiscoveredBusiness[]> {
  try {
    const osmTag = category ? (CATEGORY_TO_OSM[category] || `amenity="${category.toLowerCase()}"`) : 'amenity';

    const query = `
      [out:json][timeout:25];
      (
        node[${osmTag}](around:${radius},${lat},${lng});
        way[${osmTag}](around:${radius},${lat},${lng});
        relation[${osmTag}](around:${radius},${lat},${lng});
      );
      out center 30;
    `;

    const axios = (await import('axios')).default;
    const response = await axios.post(
      OVERPASS_BASE,
      `data=${encodeURIComponent(query)}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
        },
        timeout: REQUEST_TIMEOUT + 5000, // Overpass can be slow
      }
    );

    const elements = response.data?.elements || [];
    return elements
      .filter((el: any) => el.tags?.name)
      .map((el: any) => {
        const tags = el.tags || {};
        const amenity = tags.amenity || tags.shop || tags.tourism || tags.leisure || tags.building || '';
        const mappedCategory = TAG_TO_CATEGORY[amenity] || BusinessCategory.OTHER;

        return {
          name: tags.name,
          lat: el.lat || el.center?.lat,
          lng: el.lon || el.center?.lon,
          category: mappedCategory,
          tags,
          phone: tags.phone || tags['contact:phone'],
          website: tags.website || tags['contact:website'],
          email: tags.email || tags['contact:email'],
          address: tags['addr:street']
            ? `${tags['addr:street']}${tags['addr:housenumber'] ? ' ' + tags['addr:housenumber'] : ''}`
            : undefined,
        } as DiscoveredBusiness;
      })
      .filter((b: DiscoveredBusiness) => b.lat != null && b.lng != null);
  } catch (err: any) {
    console.warn(`[SitaraApi] discoverBusinesses failed: ${err?.message || err}`);
    return [];
  }
}

// ── OpenRouteService: Distance matrix ──────────────────────────────────────

export async function getDistanceMatrix(
  origins: LatLng[],
  destinations: LatLng[]
): Promise<DistanceMatrixResult | null> {
  try {
    const axios = (await import('axios')).default;
    const apiKey = process.env.OPENROUTESERVICE_API_KEY;

    const coordinates = [
      ...origins.map((o) => [o.lng, o.lat]),
      ...destinations.map((d) => [d.lng, d.lat]),
    ];

    const response = await axios.post(
      `${ORS_BASE}/v2/matrix/driving-car`,
      {
        locations: coordinates,
        sources: origins.map((_, i) => i),
        destinations: origins.map((_, i) => i + origins.length),
        metrics: ['distance', 'duration'],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: apiKey } : {}),
          'User-Agent': USER_AGENT,
        },
        timeout: REQUEST_TIMEOUT,
      }
    );

    return {
      distances: response.data.distances || [],
      durations: response.data.durations || [],
    };
  } catch (err: any) {
    console.warn(`[SitaraApi] getDistanceMatrix failed: ${err?.message || err}`);
    return null;
  }
}

// ── OpenRouteService: Route ───────────────────────────────────────────────

export async function getRoute(from: LatLng, to: LatLng): Promise<RouteResult | null> {
  try {
    const axios = (await import('axios')).default;
    const apiKey = process.env.OPENROUTESERVICE_API_KEY;

    const response = await axios.post(
      `${ORS_BASE}/v2/directions/driving-car`,
      {
        coordinates: [
          [from.lng, from.lat],
          [to.lng, to.lat],
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: apiKey } : {}),
          'User-Agent': USER_AGENT,
        },
        timeout: REQUEST_TIMEOUT,
      }
    );

    const route = response.data?.routes?.[0];
    if (!route) return null;

    return {
      distance: route.summary?.distance ?? 0,
      duration: route.summary?.duration ?? 0,
      geometry: route.geometry,
    };
  } catch (err: any) {
    console.warn(`[SitaraApi] getRoute failed: ${err?.message || err}`);
    return null;
  }
}

// ── OpenRouteService: Isochrone ───────────────────────────────────────────

export async function getIsochrone(
  lat: number,
  lng: number,
  minutes: number
): Promise<IsochroneResult | null> {
  try {
    const axios = (await import('axios')).default;
    const apiKey = process.env.OPENROUTESERVICE_API_KEY;

    const response = await axios.post(
      `${ORS_BASE}/v2/isochrones/driving-car`,
      {
        locations: [[lng, lat]],
        range: [minutes * 60], // seconds
        range_type: 'time',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: apiKey } : {}),
          'User-Agent': USER_AGENT,
        },
        timeout: REQUEST_TIMEOUT,
      }
    );

    return response.data as IsochroneResult;
  } catch (err: any) {
    console.warn(`[SitaraApi] getIsochrone failed: ${err?.message || err}`);
    return null;
  }
}

// ── Resend: Booking confirmation email ────────────────────────────────────

export async function sendBookingConfirmation(data: BookingConfirmationEmail): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(
      `[SitaraApi] RESEND_API_KEY not set — booking confirmation email logged to console only.\n` +
      `  To: ${data.to}\n  Business: ${data.businessName}\n  Date: ${data.date}\n  Time: ${data.time}\n  Guests: ${data.guests}`
    );
    return true; // graceful fallback
  }

  try {
    const axios = (await import('axios')).default;
    await axios.post(
      `${RESEND_BASE}/emails`,
      {
        from: 'Sitara OS <bookings@pabandi.com>',
        to: [data.to],
        subject: `Booking confirmed: ${data.businessName}`,
        html: `
          <div style="font-family: system-ui, sans-serif; padding: 20px;">
            <h1 style="color: #1a1a1a;">Booking Confirmed</h1>
            <p>Your reservation at <strong>${data.businessName}</strong> is confirmed.</p>
            <table style="margin: 16px 0;">
              <tr><td><strong>Date:</strong></td><td>${data.date}</td></tr>
              <tr><td><strong>Time:</strong></td><td>${data.time}</td></tr>
              <tr><td><strong>Guests:</strong></td><td>${data.guests}</td></tr>
            </table>
            <p style="color: #666; font-size: 12px;">Powered by Sitara OS</p>
          </div>
        `,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: REQUEST_TIMEOUT,
      }
    );
    return true;
  } catch (err: any) {
    console.warn(`[SitaraApi] sendBookingConfirmation failed: ${err?.message || err}`);
    return false;
  }
}

// ── Resend: Promo email ───────────────────────────────────────────────────

export async function sendPromoEmail(data: PromoEmail): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(
      `[SitaraApi] RESEND_API_KEY not set — promo email logged to console only.\n` +
      `  To: ${data.to}\n  Business: ${data.businessName}\n  Promo: ${data.promoTitle}\n  Description: ${data.promoDescription}`
    );
    return true; // graceful fallback
  }

  try {
    const axios = (await import('axios')).default;
    await axios.post(
      `${RESEND_BASE}/emails`,
      {
        from: 'Sitara OS <promos@pabandi.com>',
        to: [data.to],
        subject: `Special offer from ${data.businessName}`,
        html: `
          <div style="font-family: system-ui, sans-serif; padding: 20px;">
            <h1 style="color: #1a1a1a;">${data.promoTitle}</h1>
            <p>${data.businessName} has a special offer for you!</p>
            <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p>${data.promoDescription}</p>
            </div>
            <p style="color: #666; font-size: 12px;">Powered by Sitara OS</p>
          </div>
        `,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: REQUEST_TIMEOUT,
      }
    );
    return true;
  } catch (err: any) {
    console.warn(`[SitaraApi] sendPromoEmail failed: ${err?.message || err}`);
    return false;
  }
}

// ── Utility: Haversine distance (fallback when ORS unavailable) ────────────

export function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371e3;
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export const __test__ = { cacheGet, cacheSet, geocodeCache };
