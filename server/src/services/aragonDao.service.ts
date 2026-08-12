/**
 * aragonDao.service.ts — Aragon-STYLE bicameral DAO (Solana-native).
 *
 * Pabandi Protocol v2.0 Pillar 7: Bicameral Quadratic Voting. Aragon is an EVM/Solidity
 * framework and cannot deploy as a literal Aragon contract on Solana, so this is a
 * SOLANA-NATIVE equivalent with identical governance semantics:
 *   - Quadratic Voting: voting power = sqrt(trustBandMultiplier * stakedPPD), so a single
 *     elite whale cannot outvote the broader community (cost grows quadratically).
 *   - Bicameral: a proposal passes only if BOTH >50% of unique wallets AND >50% of
 *     trust-weighted power approve. This balances democratic weight with elite trust signals.
 *   - Proposals + final tallies are anchored on Solana (tamper-evident).
 */
import { solanaAnchor } from './solanaAnchor.service';
import { logger } from '../utils/logger';

export type ProposalStatus = 'OPEN' | 'PASSED' | 'REJECTED';
export type VoteChoice = 'FOR' | 'AGAINST' | 'ABSTAIN';

// PTP trust-band → multiplier (band A trusts most). Mirrors PTP_RISK_BANDS weighting.
const TRUST_BAND_MULT: Record<string, number> = { A: 5, B: 3, C: 2, D: 1, E: 0.5 };

export interface Vote { voterId: string; trustBand: string; stakedPpd: number; choice: VoteChoice; power: number; }

export class AragonStyleDao {
  /** Quadratic voting power: sqrt(trustBandMultiplier * stakedPPD). */
  votePower(trustBand: string, stakedPpd: number): number {
    const mult = TRUST_BAND_MULT[trustBand] ?? 1;
    return +(Math.sqrt(Math.max(0, mult * stakedPpd))).toFixed(4);
  }

  private proposals = new Map<string, any>();

  async createProposal(proposalId: string, title: string, body: string): Promise<any> {
    const p = {
      proposalId, title, body, status: 'OPEN' as ProposalStatus,
      votes: [] as Vote[], createdAt: new Date().toISOString(), tally: { FOR: 0, AGAINST: 0, ABSTAIN: 0 },
      walletsFor: new Set<string>(), walletsAgainst: new Set<string>(),
    };
    this.proposals.set(proposalId, p);
    logger.info(`[AragonDAO] Proposal ${proposalId} opened: ${title}`);
    return p;
  }

  /** Cast a quadratic vote. power is derived from trust band + staked PPD (not raw tokens). */
  async castVote(proposalId: string, voterId: string, trustBand: string, stakedPpd: number, choice: VoteChoice): Promise<any> {
    const p = this.proposals.get(proposalId);
    if (!p) throw new Error('proposal not found');
    if (p.status !== 'OPEN') throw new Error('proposal closed');
    const power = this.votePower(trustBand, stakedPpd);
    // replace prior vote from same wallet (one wallet = one vote weight)
    p.votes = p.votes.filter((v: Vote) => v.voterId !== voterId);
    p.votes.push({ voterId, trustBand, stakedPpd, choice, power });
    p.tally[choice] += power;
    if (choice === 'FOR') p.walletsFor.add(voterId); else if (choice === 'AGAINST') p.walletsAgainst.add(voterId);
    await this.maybeFinalize(proposalId);
    return p;
  }

  /** Bicameral check: >50% unique wallets AND >50% trust-weighted power must be FOR.
   *  Requires a minimum quorum (>=2 distinct wallets) so a single vote can't auto-pass. */
  private async maybeFinalize(proposalId: string) {
    const p = this.proposals.get(proposalId);
    const totalWallets = p.walletsFor.size + p.walletsAgainst.size;
    if (totalWallets < 2) return; // quorum not met — stay OPEN
    const walletPctFor = totalWallets ? p.walletsFor.size / totalWallets : 0;
    const powerPctFor = p.tally.FOR / (p.tally.FOR + p.tally.AGAINST || 1);
    if (walletPctFor > 0.5 && powerPctFor > 0.5) {
      p.status = 'PASSED';
    } else if (walletPctFor < 0.5) {
      p.status = 'REJECTED';
    } else {
      return; // still open (e.g. 50/50 or awaiting more votes)
    }
    p.finalizedAt = new Date().toISOString();
    p.anchor = await solanaAnchor.anchorOnSolana('ARAGON_PROPOSAL', {
      proposalId, status: p.status, walletPctFor, powerPctFor, votes: p.votes.length,
    }, 'PABANDI_DAO');
    logger.info(`[AragonDAO] Proposal ${proposalId} → ${p.status} (wallets ${(walletPctFor*100).toFixed(0)}% FOR, power ${(powerPctFor*100).toFixed(0)}% FOR)`);
  }

  getProposal(proposalId: string) { return this.proposals.get(proposalId); }
}

export const aragonDao = new AragonStyleDao();
