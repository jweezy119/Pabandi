export declare class WhatsAppEscrowService {
    /**
     * Initializes a new P2P Escrow between a buyer and a seller.
     * Returns a Solana Blink URL / Action Link for the buyer to fund it.
     */
    initiateEscrow(buyerPhone: string, sellerPhone: string, amount: number, currency: string, description?: string): Promise<{
        escrow: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            expiresAt: Date | null;
            status: string;
            description: string | null;
            currency: string;
            amount: number;
            txHash: string | null;
            buyerPhone: string;
            sellerPhone: string;
        };
        blinkUrl: string;
    }>;
    /**
     * The buyer approves the release of funds to the seller.
     */
    approveEscrow(buyerPhone: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        expiresAt: Date | null;
        status: string;
        description: string | null;
        currency: string;
        amount: number;
        txHash: string | null;
        buyerPhone: string;
        sellerPhone: string;
    }>;
}
export declare const whatsappEscrowService: WhatsAppEscrowService;
//# sourceMappingURL=whatsapp-escrow.service.d.ts.map