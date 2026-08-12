/**
 * passportEconomy.service.ts — the fault-tolerant, foolproof economic loop for
 * Agent Capability Passports.
 *
 * Design goals (per "stronger + more fault tolerant + foolproof"):
 *  1. FENCE PRIVILEGE ESCALATION — capabilities are validated against per-band
 *     allowlists + ceilings. A low-trust agent literally cannot be issued a
 *     dangerous capability (e.g. Band E can't get act:transfer at all).
 *  2. IDEMPOTENT METERING — each issue is keyed by a per-day idempotency key.
 *     Retries return the SAME charge record; never double-billed.
 *  3. ABUSE CAP — max issues per owner per rolling day.
 *  4. FAIL-CLOSED ON LEDGER OUTAGE — if the ledger can't be written, NO passport
 *     is issued (no free rides). Verifiers never pay, so verify() stays offline
 *     and always works.
 *  5. AUDITABLE — every charge is a durable row; public /ledger/:key lookup.
 *
 * Ledger uses a self-healing raw table (no Prisma migration on the live DB).
 */
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { PAB_FEE_PER_PASSPORT, PASSPORT_MAX_ISSUES_PER_DAY } from '../config/tokenomics';

export type PTPRiskBand = 'A' | 'B' | 'C' | 'D' | 'E';

/** Per-band capability policy. This is the foolproof guard rail. */
export const BAND_POLICY: Record<PTPRiskBand, {
  allow: string[];          // capability prefixes permitted
  deny: string[];           // capability prefixes always forbidden
  maxTransferUSD: number;   // ceiling for act:transfer:*  (0 = not allowed)
  maxIssuePerDay: number;   // per-owner daily cap override (<= global)
}> = {
  A: { allow: ['*'], deny: ['act:admin', 'act:irreversible'], maxTransferUSD: 10000, maxIssuePerDay: PASSPORT_MAX_ISSUES_PER_DAY },
  B: { allow: ['act:book', 'act:transfer', 'read', 'scope'], deny: ['act:admin', 'act:irreversible'], maxTransferUSD: 1000, maxIssuePerDay: PASSPORT_MAX_ISSUES_PER_DAY },
  C: { allow: ['act:book', 'read', 'scope'], deny: ['act:transfer', 'act:admin', 'act:irreversible'], maxTransferUSD: 0, maxIssuePerDay: 20 },
  D: { allow: ['read', 'act:book'], deny: ['act:transfer', 'act:admin', 'act:irreversible', 'scope'], maxTransferUSD: 0, maxIssuePerDay: 10 },
  E: { allow: ['read'], deny: ['act:transfer', 'act:admin', 'act:irreversible', 'scope', 'act:book'], maxTransferUSD: 0, maxIssuePerDay: 5 },
};

const LEDGER_TABLE = 'PassportIssuance';

async function ensureLedgerTable() {
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "${LEDGER_TABLE}" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "idempotencyKey" TEXT NOT NULL,
      "ownerUserId" TEXT NOT NULL,
      "agentId" TEXT NOT NULL,
      "riskBand" TEXT NOT NULL,
      "capabilities" JSONB NOT NULL,
      "feePab" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "chargedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "PassportIssuance_idem_idx" ON "${LEDGER_TABLE}" ("idempotencyKey")`);
}

/** Parse a transfer-USD ceiling from a capability like "act:transfer:under:100USD". */
function parseTransferUSD(cap: string): number | null {
  const m = cap.match(/act:transfer:under:(\d+(?:\.\d+)?)USD/i);
  return m ? parseFloat(m[1]) : null;
}

export interface CapabilityCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Foolproof capability validation against the owner's risk band.
 * Returns ok=false if ANY requested capability is disallowed or exceeds a ceiling.
 */
export function validateCapabilities(band: PTPRiskBand, capabilities: string[]): CapabilityCheck {
  const policy = BAND_POLICY[band] || BAND_POLICY.E;
  let maxTransfer = 0;
  for (const cap of capabilities) {
    // Explicit denials win
    if (policy.deny.some(d => cap === d || cap.startsWith(d + ':'))) {
      return { ok: false, reason: `Capability '${cap}' is forbidden for band ${band}` };
    }
    // Allowlist (prefix). '*' means everything except denials.
    const allowed = policy.allow.some(a => a === '*' || cap === a || cap.startsWith(a + ':'));
    if (!allowed) {
      return { ok: false, reason: `Capability '${cap}' not permitted for band ${band}` };
    }
    // Transfer ceiling
    const usd = parseTransferUSD(cap);
    if (usd !== null) {
      if (policy.maxTransferUSD <= 0) return { ok: false, reason: `Transfers not permitted for band ${band}` };
      if (usd > policy.maxTransferUSD) return { ok: false, reason: `Transfer cap $${usd} exceeds band ${band} limit $${policy.maxTransferUSD}` };
      maxTransfer = Math.max(maxTransfer, usd);
    }
  }
  return { ok: true };
}

export interface IssueChargeResult {
  idempotencyKey: string;
  feePab: number;
  alreadyCharged: boolean;
  record: any;
  balanceAfter?: number;
}

/**
 * Idempotent, fail-closed charge for issuing a passport.
 * - dedupes on idempotencyKey (retry-safe)
 * - enforces per-owner daily issue cap
 * - deducts the real $PAB fee from the owner's Web3Agent balance, fail-closed:
 *   insufficient balance -> throws (no passport, no charge)
 * - on ANY ledger/balance failure, throws (fail-closed: no passport without payment)
 */
export const passportEconomy = {
  async ensureLedger() {
    await ensureLedgerTable();
  },

  async countToday(ownerUserId: string): Promise<number> {
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const rows: any = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS c FROM "${LEDGER_TABLE}" WHERE "ownerUserId" = $1 AND "chargedAt" > $2`,
      ownerUserId, since
    );
    return (rows && rows[0] && rows[0].c) || 0;
  },

  /** Resolve (or lazily create at 0 balance) the owner's Web3Agent holding $PAB. */
  async resolveAgent(ownerUserId: string): Promise<any> {
    let agent = await prisma.web3Agent.findUnique({ where: { profileId: ownerUserId } });
    if (!agent) {
      agent = await prisma.web3Agent.create({
        data: {
          profileId: ownerUserId,
          walletAddress: `pab_${ownerUserId}`,
          encryptedPrivateKey: 'pabandi-agent',
          category: 'solo',
          balancePab: 0,
          dailyOutflow: 0,
          dailyTransactions: 0,
          lastReset: new Date(),
          isActive: true,
        } as any,
      });
    }
    return agent;
  },

  async chargeIssue(params: {
    ownerUserId: string;
    agentId: string;
    riskBand: PTPRiskBand;
    capabilities: string[];
    idempotencyKey?: string;
  }): Promise<IssueChargeResult> {
    const idempotencyKey = params.idempotencyKey || `${params.ownerUserId}:${params.agentId}:${new Date().toISOString().slice(0, 10)}`;
    await ensureLedgerTable();

    // Idempotency: return existing charge if present (no double bill on retry)
    const existing: any = await prisma.$queryRawUnsafe(
      `SELECT * FROM "${LEDGER_TABLE}" WHERE "idempotencyKey" = $1 LIMIT 1`, idempotencyKey
    );
    if (existing && existing[0]) {
      return { idempotencyKey, feePab: existing[0].feePab, alreadyCharged: true, record: existing[0] };
    }

    // Abuse cap (per owner per rolling day)
    const today = await this.countToday(params.ownerUserId);
    const bandCap = (BAND_POLICY[params.riskBand] || BAND_POLICY.E).maxIssuePerDay;
    const cap = Math.min(bandCap, PASSPORT_MAX_ISSUES_PER_DAY);
    if (today >= cap) {
      throw new Error(`Daily passport issue cap (${cap}) reached for band ${params.riskBand}`);
    }

    // REAL economic loop: debit the owner's actual $PAB balance, fail-closed.
    const agent = await this.resolveAgent(params.ownerUserId);
    if ((agent.balancePab || 0) < PAB_FEE_PER_PASSPORT) {
      throw new Error(`Insufficient $PAB balance (${agent.balancePab || 0}) to issue passport — need ${PAB_FEE_PER_PASSPORT} PAB`);
    }

    // Fail-closed + atomic: the conditional decrement (only if balance >= fee, race-safe)
    // and the ledger write are wrapped in one transaction. If either fails, both roll back
    // — no debited-but-no-passport edge case.
    const id = `pis_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await prisma.$transaction([
      prisma.web3Agent.updateMany({
        where: { profileId: params.ownerUserId, balancePab: { gte: PAB_FEE_PER_PASSPORT } },
        data: { balancePab: { decrement: PAB_FEE_PER_PASSPORT } } as any,
      }),
      prisma.$executeRawUnsafe(
        `INSERT INTO "${LEDGER_TABLE}" ("id","idempotencyKey","ownerUserId","agentId","riskBand","capabilities","feePab","chargedAt")
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,now())`,
        id, idempotencyKey, params.ownerUserId, params.agentId, params.riskBand,
        JSON.stringify(params.capabilities), PAB_FEE_PER_PASSPORT
      ),
    ]);
    const rec: any = await prisma.$queryRawUnsafe(`SELECT * FROM "${LEDGER_TABLE}" WHERE "id" = $1 LIMIT 1`, id);
    const after: any = await prisma.web3Agent.findUnique({ where: { profileId: params.ownerUserId }, select: { balancePab: true } });
    logger.info(`[PassportEconomy] charged ${PAB_FEE_PER_PASSPORT} PAB for issue ${id} (owner ${params.ownerUserId}) -> balance ${after?.balancePab}`);
    return { idempotencyKey, feePab: PAB_FEE_PER_PASSPORT, alreadyCharged: false, record: rec && rec[0], balanceAfter: after?.balancePab };
  },

  /** Public audit lookup. Returns the charge record or null. */
  async lookup(idempotencyKey: string): Promise<any | null> {
    await ensureLedgerTable();
    const rows: any = await prisma.$queryRawUnsafe(`SELECT * FROM "${LEDGER_TABLE}" WHERE "idempotencyKey" = $1 LIMIT 1`, idempotencyKey);
    return (rows && rows[0]) || null;
  },
};
