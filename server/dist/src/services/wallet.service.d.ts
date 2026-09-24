export declare const walletService: {
    createWallet(userId: string): Promise<{
        success: boolean;
        wallet: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            usdcBalance: number;
            userId: string;
            address: string | null;
            currency: string;
            encryptedSecret: string | null;
            balance: number;
            totalStaked: number;
            lockedPab: number;
            airdropClaimed: boolean;
            airdropAmount: number | null;
            airdropClaimedAt: Date | null;
        };
        created: boolean;
        message?: undefined;
    } | {
        success: boolean;
        wallet: {
            id: string;
            address: string | null;
            balance: number;
            currency: string;
            createdAt: Date;
        };
        created: boolean;
        message?: undefined;
    } | {
        success: boolean;
        message: string;
        wallet?: undefined;
        created?: undefined;
    }>;
    getWallet(userId: string): Promise<{
        success: boolean;
        message: string;
        wallet?: undefined;
    } | {
        success: boolean;
        wallet: {
            user: {
                email: string;
                firstName: string;
                lastName: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            usdcBalance: number;
            userId: string;
            address: string | null;
            currency: string;
            encryptedSecret: string | null;
            balance: number;
            totalStaked: number;
            lockedPab: number;
            airdropClaimed: boolean;
            airdropAmount: number | null;
            airdropClaimedAt: Date | null;
        };
        message?: undefined;
    }>;
    updateBalance(userId: string, amount: number, currency?: string): Promise<{
        success: boolean;
        message: string;
        wallet?: undefined;
    } | {
        success: boolean;
        wallet: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            usdcBalance: number;
            userId: string;
            address: string | null;
            currency: string;
            encryptedSecret: string | null;
            balance: number;
            totalStaked: number;
            lockedPab: number;
            airdropClaimed: boolean;
            airdropAmount: number | null;
            airdropClaimedAt: Date | null;
        };
        message?: undefined;
    }>;
    claimAirdrop(userId: string): Promise<{
        success: boolean;
        message: string;
        amount?: undefined;
    } | {
        success: boolean;
        message: string;
        amount: number;
    }>;
};
//# sourceMappingURL=wallet.service.d.ts.map