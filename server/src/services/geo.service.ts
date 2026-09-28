import { prisma } from '../utils/database';

export const geoService = {
  geocodeAddress,
  reverseGeocode,
  calculateDistance,
  isWithinRadius,
  getStaticMapUrl,
  autocompleteAddress,
};

const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY || '';
const GEOAPIFY_BASE = 'https://api.geoapify.com/v1';

interface GeoResult {
  lat: number;
  lng: number;
  formatted: string;
  confidence: number;
  city?: string;
  postalCode?: string;
  country?: string;
  state?: string;
}

interface RouteResult {
  miles: number;
  minutes: number;
  distanceKm: number;
  timeSeconds: number;
}

interface DistanceCheck {
  withinRadius: boolean;
  distanceMiles: number;
  distanceMeters: number;
  driveMinutes: number;
}

function cacheKey(prefix: string, ...parts: string[]): string {
  return `${prefix}:${parts.join(':')}`;
}

async function getCached<T>(key: string): Promise<T | null> {
  const cached = await prisma.cacheEntry.findUnique({ where: { key } });
  if (cached && cached.expiresAt > new Date()) {
    return JSON.parse(cached.value) as T;
  }
  return null;
}

async function setCache<T>(key: string, value: T, ttlHours = 24): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  await prisma.cacheEntry.upsert({
    where: { key },
    update: { value: JSON.stringify(value), expiresAt },
    create: { key, value: JSON.stringify(value), expiresAt },
  });
}

async function fetchWithCache<T>(key: string, fetcher: () => Promise<T>, ttlHours = 24): Promise<T> {
  const cached = await getCached<T>(key);
  if (cached) return cached;
  const result = await fetcher();
  await setCache(key, result, ttlHours);
  return result;
}

export async function geocodeAddress(address: string): Promise<GeoResult> {
  if (!GEOAPIFY_API_KEY) {
    throw new Error('GEOAPIFY_API_KEY not configured');
  }

  const key = cacheKey('geocode', address.toLowerCase().trim());
  return fetchWithCache(key, async () => {
    const params = new URLSearchParams({
      text: address,
      apiKey: GEOAPIFY_API_KEY,
      limit: '1',
      format: 'json',
    });

    const res = await fetch(`${GEOAPIFY_BASE}/geocode/search?${params}`);
    if (!res.ok) {
      throw new Error(`Geoapify geocode failed: ${res.status}`);
    }

    const data = await res.json();
    if (!data.features || data.features.length === 0) {
      throw new Error('No results found for address');
    }

    const feature = data.features[0];
    const props = feature.properties;
    const coords = feature.geometry.coordinates; // [lng, lat]

    return {
      lat: coords[1],
      lng: coords[0],
      formatted: props.formatted,
      confidence: props.rank?.confidence || 0,
      city: props.city,
      postalCode: props.postcode,
      country: props.country,
      state: props.state,
    };
  });
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeoResult> {
  if (!GEOAPIFY_API_KEY) {
    throw new Error('GEOAPIFY_API_KEY not configured');
  }

  const key = cacheKey('reverse', `${lat},${lng}`);
  return fetchWithCache(key, async () => {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lng.toString(),
      apiKey: GEOAPIFY_API_KEY,
      format: 'json',
    });

    const res = await fetch(`${GEOAPIFY_BASE}/geocode/reverse?${params}`);
    if (!res.ok) {
      throw new Error(`Geoapify reverse geocode failed: ${res.status}`);
    }

    const data = await res.json();
    if (!data.features || data.features.length === 0) {
      throw new Error('No results found for coordinates');
    }

    const feature = data.features[0];
    const props = feature.properties;
    const coords = feature.geometry.coordinates;

    return {
      lat: coords[1],
      lng: coords[0],
      formatted: props.formatted,
      confidence: props.rank?.confidence || 1,
      city: props.city,
      postalCode: props.postcode,
      country: props.country,
      state: props.state,
    };
  });
}

export async function calculateDistance(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<RouteResult> {
  if (!GEOAPIFY_API_KEY) {
    throw new Error('GEOAPIFY_API_KEY not configured');
  }

  const key = cacheKey('route', `${originLat},${originLng}`, `${destLat},${destLng}`);
  return fetchWithCache(key, async () => {
    const params = new URLSearchParams({
      waypoints: `${originLat},${originLng}|${destLat},${destLng}`,
      mode: 'drive',
      apiKey: GEOAPIFY_API_KEY,
      format: 'json',
    });

    const res = await fetch(`${GEOAPIFY_BASE}/routing?${params}`);
    if (!res.ok) {
      throw new Error(`Geoapify routing failed: ${res.status}`);
    }

    const data = await res.json();
    if (!data.features || data.features.length === 0) {
      throw new Error('No route found');
    }

    const feature = data.features[0];
    const props = feature.properties;

    return {
      miles: props.distance / 1609.34,
      minutes: props.time / 60,
      distanceKm: props.distance / 1000,
      timeSeconds: props.time,
    };
  });
}

export async function isWithinRadius(
  businessLat: number,
  businessLng: number,
  clientLat: number,
  clientLng: number,
  radiusMiles: number
): Promise<DistanceCheck> {
  const route = await calculateDistance(businessLat, businessLng, clientLat, clientLng);
  const withinRadius = route.miles <= radiusMiles;

  return {
    withinRadius,
    distanceMiles: route.miles,
    distanceMeters: route.distanceKm * 1000,
    driveMinutes: route.minutes,
  };
}

export async function getStaticMapUrl(options: {
  center: { lat: number; lng: number };
  zoom?: number;
  width?: number;
  height?: number;
  markers?: Array<{ lat: number; lng: number; color?: string; icon?: string }>;
  polyline?: string;
}): Promise<string> {
  if (!GEOAPIFY_API_KEY) {
    throw new Error('GEOAPIFY_API_KEY not configured');
  }

  const params = new URLSearchParams({
    apiKey: GEOAPIFY_API_KEY,
    center: `lonlat:${options.center.lng},${options.center.lat}`,
    zoom: (options.zoom || 12).toString(),
    width: (options.width || 400).toString(),
    height: (options.height || 300).toString(),
    format: 'png',
  });

  if (options.markers && options.markers.length > 0) {
    const markerStrs = options.markers.map(m => {
      let str = `lonlat:${m.lng},${m.lat}`;
      if (m.color) str += `;color:${m.color}`;
      if (m.icon) str += `;icon:${m.icon}`;
      return str;
    });
    params.append('marker', markerStrs.join('|'));
  }

  if (options.polyline) {
    params.append('polyline', options.polyline);
  }

  return `${GEOAPIFY_BASE}/staticmap?${params}`;
}

export async function autocompleteAddress(input: string, options?: { bias?: { lat: number; lng: number }; limit?: number }): Promise<GeoResult[]> {
  if (!GEOAPIFY_API_KEY) {
    throw new Error('GEOAPIFY_API_KEY not configured');
  }

  const params = new URLSearchParams({
    text: input,
    apiKey: GEOAPIFY_API_KEY,
    limit: (options?.limit || 5).toString(),
    format: 'json',
  });

  if (options?.bias) {
    params.append('bias', `proximity:${options.bias.lng},${options.bias.lat}`);
  }

  const res = await fetch(`${GEOAPIFY_BASE}/geocode/autocomplete?${params}`);
  if (!res.ok) {
    throw new Error(`Geoapify autocomplete failed: ${res.status}`);
  }

  const data = await res.json();
  if (!data.features || data.features.length === 0) {
    return [];
  }

  return data.features.map((f: any) => {
    const coords = f.geometry.coordinates;
    const props = f.properties;
    return {
      lat: coords[1],
      lng: coords[0],
      formatted: props.formatted,
      confidence: props.rank?.confidence || 0,
      city: props.city,
      postalCode: props.postcode,
      country: props.country,
      state: props.state,
    };
  });
}