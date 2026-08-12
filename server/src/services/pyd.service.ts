/**
 * Pabandi Yield Deposit (PYD) — non-custodial rental security deposit infrastructure.
 *
 * Design principle: Pabandi NEVER holds tenant funds. The Solana escrow contract
 * (see solana_escrow.service.ts) holds the deposit USDC. Pabandi is only:
 *   1. The TRUST layer  (PTP risk band → deposit reduction)
 *   2. The AGREEMENT layer (tenant + landlord sign a yield-pool opt-in)
 *   3. The SETTLEMENT orchestrator (tells the contract when to release)
 *
 * Liability posture: ZERO. Pabandi takes protocol fees at settlement, not by
 * custoding principal. The yield spread is taken from YIELD, never principal.
 */

import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { ptpEngine, PTP_RISK_BANDS, PTPRiskBand } from '../protocol/ptp.spec';
import { web3AgentService } from './web3Agent.service';

// Non-custodial yield pools (tenant opts in; Pabandi spreads the yield)
export const YIELD_POOLS = {
  JITO_STSOL: { label: 'Jito SOL (liquid staking)', expectedApy: 7.0, tenantApy: 5.5, spreadPct: 1.5 },
  ONDO_USDC: { label: 'Ondo USDC Money Market', expectedApy: 4.5, tenantApy: 3.5, spreadPct: 1.0 },
  MAPLE: { label: 'Maple Institutional USDC', expectedApy: 6.0, tenantApy: 4.5, spreadPct: 1.5 },
} as const;

export type YieldPoolKey = keyof typeof YIELD_POOLS;

export interface CreateDepositInput {
  tenantId: string;
  landlordId: string;
  depositContext?: 'PROPERTY' | 'CAR' | 'BUILDER' | 'FLEET' | 'HOA';
  assetDescription: string;
  requiredAmountUSD: number;
  yieldOptIn?: boolean;
  communityPoolOptIn?: boolean; // HOA: yield → community pool
  pool?: YieldPoolKey;
  beneficiaryBackgroundCheckId?: string; // BackgroundCheck.id of the builder/fleet/HOA vendor
}

export class PydService {
  /**
   * Create a security deposit. Applies the tenant's PTP risk-band deposit reduction.
   * Does NOT move money — just records the non-custodial agreement.
   */
  async createDeposit(input: CreateDepositInput): Promise<any> {
    const tenant = await prisma.user.findUnique({ where: { id: input.tenantId } });
    if (!tenant) throw new Error('Tenant not found');

    const riskBand: PTPRiskBand = ptpEngine.scoreToRiskBand(tenant.trustScore ?? 50);
    const bandSpec = PTP_RISK_BANDS[riskBand];
    const depositReductionPct = bandSpec.depositReduction; // 0.50 / 0.30 / 0.10 / 0

    // BackgroundCheck reduction lever: a verified PASS on the beneficiary
    // (builder / fleet co / HOA vendor) earns up to +10% off the deposit.
    let bcReductionPct = 0;
    let bcCheckId: string | undefined = input.beneficiaryBackgroundCheckId;
    if (bcCheckId) {
      const bc = await prisma.backgroundCheck.findUnique({ where: { id: bcCheckId } });
      if (bc && bc.recommendation === 'PASS' && (bc.riskScore ?? 100) <= 30) {
        bcReductionPct = 0.10;
      }
    }

    const totalReduction = Math.min(0.6, depositReductionPct + bcReductionPct);
    const actualDepositUSD = +(input.requiredAmountUSD * (1 - totalReduction)).toFixed(2);

    const deposit = await prisma.securityDeposit.create({
      data: {
        tenantId: input.tenantId,
        landlordId: input.landlordId,
        depositContext: input.depositContext ?? 'PROPERTY',
        assetDescription: input.assetDescription,
        requiredAmountUSD: input.requiredAmountUSD,
        tenantRiskBand: riskBand,
        depositReductionPct,
        bcReductionPct,
        bcCheckId: bcCheckId ?? null,
        actualDepositUSD,
        yieldOptIn: !!input.yieldOptIn,
        communityPoolOptIn: !!input.communityPoolOptIn,
        status: 'PENDING',
      },
    });

    logger.info(
      `[PYD] Deposit ${deposit.id} (${input.depositContext ?? 'PROPERTY'}): payer Band ${riskBand} → ` +
      `${depositReductionPct * 100}% PTP + ${bcReductionPct * 100}% BC = ${totalReduction * 100}% total, ` +
      `actual deposit $${actualDepositUSD} (was $${input.requiredAmountUSD})`
    );

    let yieldAgreement: any = null;
    if (input.yieldOptIn) {
      yieldAgreement = await this.proposeYieldAgreement(deposit.id, input.tenantId, input.landlordId, input.pool);
    }

    return { deposit, yieldAgreement };
  }

  /**
   * Propose a yield-pool agreement. Tenant + landlord must BOTH sign before it's ACTIVE.
   * Pabandi never touches principal — spread is taken from yield only.
   */
  async proposeYieldAgreement(
    depositId: string,
    tenantId: string,
    landlordId: string,
    pool: YieldPoolKey = 'JITO_STSOL'
  ): Promise<any> {
    const poolSpec = YIELD_POOLS[pool];
    const agreement = await prisma.yieldAgreement.create({
      data: {
        depositId,
        tenantId,
        landlordId,
        pool,
        expectedApy: poolSpec.expectedApy,
        tenantApy: poolSpec.tenantApy,
        pabandiSpreadPct: poolSpec.spreadPct,
        status: 'PROPOSED',
      },
    });

    // Link to deposit
    await prisma.securityDeposit.update({
      where: { id: depositId },
      data: { yieldAgreementId: agreement.id, yieldOptIn: true },
    });

    logger.info(`[PYD] Yield agreement ${agreement.id} proposed: pool ${pool}, tenant APY ${poolSpec.tenantApy}%, Pabandi spread ${poolSpec.spreadPct}%`);
    return agreement;
  }

  /** Tenant signs the yield agreement. */
  async signAsTenant(agreementId: string, tenantId: string): Promise<any> {
    const ag = await prisma.yieldAgreement.findUnique({ where: { id: agreementId } });
    if (!ag || ag.tenantId !== tenantId) throw new Error('Agreement not found / unauthorized');
    return prisma.yieldAgreement.update({
      where: { id: agreementId },
      data: { tenantSignedAt: new Date(), status: ag.landlordSignedAt ? 'ACTIVE' : 'PROPOSED' },
    });
  }

  /** Landlord signs the yield agreement. */
  async signAsLandlord(agreementId: string, landlordId: string): Promise<any> {
    const ag = await prisma.yieldAgreement.findUnique({ where: { id: agreementId } });
    if (!ag || ag.landlordId !== landlordId) throw new Error('Agreement not found / unauthorized');
    const updated = await prisma.yieldAgreement.update({
      where: { id: agreementId },
      data: { landlordSignedAt: new Date(), status: ag.tenantSignedAt ? 'ACTIVE' : 'PROPOSED' },
    });

    if (updated.status === 'ACTIVE') {
      // Both signed → mark deposit as funding-eligible (non-custodial escrow)
      await prisma.securityDeposit.update({
        where: { id: ag.depositId },
        data: { status: 'FUNDED' },
      });
      logger.info(`[PYD] Yield agreement ${agreementId} ACTIVE — deposit ${ag.depositId} ready for non-custodial funding`);
    }
    return updated;
  }

  /**
   * Fund the deposit into the non-custodial Solana escrow contract.
   * In production this calls solana_escrow.service to initialize the PDA.
   * Simulated here (no treasury SOL required) — sets the PDA + tx hash.
   */
  async fundEscrow(depositId: string, tenantWallet: string): Promise<any> {
    const deposit = await prisma.securityDeposit.findUnique({ where: { id: depositId } });
    if (!deposit) throw new Error('Deposit not found');

    // Simulate non-custodial escrow initialization (swap to solana_escrow.service in prod)
    const escrowContract = `pda_${depositId.substring(0, 12)}`;
    const txHash = `sim_escrow_${Date.now()}`;

    return prisma.securityDeposit.update({
      where: { id: depositId },
      data: {
        escrowContract,
        escrowTxHash: txHash,
        status: deposit.yieldAgreementId ? 'ACTIVE' : 'FUNDED',
      },
    });
  }

  /** Projected yield for a deposit (used by the dashboard). */
  async projectYield(depositId: string, months: number): Promise<any> {
    const deposit = await prisma.securityDeposit.findUnique({
      where: { id: depositId },
      include: { yieldAgreement: true },
    });
    if (!deposit || !deposit.yieldAgreement) {
      return { eligible: false, reason: 'No active yield agreement' };
    }
    const ag = deposit.yieldAgreement;
    const principal = deposit.actualDepositUSD;
    const tenantYield = principal * (ag.tenantApy / 100) * (months / 12);
    const pabandiSpread = principal * (ag.pabandiSpreadPct / 100) * (months / 12);
    return {
      eligible: true,
      pool: ag.pool,
      principalUSD: principal,
      tenantApy: ag.tenantApy,
      months,
      tenantYieldUSD: +tenantYield.toFixed(2),
      pabandiSpreadUSD: +pabandiSpread.toFixed(2),
      projectedTotalToTenantUSD: +(principal + tenantYield).toFixed(2),
    };
  }

  /** Get a deposit with its yield agreement. */
  async getDeposit(depositId: string): Promise<any> {
    return prisma.securityDeposit.findUnique({
      where: { id: depositId },
      include: { yieldAgreement: true },
    });
  }

  // ── TOKENIZED RENT STREAMS (Ondo USDY / DeFi Primitive) ─────────────────────

  /**
   * Process a tokenized rent payment.
   * Instead of a sunk cost, rent is held in a yield-bearing RWA (e.g., Ondo USDY) 
   * for a short duration (e.g., paid on the 1st, settles on the 5th).
   * The generated yield is split 50/50 using O(1) distribution logic.
   */
  async processTokenizedRent(tenantId: string, landlordId: string, rentAmountUSD: number, holdingDays: number): Promise<any> {
    const APY = YIELD_POOLS.ONDO_USDC.expectedApy; // e.g., 4.5%
    
    // Calculate total yield generated during the holding period
    const totalYieldUSD = rentAmountUSD * (APY / 100) * (holdingDays / 365);
    
    // 50/50 split
    const tenantEquityUSD = +(totalYieldUSD / 2).toFixed(4);
    const landlordBonusUSD = +(totalYieldUSD / 2).toFixed(4);

    // In a real implementation, this would trigger an on-chain O(1) reward distribution 
    // where the total yield is minted as ERC-20 tokens or credited to the respective wallets
    // without iterating through arrays (saving gas).

    logger.info(
      `[PYD-TokenizedRent] Processed $${rentAmountUSD} rent held for ${holdingDays} days in Ondo USDY. ` +
      `Yield generated: $${totalYieldUSD.toFixed(4)}. Tenant Equity: $${tenantEquityUSD} | Landlord Bonus: $${landlordBonusUSD}`
    );

    // Simulate updating the tenant's Renter Equity Wallet
    await prisma.$transaction(async (tx) => {
      // Find or create wallet (simplified for this walkthrough)
      const wallet = await tx.wallet.findFirst({ where: { userId: tenantId } });
      if (wallet) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { usdcBalance: { increment: tenantEquityUSD } }
        });
      }
      
      const landlordWallet = await tx.wallet.findFirst({ where: { userId: landlordId } });
      if (landlordWallet) {
        await tx.wallet.update({
          where: { id: landlordWallet.id },
          data: { usdcBalance: { increment: rentAmountUSD + landlordBonusUSD } }
        });
      }
    });

    return {
      rentAmountUSD,
      holdingDays,
      totalYieldUSD: +totalYieldUSD.toFixed(4),
      tenantEquityUSD,
      landlordSettlementUSD: +(rentAmountUSD + landlordBonusUSD).toFixed(4),
      asset: 'Ondo USDY'
    };
  }
}

export const pydService = new PydService();
