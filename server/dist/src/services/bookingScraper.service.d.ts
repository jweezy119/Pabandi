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
export declare class BookingScraperService {
    private get apiKey();
    /**
     * Search for hotels on Booking.com via the scraper API.
     * Returns up to 25 hotels per page with live prices, ratings, coordinates, photos.
     */
    searchHotels(params: BookingHotelSearchParams): Promise<{
        query: string;
        destination: any;
        stay: any;
        pagination: any;
        results: BookingHotelSearchResult[];
    }>;
    /**
     * Get autocomplete suggestions for a location.
     * Returns dest_id + dest_type that can be passed to search.
     */
    autocomplete(query: string, locale?: string): Promise<{
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
    }>;
    /**
     * Get full hotel details including rooms, facilities, photos, policies.
     */
    getHotelDetails(hotelSlug: string, checkin?: string, checkout?: string, adults?: number, rooms?: number, currency?: string, locale?: string): Promise<any>;
}
export declare const bookingScraperService: BookingScraperService;
//# sourceMappingURL=bookingScraper.service.d.ts.map