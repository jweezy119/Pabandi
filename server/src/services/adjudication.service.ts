import { z } from 'zod';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { sulhaService } from './sulha.service';
import { universalEscrowService } from './universal-escrow.service';
import type { AdjudicationCase, Prisma } from '@prisma/client';

type AdjudicationCaseRow = Prisma.AdjudicationCaseGetPayload<{}>;

/**
 * adjudication.service.ts — Internet Court Adjudication (Sulha).
 *
 * When a buyer rejects delivered work, the system requires a structured
 * EvidenceBundle before anything is arbitrated. Jev (Pabandi's Sulha AI)
 * reviews the bundle and issues a verdict:
 *
 *   - confidence > 90 → the verdict auto-executes (escrow released to seller
 *     or refunded to buyer)
 *   - confidence ≤ 90 → escalated to a staked human arbitrator panel
 *
 * The fail-safe direction is deliberate: an ambiguous case costs review time
 * when it reaches humans; an ambiguous case auto-resolving costs someone's
 * money. Confidence must be proven, not assumed.
 */

/** The strict prompt fed to Jev for every adjudication. */
export const SULHA_ADJUDICATION_PROMPT =
  'Review this evidence. Issue a verdict: RELEASE to seller, or REFUND to buyer. Provide reasoning.';

export const ARBITRATION_CONFIDENCE_THRESHOLD = 90;

/** Compute Energy Quota: maximum milliseconds the AI is allowed to run. */
export const COMPUTE_QUOTA_MS = 5000;

/** Escrows below this amount bypass AI entirely — compute cost not worth it. */
export const MIN_ESCROW_FOR_AI_USD = 10;

export interface EvidenceBundle {
  /** The job/escrow being disputed. */
  jobId: string;
  /** Buyer's claim about why the work is rejected. */
  buyerClaim: string;
  /** IPFS hash (or content hash) of the delivered data/proof. */
  sellerProof: string;
  /** Oracle-side data: price feed, GPS coordinate, etc. */
  oracleData: Record<string, unknown>;
}

export interface AdjudicationVerdict {
  verdict: 'RELEASE' | 'REFUND';
  /** 0–100, normalised from Jev's 0–1 confidence. */
  confidence: number;
  reasoning: string;
}

export interface AdjudicationCaseView {
  id: string;
  jobId: string;
  buyerClaim: string;
  sellerProof: string;
  oracleData: Record<string, unknown>;
  verdict: 'RELEASE' | 'REFUND' | null;
  confidence: number | null;
  reasoning: string | null;
  status: string;
  createdAt: Date;
  resolvedAt: Date | null;
}

const evidenceBundleSchema = z.object({
  jobId: z.string().min(1, 'jobId is required'),
  buyerClaim: z.string().min(3, 'buyerClaim must be at least 3 characters'),
  sellerProof: z.string().min(1, 'sellerProof is required'),
  oracleData: z.record(z.string(), z.unknown()).default({}),
});

export class AdjudicationService {
  /**
   * Submit an EvidenceBundle and open an adjudication case.
   *
   * One case per job (jobId is @unique). A re-submission for the same job
   * returns the existing case rather than duplicating the dispute.
   */
  async submitEvidence(input: EvidenceBundle): Promise<AdjudicationCaseView> {
    const parsed = evidenceBundleSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(
        `Invalid EvidenceBundle: ${parsed.error.issues.map(i => i.message).join('; ')}`,
      );
    }

    const { jobId, buyerClaim, sellerProof, oracleData } = parsed.data;

    const existing = await prisma.adjudicationCase.findUnique({
      where: { jobId },
    });
    if (existing) {
      logger.info(
        `[Adjudication] idempotent replay jobId=${jobId} caseId=${existing.id} status=${existing.status}`,
      );
      return this.toView(existing);
    }

    const created = await prisma.adjudicationCase.create({
      data: {
        jobId,
        buyerClaim,
        sellerProof,
        oracleData: oracleData as Prisma.InputJsonValue,
        status: 'pending',
      },
    });

    logger.info(
      `[Adjudication] case opened caseId=${created.id} jobId=${jobId}`,
    );

    return this.toView(created);
  }

  /**
   * Run Jev (Sulha AI) over the evidence bundle and issue a verdict.
   *
   * Compute Energy Quota:
   *   - Escrows below $10 bypass AI entirely → human review (compute cost
   *     not worth it).
   *   - Jev call is wrapped in a 5-second Promise.race. On timeout the AI
   *     request is aborted and the dispute is escalated to human review
   *     with an "AI Timeout" note.
   *
   * Jev > 90% confidence → auto-execute: escrow released or refunded via
   * sulhaService.settleDispute, and the case marked auto_executed.
   * Jev ≤ 90% → escalated to a human arbitrator panel; case marked escalated.
   */
  async adjudicate(caseId: string): Promise<{
    verdict: AdjudicationVerdict;
    autoExecuted: boolean;
    escalated: boolean;
  }> {
    const caseRow = await prisma.adjudicationCase.findUnique({
      where: { id: caseId },
    });
    if (!caseRow) {
      throw new Error(`Adjudication case ${caseId} not found`);
    }
    if (caseRow.status !== 'pending') {
      throw new Error(`Case ${caseId} already ${caseRow.status}`);
    }

    // ── Compute quota: bypass AI for small escrows ────────────────────────
    const escrow = await prisma.universalEscrow.findUnique({
      where: { referenceId: caseRow.jobId },
      select: { amount: true },
    });
    const amountUsd = Number(escrow?.amount ?? 0);
    if (amountUsd < MIN_ESCROW_FOR_AI_USD) {
      const updated = await prisma.adjudicationCase.update({
        where: { id: caseId },
        data: {
          status: 'human_review',
          reasoning: 'AI Timeout: escrow amount below $10 compute quota — bypassed AI, queued for human review.',
        },
      });
      logger.info(
        `[Adjudication] case ${caseId} bypassed AI (amount $${amountUsd} < $${MIN_ESCROW_FOR_AI_USD}) → human_review`,
      );
      return {
        verdict: {
          verdict: 'REFUND',
          confidence: 0,
          reasoning: `Bypassed AI — escrow amount $${amountUsd} below $${MIN_ESCROW_FOR_AI_USD} compute quota`,
        },
        autoExecuted: false,
        escalated: true,
      };
    }

    const verdict = await this.runJevWithTimeout(caseRow);

    // ── Timeout or Jev unavailable → escalate to human panel ──────────────
    if (!verdict) {
      const updated = await prisma.adjudicationCase.update({
        where: { id: caseId },
        data: {
          status: 'human_review',
          reasoning: 'AI Timeout: Jev compute quota exceeded — escalated to human review.',
        },
      });
      logger.info(
        `[Adjudication] case ${caseId} AI Timeout → human_review`,
      );
      return {
        verdict: {
          verdict: 'REFUND',
          confidence: 0,
          reasoning: 'AI Timeout: Jev compute quota exceeded',
        },
        autoExecuted: false,
        escalated: true,
      };
    }

    // ── High confidence: auto-execute ─────────────────────────────────────
    if (verdict.confidence > ARBITRATION_CONFIDENCE_THRESHOLD) {
      await this.autoExecute(caseRow, verdict);
      return { verdict, autoExecuted: true, escalated: false };
    }

    // ── Low confidence: escalate to human panel ───────────────────────────
    const updated = await prisma.adjudicationCase.update({
      where: { id: caseId },
      data: {
        status: 'escalated',
        verdict: verdict.verdict,
        confidence: verdict.confidence,
        reasoning: verdict.reasoning,
      },
    });

    logger.info(
      `[Adjudication] case ${caseId} escalated to human panel ` +
        `(verdict=${verdict.verdict} confidence=${verdict.confidence})`,
    );

    return { verdict, autoExecuted: false, escalated: true };
  }

  /** Read a case's current state. */
  async getCase(caseId: string): Promise<AdjudicationCaseView | null> {
    const row = await prisma.adjudicationCase.findUnique({ where: { id: caseId } });
    return row ? this.toView(row) : null;
  }

  /** Get (or create) the case for a job, then read it. */
  async getCaseByJobId(jobId: string): Promise<AdjudicationCaseView | null> {
    const row = await prisma.adjudicationCase.findUnique({ where: { jobId } });
    return row ? this.toView(row) : null;
  }

  /* ── Jev (Sulha AI) invocation ───────────────────────────────────────── */

  private async runJev(caseRow: {
    id: string;
    jobId: string;
    buyerClaim: string;
    sellerProof: string;
    oracleData: unknown;
  }): Promise<AdjudicationVerdict> {
    const verdict = await this.runJevWithTimeout(caseRow);
    if (verdict) {
      return verdict;
    }

    // Fallback: deterministic rule-based read when Jev times out or is
    // unavailable. This never returns >90% confidence, which correctly
    // escalates to the human panel.
    logger.warn('[Adjudication] Jev unavailable or timed out; using deterministic fallback');
    const strongSellerProof = typeof caseRow.sellerProof === 'string' && caseRow.sellerProof.length > 10;
    const hasOracleData = caseRow.oracleData && Object.keys(caseRow.oracleData).length > 0;
    const v: 'RELEASE' | 'REFUND' = strongSellerProof && hasOracleData ? 'RELEASE' : 'REFUND';
    return {
      verdict: v,
      confidence: 60, // deliberately below the 90% auto-execute threshold
      reasoning: 'Fallback heuristic (Jev unavailable/timed out): seller proof present and oracle data attached → lean RELEASE; otherwise REFUND. Escalate to human panel for a binding decision.',
    };
  }

  /**
   * Call Jev wrapped in a 5-second Promise.race (Compute Energy Quota).
   * Returns null on timeout so the caller can escalate to human review.
   */
  private async runJevWithTimeout(caseRow: {
    id: string;
    jobId: string;
    buyerClaim: string;
    sellerProof: string;
    oracleData: unknown;
  }): Promise<AdjudicationVerdict | null> {
    const prompt = `${SULHA_ADJUDICATION_PROMPT}\n\n` +
      `Job: ${caseRow.jobId}\n` +
      `Buyer claim: ${caseRow.buyerClaim}\n` +
      `Seller proof (IPFS/content hash): ${caseRow.sellerProof}\n` +
      `Oracle data: ${JSON.stringify(caseRow.oracleData)}`;

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Jev compute quota exceeded')), COMPUTE_QUOTA_MS);
    });

    try {
      return await Promise.race([this.callJev(prompt), timeoutPromise]);
    } catch {
      return null;
    }
  }

  /** Call the Jev/typesafe decision endpoint with the strict adjudication prompt. */
  private async callJev(prompt: string): Promise<AdjudicationVerdict | null> {
    const apiKey = process.env.TYPESAFE_API_KEY || '';
    const baseUrl = process.env.TYPESAFE_BASE_URL || 'https://api.typesafe.dev';
    if (!apiKey) return null;

    try {
      const response = await fetch(`${baseUrl}/v1/decisions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'jev-latest',
          state: {},
          questions: {
            verdict: {
              type: 'choice',
              instructions: prompt,
              criteria: ['RELEASE', 'REFUND'],
            },
            confidence: {
              type: 'score',
              instructions: 'Confidence 0-100 in the verdict.',
            },
            reasoning: {
              type: 'noul',
              instructions: 'Reasoning for the verdict.',
            },
          },
        }),
      });

      if (!response.ok) {
        logger.warn(`[Adjudication] Jev API error: ${response.status}`);
        return null;
      }

      const body = await response.json();
      const answers = body.answers ?? {};
      const verdict = String(answers.verdict ?? '').toUpperCase() as 'RELEASE' | 'REFUND';
      const confidence = Number(answers.confidence ?? 0);
      const reasoning = String(answers.reasoning ?? '');

      if (verdict !== 'RELEASE' && verdict !== 'REFUND') {
        logger.warn(`[Adjudication] Jev returned unparseable verdict: ${verdict}`);
        return null;
      }

      return { verdict, confidence, reasoning };
    } catch (err: unknown) {
      logger.warn(`[Adjudication] Jev call failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  /* ── Auto-execution ──────────────────────────────────────────────────── */

  private async autoExecute(
    caseRow: { id: string; jobId: string },
    verdict: AdjudicationVerdict,
  ): Promise<void> {
    // Freeze the escrow as disputed first (Sulha invariant), then settle.
    await universalEscrowService.updateStatus(caseRow.jobId, 'disputed').catch((err) => {
      logger.warn(
        `[Adjudication] could not mark escrow ${caseRow.jobId} disputed: ${err instanceof Error ? err.message : String(err)}`,
      );
    });

    const sulhaVerdict = verdict.verdict === 'RELEASE' ? 'seller' : 'buyer';
    await sulhaService.settleDispute({
      disputeId: caseRow.id,
      verdict: sulhaVerdict,
      resolutionNotes: verdict.reasoning,
      confidence: verdict.confidence,
      source: 'ai',
    });

    await prisma.adjudicationCase.update({
      where: { id: caseRow.id },
      data: {
        status: 'auto_executed',
        verdict: verdict.verdict,
        confidence: verdict.confidence,
        reasoning: verdict.reasoning,
        resolvedAt: new Date(),
      },
    });

    logger.info(
      `[Adjudication] case ${caseRow.id} auto-executed: ${verdict.verdict} ` +
        `(confidence=${verdict.confidence})`,
    );
  }

  private toView(row: AdjudicationCaseRow): AdjudicationCaseView {
    return {
      id: row.id,
      jobId: row.jobId,
      buyerClaim: row.buyerClaim,
      sellerProof: row.sellerProof,
      oracleData: (row.oracleData ?? {}) as Record<string, unknown>,
      verdict: (row.verdict ?? null) as 'RELEASE' | 'REFUND' | null,
      confidence: row.confidence,
      reasoning: row.reasoning,
      status: row.status,
      createdAt: row.createdAt,
      resolvedAt: row.resolvedAt,
    };
  }
}

export const adjudicationService = new AdjudicationService();
