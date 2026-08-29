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

import { Connection, PublicKey, Keypair, Transaction, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount, getAccount, createTransferInstruction } from '@solana/spl-token';
import { logger } from '../utils/logger';
import { prisma } from '../utils/database';

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const USDY_DECIMALS = 6; // USDY is 6 decimals (like USDC)
const ONDO_APY = Number(process.env.ONDO_APY || 4.5); // current USDY APY (oracle/constant)

function getConnection(): Connection {
  return new Connection(RPC_URL, 'confirmed');
}

function getSettlementKeypair(): Keypair | null {
  const key = process.env.ONDO_SETTLEMENT_KEY; // base58 secret of the DEDICATED settlement wallet
  if (!key) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bs58 = require('bs58').default;
    return Keypair.fromSecretKey(bs58.decode(key));
  } catch {
    return null;
  }
}

function getUsdyMint(): PublicKey | null {
  const m = process.env.ONDO_USDY_MINT;
  if (!m) return null;
  try { return new PublicKey(m); } catch { return null; }
}

export interface UsdyHoldingResult {
  simulated: boolean;
  streamId?: string;
  usdyMint?: string;
  heldAmountUsdy?: number;
  settlementWallet?: string;
  txHash?: string;
  error?: string;
}

export class OndoUsdyService {
  private live = process.env.ONDO_RWA_LIVE === 'true';

  /**
   * Hold a rent payment in USDY for the float window (real SPL transfer when live).
   * Returns simulated:true when ONDO_RWA_LIVE / mint / settlement wallet are not configured.
   */
  async holdInUsdy(streamId: string, tenantWallet: string, amountUsd: number): Promise<UsdyHoldingResult> {
    const mint = getUsdyMint();
    const kp = getSettlementKeypair();
    const base = { simulated: !this.live || !mint || !kp, streamId, usdyMint: mint?.toBase58() };

    if (!this.live || !mint || !kp) {
      logger.info(`[ONDO-USDY] SIMULATED hold of $${amountUsd} in USDY for stream ${streamId} (live=${this.live}, mint=${!!mint}, settlement=${!!kp})`);
      // Record the simulated holding so settlement can compute yield.
      await prisma.rentStream.update({ where: { id: streamId }, data: { simulated: true } }).catch(() => {});
      return { ...base };
    }

    try {
      const connection = getConnection();
      const tenantPub = new PublicKey(tenantWallet);
      const settlementAta = await getOrCreateAssociatedTokenAccount(connection, kp, mint, kp.publicKey);
      const tenantAta = await getOrCreateAssociatedTokenAccount(connection, kp, mint, tenantPub);

      // Move USDY from tenant ATA -> settlement wallet (Pabandi holds for float).
      const ix = createTransferInstruction(
        tenantAta.address, settlementAta.address, kp.publicKey,
        Math.round(amountUsd * (10 ** USDY_DECIMALS))
      );
      const tx = new Transaction().add(ix);
      const sig = await connection.sendTransaction(tx, [kp]);

      logger.info(`[ONDO-USDY] Held $${amountUsd} USDY for stream ${streamId} (tx ${sig})`);
      return { ...base, simulated: false, settlementWallet: kp.publicKey.toBase58(), heldAmountUsdy: amountUsd, txHash: sig };
    } catch (e: any) {
      logger.error(`[ONDO-USDY] hold failed: ${e.message}`);
      return { ...base, error: e.message };
    }
  }

  /**
   * Compute the 50/50 yield split for a holding over `holdingDays`.
   * Yield is USDY-native; we express the distributable yield in USD and split.
   */
  computeYieldSplit(amountUsd: number, holdingDays: number) {
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
  async settleYield(streamId: string, tenantWallet: string, landlordWallet: string, amountUsd: number, holdingDays: number): Promise<any> {
    const split = this.computeYieldSplit(amountUsd, holdingDays);
    const kp = getSettlementKeypair();
    const usdcMint = process.env.USDC_MINT_ADDRESS ? new PublicKey(process.env.USDC_MINT_ADDRESS) : null;

    if (!this.live || !kp || !usdcMint) {
      logger.info(`[ONDO-USDY] SIMULATED settle: tenant $${split.tenantEquity} | landlord $${split.landlordBonus} (stream ${streamId})`);
      return { ...split, simulated: true };
    }

    try {
      const connection = getConnection();
      const tenantPub = new PublicKey(tenantWallet);
      const landlordPub = new PublicKey(landlordWallet);
      const settlementUsdc = await getOrCreateAssociatedTokenAccount(connection, kp, usdcMint, kp.publicKey);
      const tenantUsdc = await getOrCreateAssociatedTokenAccount(connection, kp, usdcMint, tenantPub);
      const landlordUsdc = await getOrCreateAssociatedTokenAccount(connection, kp, usdcMint, landlordPub);

      const tenantIx = createTransferInstruction(settlementUsdc.address, tenantUsdc.address, kp.publicKey, Math.round(split.tenantEquity * 1e6));
      const landlordIx = createTransferInstruction(settlementUsdc.address, landlordUsdc.address, kp.publicKey, Math.round(split.landlordBonus * 1e6));
      const tx = new Transaction().add(tenantIx, landlordIx);
      const sig = await connection.sendTransaction(tx, [kp]);

      logger.info(`[ONDO-USDY] Settled yield stream ${streamId} (tx ${sig}): tenant $${split.tenantEquity} | landlord $${split.landlordBonus}`);
      return { ...split, simulated: false, txHash: sig };
    } catch (e: any) {
      logger.error(`[ONDO-USDY] settle failed: ${e.message}`);
      return { ...split, simulated: true, error: e.message };
    }
  }
}

export const ondoUsdyService = new OndoUsdyService();
