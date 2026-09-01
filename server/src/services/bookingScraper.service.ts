import axios from 'axios';
import { logger } from '../utils/logger';

const BOOKING_SCRAPER_BASE = 'https://booking-scraper.omkar.cloud';

export interface BookingHotelSearchParams {
  query: string;
  checkin?: string;
  checkout?: string;
  adults?: number;
  children_ages?: number[];
  rooms?: number;
  currency?: string;
  locale?: string;
  page?: number;
  sort_by?: string;
  price_min?: number;
  price_max?: number;
  stars?: string;
  min_review_score?: number;
}

export interface BookingHotelSearchResult {
  id: number;
  name: string;
  link: string;
  page_name: string;
  accommodation_type: string;
  image: string;
  location: {
    address: string;
    city: string;
    country_code: string;
    latitude: number;
    longitude: number;
    distance_from_center: string;
    nearest_public_transport: string;
    is_centrally_located: boolean;
  };
  rating: {
    score: number;
    count: number;
    word: string;
    stars: number;
  };
  price: {
    currency: string;
    total: number;
    per_night: number | null;
    before_discount: number | null;
    charges_info: string;
  };
  is_preferred: boolean;
  is_sponsored: boolean;
  is_sold_out: boolean;
}

export class BookingScraperService {
  private get apiKey() {
    return process.env.BOOKING_SCRAPER_API_KEY || '';
  }

  /**
   * Search for hotels on Booking.com via the scraper API.
   * Returns up to 25 hotels per page with live prices, ratings, coordinates, photos.
   */
  public async searchHotels(params: BookingHotelSearchParams): Promise<{
    query: string;
    destination: any;
    stay: any;
    pagination: any;
    results: BookingHotelSearchResult[];
  }> {
    if (!this.apiKey) {
      throw new Error('BOOKING_SCRAPER_API_KEY not set');
    }

    const queryParams: Record<string, string> = {
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
    logger.info(`[BookingScraper] Searching: ${params.query} (${params.checkin} → ${params.checkout})`);

    const response = await axios.get(url, {
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
  public async autocomplete(query: string, locale = 'en-us'): Promise<{
    query: string;
    locale: string;
    count: number;
    results: Array<{
      dest_id: string;
      dest_type: string;
      name: string;
      label: string;
      region: string;
      country_code: string;
      latitude: number;
      longitude: number;
      nr_hotels: number;
      nr_homes: number;
      image: string;
    }>;
  }> {
    if (!this.apiKey) {
      throw new Error('BOOKING_SCRAPER_API_KEY not set');
    }

    const url = `${BOOKING_SCRAPER_BASE}/booking/hotels/autocomplete`;
    const response = await axios.get(url, {
      params: { query, locale },
      headers: { 'API-Key': this.apiKey },
      timeout: 15000,
    });

    return response.data;
  }

  /**
   * Get full hotel details including rooms, facilities, photos, policies.
   */
  public async getHotelDetails(
    hotelSlug: string,
    checkin?: string,
    checkout?: string,
    adults = 2,
    rooms = 1,
    currency = 'USD',
    locale = 'en-us'
  ): Promise<any> {
    if (!this.apiKey) {
      throw new Error('BOOKING_SCRAPER_API_KEY not set');
    }

    const url = `${BOOKING_SCRAPER_BASE}/booking/hotels/details`;
    const response = await axios.get(url, {
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

export const bookingScraperService = new BookingScraperService();
