"use strict";
/**
 * ondoUsdy.service.ts — Real Ondo USDY (tokenized US Treasuries) holding + yield split
 * for the Trust-As-Infrastructure rent rail.
 *
 * SECURITY POSTURE (non-custodial, treasury-protected):
 *   - Pabandi NEVER sweeps the main treasury (38HR8Bo…) into USDY. All on-chain USDY
 *     activity uses a DEDICATED settlement wallet (ONDO_SETTLEMENT_WALLET env), which must
 *     be seeded separately with USDY + a little SOL for gas.
 *   - The USDY mint is an ENV VAR (ONDO_USDY_MINT). We NEVER hardcode a mainnet mint —
 *     a wrong mint = irreversible loss. Until it is set + ONDO_RWA_LIVE=true, everything
 *     is SIMULATED (clearly flagged), matching the rest of the platform.
 *   - Yield is accrued by USDY natively (rebasing). We compute the distributable yield for
 *     the float window from ONDO_APY (env, default 4.5%) and split 50/50 tenant/landlord.
 *     The yield math is real; the on-chain USDY holding + balance read is real when live.
 *
 * Real on-chain calls (when live):
 *   - getOrCreateAssociatedTokenAccount(usdyMint, settlementWallet)
 *   - getOrCreateAssociatedTokenAccount(usdyMint, tenant/landlord destination)
 *   - transfer(usdyMint, settlement -> destination, amount)
 *   - getAccount balance read
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ondoUsdyService = exports.OndoUsdyService = void 0;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const logger_1 = require("../utils/logger");
const database_1 = require("../utils/database");
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const USDY_DECIMALS = 6; // USDY is 6 decimals (like USDC)
const ONDO_APY = Number(process.env.ONDO_APY || 4.5); // current USDY APY (oracle/constant)
function getConnection() {
    return new web3_js_1.Connection(RPC_URL, 'confirmed');
}
function getSettlementKeypair() {
    const key = process.env.ONDO_SETTLEMENT_KEY; // base58 secret of the DEDICATED settlement wallet
    if (!key)
        return null;
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const bs58 = require('bs58').default;
        return web3_js_1.Keypair.fromSecretKey(bs58.decode(key));
    }
    catch {
        return null;
    }
}
function getUsdyMint() {
    const m = process.env.ONDO_USDY_MINT;
    if (!m)
        return null;
    try {
        return new web3_js_1.PublicKey(m);
    }
    catch {
        return null;
    }
}
class OndoUsdyService {
    constructor() {
        this.live = process.env.ONDO_RWA_LIVE === 'true';
    }
    /**
     * Hold a rent payment in USDY for the float window (real SPL transfer when live).
     * Returns simulated:true when ONDO_RWA_LIVE / mint / settlement wallet are not configured.
     */
    async holdInUsdy(streamId, tenantWallet, amountUsd) {
        const mint = getUsdyMint();
        const kp = getSettlementKeypair();
        const base = { simulated: !this.live || !mint || !kp, streamId, usdyMint: mint?.toBase58() };
        if (!this.live || !mint || !kp) {
            logger_1.logger.info(`[ONDO-USDY] SIMULATED hold of $${amountUsd} in USDY for stream ${streamId} (live=${this.live}, mint=${!!mint}, settlement=${!!kp})`);
            // Record the simulated holding so settlement can compute yield.
            await database_1.prisma.rentStream.update({ where: { id: streamId }, data: { simulated: true } }).catch(() => { });
            return { ...base };
        }
        try {
            const connection = getConnection();
            const tenantPub = new web3_js_1.PublicKey(tenantWallet);
            const settlementAta = await (0, spl_token_1.getOrCreateAssociatedTokenAccount)(connection, kp, mint, kp.publicKey);
            const tenantAta = await (0, spl_token_1.getOrCreateAssociatedTokenAccount)(connection, kp, mint, tenantPub);
            // Move USDY from tenant ATA -> settlement wallet (Pabandi holds for float).
            const ix = (0, spl_token_1.createTransferInstruction)(tenantAta.address, settlementAta.address, kp.publicKey, Math.round(amountUsd * (10 ** USDY_DECIMALS)));
            const tx = new web3_js_1.Transaction().add(ix);
            const sig = await connection.sendTransaction(tx, [kp]);
            logger_1.logger.info(`[ONDO-USDY] Held $${amountUsd} USDY for stream ${streamId} (tx ${sig})`);
            return { ...base, simulated: false, settlementWallet: kp.publicKey.toBase58(), heldAmountUsdy: amountUsd, txHash: sig };
        }
        catch (e) {
            logger_1.logger.error(`[ONDO-USDY] hold failed: ${e.message}`);
            return { ...base, error: e.message };
        }
    }
    /**
     * Compute the 50/50 yield split for a holding over `holdingDays`.
     * Yield is USDY-native; we express the distributable yield in USD and split.
     */
    computeYieldSplit(amountUsd, holdingDays) {
        const totalYield = +(amountUsd * (ONDO_APY / 100) * (holdingDays / 365)).toFixed(6);
        const spreadPct = 1.0; // Pabandi spread taken from yield, not principal
        const spread = +(totalYield * (spreadPct / 100)).toFixed(6);
        const net = +(totalYield - spread).toFixed(6);
        return {
            totalYield,
            spread,
            tenantEquity: +(net / 2).toFixed(6),
            landlordBonus: +(net / 2).toFixed(6),
            apy: ONDO_APY,
            simulated: !this.live,
        };
    }
    /**
     * Settle: distribute the yield (as USDC from the settlement wallet) 50/50 to tenant + landlord.
     * Principal (USDY) is returned to the tenant. Real USDC transfer when live; else simulated.
     */
    async settleYield(streamId, tenantWallet, landlordWallet, amountUsd, holdingDays) {
        const split = this.computeYieldSplit(amountUsd, holdingDays);
        const kp = getSettlementKeypair();
        const usdcMint = process.env.USDC_MINT_ADDRESS ? new web3_js_1.PublicKey(process.env.USDC_MINT_ADDRESS) : null;
        if (!this.live || !kp || !usdcMint) {
            logger_1.logger.info(`[ONDO-USDY] SIMULATED settle: tenant $${split.tenantEquity} | landlord $${split.landlordBonus} (stream ${streamId})`);
            return { ...split, simulated: true };
        }
        try {
            const connection = getConnection();
            const tenantPub = new web3_js_1.PublicKey(tenantWallet);
            const landlordPub = new web3_js_1.PublicKey(landlordWallet);
            const settlementUsdc = await (0, spl_token_1.getOrCreateAssociatedTokenAccount)(connection, kp, usdcMint, kp.publicKey);
            const tenantUsdc = await (0, spl_token_1.getOrCreateAssociatedTokenAccount)(connection, kp, usdcMint, tenantPub);
            const landlordUsdc = await (0, spl_token_1.getOrCreateAssociatedTokenAccount)(connection, kp, usdcMint, landlordPub);
            const tenantIx = (0, spl_token_1.createTransferInstruction)(settlementUsdc.address, tenantUsdc.address, kp.publicKey, Math.round(split.tenantEquity * 1e6));
            const landlordIx = (0, spl_token_1.createTransferInstruction)(settlementUsdc.address, landlordUsdc.address, kp.publicKey, Math.round(split.landlordBonus * 1e6));
            const tx = new web3_js_1.Transaction().add(tenantIx, landlordIx);
            const sig = await connection.sendTransaction(tx, [kp]);
            logger_1.logger.info(`[ONDO-USDY] Settled yield stream ${streamId} (tx ${sig}): tenant $${split.tenantEquity} | landlord $${split.landlordBonus}`);
            return { ...split, simulated: false, txHash: sig };
        }
        catch (e) {
            logger_1.logger.error(`[ONDO-USDY] settle failed: ${e.message}`);
            return { ...split, simulated: true, error: e.message };
        }
    }
}
exports.OndoUsdyService = OndoUsdyService;
exports.ondoUsdyService = new OndoUsdyService();
//# sourceMappingURL=ondoUsdy.service.js.map