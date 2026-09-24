export interface CreateBookingData {
    userId: string;
    venueId: string;
    tableTypeId: string;
    bottlePackageId: string;
    date: string;
    guestCount: number;
    arrivalTime: string;
    specialRequests?: string;
    guestListId?: string;
    promoterId?: string;
    promoCode?: string;
}
export declare const bottleBookingService: {
    /**
     * Create a new bottle/table booking
     */
    createBooking(data: CreateBookingData): Promise<{
        bottlePackage: {
            includes: string[];
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            isActive: boolean;
            description: string;
            venueId: string;
            bottleType: string;
            basePrice: number;
            minSpend: number;
            maxGuests: number;
        };
        tableType: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            isActive: boolean;
            venueId: string;
            basePrice: number;
            minSpend: number;
            maxCapacity: number;
            totalCount: number;
        };
        venue: {
            phone: string | null;
            state: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            hours: import("@prisma/client/runtime/library").JsonValue;
            isActive: boolean;
            type: string;
            description: string | null;
            address: string;
            city: string;
            website: string | null;
            rating: number;
            instagram: string | null;
            zip: string;
            amenities: string[];
            capacity: number;
            openTime: string | null;
            closeTime: string | null;
            featured: boolean;
            lat: number;
            lng: number;
            musicGenres: string[];
            dressCode: string | null;
            images: string[];
            coverChargeDefault: number;
            minAge: number;
            daysOpen: string[];
        };
    } & {
        promoCode: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        status: string;
        specialRequests: string | null;
        depositAmount: number;
        depositPaid: boolean;
        guestCount: number;
        date: Date;
        venueId: string;
        promoterId: string | null;
        confirmationCode: string;
        tableTypeId: string;
        bottlePackageId: string;
        arrivalTime: string;
        totalPrice: number;
        coverChargeAmount: number;
        guestListId: string | null;
    }>;
    /**
     * Calculate dynamic pricing multiplier
     */
    calculateDynamicPricing(venueId: string, date: string): Promise<number>;
    /**
     * Confirm a booking
     */
    confirmBooking(bookingId: string): Promise<{
        bottlePackage: {
            includes: string[];
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            isActive: boolean;
            description: string;
            venueId: string;
            bottleType: string;
            basePrice: number;
            minSpend: number;
            maxGuests: number;
        };
        tableType: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            isActive: boolean;
            venueId: string;
            basePrice: number;
            minSpend: number;
            maxCapacity: number;
            totalCount: number;
        };
        venue: {
            phone: string | null;
            state: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            hours: import("@prisma/client/runtime/library").JsonValue;
            isActive: boolean;
            type: string;
            description: string | null;
            address: string;
            city: string;
            website: string | null;
            rating: number;
            instagram: string | null;
            zip: string;
            amenities: string[];
            capacity: number;
            openTime: string | null;
            closeTime: string | null;
            featured: boolean;
            lat: number;
            lng: number;
            musicGenres: string[];
            dressCode: string | null;
            images: string[];
            coverChargeDefault: number;
            minAge: number;
            daysOpen: string[];
        };
    } & {
        promoCode: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        status: string;
        specialRequests: string | null;
        depositAmount: number;
        depositPaid: boolean;
        guestCount: number;
        date: Date;
        venueId: string;
        promoterId: string | null;
        confirmationCode: string;
        tableTypeId: string;
        bottlePackageId: string;
        arrivalTime: string;
        totalPrice: number;
        coverChargeAmount: number;
        guestListId: string | null;
    }>;
    /**
     * Cancel a booking
     */
    cancelBooking(bookingId: string): Promise<{
        bottlePackage: {
            includes: string[];
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            isActive: boolean;
            description: string;
            venueId: string;
            bottleType: string;
            basePrice: number;
            minSpend: number;
            maxGuests: number;
        };
        tableType: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            isActive: boolean;
            venueId: string;
            basePrice: number;
            minSpend: number;
            maxCapacity: number;
            totalCount: number;
        };
        venue: {
            phone: string | null;
            state: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            hours: import("@prisma/client/runtime/library").JsonValue;
            isActive: boolean;
            type: string;
            description: string | null;
            address: string;
            city: string;
            website: string | null;
            rating: number;
            instagram: string | null;
            zip: string;
            amenities: string[];
            capacity: number;
            openTime: string | null;
            closeTime: string | null;
            featured: boolean;
            lat: number;
            lng: number;
            musicGenres: string[];
            dressCode: string | null;
            images: string[];
            coverChargeDefault: number;
            minAge: number;
            daysOpen: string[];
        };
    } & {
        promoCode: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        status: string;
        specialRequests: string | null;
        depositAmount: number;
        depositPaid: boolean;
        guestCount: number;
        date: Date;
        venueId: string;
        promoterId: string | null;
        confirmationCode: string;
        tableTypeId: string;
        bottlePackageId: string;
        arrivalTime: string;
        totalPrice: number;
        coverChargeAmount: number;
        guestListId: string | null;
    }>;
    /**
     * Get all bookings for a user
     */
    getUserBookings(userId: string): Promise<({
        bottlePackage: {
            id: string;
            name: string;
            bottleType: string;
            basePrice: number;
        };
        tableType: {
            id: string;
            name: string;
            basePrice: number;
        };
        venue: {
            id: string;
            name: string;
            address: string;
            city: string;
            images: string[];
        };
    } & {
        promoCode: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        status: string;
        specialRequests: string | null;
        depositAmount: number;
        depositPaid: boolean;
        guestCount: number;
        date: Date;
        venueId: string;
        promoterId: string | null;
        confirmationCode: string;
        tableTypeId: string;
        bottlePackageId: string;
        arrivalTime: string;
        totalPrice: number;
        coverChargeAmount: number;
        guestListId: string | null;
    })[]>;
    /**
     * Get a single booking by ID
     */
    getBookingById(bookingId: string): Promise<({
        bottlePackage: {
            includes: string[];
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            isActive: boolean;
            description: string;
            venueId: string;
            bottleType: string;
            basePrice: number;
            minSpend: number;
            maxGuests: number;
        };
        tableType: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            isActive: boolean;
            venueId: string;
            basePrice: number;
            minSpend: number;
            maxCapacity: number;
            totalCount: number;
        };
        guestList: {
            email: string | null;
            phone: string | null;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            status: string;
            noShowProbability: number;
            depositAmount: number;
            depositStatus: string;
            date: Date;
            partySize: number;
            venueId: string;
            eventId: string | null;
            promoterId: string | null;
            guestNames: string[];
            confirmationCode: string;
            rewarded: boolean;
        } | null;
        promoter: {
            phone: string | null;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            userId: string;
            isActive: boolean;
            instagram: string | null;
            verified: boolean;
            bio: string | null;
        } | null;
        venue: {
            phone: string | null;
            state: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            hours: import("@prisma/client/runtime/library").JsonValue;
            isActive: boolean;
            type: string;
            description: string | null;
            address: string;
            city: string;
            website: string | null;
            rating: number;
            instagram: string | null;
            zip: string;
            amenities: string[];
            capacity: number;
            openTime: string | null;
            closeTime: string | null;
            featured: boolean;
            lat: number;
            lng: number;
            musicGenres: string[];
            dressCode: string | null;
            images: string[];
            coverChargeDefault: number;
            minAge: number;
            daysOpen: string[];
        };
    } & {
        promoCode: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        status: string;
        specialRequests: string | null;
        depositAmount: number;
        depositPaid: boolean;
        guestCount: number;
        date: Date;
        venueId: string;
        promoterId: string | null;
        confirmationCode: string;
        tableTypeId: string;
        bottlePackageId: string;
        arrivalTime: string;
        totalPrice: number;
        coverChargeAmount: number;
        guestListId: string | null;
    }) | null>;
    /**
     * Check in a booking (mark as arrived/completed)
     */
    checkInBooking(bookingId: string, staffId?: string): Promise<{
        bottlePackage: {
            includes: string[];
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            isActive: boolean;
            description: string;
            venueId: string;
            bottleType: string;
            basePrice: number;
            minSpend: number;
            maxGuests: number;
        };
        tableType: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            isActive: boolean;
            venueId: string;
            basePrice: number;
            minSpend: number;
            maxCapacity: number;
            totalCount: number;
        };
        venue: {
            phone: string | null;
            state: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            hours: import("@prisma/client/runtime/library").JsonValue;
            isActive: boolean;
            type: string;
            description: string | null;
            address: string;
            city: string;
            website: string | null;
            rating: number;
            instagram: string | null;
            zip: string;
            amenities: string[];
            capacity: number;
            openTime: string | null;
            closeTime: string | null;
            featured: boolean;
            lat: number;
            lng: number;
            musicGenres: string[];
            dressCode: string | null;
            images: string[];
            coverChargeDefault: number;
            minAge: number;
            daysOpen: string[];
        };
    } & {
        promoCode: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        status: string;
        specialRequests: string | null;
        depositAmount: number;
        depositPaid: boolean;
        guestCount: number;
        date: Date;
        venueId: string;
        promoterId: string | null;
        confirmationCode: string;
        tableTypeId: string;
        bottlePackageId: string;
        arrivalTime: string;
        totalPrice: number;
        coverChargeAmount: number;
        guestListId: string | null;
    }>;
    /**
     * Credit promoter commission
     */
    creditPromoter(promoterId: string, amount: number, bookingId: string): Promise<{
        id: string;
        createdAt: Date;
        businessId: string | null;
        type: import(".prisma/client").$Enums.LedgerEntryType;
        currency: string;
        amount: number;
        reservationId: string | null;
        profileId: string;
        platformFeeBasis: number | null;
        commissionRate: number | null;
        isReversed: boolean;
        payoutId: string | null;
    } | null>;
};
//# sourceMappingURL=bottleBooking.service.d.ts.map