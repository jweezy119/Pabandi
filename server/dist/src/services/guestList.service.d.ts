export interface AddToGuestListData {
    userId: string;
    venueId: string;
    eventId?: string;
    date: string;
    partySize: number;
    guestNames: string[];
    email?: string;
    phone?: string;
}
export declare const guestListService: {
    /**
     * Add an entry to the guest list
     */
    addToGuestList(data: AddToGuestListData): Promise<{
        venue: {
            id: string;
            name: string;
            address: string;
            city: string;
        };
    } & {
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
    }>;
    /**
     * Get guest list for a venue on a specific date
     */
    getGuestList(venueId: string, date?: string): Promise<({
        promoter: {
            id: string;
            name: string;
            instagram: string | null;
        } | null;
    } & {
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
    })[]>;
    /**
     * Get guest list entries by user ID
     */
    getGuestListByUser(userId: string): Promise<({
        venue: {
            id: string;
            name: string;
            address: string;
            city: string;
            images: string[];
        };
    } & {
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
    })[]>;
    /**
     * Confirm a guest list entry
     */
    confirmGuestListEntry(id: string): Promise<{
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
    }>;
    /**
     * Check in a guest
     */
    checkInGuest(id: string): Promise<{
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
    }>;
    /**
     * Cancel a guest list entry
     */
    cancelGuestListEntry(id: string): Promise<{
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
    }>;
    /**
     * Predict no-show probability based on user history and venue data
     */
    predictNoShow(userId: string, venueId: string): Promise<number>;
};
//# sourceMappingURL=guestList.service.d.ts.map