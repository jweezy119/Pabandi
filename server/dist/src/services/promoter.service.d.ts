export interface RegisterPromoterData {
    name: string;
    phone?: string;
    instagram?: string;
    bio?: string;
}
export declare const promoterService: {
    /**
     * Register a new promoter profile
     */
    registerPromoter(userId: string, data: RegisterPromoterData): Promise<{
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
    }>;
    /**
     * Get promoter by user ID
     */
    getPromoterByUserId(userId: string): Promise<({
        reviews: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            rating: number;
            comment: string | null;
            promoterId: string;
        }[];
        promoCodes: {
            code: string;
            id: string;
            createdAt: Date;
            isActive: boolean;
            type: string;
            value: number;
            promoterId: string | null;
            maxUses: number;
            currentUses: number;
            validFrom: Date;
            validUntil: Date;
        }[];
    } & {
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
    }) | null>;
    /**
     * Get promoter stats (total bookings, commission, conversion rate)
     */
    getPromoterStats(promoterId: string): Promise<{
        promoterId: string;
        totalBookings: number;
        totalCommission: number;
        conversionRate: number;
        totalGuestLists: number;
        avgRating: number;
        reviewCount: number;
        thisMonthBookings: number;
        thisMonthRevenue: number;
        thisMonthCommissionEarned: number;
        avgBookingValue: number;
        revenuePerGuestList: number;
        guestListStats: {
            total: number;
            confirmed: number;
            arrived: number;
            confirmationRate: number;
            arrivalRate: number;
        };
        recentBookings: {
            id: string;
            date: Date;
            venueName: string;
            tableName: string;
            packageName: string;
            totalPrice: number;
            status: string;
        }[];
    }>;
    /**
     * Generate a unique referral code for a promoter
     */
    generateReferralCode(promoterId: string): Promise<{
        code: string;
        id: string;
        createdAt: Date;
        isActive: boolean;
        type: string;
        value: number;
        promoterId: string | null;
        maxUses: number;
        currentUses: number;
        validFrom: Date;
        validUntil: Date;
    }>;
    /**
     * Get all bookings attributed to a promoter with optional filtering
     */
    getPromoterBookings(promoterId: string, options?: {
        status?: string;
        startDate?: Date;
        endDate?: Date;
        venueId?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        bookings: ({
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
            guestList: {
                id: string;
                status: string;
                date: Date;
                partySize: number;
            } | null;
            promoter: {
                id: string;
                name: string;
                instagram: string | null;
            } | null;
            venue: {
                id: string;
                name: string;
                address: string;
                city: string;
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
        })[];
        pagination: {
            total: number;
            page: number;
            limit: number;
            pages: number;
        };
        summary: {
            totalRevenue: number;
            totalCommission: number;
            averageBookingValue: number;
            bookingsCount: number;
            thisMonthRevenue: number;
            lastMonthRevenue: number;
            monthOverMonthGrowth: number;
        };
        venueStats: any[];
    }>;
    /**
     * Get top promoters by commission (leaderboard)
     */
    getPromoterLeaderboard(limit?: number): Promise<{
        promoter: {
            id: string;
            name: string;
            instagram: string | null;
            verified: boolean;
        } | null;
        totalCommission: number;
    }[]>;
    /**
     * Credit commission to promoter wallet
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
    /**
     * Get promoter wallet balance and history
     */
    getPromoterWallet(promoterId: string): Promise<{
        promoterId: string;
        userId: string;
        balance: number;
        totalEarnings: number;
        history: {
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
        }[];
    }>;
};
//# sourceMappingURL=promoter.service.d.ts.map