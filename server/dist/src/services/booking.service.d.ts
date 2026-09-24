/**
 * booking.service.ts — BookingOS Service
 * Renamed from sitaraApiService.ts
 * Provides geocoding, routing, and email services for the BookingOS module.
 */
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
    distance: number;
    duration: number;
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
export declare enum BusinessCategory {
    RESTAURANT = "RESTAURANT",
    SALON = "SALON",
    SPA = "SPA",
    CLINIC = "CLINIC",
    FITNESS_CENTER = "FITNESS_CENTER",
    EVENT_VENUE = "EVENT_VENUE",
    HOTEL = "HOTEL",
    PROPERTY_RENTAL = "PROPERTY_RENTAL",
    OTHER = "OTHER"
}
export declare class BookingService {
    geocodeAddress(address: string): Promise<GeocodeResult[]>;
    reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null>;
    searchPOI(query: string, lat?: number, lng?: number, radius?: number): Promise<POIResult[]>;
    discoverBusinesses(lat: number, lng: number, radius: number, category?: string): Promise<DiscoveredBusiness[]>;
    getDistanceMatrix(origins: LatLng[], destinations: LatLng[]): Promise<DistanceMatrixResult | null>;
    getRoute(from: LatLng, to: LatLng): Promise<RouteResult | null>;
    getIsochrone(lat: number, lng: number, minutes: number): Promise<IsochroneResult | null>;
    sendBookingConfirmation(data: BookingConfirmationEmail): Promise<boolean>;
    sendPromoEmail(data: PromoEmail): Promise<boolean>;
    haversineDistance(a: LatLng, b: LatLng): number;
}
export declare function createBookingWithDeposit(data: any): Promise<any>;
export declare function confirmPaymentAndCreateEscrow(bookingReference: string, paymentData?: any): Promise<any>;
export declare function releaseEscrowToBusiness(escrowId: string, userId: string): Promise<any>;
export declare function getBookingDetails(id: string | undefined, reference?: string): Promise<any>;
export declare const bookingService: BookingService;
//# sourceMappingURL=booking.service.d.ts.map