/**
 * Maps Service - Geocoding and Location Services
 * Wrapper around Nominatim, Overpass API, and OSRM
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import { prisma } from '../utils/database';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const OSRM = 'https://router.project-osrm.org';

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

export class MapsService {
  /**
   * Geocode an address to coordinates
   */
  async geocode(address: string): Promise<GeocodeResult[]> {
    try {
      const response = await axios.get(`${NOMINATIM}/search`, {
        params: {
          q: address,
          format: 'json',
          limit: 5,
          'accept-language': 'en',
        },
        headers: { 'User-Agent': 'Pabandi/1.0' },
      });

      return response.data.map((item: any) => ({
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        displayName: item.display_name,
        type: item.type,
        address: item.address,
      }));
    } catch (error: any) {
      logger.error(`[Maps] Geocode error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
    try {
      const response = await axios.get(`${NOMINATIM}/reverse`, {
        params: {
          lat,
          lon: lng,
          format: 'json',
          'accept-language': 'en',
        },
        headers: { 'User-Agent': 'Pabandi/1.0' },
      });

      const data = response.data;
      return {
        lat: parseFloat(data.lat),
        lng: parseFloat(data.lon),
        displayName: data.display_name,
        type: data.type,
        address: data.address,
      };
    } catch (error: any) {
      logger.error(`[Maps] Reverse geocode error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find nearby places
   */
  async nearby(
    lat: number,
    lng: number,
    category: string,
    radius: number = 5000,
    limit: number = 20
  ): Promise<NearbyResult[]> {
    try {
      const categoryMap: Record<string, string> = {
        restaurant: 'amenity~"restaurant|fast_food|food_court"',
        cafe: 'amenity~"cafe|bakery"',
        bar: 'amenity~"bar|pub|nightclub"',
        hotel: 'tourism~"hotel|motel|guest_house"',
        hospital: 'amenity~"hospital|clinic|doctors"',
        pharmacy: 'amenity~"pharmacy"',
        school: 'amenity~"school|university|college"',
        bank: 'amenity~"bank|atm"',
        supermarket: 'shop~"supermarket|convenience"',
        mall: 'shop~"mall|department_store"',
        gym: 'leisure~"fitness_centre|sports_centre"',
        park: 'leisure~"park|playground"',
        cinema: 'amenity~"cinema"',
        theatre: 'amenity~"theatre"',
        dentist: 'amenity~"dentist"',
        doctor: 'amenity~"doctors"',
        vet: 'amenity~"veterinary"',
        laundry: 'amenity~"laundry"',
        car_wash: 'amenity~"car_wash"',
        gas: 'amenity~"fuel"',
        parking: 'amenity~"parking"',
        police: 'amenity~"police"',
        post: 'amenity~"post_office"',
        library: 'amenity~"library"',
        mosque: 'amenity~"place_of_worship"',
        church: 'amenity~"place_of_worship"',
        beauty: 'amenity~"beauty|salon"',
        salon: 'shop~"hairdresser|beauty"',
        electronics: 'shop~"electronics"',
        clothing: 'shop~"clothes|shoes"',
        furniture: 'shop~"furniture"',
        hardware: 'shop~"hardware|doityourself"',
      };

      const osmTag = categoryMap[category] || `amenity="${category}"`;

      const query = `
        [out:json][timeout:25];
        (
          node[${osmTag}](around:${radius},${lat},${lng});
          way[${osmTag}](around:${radius},${lat},${lng});
        );
        out center ${limit};
      `;

      const response = await axios.post(OVERPASS, `data=${encodeURIComponent(query)}`, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000,
      });

      return (response.data?.elements || []).map((el: any) => ({
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
      }));
    } catch (error: any) {
      logger.error(`[Maps] Nearby search error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate travel distance between two points
   */
  async distance(
    from: GeoCoordinates | string,
    to: GeoCoordinates | string,
    mode: 'driving' | 'walking' | 'cycling' = 'driving'
  ): Promise<{ distance: number; duration: number; mode: string }> {
    try {
      const fromCoord = typeof from === 'string' ? from : `${from.lng},${from.lat}`;
      const toCoord = typeof to === 'string' ? to : `${to.lng},${to.lat}`;
      
      const profile = mode === 'walking' ? 'foot' : mode === 'cycling' ? 'bike' : 'car';
      
      const response = await axios.get(`${OSRM}/route/v1/${profile}/${fromCoord};${toCoord}`, {
        params: { overview: false },
      });

      const route = response.data?.routes?.[0];
      if (!route) throw new Error('No route found');

      return {
        distance: route.distance, // meters
        duration: route.duration, // seconds
        mode,
      };
    } catch (error: any) {
      logger.error(`[Maps] Distance error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get turn-by-turn directions
   */
  async directions(
    from: GeoCoordinates | string,
    to: GeoCoordinates | string,
    mode: 'driving' | 'walking' | 'cycling' = 'driving'
  ): Promise<DirectionsResult> {
    try {
      const fromCoord = typeof from === 'string' ? from : `${from.lng},${from.lat}`;
      const toCoord = typeof to === 'string' ? to : `${to.lng},${to.lat}`;
      
      const profile = mode === 'walking' ? 'foot' : mode === 'cycling' ? 'bike' : 'car';
      
      const response = await axios.get(`${OSRM}/route/v1/${profile}/${fromCoord};${toCoord}`, {
        params: { overview: false, steps: true, geometries: 'geojson' },
      });

      const route = response.data?.routes?.[0];
      if (!route) throw new Error('No route found');

      return {
        distance: route.distance,
        duration: route.duration,
        steps: route.legs?.[0]?.steps?.map((s: any) => ({
          instruction: s.maneuver?.instruction || `${s.maneuver?.type} ${s.maneuver?.modifier || ''}`.trim(),
          distance: s.distance,
          duration: s.duration,
          road: s.name,
        })) || [],
      };
    } catch (error: any) {
      logger.error(`[Maps] Directions error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Search businesses near location
   */
  async searchNearbyBusinesses(
    lat: number,
    lng: number,
    category: string,
    radius: number = 5000
  ): Promise<any[]> {
    try {
      const businesses = await prisma.business.findMany({
        where: {
          category: category as any,
          isActive: true,
        },
      });

      // Filter by distance (simple Haversine)
      const nearby = businesses.filter((b: any) => {
        if (!b.latitude || !b.longitude) return false;
        const dist = this.haversineDistance(lat, lng, b.latitude, b.longitude);
        return dist <= radius;
      });

      return nearby.map((b: any) => ({
        ...b,
        distance: this.haversineDistance(lat, lng, b.latitude, b.longitude),
      })).sort((a: any, b: any) => a.distance - b.distance);
    } catch (error: any) {
      logger.error(`[Maps] Search businesses error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate Haversine distance between two coordinates
   */
  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

// Singleton instance
export const mapsService = new MapsService();
