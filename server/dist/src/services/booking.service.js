"use strict";
/**
 * booking.service.ts — BookingOS Service
 * Renamed from sitaraApiService.ts
 * Provides geocoding, routing, and email services for the BookingOS module.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookingService = exports.BookingService = exports.BusinessCategory = void 0;
exports.createBookingWithDeposit = createBookingWithDeposit;
exports.confirmPaymentAndCreateEscrow = confirmPaymentAndCreateEscrow;
exports.releaseEscrowToBusiness = releaseEscrowToBusiness;
exports.getBookingDetails = getBookingDetails;
var BusinessCategory;
(function (BusinessCategory) {
    BusinessCategory["RESTAURANT"] = "RESTAURANT";
    BusinessCategory["SALON"] = "SALON";
    BusinessCategory["SPA"] = "SPA";
    BusinessCategory["CLINIC"] = "CLINIC";
    BusinessCategory["FITNESS_CENTER"] = "FITNESS_CENTER";
    BusinessCategory["EVENT_VENUE"] = "EVENT_VENUE";
    BusinessCategory["HOTEL"] = "HOTEL";
    BusinessCategory["PROPERTY_RENTAL"] = "PROPERTY_RENTAL";
    BusinessCategory["OTHER"] = "OTHER";
})(BusinessCategory || (exports.BusinessCategory = BusinessCategory = {}));
// ── Category mapping from OSM tags ────────────────────────────────────────
const CATEGORY_TO_OSM = {
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
const TAG_TO_CATEGORY = {
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
const MIN_INTERVAL_MS = 1000;
async function rateLimited(fn) {
    const now = Date.now();
    const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastRequestTime));
    if (wait > 0) {
        await new Promise((r) => setTimeout(r, wait));
    }
    lastRequestTime = Date.now();
    return fn();
}
// ── In-memory cache (geocode, 1 hour TTL) ─────────────────────────────────
const CACHE_TTL_MS = 60 * 60 * 1000;
const geocodeCache = new Map();
function cacheGet(key) {
    const entry = geocodeCache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
        return entry.result;
    }
    if (entry)
        geocodeCache.delete(key);
    return null;
}
function cacheSet(key, value) {
    geocodeCache.set(key, { result: value, timestamp: Date.now() });
}
// ── Constants ─────────────────────────────────────────────────────────────
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const OVERPASS_BASE = 'https://overpass-api.de/api/interpreter';
const ORS_BASE = 'https://api.openrouteservice.org';
const RESEND_BASE = 'https://api.resend.com';
const USER_AGENT = 'Pabandi/1.0 (contact@pabandi.com)';
const REQUEST_TIMEOUT = 10000;
// ── BookingOS Service Class ───────────────────────────────────────────────
class BookingService {
    async geocodeAddress(address) {
        const cached = cacheGet(`geo:${address}`);
        if (cached)
            return cached;
        return rateLimited(async () => {
            try {
                const axios = (await Promise.resolve().then(() => __importStar(require('axios')))).default;
                const response = await axios.get(`${NOMINATIM_BASE}/search`, {
                    params: { q: address, format: 'json', limit: 5, addressdetails: 1 },
                    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
                    timeout: REQUEST_TIMEOUT,
                });
                const results = (response.data || []).map((item) => ({
                    lat: parseFloat(item.lat),
                    lng: parseFloat(item.lon),
                    displayName: item.display_name,
                    type: item.type,
                }));
                cacheSet(`geo:${address}`, results);
                return results;
            }
            catch (err) {
                console.warn(`[BookingService] geocodeAddress failed: ${err?.message || err}`);
                return [];
            }
        });
    }
    async reverseGeocode(lat, lng) {
        const cacheKey = `revgeo:${lat.toFixed(5)},${lng.toFixed(5)}`;
        const cached = cacheGet(cacheKey);
        if (cached)
            return cached;
        return rateLimited(async () => {
            try {
                const axios = (await Promise.resolve().then(() => __importStar(require('axios')))).default;
                const response = await axios.get(`${NOMINATIM_BASE}/reverse`, {
                    params: { lat, lon: lng, format: 'json', addressdetails: 1 },
                    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
                    timeout: REQUEST_TIMEOUT,
                });
                const result = {
                    displayName: response.data.display_name,
                    address: response.data.address,
                };
                cacheSet(cacheKey, result);
                return result;
            }
            catch (err) {
                console.warn(`[BookingService] reverseGeocode failed: ${err?.message || err}`);
                return null;
            }
        });
    }
    async searchPOI(query, lat, lng, radius) {
        return rateLimited(async () => {
            try {
                const axios = (await Promise.resolve().then(() => __importStar(require('axios')))).default;
                const params = { q: query, format: 'json', limit: 20, addressdetails: 1 };
                if (lat != null && lng != null) {
                    params.viewbox = `${lng - 0.1},${lat + 0.1},${lng + 0.1},${lat - 0.1}`;
                    params.bounded = 1;
                }
                const response = await axios.get(`${NOMINATIM_BASE}/search`, {
                    params,
                    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
                    timeout: REQUEST_TIMEOUT,
                });
                return (response.data || []).map((item) => ({
                    name: item.display_name.split(',')[0] || query,
                    lat: parseFloat(item.lat),
                    lng: parseFloat(item.lon),
                    category: item.type || item.class || 'poi',
                    tags: { osmType: item.type, osmClass: item.class, osmId: String(item.osm_id || ''), importance: String(item.importance || '') },
                }));
            }
            catch (err) {
                console.warn(`[BookingService] searchPOI failed: ${err?.message || err}`);
                return [];
            }
        });
    }
    async discoverBusinesses(lat, lng, radius, category) {
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
            const axios = (await Promise.resolve().then(() => __importStar(require('axios')))).default;
            const response = await axios.post(OVERPASS_BASE, `data=${encodeURIComponent(query)}`, { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT }, timeout: REQUEST_TIMEOUT + 5000 });
            const elements = response.data?.elements || [];
            return elements
                .filter((el) => el.tags?.name)
                .map((el) => {
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
                    address: tags['addr:street'] ? `${tags['addr:street']}${tags['addr:housenumber'] ? ' ' + tags['addr:housenumber'] : ''}` : undefined,
                };
            })
                .filter((b) => b.lat != null && b.lng != null);
        }
        catch (err) {
            console.warn(`[BookingService] discoverBusinesses failed: ${err?.message || err}`);
            return [];
        }
    }
    async getDistanceMatrix(origins, destinations) {
        try {
            const axios = (await Promise.resolve().then(() => __importStar(require('axios')))).default;
            const apiKey = process.env.OPENROUTESERVICE_API_KEY;
            const coordinates = [
                ...origins.map((o) => [o.lng, o.lat]),
                ...destinations.map((d) => [d.lng, d.lat]),
            ];
            const response = await axios.post(`${ORS_BASE}/v2/matrix/driving-car`, {
                locations: coordinates,
                sources: origins.map((_, i) => i),
                destinations: origins.map((_, i) => i + origins.length),
                metrics: ['distance', 'duration'],
            }, { headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: apiKey } : {}), 'User-Agent': USER_AGENT }, timeout: REQUEST_TIMEOUT });
            return { distances: response.data.distances || [], durations: response.data.durations || [] };
        }
        catch (err) {
            console.warn(`[BookingService] getDistanceMatrix failed: ${err?.message || err}`);
            return null;
        }
    }
    async getRoute(from, to) {
        try {
            const axios = (await Promise.resolve().then(() => __importStar(require('axios')))).default;
            const apiKey = process.env.OPENROUTESERVICE_API_KEY;
            const response = await axios.post(`${ORS_BASE}/v2/directions/driving-car`, { coordinates: [[from.lng, from.lat], [to.lng, to.lat]] }, { headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: apiKey } : {}), 'User-Agent': USER_AGENT }, timeout: REQUEST_TIMEOUT });
            const route = response.data?.routes?.[0];
            if (!route)
                return null;
            return { distance: route.summary?.distance ?? 0, duration: route.summary?.duration ?? 0, geometry: route.geometry };
        }
        catch (err) {
            console.warn(`[BookingService] getRoute failed: ${err?.message || err}`);
            return null;
        }
    }
    async getIsochrone(lat, lng, minutes) {
        try {
            const axios = (await Promise.resolve().then(() => __importStar(require('axios')))).default;
            const apiKey = process.env.OPENROUTESERVICE_API_KEY;
            const response = await axios.post(`${ORS_BASE}/v2/isochrones/driving-car`, { locations: [[lng, lat]], range: [minutes * 60], range_type: 'time' }, { headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: apiKey } : {}), 'User-Agent': USER_AGENT }, timeout: REQUEST_TIMEOUT });
            return response.data;
        }
        catch (err) {
            console.warn(`[BookingService] getIsochrone failed: ${err?.message || err}`);
            return null;
        }
    }
    async sendBookingConfirmation(data) {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            console.log(`[BookingService] RESEND_API_KEY not set — booking confirmation email logged to console only.\n` +
                `  To: ${data.to}\n  Business: ${data.businessName}\n  Date: ${data.date}\n  Time: ${data.time}\n  Guests: ${data.guests}`);
            return true;
        }
        try {
            const axios = (await Promise.resolve().then(() => __importStar(require('axios')))).default;
            await axios.post(`${RESEND_BASE}/emails`, {
                from: 'BookingOS <bookings@pabandi.com>',
                to: [data.to],
                subject: `Booking confirmed: ${data.businessName}`,
                html: `<div style="font-family: system-ui, sans-serif; padding: 20px;"><h1 style="color: #1a1a1a;">Booking Confirmed</h1><p>Your reservation at <strong>${data.businessName}</strong> is confirmed.</p><table style="margin: 16px 0;"><tr><td><strong>Date:</strong></td><td>${data.date}</td></tr><tr><td><strong>Time:</strong></td><td>${data.time}</td></tr><tr><td><strong>Guests:</strong></td><td>${data.guests}</td></tr></table><p style="color: #666; font-size: 12px;">Powered by BookingOS</p></div>`,
            }, { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: REQUEST_TIMEOUT });
            return true;
        }
        catch (err) {
            console.warn(`[BookingService] sendBookingConfirmation failed: ${err?.message || err}`);
            return false;
        }
    }
    async sendPromoEmail(data) {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            console.log(`[BookingService] RESEND_API_KEY not set — promo email logged to console only.\n` +
                `  To: ${data.to}\n  Business: ${data.businessName}\n  Promo: ${data.promoTitle}\n  Description: ${data.promoDescription}`);
            return true;
        }
        try {
            const axios = (await Promise.resolve().then(() => __importStar(require('axios')))).default;
            await axios.post(`${RESEND_BASE}/emails`, {
                from: 'BookingOS <promos@pabandi.com>',
                to: [data.to],
                subject: `Special offer from ${data.businessName}`,
                html: `<div style="font-family: system-ui, sans-serif; padding: 20px;"><h1 style="color: #1a1a1a;">${data.promoTitle}</h1><p>${data.businessName} has a special offer for you!</p><div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;"><p>${data.promoDescription}</p></div><p style="color: #666; font-size: 12px;">Powered by BookingOS</p></div>`,
            }, { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: REQUEST_TIMEOUT });
            return true;
        }
        catch (err) {
            console.warn(`[BookingService] sendPromoEmail failed: ${err?.message || err}`);
            return false;
        }
    }
    haversineDistance(a, b) {
        const R = 6371e3;
        const φ1 = (a.lat * Math.PI) / 180;
        const φ2 = (b.lat * Math.PI) / 180;
        const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
        const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
        const x = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    }
}
exports.BookingService = BookingService;
// ── Stub Functions (for controller imports) ────────────────────────────────
async function createBookingWithDeposit(data) {
    console.log('[BookingService] createBookingWithDeposit called', data);
    let ap2Mandates = null;
    if (data.intentMandate && data.cartMandate && data.paymentMandate) {
        ap2Mandates = {
            intentMandate: data.intentMandate,
            cartMandate: data.cartMandate,
            paymentMandate: data.paymentMandate,
        };
        console.log('[AP2] Storing mandates for booking', JSON.stringify(ap2Mandates));
    }
    return {
        success: true,
        message: 'Booking created',
        bookingReference: `BK-${Date.now()}`,
        reservationId: null,
        depositAmount: data?.depositAmount || 0,
        paymentUrl: null,
        paymentId: null,
        paymentMethod: data?.paymentMethod || null,
        raastId: null,
        ap2Mandates,
    };
}
async function confirmPaymentAndCreateEscrow(bookingReference, paymentData) {
    console.log('[BookingService] confirmPaymentAndCreateEscrow called (stub)', bookingReference, paymentData);
    return {
        success: true,
        message: 'Payment confirmed (stub)',
        escrowId: null,
    };
}
async function releaseEscrowToBusiness(escrowId, userId) {
    console.log('[BookingService] releaseEscrowToBusiness called (stub)', escrowId, userId);
    return {
        success: true,
        message: 'Escrow released (stub)',
        releasedAmount: 0,
        releaseFee: 0,
        netToBusiness: 0,
    };
}
async function getBookingDetails(id, reference) {
    console.log('[BookingService] getBookingDetails called (stub)', id, reference);
    return null;
}
exports.bookingService = new BookingService();
//# sourceMappingURL=booking.service.js.map