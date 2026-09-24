"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookingScraperService = exports.BookingScraperService = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
const BOOKING_SCRAPER_BASE = 'https://booking-scraper.omkar.cloud';
class BookingScraperService {
    get apiKey() {
        return process.env.BOOKING_SCRAPER_API_KEY || '';
    }
    /**
     * Search for hotels on Booking.com via the scraper API.
     * Returns up to 25 hotels per page with live prices, ratings, coordinates, photos.
     */
    async searchHotels(params) {
        if (!this.apiKey) {
            throw new Error('BOOKING_SCRAPER_API_KEY not set');
        }
        const queryParams = {
            query: params.query,
            ...(params.checkin && { checkin: params.checkin }),
            ...(params.checkout && { checkout: params.checkout }),
            ...(params.adults && { adults: String(params.adults) }),
            ...(params.children_ages && { children_ages: params.children_ages.join(',') }),
            ...(params.rooms && { rooms: String(params.rooms) }),
            ...(params.currency && { currency: params.currency }),
            ...(params.locale && { locale: params.locale }),
            ...(params.page && { page: String(params.page) }),
            ...(params.sort_by && { sort_by: params.sort_by }),
            ...(params.price_min && { price_min: String(params.price_min) }),
            ...(params.price_max && { price_max: String(params.price_max) }),
            ...(params.stars && { stars: params.stars }),
            ...(params.min_review_score && { min_review_score: String(params.min_review_score) }),
        };
        const url = `${BOOKING_SCRAPER_BASE}/booking/hotels/search`;
        logger_1.logger.info(`[BookingScraper] Searching: ${params.query} (${params.checkin} → ${params.checkout})`);
        const response = await axios_1.default.get(url, {
            params: queryParams,
            headers: { 'API-Key': this.apiKey },
            timeout: 30000,
        });
        return response.data;
    }
    /**
     * Get autocomplete suggestions for a location.
     * Returns dest_id + dest_type that can be passed to search.
     */
    async autocomplete(query, locale = 'en-us') {
        if (!this.apiKey) {
            throw new Error('BOOKING_SCRAPER_API_KEY not set');
        }
        const url = `${BOOKING_SCRAPER_BASE}/booking/hotels/autocomplete`;
        const response = await axios_1.default.get(url, {
            params: { query, locale },
            headers: { 'API-Key': this.apiKey },
            timeout: 15000,
        });
        return response.data;
    }
    /**
     * Get full hotel details including rooms, facilities, photos, policies.
     */
    async getHotelDetails(hotelSlug, checkin, checkout, adults = 2, rooms = 1, currency = 'USD', locale = 'en-us') {
        if (!this.apiKey) {
            throw new Error('BOOKING_SCRAPER_API_KEY not set');
        }
        const url = `${BOOKING_SCRAPER_BASE}/booking/hotels/details`;
        const response = await axios_1.default.get(url, {
            params: {
                hotel: hotelSlug,
                ...(checkin && { checkin }),
                ...(checkout && { checkout }),
                adults,
                rooms,
                currency,
                locale,
            },
            headers: { 'API-Key': this.apiKey },
            timeout: 30000,
        });
        return response.data;
    }
}
exports.BookingScraperService = BookingScraperService;
exports.bookingScraperService = new BookingScraperService();
//# sourceMappingURL=bookingScraper.service.js.map