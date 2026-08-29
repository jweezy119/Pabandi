export declare class AutonomousEconomyService {
    private conn;
    private treasury;
    private feeWallet;
    private yieldVault;
    /** Net on-chain SOL revenue (fee wallet inflow) for the profitability report. */
    netSolRevenue(sinceDays?: number): Promise<{
        inSol: number;
        outSol: number;
        netSol: number;
        usd: number;
    }>;
    quoteRake(payer: string, solAmount: number): Promise<{
        payer: string;
        solAmount: number;
        rakeSol: number;
        netToProtocol: number;
    }>;
    /**
     * HUMAN SOL rake — the real external inflow. A human (or any external wallet) sends
     * `solAmount` SOL; we take a 1% platform rake on-chain into the FEE wallet and route
     * the rest into the protocol (treasury). The payer signs + broadcasts the returned
     * base64 tx. Returns { serializedTx, rakeSol, netToProtocol, bookingRef }.
     * This is genuine profit: external SOL in, 1% skimmed, rest settles the booking.
     */
    demoBook(opts?: {
        referralCode?: string;
        partnerId?: string;
        agentId?: string;
        gigId?: string;
        solAmount?: number;
    }): Promise<{
        bookingRef: string;
        rakeSol: number;
        referralSol: number;
        partnerSol: number;
        stakePab: number;
        agentId: string | null;
        simulated: true;
    }>;
    /** Business dashboard: a referrer's posted gigs, bookings, and rake earned (all SOL, real ledger). */
    businessDashboard(referralCode: string): Promise<{
        referralCode: string;
        postedGigs: number;
        bookings: number;
        rakeSolEarned: number;
        referralSolEarned: number;
        pabStaked: number;
    }>;
    chargeRake(payer: string, solAmount: number, bookingRef?: string, opts?: {
        referralCode?: string;
        partnerId?: string;
    }): Promise<{
        serializedTx: string;
        rakeSol: number;
        netToProtocol: number;
        bookingRef: string;
        referralSol: number;
        partnerSol: number;
    }>;
    /**
     * Confirm a human rake: verify the tx landed on-chain, mark the pending charge
     * DEPLOYED, and record the SOL revenue. `txHash` is the broadcasted signature.
     */
    confirmRake(bookingRef: string, txHash: string): Promise<{
        confirmed: boolean;
        rakeSol: number;
        referralSol?: number;
        partnerSol?: number;
    }>;
    /**
     * YIELD ROUTER (option Y) — agents route a USER's external SOL into JitoSOL staking.
     * Treasury NEVER deploys its own capital: the user's SOL funds the stake, the platform
     * skims a one-time entry fee (PLATFORM_YIELD_FEE, default 0.5%) into the fee wallet,
     * and the user receives JitoSOL (yield-bearing) at the current swap rate. Profit =
     * the skim, earned entirely on external SOL. Autonomous + zero treasury risk.
     *
     * Returns a partial-signed tx: the user signs + broadcasts. The treasury pre-signs the
     * fee leg; the stake leg is a Jito pool SOL->JitoSOL swap (simplified transfer to the
     * Jito pool's deposit; full stake-pool ix is wired for mainnet when volume justifies).
     */
    routeToYield(user: string, solAmount: number, bookingRef?: string, opts?: {
        partnerId?: string;
    }): Promise<{
        serializedTx: string;
        platformFeeSol: number;
        estJitosol: number;
        bookingRef: string;
        partnerSol: number;
    }>;
    /** Quote the yield route without signing: expected platform fee + JitoSOL out. */
    quoteYield(user: string, solAmount: number): Promise<{
        user: string;
        solAmount: number;
        platformFeeSol: number;
        estJitosol: number;
        note: string;
    }>;
    /** Confirm a yield route: verify on-chain, mark the pending fee DEPLOYED as revenue. */
    confirmYield(bookingRef: string, txHash: string): Promise<{
        confirmed: boolean;
        platformFeeSol: number;
        partnerSol?: number;
    }>;
    /** Referral earnings (Tier-2 idea 5): total claimable SOL + $PAB for a referral code. */
    referralStats(referralCode: string): Promise<{
        code: string;
        earnedSol: number;
        earnedPab: number;
        claims: number;
    }>;
    /** Partner infra-fee earnings (Tier-2 idea 6): total SOL skimmed for a partner. */
    partnerStats(partnerId: string): Promise<{
        partnerId: string;
        earnedSol: number;
        bookings: number;
    }>;
    /** Public leaderboard (social proof): top referrers + partners by SOL earned.
     *  Demo rows (meta.demo === true) are excluded so the public view stays real. */
    leaderboard(limit?: number): Promise<{
        referrers: {
            code: string;
            earnedSol: number;
            earnedPab: number;
            claims: number;
        }[];
        partners: {
            partnerId: string;
            earnedSol: number;
            bookings: number;
        }[];
    }>;
    autonomousReinvest(): Promise<{
        stakedSol: number;
        note: string;
    }>;
}
export declare const autonomousEconomyService: AutonomousEconomyService;
//# sourceMappingURL=autonomousEconomy.service.d.ts.map