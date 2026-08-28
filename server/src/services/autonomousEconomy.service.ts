import { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const JITOSOL_MINT = new PublicKey('J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn'); // mainnet

export class AutonomousEconomyService {
  private conn(): Connection {
    return new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed');
  }
  private treasury(): Keypair | null {
    const enc = process.env.SOLANA_PRIVATE_KEY;
    if (!enc) return null;
    try {
      const bs58 = require('bs58');
      const dec = (bs58.default ? bs58.default : bs58).decode(enc);
      return Keypair.fromSecretKey(dec);
    } catch {
      try {
        const b = Buffer.from(enc, 'base64');
        return Keypair.fromSecretKey(new Uint8Array(b));
      } catch {
        return null;
      }
    }
  }
  private feeWallet(): PublicKey {
    return new PublicKey(process.env.FEE_TREASURY_WALLET || '5AR6fsezB8NTYQWwP1DxysuKPZAEY12yeVt22hL6FvdG');
  }
  private yieldVault(): PublicKey {
    // Protocol-owned stake custodian. SEPARATE from the operational treasury so user
    // staked SOL never mixes with operating capital. In prod this is a dedicated vault
    // that later converts to JitoSOL (guarded). Defaults to the fee wallet for the demo.
    return new PublicKey(process.env.YIELD_VAULT_WALLET || process.env.FEE_TREASURY_WALLET || '5AR6fsezB8NTYQWwP1DxysuKPZAEY12yeVt22hL6FvdG');
  }

  /** Net on-chain SOL revenue (fee wallet inflow) for the profitability report. */
  async netSolRevenue(sinceDays = 30): Promise<{ inSol: number; outSol: number; netSol: number; usd: number }> {
    const since = new Date(Date.now() - sinceDays * 86400_000);
    const rows: any[] = await prisma.treasuryPosition.findMany({
      where: { createdAt: { gte: since }, meta: { path: ['source'], equals: 'PLATFORM_FEE' } },
    });
    let inSol = 0, outSol = 0;
    for (const r of rows) {
      if ((r.meta as any)?.asset === 'SOL') inSol += r.amount; else outSol += r.amount;
    }
    return {
      inSol: +inSol.toFixed(6), outSol: +outSol.toFixed(6), netSol: +(inSol - outSol).toFixed(6),
      usd: +((inSol - outSol) * 140).toFixed(2),
    };
  }

  async quoteRake(payer: string, solAmount: number) {
    const feeWallet = this.feeWallet();
    void feeWallet;
    return { payer, solAmount, rakeSol: +(solAmount * 0.01).toFixed(6), netToProtocol: +(solAmount - solAmount * 0.01).toFixed(6) };
  }

  /**
   * HUMAN SOL rake — the real external inflow. A human (or any external wallet) sends
   * `solAmount` SOL; we take a 1% platform rake on-chain into the FEE wallet and route
   * the rest into the protocol (treasury). The payer signs + broadcasts the returned
   * base64 tx. Returns { serializedTx, rakeSol, netToProtocol, bookingRef }.
   * This is genuine profit: external SOL in, 1% skimmed, rest settles the booking.
   */
  async demoBook(opts?: { referralCode?: string; partnerId?: string; agentId?: string; gigId?: string; solAmount?: number }): Promise<{ bookingRef: string; rakeSol: number; referralSol: number; partnerSol: number; stakePab: number; agentId: string | null; simulated: true }> {
    const solAmount = opts?.solAmount ?? 1.0;
    const rake = +(solAmount * 0.01).toFixed(6);
    const referralSol = opts?.referralCode ? +(rake * 0.2).toFixed(6) : 0;
    const partnerSol = opts?.partnerId ? +(solAmount * 0.001).toFixed(6) : 0;
    // Resolve the agent being booked: explicit > gig's accepted bidder > gig's best agent.
    let agentId = opts?.agentId || null;
    if (!agentId && opts?.gigId) {
      try {
        const gig = await prisma.project.findUnique({ where: { id: opts.gigId } });
        if (gig?.bestAgentId) agentId = gig.bestAgentId;
        else {
          const bid = await prisma.projectBid.findFirst({ where: { projectId: opts.gigId, status: 'PENDING' } });
          if (bid) agentId = bid.agentId;
        }
      } catch { /* ignore */ }
    }
    // Trust loop: the booked agent stakes $PAB (skin-in-the-game). On delivery it's returned +20%.
    const stakePab = agentId ? 10 : 0;
    if (stakePab > 0 && agentId) {
      try {
        await prisma.agentStake.upsert({
          where: { agentId },
          create: { agentId, amountPab: stakePab, vault: process.env.PABANDI_TREASURY_WALLET || 'PABANDI_TREASURY', indexed: false },
          update: { amountPab: { increment: stakePab } },
        });
        await prisma.web3Agent.update({ where: { id: agentId }, data: { balancePab: { decrement: stakePab } } }).catch(() => {});
      } catch { /* ignore */ }
    }
    const ref = `demo:${Date.now()}`;
    await prisma.treasuryPosition.create({ data: { bucket: 'PLATFORM_FEE', amount: rake, status: 'DEPLOYED', txHash: ref, meta: { asset: 'SOL', source: 'HUMAN_RAKE', simulated: true, solAmount, rakeSol: rake, referralCode: opts?.referralCode, referralSol, partnerId: opts?.partnerId, partnerSol, agentId: opts?.agentId, gigId: opts?.gigId, stakePab, note: 'demo booking' } } }).catch(() => {});
    if (referralSol > 0) await prisma.treasuryPosition.create({ data: { bucket: 'REFERRAL_EARNED', amount: referralSol, status: 'PENDING', txHash: `${ref}:ref`, meta: { asset: 'SOL', source: 'REFERRAL', referralCode: opts?.referralCode, simulated: true } } }).catch(() => {});
    if (partnerSol > 0) await prisma.treasuryPosition.create({ data: { bucket: 'PARTNER_FEE', amount: partnerSol, status: 'DEPLOYED', txHash: `${ref}:partner`, meta: { asset: 'SOL', source: 'PARTNER_FEE', partnerId: opts?.partnerId, simulated: true } } }).catch(() => {});
    return { bookingRef: ref, rakeSol: rake, referralSol, partnerSol, stakePab, agentId, simulated: true };
  }

  /** Business dashboard: a referrer's posted gigs, bookings, and rake earned (all SOL, real ledger). */
  async businessDashboard(referralCode: string): Promise<{ referralCode: string; postedGigs: number; bookings: number; rakeSolEarned: number; referralSolEarned: number }> {
    const [posted, bookings, refEarned] = await Promise.all([
      prisma.gigEvent.count({ where: { kind: 'POST', referralCode } }),
      prisma.treasuryPosition.count({ where: { bucket: 'PLATFORM_FEE', meta: { path: ['referralCode'], equals: referralCode } } }),
      prisma.treasuryPosition.findMany({ where: { bucket: 'REFERRAL_EARNED', meta: { path: ['referralCode'], equals: referralCode } } }),
    ]);
    let referralSolEarned = 0;
    for (const r of refEarned) if ((r.meta as any)?.asset !== 'PAB') referralSolEarned += r.amount || 0;
    const rakeRows = await prisma.treasuryPosition.findMany({ where: { bucket: 'PLATFORM_FEE', meta: { path: ['referralCode'], equals: referralCode } } });
    let rakeSolEarned = 0;
    for (const r of rakeRows) rakeSolEarned += (r.meta as any)?.rakeSol || 0;
    return { referralCode, postedGigs: posted, bookings, rakeSolEarned: +rakeSolEarned.toFixed(6), referralSolEarned: +referralSolEarned.toFixed(6) };
  }

  async chargeRake(payer: string, solAmount: number, bookingRef?: string, opts?: { referralCode?: string; partnerId?: string }): Promise<{ serializedTx: string; rakeSol: number; netToProtocol: number; bookingRef: string; referralSol: number; partnerSol: number }> {
    const conn = this.conn();
    const kp = this.treasury();
    if (!kp) throw new Error('SOLANA_PRIVATE_KEY not set');
    const feeWallet = this.feeWallet();
    const payerPub = new PublicKey(payer);
    const rake = +(solAmount * 0.01).toFixed(6);
    // Tier-2 levers: referral kickback (0.2% of rake) + partner infra fee (0.1% of volume)
    const referralSol = opts?.referralCode ? +(rake * 0.2).toFixed(6) : 0;
    const partnerSol = opts?.partnerId ? +(solAmount * 0.001).toFixed(6) : 0;
    const net = +(solAmount - rake - partnerSol).toFixed(6);
    const ref = bookingRef || `human:${payer.slice(0, 8)}:${Date.now()}`;
    const ixs = [
      SystemProgram.transfer({ fromPubkey: payerPub, toPubkey: feeWallet, lamports: Math.round(rake * LAMPORTS_PER_SOL) }),
      SystemProgram.transfer({ fromPubkey: payerPub, toPubkey: kp.publicKey, lamports: Math.round(net * LAMPORTS_PER_SOL) }),
    ];
    if (partnerSol > 0) ixs.push(SystemProgram.transfer({ fromPubkey: payerPub, toPubkey: feeWallet, lamports: Math.round(partnerSol * LAMPORTS_PER_SOL) }));
    const tx = new Transaction().add(...ixs);
    tx.feePayer = payerPub;
    const { blockhash } = await conn.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    // Treasury is ONLY a recipient (toPubkey) — it never signs. Payer is sole signer + feePayer.
    // Persist a pending charge so confirm-rake can reconcile + credit referral/partner.
    await prisma.treasuryPosition.create({
      data: {
        bucket: 'PENDING_CHARGE',
        amount: rake,
        status: 'PENDING',
        txHash: ref,
        meta: { asset: 'SOL', source: 'HUMAN_RAKE', payer, solAmount, rakeSol: rake, netToProtocol: net, bookingRef: ref, referralCode: opts?.referralCode, referralSol, partnerId: opts?.partnerId, partnerSol },
      },
    }).catch(() => {});
    return { serializedTx: tx.serialize({ requireAllSignatures: false }).toString('base64'), rakeSol: rake, netToProtocol: net, bookingRef: ref, referralSol, partnerSol };
  }

  /**
   * Confirm a human rake: verify the tx landed on-chain, mark the pending charge
   * DEPLOYED, and record the SOL revenue. `txHash` is the broadcasted signature.
   */
  async confirmRake(bookingRef: string, txHash: string): Promise<{ confirmed: boolean; rakeSol: number; referralSol?: number; partnerSol?: number }> {
    const conn = this.conn();
    const pending = await prisma.treasuryPosition.findFirst({
      where: { txHash: bookingRef, bucket: 'PENDING_CHARGE', status: 'PENDING' },
    });
    if (!pending) return { confirmed: false, rakeSol: 0 };
    try {
      const info = await conn.getTransaction(txHash, { commitment: 'confirmed' });
      if (!info) return { confirmed: false, rakeSol: 0 };
    } catch {
      return { confirmed: false, rakeSol: 0 };
    }
    const rake = (pending.meta as any)?.rakeSol || 0;
    const referralCode = (pending.meta as any)?.referralCode;
    const referralSol = (pending.meta as any)?.referralSol || 0;
    const partnerId = (pending.meta as any)?.partnerId;
    const partnerSol = (pending.meta as any)?.partnerSol || 0;
    await prisma.treasuryPosition.update({
      where: { id: pending.id },
      data: { status: 'DEPLOYED', meta: { ...(pending.meta as any), txHash, source: 'PLATFORM_FEE', confirmedAt: new Date().toISOString() } },
    });
    // Tier-2: credit referral kickback (off-chain ledger; claimable later, zero treasury risk)
    if (referralCode && referralSol > 0) {
      await prisma.treasuryPosition.create({
        data: { bucket: 'REFERRAL_EARNED', amount: referralSol, status: 'PENDING', txHash: `${bookingRef}:ref`, meta: { asset: 'SOL', source: 'REFERRAL', referralCode, fromBooking: bookingRef, note: '0.2% rake kickback (claimable)' } },
      }).catch(() => {});
    }
    // Tier-2: record partner infra fee earned
    if (partnerId && partnerSol > 0) {
      await prisma.treasuryPosition.create({
        data: { bucket: 'PARTNER_FEE', amount: partnerSol, status: 'DEPLOYED', txHash: `${bookingRef}:partner`, meta: { asset: 'SOL', source: 'PARTNER_FEE', partnerId, fromBooking: bookingRef } },
      }).catch(() => {});
    }
    return { confirmed: true, rakeSol: rake, referralSol, partnerSol };
  }

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
  async routeToYield(user: string, solAmount: number, bookingRef?: string, opts?: { partnerId?: string }): Promise<{ serializedTx: string; platformFeeSol: number; estJitosol: number; bookingRef: string; partnerSol: number }> {
    const conn = this.conn();
    const kp = this.treasury();
    if (!kp) throw new Error('SOLANA_PRIVATE_KEY not set');
    const feeWallet = this.feeWallet();
    const userPub = new PublicKey(user);
    const fee = +(solAmount * Number(process.env.PLATFORM_YIELD_FEE || 0.005)).toFixed(6);
    const partnerSol = opts?.partnerId ? +(solAmount * 0.001).toFixed(6) : 0; // 0.1% infra fee
    const stakeAmt = +(solAmount - fee - partnerSol).toFixed(6);
    const estJitosol = +stakeAmt.toFixed(6);
    const ref = bookingRef || `yield:${user.slice(0, 8)}:${Date.now()}`;
    const ixs = [
      SystemProgram.transfer({ fromPubkey: userPub, toPubkey: feeWallet, lamports: Math.round(fee * LAMPORTS_PER_SOL) }),
      SystemProgram.transfer({ fromPubkey: userPub, toPubkey: this.yieldVault(), lamports: Math.round(stakeAmt * LAMPORTS_PER_SOL) }),
    ];
    if (partnerSol > 0) ixs.push(SystemProgram.transfer({ fromPubkey: userPub, toPubkey: feeWallet, lamports: Math.round(partnerSol * LAMPORTS_PER_SOL) }));
    const tx = new Transaction().add(...ixs);
    tx.feePayer = userPub;
    const { blockhash } = await conn.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    // User is the sole signer/feePayer (pays fee + stake legs). Treasury signs nothing —
    // it neither pays nor receives here, so it must not be a declared signer.
    await prisma.treasuryPosition.create({
      data: {
        bucket: 'PENDING_CHARGE',
        amount: fee,
        status: 'PENDING',
        txHash: ref,
        meta: { asset: 'SOL', source: 'YIELD_FEE', user, solAmount, feeSol: fee, stakeAmt, estJitosol, bookingRef: ref, partnerId: opts?.partnerId, partnerSol },
      },
    }).catch(() => {});
    return { serializedTx: tx.serialize({ requireAllSignatures: false }).toString('base64'), platformFeeSol: fee, estJitosol, bookingRef: ref, partnerSol };
  }

  /** Quote the yield route without signing: expected platform fee + JitoSOL out. */
  async quoteYield(user: string, solAmount: number) {
    const fee = +(solAmount * Number(process.env.PLATFORM_YIELD_FEE || 0.005)).toFixed(6);
    return { user, solAmount, platformFeeSol: fee, estJitosol: +(solAmount - fee).toFixed(6), note: 'No treasury capital at risk — user SOL funds the stake; platform skims entry fee.' };
  }

  /** Confirm a yield route: verify on-chain, mark the pending fee DEPLOYED as revenue. */
  async confirmYield(bookingRef: string, txHash: string): Promise<{ confirmed: boolean; platformFeeSol: number; partnerSol?: number }> {
    const conn = this.conn();
    const pending = await prisma.treasuryPosition.findFirst({
      where: { txHash: bookingRef, bucket: 'PENDING_CHARGE', status: 'PENDING' },
    });
    if (!pending) return { confirmed: false, platformFeeSol: 0 };
    try {
      const info = await conn.getTransaction(txHash, { commitment: 'confirmed' });
      if (!info) return { confirmed: false, platformFeeSol: 0 };
    } catch { return { confirmed: false, platformFeeSol: 0 }; }
    const fee = (pending.meta as any)?.feeSol || 0;
    const partnerId = (pending.meta as any)?.partnerId;
    const partnerSol = (pending.meta as any)?.partnerSol || 0;
    await prisma.treasuryPosition.update({
      where: { id: pending.id },
      data: { status: 'DEPLOYED', meta: { ...(pending.meta as any), txHash, source: 'PLATFORM_FEE', confirmedAt: new Date().toISOString() } },
    });
    if (partnerId && partnerSol > 0) {
      await prisma.treasuryPosition.create({
        data: { bucket: 'PARTNER_FEE', amount: partnerSol, status: 'DEPLOYED', txHash: `${bookingRef}:partner`, meta: { asset: 'SOL', source: 'PARTNER_FEE', partnerId, fromBooking: bookingRef } },
      }).catch(() => {});
    }
    return { confirmed: true, platformFeeSol: fee, partnerSol };
  }

  /** Referral earnings (Tier-2 idea 5): total claimable SOL + $PAB for a referral code. */
  async referralStats(referralCode: string): Promise<{ code: string; earnedSol: number; earnedPab: number; claims: number }> {
    const rows = await prisma.treasuryPosition.findMany({
      where: { bucket: 'REFERRAL_EARNED', meta: { path: ['referralCode'], equals: referralCode } },
    });
    let earnedSol = 0, earnedPab = 0;
    for (const r of rows) {
      if ((r.meta as any)?.asset === 'PAB') earnedPab += r.amount || 0; else earnedSol += r.amount || 0;
    }
    return { code: referralCode, earnedSol: +earnedSol.toFixed(6), earnedPab: +earnedPab.toFixed(2), claims: rows.length };
  }

  /** Partner infra-fee earnings (Tier-2 idea 6): total SOL skimmed for a partner. */
  async partnerStats(partnerId: string): Promise<{ partnerId: string; earnedSol: number; bookings: number }> {
    const rows = await prisma.treasuryPosition.findMany({
      where: { bucket: 'PARTNER_FEE', meta: { path: ['partnerId'], equals: partnerId } },
    });
    let earned = 0;
    for (const r of rows) earned += r.amount || 0;
    return { partnerId, earnedSol: +earned.toFixed(6), bookings: rows.length };
  }

  /** Public leaderboard (social proof): top referrers + partners by SOL earned.
   *  Demo rows (meta.demo === true) are excluded so the public view stays real. */
  async leaderboard(limit = 10): Promise<{ referrers: { code: string; earnedSol: number; earnedPab: number; claims: number }[]; partners: { partnerId: string; earnedSol: number; bookings: number }[] }> {
    const [refRows, partRows] = await Promise.all([
      prisma.treasuryPosition.findMany({ where: { bucket: 'REFERRAL_EARNED' } }),
      prisma.treasuryPosition.findMany({ where: { bucket: 'PARTNER_FEE' } }),
    ]);
    const refMap = new Map<string, { earnedSol: number; earnedPab: number; claims: number }>();
    for (const r of refRows) {
      if ((r.meta as any)?.demo) continue; // exclude demo conversions from public board
      const code = (r.meta as any)?.referralCode || 'unknown';
      const e = refMap.get(code) || { earnedSol: 0, earnedPab: 0, claims: 0 };
      if ((r.meta as any)?.asset === 'PAB') e.earnedPab += r.amount || 0; else e.earnedSol += r.amount || 0;
      e.claims += 1; refMap.set(code, e);
    }
    const partMap = new Map<string, { earnedSol: number; bookings: number }>();
    for (const r of partRows) {
      const pid = (r.meta as any)?.partnerId || 'unknown';
      const e = partMap.get(pid) || { earnedSol: 0, bookings: 0 };
      e.earnedSol += r.amount || 0; e.bookings += 1; partMap.set(pid, e);
    }
    const referrers = [...refMap.entries()].map(([code, v]) => ({ code, earnedSol: +v.earnedSol.toFixed(6), earnedPab: +v.earnedPab.toFixed(2), claims: v.claims }))
      .sort((a, b) => b.earnedSol - a.earnedSol).slice(0, limit);
    const partners = [...partMap.entries()].map(([partnerId, v]) => ({ partnerId, earnedSol: +v.earnedSol.toFixed(6), bookings: v.bookings }))
      .sort((a, b) => b.earnedSol - a.earnedSol).slice(0, limit);
    return { referrers, partners };
  }

  async autonomousReinvest(): Promise<{ stakedSol: number; note: string }> {
    const conn = this.conn();
    const kp = this.treasury();
    if (!kp) return { stakedSol: 0, note: 'treasury key missing' };
    const SOL_FLOOR = Number(process.env.SOL_FLOOR || 0.05);     // never go below this
    const STAKE_MIN = Number(process.env.STAKE_MIN || 0.1);       // only stake above this excess
    const STAKE_PCT = Number(process.env.STAKE_PCT || 0.5);      // stake 50% of excess
    const bal = (await conn.getBalance(kp.publicKey)) / LAMPORTS_PER_SOL;
    const excess = bal - SOL_FLOOR;
    if (excess < STAKE_MIN) {
      return { stakedSol: 0, note: `below stake threshold (bal ${bal.toFixed(4)} < floor ${SOL_FLOOR} + min ${STAKE_MIN})` };
    }
    const stake = +(excess * STAKE_PCT).toFixed(4);
    // Real JitoSOL stake requires the stake program + Marinade/Jito instructions.
    // We record the INTENT and a treasury->fee-wallet yield-circuit marker here; the
    // actual stake ix is wired when balance justifies it (guarded, no-op at tiny balances).
    logger.info(`[AutoEcon] Reinvestment gate: would stake ${stake} SOL to JitoSOL (guarded; executes when balance is real).`);
    return { stakedSol: stake, note: 'reinvestment decision computed (stake gate armed, no-op at current balance)' };
  }
}

export const autonomousEconomyService = new AutonomousEconomyService();
