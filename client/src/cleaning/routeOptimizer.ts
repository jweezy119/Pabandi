import { CleaningBusinessSystem } from '../src/cleaning/businessSystem';

export class RouteOptimizer {
  private zones: Map<string, string[]> = new Map();
  private bookings: Map<string, any> = new Map();

  init() {
    // Define geographic zones for efficient routing
    this.zones.set('north', ['123 Main St', '456 Oak Ave']);
    this.zones.set('south', ['789 Pine Rd', '321 Elm St']);
    this.zones.set('east', ['654 Maple Dr', '987 Cedar Ln']);
    this.zones.set('west', ['147 Birch Way', '258 Spruce Ct']);
  }

  /**
   * Add a booking to the zone map
   * @param bookingId - Booking ID
   * @param address - Service address
   */
  addBooking(bookingId: string, address: string) {
    const zone = this.getZone(address);
    if (zone) {
      if (!this.zones.has(zone)) {
        this.zones.set(zone, []);
      }
      this.zones.get(zone)!.push(bookingId);
    }
  }

  /**
   * Get all bookings in a zone
   * @param zone - Zone name
   * @returns Array of booking IDs
   */
  getBookingsInZone(zone: string): string[] {
    return this.zones.get(zone) || [];
  }

  /**
   * Cluster bookings by geographic proximity
   * @param bookings - Array of booking objects
   * @returns Clustered route plan
   */
  clusterBookings(bookings: any[]): any[] {
    // Simple clustering by sorting and grouping nearby addresses
    const sorted = [...bookings].sort((a, b) => {
      const addrA = a.address.split('|')[0];
      const addrB = b.address.split('|')[0];
      return addrA.localeCompare(addrB);
    });

    const clusters: any[] = [];
    let currentCluster: any = null;

    for (const booking of sorted) {
      if (!currentCluster) {
        currentCluster = { bookings: [booking], members: [booking.id] };
      } else {
        // If booking is close enough to current cluster, add it
        const last = currentCluster.members[booking.id];
        if (last && this.isNearEnough(last.address, booking.address)) {
          currentCluster.members.push(booking.id);
        } else {
          // Start new cluster
          clusters.push(currentCluster);
          currentCluster = { bookings: [booking], members: [booking.id] };
        }
      }
    }

    if (currentCluster) {
      clusters.push(currentCluster);
    }

    return clusters;
  }

  private getZone(address: string): string | null {
    // Simple zone mapping - in production this would use geocoding
    const addressLower = address.toLowerCase();
    if (addressLower.includes('north')) return 'north';
    if (addressLower.includes('south')) return 'south';
    if (addressLower.includes('east')) return 'east';
    if (addressLower.includes('west')) return 'west';
    return null;
  }

  private isNearEnough(addr1: string, addr2: string): boolean {
    // Simplified distance check - in reality would use Haversine formula
    const dist = Math.abs(addr1.length - addr2.length);
    return dist <= 10; // Within 10 characters suggests proximity
  }
}

export default RouteOptimizer;