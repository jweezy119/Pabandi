export interface MLScoredTarget {
  id: string;
  name: string;
  email?: string;
  website?: string;
  wallet?: string;
  agentType: string;
  source: string;
  score: number; // 0-100
  tier: 'hot' | 'warm' | 'cold';
  factors: {
    balance: number; // 0-30
    activity: number; // 0-30
    github: number; // 0-20
    contact: number; // 0-20
  };
  reason: string;
}

export interface ScoreInputs {
  usdcBalance: number;
  txCount: number;
  lastActivity?: Date | null;
  githubStars?: number;
  githubForks?: number;
  githubLastCommit?: Date | null;
  hasEmail: boolean;
  hasWebsite: boolean;
  hasWallet: boolean;
}

/**
 * Heuristic lead scoring model for scout targets.
 *
 * Factors (weights sum to 100):
 *   - USDC balance:     30 (holds settlement currency = intent)
 *   - On-chain activity: 30 (recent transactor = active user)
 *   - GitHub presence:   20 (active builder = likely adopter)
 *   - Contact info:      20 (can we actually reach them?)
 *
 * A target with a wallet + USDC + recent activity scores "hot" and gets
 * prioritized for outreach. A GitHub repo with no email and no wallet stays
 * "cold" and is skipped.
 */
export function scoreTarget(inputs: ScoreInputs): { score: number; tier: 'hot' | 'warm' | 'cold'; reason: string; factors: { balance: number; activity: number; github: number; contact: number; } } {
  // ── Balance score (0-30) ──
  const usdcBalance = inputs.usdcBalance ?? 0;
  const txCount = inputs.txCount ?? 0;
  const githubStars = inputs.githubStars ?? 0;
  const githubForks = inputs.githubForks ?? 0;

  // $10k+ USDC = full 30, $1k = 3, $0 = 0
  let balanceScore = 0;
  if (usdcBalance >= 10000) balanceScore = 30;
  else if (usdcBalance >= 1000) balanceScore = Math.round(3 + (usdcBalance - 1000) / 9000 * 27);
  else if (usdcBalance > 0) balanceScore = Math.round(usdcBalance / 1000 * 3);

  // ── Activity score (0-30) ──
  // Recent activity (<7 days) = full 30, <30 days = 20, <90 days = 10, older = 0
  let activityScore = 0;
  if (txCount >= 10) activityScore += 15;
  else if (txCount >= 3) activityScore += 10;
  else if (txCount >= 1) activityScore += 5;

  const now = new Date();
  const daysSinceActivity = inputs.lastActivity
    ? (now.getTime() - inputs.lastActivity.getTime()) / (1000 * 60 * 60 * 24)
    : 999;

  if (daysSinceActivity < 7) activityScore += 15;
  else if (daysSinceActivity < 30) activityScore += 10;
  else if (daysSinceActivity < 90) activityScore += 5;

  // ── GitHub score (0-20) ──
  let githubScore = 0;
  if (githubStars >= 100) githubScore += 10;
  else if (githubStars >= 10) githubScore += 5;
  else if (githubStars > 0) githubScore += 2;

  if (githubForks >= 20) githubScore += 5;
  else if (githubForks >= 5) githubScore += 3;
  else if (githubForks > 0) githubScore += 1;

  const daysSinceCommit = inputs.githubLastCommit
    ? (now.getTime() - inputs.githubLastCommit.getTime()) / (1000 * 60 * 60 * 24)
    : 999;

  if (daysSinceCommit < 30) githubScore += 5;
  else if (daysSinceCommit < 90) githubScore += 3;

  // ── Contact score (0-20) ──
  const hasEmail = inputs.hasEmail ?? false;
  const hasWebsite = inputs.hasWebsite ?? false;
  const hasWallet = inputs.hasWallet ?? false;

  let contactScore = 0;
  if (hasEmail) contactScore += 10;
  if (hasWebsite) contactScore += 5;
  if (hasWallet) contactScore += 5;

  const score = Math.min(100, balanceScore + activityScore + githubScore + contactScore);

  let tier: MLScoredTarget['tier'] = 'cold';
  if (score >= 70) tier = 'hot';
  else if (score >= 40) tier = 'warm';

  let reason: string;
  if (score >= 70) reason = 'High-intent: wallet + USDC + recent activity';
  else if (score >= 40) reason = 'Moderate intent: some signals present';
  else if (hasEmail && hasWallet) reason = 'Low intent but reachable with wallet';
  else reason = 'Low intent: missing contact or on-chain presence';

  return {
    score,
    tier,
    factors: { balance: balanceScore, activity: activityScore, github: githubScore, contact: contactScore },
    reason,
  };
}

/**
 * Rank targets by ML score, hot first, then by score descending.
 */
export function rankTargets(targets: MLScoredTarget[]): MLScoredTarget[] {
  return [...targets].sort((a, b) => {
    const tierOrder = { hot: 3, warm: 2, cold: 1 };
    if (tierOrder[b.tier] !== tierOrder[a.tier]) return tierOrder[b.tier] - tierOrder[a.tier];
    return b.score - a.score;
  });
}

export const scoutML = { scoreTarget, rankTargets };
