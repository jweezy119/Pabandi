import axios from 'axios';
import { logger } from '../utils/logger';

/**
 * TypeSafe / Jev — structured decisions.
 *
 * Jev is not a chat model. It takes a `state` (text or JSON) and a set of
 * typed questions, and returns one answer per question. Use it for decisions
 * that must be structured: dispute verdicts, risk bands, quality scores.
 *
 * Pricing is input-only ($0.042 / 1M input tokens, output free), so a decision
 * path that would need a large generative model is cheap here. It is not a
 * free tier; `TYPESAFE_API_KEY` must be set.
 */

export interface JevChoiceQuestion {
  type: 'choice';
  instructions: string;
  criteria: Record<string, string>;
}

export interface JevScoreQuestion {
  type: 'score';
  instructions: string;
  criteria: string[];
}

export interface JevNoulQuestion {
  type: 'noul';
  instructions: string;
}

export type JevQuestion = JevChoiceQuestion | JevScoreQuestion | JevNoulQuestion;

export interface JevAnswer {
  choice?: string;
  score?: number;
  noul?: number;
  confidence?: number;
  probabilities?: Record<string, number>;
}

export interface JevResponse {
  answers: Record<string, JevAnswer>;
}

export function jevStatus(): boolean {
  return Boolean((process.env.TYPESAFE_API_KEY || '').trim());
}

export async function jevDecide(
  state: string | Record<string, unknown>,
  questions: Record<string, JevQuestion>,
): Promise<JevResponse> {
  const apiKey = (process.env.TYPESAFE_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('TYPESAFE_API_KEY is not configured');
  }

  const base = (process.env.TYPESAFE_BASE_URL || 'https://api.typesafe.ai').replace(/\/$/, '');
  const model = process.env.TYPESAFE_MODEL || 'jev-latest';

  const response = await axios.post(
    `${base}/v1/systemone`,
    { state, model, questions },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    },
  );

  return response.data as JevResponse;
}

export interface DisputeReview {
  verdict: 'release' | 'refund' | 'human_review';
  confidence: number;
  raw: JevResponse;
}

/**
 * First-line review of a dispute. The verdict is a decision, not a payment:
 * `release` and `refund` are recommendations for a human or escrow contract,
 * and `human_review` is the explicit "not enough evidence" answer.
 */
export async function reviewDispute(input: {
  description: string;
  evidenceUrls?: string[];
}): Promise<DisputeReview> {
  const response = await jevDecide(
    {
      claim: input.description,
      evidence: input.evidenceUrls ?? [],
    },
    {
      verdict: {
        type: 'choice',
        instructions: 'Review this evidence. Issue a verdict: RELEASE to seller, or REFUND to buyer.',
        criteria: {
          release: 'The evidence supports releasing the deposit to the seller',
          refund: 'The evidence supports refunding the buyer',
          human_review: 'The evidence is conflicting or insufficient for a decision',
        },
      },
      confidence: {
        type: 'score',
        instructions: 'How confident are you in the verdict?',
        criteria: ['Low', 'Medium', 'High'],
      },
    },
  );

  const verdict = response.answers?.verdict?.choice ?? 'human_review';
  const confidence = response.answers?.confidence?.score ?? 0;
  return {
    verdict: verdict === 'release' || verdict === 'refund' ? verdict : 'human_review',
    confidence: typeof confidence === 'number' ? confidence : 0,
    raw: response,
  };
}

export async function safeReviewDispute(input: {
  description: string;
  evidenceUrls?: string[];
}): Promise<DisputeReview | null> {
  if (!jevStatus()) return null;
  try {
    return await reviewDispute(input);
  } catch (error: any) {
    logger.error(`[Jev] dispute review failed: ${error.message}`);
    return null;
  }
}
