import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

// ── OpenStreetMap / Nominatim Integration ─────────────────────────────────
// Free, no API key required. Rate limit: 1 req/s.

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const OVERPASS = 'https://overpass-api.de/api/interpreter';

// Geocode an address to lat/lng
router.get('/geocode', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'q required' });

    const response = await axios.get(`${NOMINATIM}/search`, {
      params: { q, format: 'json', limit: 1 },
      headers: { 'User-Agent': 'Pabandi/1.0' },
    });

    if (response.data.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    const result = response.data[0];
    res.json({
      success: true,
      data: {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        displayName: result.display_name,
        type: result.type,
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Geocoding failed' });
  }
});

// Reverse geocode lat/lng to address
router.get('/reverse', async (req: Request, res: Response) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

    const response = await axios.get(`${NOMINATIM}/reverse`, {
      params: { lat, lon: lng, format: 'json' },
      headers: { 'User-Agent': 'Pabandi/1.0' },
    });

    res.json({
      success: true,
      data: {
        displayName: response.data.display_name,
        address: response.data.address,
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Reverse geocoding failed' });
  }
});

// Search for nearby places (POI)
router.get('/nearby', async (req: Request, res: Response) => {
  try {
    const { lat, lng, category, radius = 5000, limit = 20 } = req.query;
    
    let queryFilter = '';
    
    // Map category to OSM tags
    const categoryMap: Record<string, string> = {
      restaurant: 'amenity~"restaurant|fast_food|food_court"',
      bar: 'amenity~"bar|pub|nightclub"',
      cafe: 'amenity~"cafe|bakery"',
      hotel: 'tourism~"hotel|motel|guest_house"',
      club: 'amenity~"nightclub|club"',
      event: 'amenity~"events_venue|conference_centre"',
      theater: 'amenity~"theatre|cinema"',
      museum: 'tourism~"museum|gallery"',
      park: 'leisure~"park|playground"',
      gym: 'leisure~"fitness_centre|sports_centre"',
      hospital: 'amenity~"hospital|clinic|doctors"',
      pharmacy: 'amenity~"pharmacy"',
      bank: 'amenity~"bank|atm"',
      gas: 'amenity~"fuel"',
      parking: 'amenity~"parking"',
      supermarket: 'shop~"supermarket|convenience"',
      mall: 'shop~"mall|department_store"',
      school: 'amenity~"school|university|college"',
      library: 'amenity~"library"',
      police: 'amenity~"police"',
      post: 'amenity~"post_office"',
      car_rental: 'amenity~"car_rental"',
      taxi: 'amenity~"taxi"',
      zoo: 'tourism~"zoo"',
      stadium: 'leisure~"stadium"',
      swim: 'leisure~"swimming_pool"',
      vet: 'amenity~"veterinary"',
      laundry: 'amenity~"laundry"',
      car_wash: 'amenity~"car_wash"',
      bookshop: 'shop~"books"',
      conv_store: 'shop~"convenience"',
      bakery: 'shop~"bakery"',
      dentist: 'amenity~"dentist"',
      doctor: 'amenity~"doctors"',
      cinema: 'amenity~"cinema"',
    };

    const osmTag = categoryMap[category as string] || `amenity="${category}"`;

    const query = `
      [out:json][timeout:15];
      (
        node[${osmTag}](around:${radius},${lat},${lng});
        way[${osmTag}](around:${radius},${lat},${lng});
      );
      out center ${limit};
    `;

    const response = await axios.post(OVERPASS, `data=${encodeURIComponent(query)}`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    });

    const results = (response.data?.elements || []).map((el: any) => ({
      id: el.id,
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
      country: el.tags?.['addr:country'],
      hours: el.tags?.opening_hours,
      lat: el.lat || el.center?.lat,
      lng: el.lon || el.center?.lon,
      wheelchair: el.tags?.wheelchair,
      outdoor: el.tags?.outdoor_seating,
      delivery: el.tags?.delivery,
      takeaway: el.tags?.takeaway,
      url: el.tags?.website ? (el.tags.website.startsWith('http') ? el.tags.website : `https://${el.tags.website}`) : null,
    }));

    res.json({ success: true, data: results });
  } catch (e: any) {
    console.error('Nearby search failed:', e.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Search by address (auto-geocode then search)
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, category, radius = 5000, limit = 20 } = req.query;
    if (!q) return res.status(400).json({ error: 'q required' });

    // First geocode
    const geoRes = await axios.get(`${NOMINATIM}/search`, {
      params: { q, format: 'json', limit: 1 },
      headers: { 'User-Agent': 'Pabandi/1.0' },
    });

    if (geoRes.data.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const { lat, lon } = geoRes.data[0];

    // Then search nearby
    const nearbyRes = await axios.get(`http://localhost:${process.env.PORT || 5000}/api/v1/maps/nearby`, {
      params: { lat, lng: lon, category, radius, limit },
    });

    res.json(nearbyRes.data);
  } catch (e: any) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get directions between two points
router.get('/directions', async (req: Request, res: Response) => {
  try {
    const { from, to, mode = 'driving' } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to required' });

    const response = await axios.get(`https://router.project-osrm.org/route/v1/${mode}/${from};${to}`, {
      params: { overview: false, steps: true },
    });

    const route = response.data?.routes?.[0];
    if (!route) return res.status(404).json({ error: 'Route not found' });

    res.json({
      success: true,
      data: {
        distance: route.distance,
        duration: route.duration,
        steps: route.legs?.[0]?.steps?.map((s: any) => ({
          instruction: s.maneuver?.instruction || `${s.maneuver?.type} ${s.maneuver?.modifier || ''}`.trim(),
          distance: s.distance,
          duration: s.duration,
          road: s.name,
        })) || [],
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Directions failed' });
  }
});

// Get timezone for coordinates
router.get('/timezone', async (req: Request, res: Response) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

    const response = await axios.get(`https://timeapi.io/api/TimeZone/coordinate`, {
      params: { latitude: lat, longitude: lng },
    });

    res.json({
      success: true,
      data: {
        timezone: response.data.timeZone,
        utcOffset: response.data.currentUtcOffset,
        localTime: response.data.time,
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Timezone lookup failed' });
  }
});

export default router;
