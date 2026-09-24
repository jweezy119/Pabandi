export interface SeedProfile {
    linkedinId: string;
    linkedinUrl: string;
    firstName: string;
    lastName: string;
    headline: string;
    company: string;
    industry: string;
    location: string;
    connectionCount: number;
    headlineKeywords: string[];
    profileCompleteness: number;
    trustVelocity: number;
    persona: string;
    seedSource: 'LINKEDIN_SEARCH' | 'MANUAL_IMPORT' | 'USER_REFERRAL' | 'GITHUB' | 'FIVERR' | 'ANGELLIST' | 'WELLFOUND' | 'CHAMBER';
    githubUrl?: string;
    walletAddress?: string;
}
export declare class LinkedInProfileSeeder {
    private seeded;
    /**
     * Seed profiles for all personas from public LinkedIn search.
     * Returns count of seeded profiles per persona.
     */
    seedAllProfiles(profilesPerPersona?: number): Promise<Record<string, number>>;
    /** Load real profiles from pre-verified JSON seed file. */
    loadLocalSeedData(): Array<{
        login: string;
        githubUrl: string;
        category: string;
        headline: string;
        company: string;
        location: string;
    }>;
    /** Convert a raw profile object into a Partial<SeedProfile>. */
    private prepareProfile;
    /**
     * Seed a single profile with initial trust velocity + public badge.
     */
    seedProfile(rawProfile: Partial<SeedProfile>, persona: {
        id: string;
        name: string;
    }, seedSource?: 'LINKEDIN_SEARCH' | 'MANUAL_IMPORT' | 'USER_REFERRAL' | 'GITHUB' | 'FIVERR' | 'ANGELLIST' | 'WELLFOUND' | 'CHAMBER'): Promise<SeedProfile | null>;
    /**
     * Generate a Solana wallet for a profile (deterministic from profile ID).
     * Returns the wallet address. Private key is encrypted via walletAddress hash
     * so profiles can sign transactions autonomously.
     */
    generateWalletForProfile(profile: SeedProfile): Promise<string>;
    /**
     * Fund a profile's wallet with $1 USD worth of PAB token.
     * In dev/sim mode, logs the action. In production, calls blockchain.service.
     */
    fundProfileWallet(walletAddress: string, amountUsd?: number): Promise<{
        txHash?: string;
        simulated: boolean;
        pabAmount: number;
    }>;
    private getSolanaWeb3;
    /**
     * Seed profiles + generate + fund wallets for each profile.
     * This is the "self-economy" approach: real profiles get wallets with $1 PAB,
     * then auto-interact with bookings/reservations, generating revenue from fees.
     */
    seedWithWallets(profilesPerPersona?: number, fundingUsd?: number): Promise<Record<string, {
        profiles: number;
        walletsFunded: number;
        totalPab: number;
    }>>;
    /**
     * Get a free public trust badge HTML for a seeded profile.
     * This is the FREE marketing layer — everyone gets a badge.
     */
    getTrustBadge(profile: SeedProfile): string;
    /**
     * Get premium analytics (paid feature).
     */
    getPremiumAnalytics(profile: SeedProfile): {
        trustVelocity: number;
        trustBand: string;
        projected30d: number;
        insuranceRate: string;
        pabondMultiplier: number;
        premiumFeatures: string[];
    } | null;
    /**
     * Get TrustFlux score for a seeded profile (initial velocity).
     */
    getTrustBand(velocity: number): string;
    /**
     * Get seeder stats.
     */
    getStats(): {
        totalSeeded: number;
        byPersona: Record<string, number>;
        byBand: Record<string, number>;
        avgVelocity: number;
        walletCoverage: {
            withWallet: number;
            total: number;
            percentage: number;
        };
        economy: any;
        lastEconomy: any;
    };
    /** Calculate how many seeded profiles have wallets. */
    private calculateWalletCoverage;
    /** Public list of seeded profiles. */
    getProfiles(): SeedProfile[];
    /**
     * Batch seed from a CSV upload (manual import mode).
     * Format: linkedinUrl,firstName,lastName,headline,company,industry,location
     */
    importFromCSV(csvContent: string, personaId: string): Promise<{
        imported: number;
        errors: string[];
    }>;
    /**
     * Self-Economy Simulation: seeded profiles make bookings with each other.
     * Freelancer profiles "book" project-owner profiles for services,
     * generating PAB rewards + escrow fees that flow back into the ecosystem.
     *
     * This creates a self-sustaining micro-economy: seeded wallets fund bookings,
     * booking fees generate platform revenue, revenue funds new profile wallets.
     */
    simulateSelfEconomy(rounds?: number): Promise<{
        bookingsMade: number;
        pabRewarded: number;
        pabFees: number;
        pabBurned: number;
        roundsCompleted: number;
    }>;
    catch(err: any): void;
    private sleep;
}
export declare const linkedinProfileSeeder: LinkedInProfileSeeder;
//# sourceMappingURL=linkedinProfileSeeder.service.d.ts.map