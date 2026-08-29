export declare class OAuthService {
    /**
     * Validate if a client exists and the redirect URI is allowed.
     */
    validateClientAndRedirect(clientId: string, redirectUri: string): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        clientSecret: string;
        updatedAt: Date;
        isActive: boolean;
        clientId: string;
        logoUrl: string | null;
        redirectUris: string[];
        webhookUrl: string | null;
        webhookSecret: string | null;
    }>;
    /**
     * Generate a short-lived authorization code for a user.
     */
    generateAuthorizationCode(clientId: string, userId: string, redirectUri: string): Promise<string>;
    /**
     * Exchange an authorization code for an access token (and refresh token).
     */
    exchangeCodeForToken(clientId: string, clientSecret: string, code: string, redirectUri: string): Promise<{
        access_token: string;
        token_type: string;
        expires_in: number;
        refresh_token: string;
        id_token: string;
    }>;
    /**
     * Fetch the UserInfo payload based on a valid access token.
     * Returns Trust Passport data.
     */
    getUserInfo(accessToken: string): Promise<{
        sub: string;
        name: string;
        email: string;
        email_verified: boolean;
        trust_passport: {
            trust_score: number;
            trust_band: string;
            handle: string | null;
            badges: string[];
            verifications: Array<{
                type: string;
                verifiedAt: Date | null;
            }>;
        };
    }>;
}
export declare const oauthService: OAuthService;
//# sourceMappingURL=oauth.service.d.ts.map