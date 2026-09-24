export declare class CODEscrowService {
    createEscrow(sellerId: string, buyerId: string, data: {
        amount: number;
        description: string;
        shippingAddress?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        description: string;
        amount: number;
        buyerId: string;
        sellerId: string;
        shippingAddress: string | null;
        trackingNumber: string | null;
    }>;
    payIntoEscrow(escrowId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        description: string;
        amount: number;
        buyerId: string;
        sellerId: string;
        shippingAddress: string | null;
        trackingNumber: string | null;
    }>;
    confirmShipment(escrowId: string, trackingNumber: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        description: string;
        amount: number;
        buyerId: string;
        sellerId: string;
        shippingAddress: string | null;
        trackingNumber: string | null;
    }>;
    confirmDelivery(escrowId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        description: string;
        amount: number;
        buyerId: string;
        sellerId: string;
        shippingAddress: string | null;
        trackingNumber: string | null;
    }>;
    releaseFunds(escrowId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        description: string;
        amount: number;
        buyerId: string;
        sellerId: string;
        shippingAddress: string | null;
        trackingNumber: string | null;
    }>;
    raiseDispute(escrowId: string, reason: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        description: string;
        amount: number;
        buyerId: string;
        sellerId: string;
        shippingAddress: string | null;
        trackingNumber: string | null;
    }>;
    resolveDispute(escrowId: string, resolution: 'REFUND' | 'RELEASE'): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        description: string;
        amount: number;
        buyerId: string;
        sellerId: string;
        shippingAddress: string | null;
        trackingNumber: string | null;
    }>;
    getEscrowHistory(userId: string): Promise<({
        buyer: {
            email: string;
            id: string;
            firstName: string;
            lastName: string;
        };
        seller: {
            email: string;
            id: string;
            firstName: string;
            lastName: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        description: string;
        amount: number;
        buyerId: string;
        sellerId: string;
        shippingAddress: string | null;
        trackingNumber: string | null;
    })[]>;
    getEscrowById(escrowId: string): Promise<({
        buyer: {
            email: string;
            id: string;
            firstName: string;
            lastName: string;
        };
        seller: {
            email: string;
            id: string;
            firstName: string;
            lastName: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        description: string;
        amount: number;
        buyerId: string;
        sellerId: string;
        shippingAddress: string | null;
        trackingNumber: string | null;
    }) | null>;
}
export declare const codEscrowService: CODEscrowService;
//# sourceMappingURL=codEscrow.service.d.ts.map