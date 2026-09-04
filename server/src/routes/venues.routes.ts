import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

// ── API Configuration ─────────────────────────────────────────────────────
const YELP_API_KEY = process.env.YELP_API_KEY || '';
const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY || '';
const OPENMENU_API_KEY = process.env.OPENMENU_API_KEY || '';

const yelpHeaders = { Authorization: `Bearer ${YELP_API_KEY}` };
const foursquareHeaders = { Authorization: FOURSQUARE_API_KEY };

// ── Unified Venue Search ──────────────────────────────────────────────────
// Searches Yelp, Foursquare, and OSM in parallel, deduplicates, and merges data
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { lat, lng, q, radius = 5000, limit = 20, categories } = req.query;

    // Search all sources in parallel
    const [yelpResults, fsqResults, osmResults] = await Promise.allSettled([
      searchYelp(lat as string, lng as string, q as string, radius as string, limit as string),
      searchFoursquare(lat as string, lng as string, q as string, radius as string, limit as string),
      searchOSM(lat as string, lng as string, categories as string, radius as string, limit as string),
    ]);

    // Merge and deduplicate results
    const merged = mergeResults(
      yelpResults.status === 'fulfilled' ? yelpResults.value : [],
      fsqResults.status === 'fulfilled' ? fsqResults.value : [],
      osmResults.status === 'fulfilled' ? osmResults.value : []
    );

    res.json({
      success: true,
      data: merged.slice(0, Number(limit)),
      sources: {
        yelp: yelpResults.status === 'fulfilled' ? yelpResults.value.length : 0,
        foursquare: fsqResults.status === 'fulfilled' ? fsqResults.value.length : 0,
        osm: osmResults.status === 'fulfilled' ? osmResults.value.length : 0,
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

  const query = `
    [out:json][timeout:15];
    (
      node[${osmTag}](around:${radius},${lat},${lng});
      way[${osmTag}](around:${radius},${lat},${lng});
    );
    out center ${limit};
  `;

  const response = await axios.post('https://overpass-api.de/api/interpreter', `data=${encodeURIComponent(query)}`, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15000,
  });

  return (response.data?.elements || []).map((el: any) => ({
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

  // Process Yelp results (highest priority for ratings/reviews)
  for (const venue of yelp) {
    const key = `${venue.name?.toLowerCase()}_${Math.round(venue.lat * 1000)}_${Math.round(venue.lng * 1000)}`;
    merged.set(key, { ...venue, sources: ['yelp'] });
  }

  // Merge Foursquare results
  for (const venue of fsq) {
    const key = `${venue.name?.toLowerCase()}_${Math.round(venue.lat * 1000)}_${Math.round(venue.lng * 1000)}`;
    const existing = merged.get(key);
    if (existing) {
      // Merge data, preferring existing (Yelp) for ratings but adding Foursquare data
      if (!existing.website && venue.website) existing.website = venue.website;
      if (!existing.phone && venue.tel) existing.phone = venue.tel;
      if (!existing.description && venue.description) existing.description = venue.description;
      existing.sources.push('foursquare');
    } else {
      merged.set(key, { ...venue, sources: ['foursquare'] });
    }
  }

  // Merge OSM results
  for (const venue of osm) {
    const key = `${venue.name?.toLowerCase()}_${Math.round(venue.lat * 1000)}_${Math.round(venue.lng * 1000)}`;
    const existing = merged.get(key);
    if (existing) {
      // Fill in missing data from OSM
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
