export declare class SolanaCnftService {
    private umi;
    private treeAddress;
    constructor();
    /**
     * Mint a Compressed NFT (cNFT) for Proof of Visit
     */
    mintProofOfVisitCnft(customerWallet: string, businessName: string, businessId: string): Promise<{
        txHash: string;
    } | null>;
}
export declare const solanaCnftService: SolanaCnftService;
//# sourceMappingURL=solana-cnft.service.d.ts.map