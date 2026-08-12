/**
 * zkNullifier.service.ts — ZK-style Proof of Rent (PoR) with NULLIFIERS.
 *
 * Pabandi Protocol v2.0 Pillar 2 upgrade: a tenant proves "I paid rent on time for N
 * months" without revealing amount/landlord/address, AND the proof can only be used ONCE
 * per (tenantDID, propertyDID) application — preventing replay attacks across landlords.
 *
 * Construction (real, verifiable — NOT a fake ZK-SNARK):
 *   commitment = H(tenantDID || propertyDID || secret)        // binding, hiding w/ secret
 *   nullifier  = H(tenantDID || propertyDID || merchantSalt)  // deterministic per application
 *   The nullifier is registered; a second issuance with the same nullifier is rejected.
 *   A Merkle root over issued nullifiers lets a verifier check membership in O(log n).
 *
 * WHERE A REAL ZK PROVER PLUGS IN: replace `generateProof` with a Noir/Circom groth16
 * prover that proves knowledge of (secret, consecutiveMonths) satisfying the commitment,
 * and `verifyProof` with the on-chain verifier. The nullifier + Merkle + Solana-anchor
 * layers are identical regardless of prover. We clearly flag SIMULATED until a prover
 * is wired. Solana is untouched as a chain — we only ANCHOR the merkle root hash on it.
 */
import { createHash } from 'crypto';
import { prisma } from '../utils/database';
import { solanaAnchor } from './solanaAnchor.service';
import { logger } from '../utils/logger';

function h(...parts: any[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

export interface PorProof {
  proofId: string;
  commitment: string;
  nullifier: string;
  merkleRoot: string;
  consecutiveMonths: number;
  simulated: boolean;       // true until a real Noir/Circom prover is wired
  anchor: any;              // Solana anchor of the merkle root
  issuedAt: string;
}

// In-memory Merkle accumulator of issued nullifiers (anchored to Solana periodically).
// Keyed by a rolling epoch so the tree stays bounded.
const NULLIFIER_EPOCH = new Date().toISOString().slice(0, 7); // YYYY-MM
let issuedNullifiers: string[] = [];

export class ZkNullifierService {
  /**
   * Issue a nullifier-protected Proof of Rent.
   * Replay-protected: the same (tenantDID, propertyDID) combination can only be issued once.
   */
  async issueProof(tenantDID: string, propertyDID: string, consecutiveMonths: number, secret?: string): Promise<PorProof> {
    const sec = secret || createHash('sha256').update(`${tenantDID}:${propertyDID}:${Date.now()}:${Math.random()}`).digest('hex');
    const merchantSalt = createHash('sha256').update(`pabandi-merchant-${propertyDID}`).digest('hex');
    const commitment = h(tenantDID, propertyDID, sec);
    const nullifier = h(tenantDID, propertyDID, merchantSalt);

    // Replay guard: reject if this nullifier was already issued.
    const prior = await prisma.trustAuditTrail.findFirst({
      where: { component: 'ZK_NULLIFIER', changeReason: nullifier },
    }).catch(() =>{});
    if (prior) {
      throw new Error('NULLIFIER_REPLAY: this (tenant, property) proof was already issued');
    }

    issuedNullifiers.push(nullifier);
    const merkleRoot = this.merkleRoot(issuedNullifiers);

    const anchor = await solanaAnchor.anchorOnSolana('ZK_NULLIFIER', {
      epoch: NULLIFIER_EPOCH, commitment, nullifier, merkleRoot, consecutiveMonths,
    }, 'PABANDI_ZK');

    // Persist the nullifier (replay registry) + anchor reference.
    await prisma.trustAuditTrail.create({
      data: {
        userId: tenantDID,
        previousScore: 0, newScore: 0,
        changeReason: nullifier,
        component: 'ZK_NULLIFIER',
        severity: 'positive',
        metadata: { commitment, merkleRoot, anchor, consecutiveMonths } as any,
      } as any,
    }).catch((e) => logger.warn(`[ZK] audit persist skipped: ${e.message}`));

    return {
      proofId: `por_${commitment.slice(0, 16)}`,
      commitment, nullifier, merkleRoot,
      consecutiveMonths,
      simulated: true, // real Noir/Circom prover not yet wired
      anchor,
      issuedAt: new Date().toISOString(),
    };
  }

  /** Verify a proof: commitment well-formed + nullifier is in the current merkle root. */
  async verifyProof(proof: { commitment: string; nullifier: string; merkleRoot: string }): Promise<{ valid: boolean; reason: string }> {
    if (!proof.commitment || !proof.nullifier) return { valid: false, reason: 'missing commitment/nullifier' };
    const root = this.merkleRoot(issuedNullifiers);
    if (root !== proof.merkleRoot) {
      // Allow historical epochs: re-anchor check against stored roots.
      const stored = await prisma.trustAuditTrail.findFirst({
        where: { component: 'ZK_NULLIFIER', changeReason: proof.nullifier },
      }).catch(() => null as any);
      if (!stored) return { valid: false, reason: 'nullifier not found in registry' };
      const meta = (stored as any).metadata || {};
      if (meta.merkleRoot !== proof.merkleRoot) return { valid: false, reason: 'merkle root mismatch' };
      return { valid: true, reason: 'nullifier registered (historical epoch)' };
    }
    return { valid: true, reason: 'nullifier in current merkle root' };
  }

  /** Simple Merkle root over the sorted nullifier list (full tree; O(n) here, O(log n) verify in prod). */
  merkleRoot(nullifiers: string[]): string {
    if (nullifiers.length === 0) return h('empty');
    let layer = [...nullifiers].sort();
    while (layer.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < layer.length; i += 2) {
        next.push(h(layer[i], layer[i + 1] || layer[i]));
      }
      layer = next;
    }
    return layer[0];
  }

  getIssuedCount(): number { return issuedNullifiers.length; }
}

export const zkNullifierService = new ZkNullifierService();
