export declare const socialIntegrationService: {
    connectSocialAccount(userId: string, platform: string, data: any): Promise<{
        id: string;
        userId: string;
        accessToken: string;
        refreshToken: string | null;
        platform: string;
        connectedAt: Date;
        username: string | null;
        profileUrl: string | null;
        followerCount: number | null;
    }>;
    getSocialAccounts(userId: string): Promise<{
        id: string;
        userId: string;
        accessToken: string;
        refreshToken: string | null;
        platform: string;
        connectedAt: Date;
        username: string | null;
        profileUrl: string | null;
        followerCount: number | null;
    }[]>;
    disconnectSocialAccount(userId: string, platform: string): Promise<{
        id: string;
        userId: string;
        accessToken: string;
        refreshToken: string | null;
        platform: string;
        connectedAt: Date;
        username: string | null;
        profileUrl: string | null;
        followerCount: number | null;
    }>;
    shareToSocial(userId: string, platform: string, content: any): Promise<{
        error: string;
        shareUrl?: undefined;
        platform?: undefined;
    } | {
        shareUrl: string;
        platform: string;
        error?: undefined;
    }>;
    getOAuthUrl(platform: string, redirectUri: string): Promise<string | null>;
    handleOAuthCallback(platform: string, code: string, redirectUri: string): Promise<{
        success: boolean;
        platform: string;
    }>;
    getSocialStats(userId: string): Promise<{
        accounts: {
            platform: any;
            username: any;
            followerCount: any;
            connected: boolean;
        }[];
        totalShares: number;
        sharesByPlatform: any;
    }>;
    generateDeepLink(type: string, id: string): Promise<{
        web: string;
        ios: string;
        android: string;
        app: string;
    }>;
    generateSocialEntryQR(venueId: string, eventId?: string): Promise<{
        checkInUrl: string;
        qrUrl: string;
        venueId: string;
        eventId: string | undefined;
    }>;
};
//# sourceMappingURL=socialIntegration.service.d.ts.map