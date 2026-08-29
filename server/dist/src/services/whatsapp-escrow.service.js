"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappEscrowService = exports.WhatsAppEscrowService = void 0;
const database_1 = require("../utils/database");
const vc_service_1 = require("./vc.service");
const vcService = new vc_service_1.VCService();
class WhatsAppEscrowService {
    /**
     * Initializes a new P2P Escrow between a buyer and a seller.
     * Returns a Solana Blink URL / Action Link for the buyer to fund it.
     */
    async initiateEscrow(buyerPhone, sellerPhone, amount, currency, description = 'Gig Payment') {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 14); // 14-day auto-release timer by default
        const escrow = await database_1.prisma.p2PEscrow.create({
            data: {
                buyerPhone,
                sellerPhone,
                amount,
                currency,
                description,
                status: 'PENDING',
                expiresAt,
            },
        });
        // In a real implementation, we would call the Solana Action API (Blinks) here
        // to generate a cryptographic payment link.
        const blinkUrl = `https://pabandi.com/blink/escrow/${escrow.id}`;
        return {
            escrow,
            blinkUrl,
        };
    }
    /**
     * The buyer approves the release of funds to the seller.
     */
    async approveEscrow(buyerPhone) {
        // Find the active funded/pending escrow for this buyer. 
        // In a real app with multiple concurrent escrows, we would require the ID or parse conversational context.
        const activeEscrow = await database_1.prisma.p2PEscrow.findFirst({
            where: {
                buyerPhone,
                status: { in: ['PENDING', 'FUNDED'] }
            },
            orderBy: { createdAt: 'desc' }
        });
        if (!activeEscrow) {
            throw new Error('No active escrow found for your number to approve.');
        }
        // 1. Release funds on-chain
        // Mocking the Solana SPL token transfer from the escrow vault to the seller's wallet
        const mockTxHash = `tx_p2p_release_${Date.now()}`;
        // 2. Update the Escrow record
        await database_1.prisma.p2PEscrow.update({
            where: { id: activeEscrow.id },
            data: {
                status: 'RELEASED',
                txHash: mockTxHash,
            }
        });
        // 3. Issue W3C Verifiable Credential for Reputation
        // Find seller user if they exist in our DB (optional in MVP, but needed for VC)
        const seller = await database_1.prisma.user.findFirst({
            where: { phone: activeEscrow.sellerPhone }
        });
        if (seller) {
            await vcService.issueTrustCredential(seller.id, 'GIG_COMPLETED');
            console.log(`[P2P Escrow] Issued GIG_COMPLETED Trust Credential for seller ${seller.id}`);
        }
        return activeEscrow;
    }
}
exports.WhatsAppEscrowService = WhatsAppEscrowService;
exports.whatsappEscrowService = new WhatsAppEscrowService();
//# sourceMappingURL=whatsapp-escrow.service.js.map