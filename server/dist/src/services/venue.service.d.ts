export interface VenueFilters {
    city?: string;
    type?: string;
    date?: string;
    capacity?: number;
    genre?: string;
    amenities?: string[];
    featured?: boolean;
    active?: boolean;
    limit?: number;
    offset?: number;
}
export declare const venueService: {
    /**
     * Search venues with filters
     */
    searchVenues(filters: VenueFilters): Promise<({
        events: {
            id: string;
            createdAt: Date;
            name: string;
            updatedAt: Date;
            description: string | null;
            date: Date;
            startTime: string;
            endTime: string;
            venueId: string;
            lineup: import("@prisma/client/runtime/library").JsonValue | null;
            coverChargeMultiplier: number;
            ticketPrice: number | null;
            ticketTiers: import("@prisma/client/runtime/library").JsonValue | null;
            attendeeIds: string[];
        }[];
        reviews: {
            id: string;
            userId: string;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            rating: number;
            text: string | null;
            venueId: string;
            visitDate: Date | null;
        }[];
        bottlePackages: {
            includes: string[];
            id: string;
            createdAt: Date;
            name: string;
            updatedAt: Date;
            isActive: boolean;
            description: string;
            maxGuests: number;
            venueId: string;
            bottleType: string;
            basePrice: number;
            minSpend: number;
        }[];
        tableTypes: {
            id: string;
            createdAt: Date;
            name: string;
            updatedAt: Date;
            isActive: boolean;
            venueId: string;
            basePrice: number;
            minSpend: number;
            maxCapacity: number;
            totalCount: number;
        }[];
        coverCharges: {
            id: string;
            createdAt: Date;
            name: string;
            updatedAt: Date;
            isActive: boolean;
            type: string;
            description: string | null;
            amount: number;
            startTime: string;
            endTime: string;
            venueId: string;
            daysOfWeek: number[];
            gender: string | null;
            guestListIncluded: boolean;
        }[];
    } & {
        phone: string | null;
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        state: string;
        hours: import("@prisma/client/runtime/library").JsonValue;
        isActive: boolean;
        type: string;
        description: string | null;
        address: string;
        city: string;
        website: string | null;
        rating: number;
        instagram: string | null;
        capacity: number;
        openTime: string | null;
        closeTime: string | null;
        lat: number;
        lng: number;
        amenities: string[];
        featured: boolean;
        zip: string;
        musicGenres: string[];
        dressCode: string | null;
        images: string[];
        coverChargeDefault: number;
        minAge: number;
        daysOpen: string[];
    })[]>;
    /**
     * Get a single venue by ID with all related data
     */
    getVenueById(id: string): Promise<({
        events: {
            id: string;
            createdAt: Date;
            name: string;
            updatedAt: Date;
            description: string | null;
            date: Date;
            startTime: string;
            endTime: string;
            venueId: string;
            lineup: import("@prisma/client/runtime/library").JsonValue | null;
            coverChargeMultiplier: number;
            ticketPrice: number | null;
            ticketTiers: import("@prisma/client/runtime/library").JsonValue | null;
            attendeeIds: string[];
        }[];
        reviews: ({
            user: {
                id: string;
                firstName: string;
                lastName: string;
                profilePictureUrl: string | null;
            };
        } & {
            id: string;
            userId: string;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            rating: number;
            text: string | null;
            venueId: string;
            visitDate: Date | null;
        })[];
        bottlePackages: {
            includes: string[];
            id: string;
            createdAt: Date;
            name: string;
            updatedAt: Date;
            isActive: boolean;
            description: string;
            maxGuests: number;
            venueId: string;
            bottleType: string;
            basePrice: number;
            minSpend: number;
        }[];
        tableTypes: {
            id: string;
            createdAt: Date;
            name: string;
            updatedAt: Date;
            isActive: boolean;
            venueId: string;
            basePrice: number;
            minSpend: number;
            maxCapacity: number;
            totalCount: number;
        }[];
        coverCharges: {
            id: string;
            createdAt: Date;
            name: string;
            updatedAt: Date;
            isActive: boolean;
            type: string;
            description: string | null;
            amount: number;
            startTime: string;
            endTime: string;
            venueId: string;
            daysOfWeek: number[];
            gender: string | null;
            guestListIncluded: boolean;
        }[];
    } & {
        phone: string | null;
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        state: string;
        hours: import("@prisma/client/runtime/library").JsonValue;
        isActive: boolean;
        type: string;
        description: string | null;
        address: string;
        city: string;
        website: string | null;
        rating: number;
        instagram: string | null;
        capacity: number;
        openTime: string | null;
        closeTime: string | null;
        lat: number;
        lng: number;
        amenities: string[];
        featured: boolean;
        zip: string;
        musicGenres: string[];
        dressCode: string | null;
        images: string[];
        coverChargeDefault: number;
        minAge: number;
        daysOpen: string[];
    }) | null>;
    /**
     * Check venue availability for a given date
     */
    getVenueAvailability(venueId: string, date: string): Promise<{
        venueId: string;
        date: string;
        tables: {
            tableTypeId: string;
            name: string;
            basePrice: number;
            minSpend: number;
            maxCapacity: number;
            totalCount: number;
            availableCount: number;
            isAvailable: boolean;
        }[];
    }>;
    /**
     * Get featured venues, optionally filtered by city
     */
    getFeaturedVenues(city?: string): Promise<({
        events: {
            id: string;
            createdAt: Date;
            name: string;
            updatedAt: Date;
            description: string | null;
            date: Date;
            startTime: string;
            endTime: string;
            venueId: string;
            lineup: import("@prisma/client/runtime/library").JsonValue | null;
            coverChargeMultiplier: number;
            ticketPrice: number | null;
            ticketTiers: import("@prisma/client/runtime/library").JsonValue | null;
            attendeeIds: string[];
        }[];
        bottlePackages: {
            includes: string[];
            id: string;
            createdAt: Date;
            name: string;
            updatedAt: Date;
            isActive: boolean;
            description: string;
            maxGuests: number;
            venueId: string;
            bottleType: string;
            basePrice: number;
            minSpend: number;
        }[];
        tableTypes: {
            id: string;
            createdAt: Date;
            name: string;
            updatedAt: Date;
            isActive: boolean;
            venueId: string;
            basePrice: number;
            minSpend: number;
            maxCapacity: number;
            totalCount: number;
        }[];
    } & {
        phone: string | null;
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        state: string;
        hours: import("@prisma/client/runtime/library").JsonValue;
        isActive: boolean;
        type: string;
        description: string | null;
        address: string;
        city: string;
        website: string | null;
        rating: number;
        instagram: string | null;
        capacity: number;
        openTime: string | null;
        closeTime: string | null;
        lat: number;
        lng: number;
        amenities: string[];
        featured: boolean;
        zip: string;
        musicGenres: string[];
        dressCode: string | null;
        images: string[];
        coverChargeDefault: number;
        minAge: number;
        daysOpen: string[];
    })[]>;
    /**
     * Find venues near a geographic point
     */
    getVenuesNearby(lat: number, lng: number, radiusKm?: number): Promise<unknown>;
    /**
     * Create a new venue (admin only)
     */
    createVenue(data: any): Promise<{
        phone: string | null;
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        state: string;
        hours: import("@prisma/client/runtime/library").JsonValue;
        isActive: boolean;
        type: string;
        description: string | null;
        address: string;
        city: string;
        website: string | null;
        rating: number;
        instagram: string | null;
        capacity: number;
        openTime: string | null;
        closeTime: string | null;
        lat: number;
        lng: number;
        amenities: string[];
        featured: boolean;
        zip: string;
        musicGenres: string[];
        dressCode: string | null;
        images: string[];
        coverChargeDefault: number;
        minAge: number;
        daysOpen: string[];
    }>;
    /**
     * Update a venue (admin only)
     */
    updateVenue(id: string, data: any): Promise<{
        phone: string | null;
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        state: string;
        hours: import("@prisma/client/runtime/library").JsonValue;
        isActive: boolean;
        type: string;
        description: string | null;
        address: string;
        city: string;
        website: string | null;
        rating: number;
        instagram: string | null;
        capacity: number;
        openTime: string | null;
        closeTime: string | null;
        lat: number;
        lng: number;
        amenities: string[];
        featured: boolean;
        zip: string;
        musicGenres: string[];
        dressCode: string | null;
        images: string[];
        coverChargeDefault: number;
        minAge: number;
        daysOpen: string[];
    }>;
};
//# sourceMappingURL=venue.service.d.ts.map