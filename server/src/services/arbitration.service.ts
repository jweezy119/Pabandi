import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { jevDecision } from './jevDecision.service';
import { sulhaService } from './sulha.service';

/**
 * arbitration.service.ts — the Jev arbitrator for Sulha (Optimistic
 * Arbitration).
 *
 * ─── THE ORDER OF AUTHORITY ───────────────────────────────────────────────
 * A dispute is heard by Jev first — Pabandi's cheap, fast decision model —
 * and only escalates to the staked human panel when the machine cannot
 * decide with high confidence. The two thresholds matter more than the
 * plumbing:
 *
 *   - Jev confidence > 90  → the dispute RESOLVES automatically, the escrow
 *     releases or refunds through sulhaService.settleDispute, which fires
 *     the trust events (winner's score gains, loser's drops).
 *   - Jev confidence ≤ 90, or Jev unavailable, or an unparseable answer →
 *     the dispute moves to `human_review`. Jev's preliminary read is stored
 *     as resolutionNotes so the panel reviews WITH the machine's opinion,
 *     not from scratch.
 *
 * The fail-safe direction is deliberate: an ambiguous case reaching humans
 * costs review time; an ambiguous case auto-resolving costs someone's
 * money. Confidence must be proven, not assumed.
 */

export const ARBITRATION_CONFIDENCE_THRESHOLD = 90;

/** Jev's verdict — the exact JSON contract the task pins. */
export interface ArbitrationVerdict {
  fault: 'buyer' | 'seller';
  /** 0–100, normalised from Jev's 0–1 confidence. */
  confidence: number;
  reasoning: string;
}

export interface ArbitrationCase {
  dispute: {
    id: string;
    escrowId: string;
    raisedByPassport: string;
    reason: string;
    evidenceJson: unknown;
    status: string;
  };
  contractJson: unknown;
  buyerEvidence: unknown;
  sellerEvidence: unknown;
}

function evidenceSummary(evidence: unknown): string {
  if (!evidence || typeof evidence !== 'object') return JSON.stringify(evidence ?? {});
  const e = evidence as Record<string, unknown>;
  const parts: string[] = [];
  const urls = Array.isArray(e.urls) ? e.urls : [];
  const hashes = Array.isArray(e.hashes) ? e.hashes : [];
  const appended = Array.isArray(e.appended) ? e.appended : [];
  if (urls.length) parts.push(`${urls.length} evidence URL(s)`);
  if (hashes.length) parts.push(`${hashes.length} data hash(es)`);
  const appendedItems = appended.reduce<number>((n, entry) => {
    if (entry && typeof entry === 'object') {
      const ev = (entry as { evidence?: unknown }).evidence;
      if (ev && typeof ev === 'object' && Object.keys(ev as object).length > 0) return n + 1;
    }
    return n;
  }, 0);
  if (appendedItems) parts.push(`${appendedItems} follow-up submission(s)`);
  const notes = typeof e.notes === 'string' ? e.notes : null;
  if (notes) parts.push(`notes: ${notes}`);
  return parts.length ? parts.join(', ') + (notes ? '' : '') : JSON.stringify(e).slice(0, 800);
}

function splitEvidenceBySide(evidenceJson: unknown, raiserSide: 'buyer' | 'seller'): {
  buyerEvidence: unknown;
  sellerEvidence: unknown;
} {
  // The raiser's evidence leads their side of the file. Follow-up submissions
  // carry the passport that submitted them, but party roles are escrow-level
  // data, so any appended submission we cannot attribute stays on the raiser's
  // side — the panel reads both stacks anyway.
  const original = evidenceJson && typeof evidenceJson === 'object' ? (evidenceJson as Record<string, unknown>) : {};
  const { appended, ...core } = original;
  return raiserSide === 'buyer'
    ? { buyerEvidence: original, sellerEvidence: appended ? { appended } : {} }
    : { buyerEvidence: appended ? { appended } : {}, sellerEvidence: original };
}

export class ArbitrationService {
  /**
   * Queue a dispute for machine arbitration. This is the raise-time entry
   * point: it flips the dispute to `ai_review` synchronously (so every read
   * after the raise returns a coherent state) and hands the Jev call to the
   * background — a model call takes seconds, and the raising party should not
   * wait on it to learn that their case is filed.
   */
  async queueArbitration(disputeId: string): Promise<{ queued: boolean; settled?: Promise<ArbitrationVerdict | { escalated: 'human_review' }> }> {
    const updated = await prisma.escrowDispute.updateMany({
      where: { id: disputeId, status: 'open' },
      data: { status: 'ai_review' },
    });
    if (updated.count === 0) {
      // Something resolved it between the raise and this call, or it was
      // already queued — either way nothing to do, and nothing to crash over.
      return { queued: false };
    }

    // Fire and forget: the run records its own outcome (verdict, human_review,
    // or error → human_review) so a rejected background promise is a lost
    // dispute, while a caught one is a dispute waiting for the panel.
    const settled = this.runArbitration(disputeId).catch((err: unknown) => {
      logger.error(`[Sulha] arbitration crashed for ${disputeId}, escalating to human review: ${String(err)}`);
      return this.markHumanReview(disputeId, 'Arbitration crashed; awaiting panel').then(() => ({ escalated: 'human_review' as const }));
    });
    // The routes never await this; tests do, so a background hearing cannot
    // leak into a neighbouring case's observations.
    void settled;
    return { queued: true, settled };
  }

  /** The full machine hearing, synchronously. Exposed for tests and retries. */
  async runArbitration(disputeId: string): Promise<ArbitrationVerdict | { escalated: 'human_review' }> {
    const dispute = await prisma.escrowDispute.findUnique({
      where: { id: disputeId },
      select: {
        id: true,
        escrowId: true,
        raisedByPassport: true,
        reason: true,
        evidenceJson: true,
        status: true,
      },
    });
    if (!dispute) throw new Error(`No dispute ${disputeId} to arbitrate`);
    if (dispute.status.startsWith('resolved')) {
      // Settled while arbitrator queue was forming — a real race the panel can
      // win. Recording nothing further: the human verdict stands.
      logger.info(`[Sulha] dispute ${disputeId} already resolved; arbitration skipped`);
      return { escalated: 'human_review' };
    }

    const escrow = await prisma.universalEscrow.findUnique({
      where: { referenceId: dispute.escrowId },
      select: { template: true, amount: true, currency: true, conditions: true, metadata: true, parties: true },
    });

    const parties = Array.isArray(escrow?.parties) ? (escrow?.parties as Array<{ partyId: string; role?: string }>) : [];
    // Whichever role the raiser is named under — evidence attribution and the
    // case framing follow from that, not from an assumption that buyers file
    // first.
    const raiserParty = parties.find((p) => p.partyId === dispute.raisedByPassport);
    const raiserSide: 'buyer' | 'seller' = raiserParty?.role === 'seller' ? 'seller' : 'buyer';
    const { buyerEvidence, sellerEvidence } = splitEvidenceBySide(dispute.evidenceJson, raiserSide);

    // Contract terms: the conditions the escrow was authored with — what the
    // parties agreed to — plus the metadata the escrow API carried.
    const contractJson = {
      template: escrow?.template ?? 'custom',
      amount: escrow?.amount,
      currency: escrow?.currency,
      conditions: escrow?.conditions ?? [],
      metadata: escrow?.metadata ?? {},
    };

    const state = {
      escrow_id: dispute.escrowId,
      dispute_id: dispute.id,
      claim: dispute.reason,
      contract_terms: contractJson,
      buyer_evidence: buyerEvidence,
      seller_evidence: sellerEvidence,
    };

    const question = this.arbitrationQuestion(dispute.reason, evidenceSummary(buyerEvidence), evidenceSummary(sellerEvidence), contractJson);
    const answers = (await jevDecision.decide(state, question)) as Record<string, unknown> | null;

    if (!answers) {
      // Jev down, key unset, or API refusal — the fail-safe escalates. NOT an
      // error: an unavailable arbitrator is a normal, scheduled condition.
      logger.warn(`[Sulha] Jev unavailable for ${disputeId}; escalating to human review`);
      await this.markHumanReview(disputeId, 'Jev arbitrator unavailable; awaiting panel');
      return { escalated: 'human_review' };
    }

    const faultAnswer = answers.fault as { choice?: string; confidence?: number } | undefined;
    const fault = faultAnswer?.choice;
    if (fault !== 'buyer' && fault !== 'seller') {
      logger.warn(`[Sulha] Jev gave no parsable fault for ${disputeId}: ${JSON.stringify(answers).slice(0, 400)}`);
      await this.markHumanReview(disputeId, 'Jev verdict unreadable; awaiting panel');
      return { escalated: 'human_review' };
    }

    // Jev confidence is 0–1; the Sulha contract is 0–100. A fault answer is
    // required to be confident; the explicit rubric answer, when present,
    // pulls the reported confidence down when Jev hedges in either channel.
    const rubricConfidence = (answers.confidence as { score?: number; confidence?: number } | undefined)?.confidence;
    const rawConfidence = Math.min(faultAnswer?.confidence ?? 0, rubricConfidence ?? 1);
    const confidence = Math.round(Math.min(1, Math.max(0, rawConfidence)) * 100);

    const verdict: ArbitrationVerdict = {
      fault,
      confidence,
      reasoning: this.composeReasoning(fault, confidence, dispute.reason, contractJson),
    };

    if (confidence > ARBITRATION_CONFIDENCE_THRESHOLD) {
      logger.info(`[Sulha] Jev resolving ${disputeId}: fault=${fault} confidence=${confidence}`);
      await sulhaService.settleDispute({
        disputeId,
        verdict: fault,
        resolutionNotes: `Jev auto-resolution (${confidence}% confidence): ${verdict.reasoning}`,
        confidence,
        source: 'ai',
      });
    } else {
      logger.info(
        `[Sulha] Jev inconclusive for ${disputeId} (${confidence}% ≤ ${ARBITRATION_CONFIDENCE_THRESHOLD}%); human panel`
      );
      await this.markHumanReview(disputeId, `Jev preliminary read: fault=${fault} (${confidence}%): ${verdict.reasoning}`, confidence);
    }

    return verdict;
  }

  /**
   * Escalate to the staked panel. Jev's read (when there was one) stays in
   * resolutionNotes — the panel reviews with the machine's opinion in front
   * of it, which is the whole point of calling Jev first.
   */
  private async markHumanReview(disputeId: string, notes: string, confidence?: number): Promise<void> {
    await prisma.escrowDispute.updateMany({
      where: { id: disputeId, status: { in: ['open', 'ai_review'] } },
      data: {
        status: 'human_review',
        resolutionNotes: notes,
        ...(confidence !== undefined ? { aiConfidence: confidence } : {}),
      },
    });
  }

  /**
   * The Jev question set. The prompt text is the Sulha arbitration charter,
   * rendered as instructions + rubric so Jev answers a bounded question
   * instead of riffing.
   */
  private arbitrationQuestion(
    claim: string,
    buyerEvidence: string,
    sellerEvidence: string,
    contract: unknown
  ): Record<string, import('./jevDecision.service').JevQuestion> {
    return {
      fault: {
        type: 'choice',
        instructions:
          'You are an objective arbitrator. Decide which party is at fault given the evidence. ' +
          `Buyer claims: ${claim}. Buyer submitted: ${buyerEvidence || 'no evidence'}. ` +
          `Seller submitted: ${sellerEvidence || 'no evidence'}. ` +
          `The parties escrowed funds under these initial contract terms: ${JSON.stringify(contract).slice(0, 1200)}. ` +
          'Rule for the party whose conduct better matches the contract terms and the evidence, not the louder party.',
        criteria: {
          buyer: 'Buyer is at fault — the seller met the contract terms and the buyers evidence does not show otherwise',
          seller: 'Seller is at fault — the buyer claim is supported by the evidence or the seller could not meet the contract terms',
        },
      },
      confidence: {
        type: 'score',
        instructions: 'How decisive is this ruling? Score your evidentiary certainty, not your confidence in the choice above.',
        criteria: [
          'Inconclusive — evidence is thin, contradictory, or missing on both sides',
          'Leaning one way — some supporting evidence, plausibly contestable',
          'Clear — evidence lines up with the contract terms on one side',
          'Decisive — the evidence is unambiguous and a reasonable reviewer would not contest the ruling',
        ],
      },
    };
  }

  /**
   * A human-readable reasoning line. Jev answers structured questions, not
   * prose — rather than fabricate a quote, the reasoning records what the
   * verdict is built FROM: the claim, the term-set, and the evidence stacks
   * both sides filed. The panel and auditors can re-trace it.
   */
  private composeReasoning(
    fault: 'buyer' | 'seller',
    confidence: number,
    claim: string,
    contract: unknown
  ): string {
    const c = contract as { template?: string; amount?: number; currency?: string };
    return (
      `Fault assigned to ${fault} at ${confidence}% confidence. The ruling sides with the party whose conduct ` +
      `matched the escrowed contract terms (${c.template ?? 'custom'}, ${c.amount ?? '?'} ${c.currency ?? ''}) ` +
      `in the case raised as: "${claim}".`
    );
  }
}

export const arbitrationService = new ArbitrationService();
