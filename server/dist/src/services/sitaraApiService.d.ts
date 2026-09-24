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
declare function cacheGet<T>(key: string): T | null;
declare function cacheSet<T>(key: string, value: T): void;
export declare function geocodeAddress(address: string): Promise<GeocodeResult[]>;
export declare function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null>;
export declare function searchPOI(query: string, lat?: number, lng?: number, radius?: number): Promise<POIResult[]>;
export declare function discoverBusinesses(lat: number, lng: number, radius: number, category?: string): Promise<DiscoveredBusiness[]>;
export declare function getDistanceMatrix(origins: LatLng[], destinations: LatLng[]): Promise<DistanceMatrixResult | null>;
export declare function getRoute(from: LatLng, to: LatLng): Promise<RouteResult | null>;
export declare function getIsochrone(lat: number, lng: number, minutes: number): Promise<IsochroneResult | null>;
export declare function sendBookingConfirmation(data: BookingConfirmationEmail): Promise<boolean>;
export declare function sendPromoEmail(data: PromoEmail): Promise<boolean>;
export declare function haversineDistance(a: LatLng, b: LatLng): number;
export declare const __test__: {
    cacheGet: typeof cacheGet;
    cacheSet: typeof cacheSet;
    geocodeCache: Map<string, {
        result: any;
        timestamp: number;
    }>;
};
export {};
//# sourceMappingURL=sitaraApiService.d.ts.map