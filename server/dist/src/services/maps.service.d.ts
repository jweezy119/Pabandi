/**
 * Maps Service - Geocoding and Location Services
 * Wrapper around Nominatim, Overpass API, and OSRM
 */
export interface GeoCoordinates {
    lat: number;
    lng: number;
}
export interface GeocodeResult {
    lat: number;
    lng: number;
    displayName: string;
    type: string;
    address?: any;
}
export interface NearbyResult {
    id: number;
    name: string;
    type: string;
    lat: number;
    lng: number;
    phone?: string;
    website?: string;
    address?: string;
    city?: string;
    hours?: string;
    cuisine?: string;
    wheelchair?: string;
    outdoor?: string;
    delivery?: string;
}
export interface DirectionsStep {
    instruction: string;
    distance: number;
    duration: number;
    road: string;
}
export interface DirectionsResult {
    distance: number;
    duration: number;
    steps: DirectionsStep[];
}
export declare class MapsService {
    /**
     * Geocode an address to coordinates
     */
    geocode(address: string): Promise<GeocodeResult[]>;
    /**
     * Reverse geocode coordinates to address
     */
    reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null>;
    /**
     * Find nearby places
     */
    nearby(lat: number, lng: number, category: string, radius?: number, limit?: number): Promise<NearbyResult[]>;
    /**
     * Calculate travel distance between two points
     */
    distance(from: GeoCoordinates | string, to: GeoCoordinates | string, mode?: 'driving' | 'walking' | 'cycling'): Promise<{
        distance: number;
        duration: number;
        mode: string;
    }>;
    /**
     * Get turn-by-turn directions
     */
    directions(from: GeoCoordinates | string, to: GeoCoordinates | string, mode?: 'driving' | 'walking' | 'cycling'): Promise<DirectionsResult>;
    /**
     * Search businesses near location
     */
    searchNearbyBusinesses(lat: number, lng: number, category: string, radius?: number): Promise<any[]>;
    /**
     * Calculate Haversine distance between two coordinates
     */
    private haversineDistance;
    private toRad;
}
export declare const mapsService: MapsService;
//# sourceMappingURL=maps.service.d.ts.map