export function trustTierFromPassportScore(score?: number | null) {
  if (score == null || score < 20) return 'BRONZE';
  if (score < 40) return 'SILVER';
  if (score < 60) return 'GOLD';
  return 'PLATINUM';
}

export function trustTierPreset(score?: number | null) {
  const tier = trustTierFromPassportScore(score);
  if (tier === 'PLATINUM') return { id: 'platinum', emoji: '💎', color: '#94a3b8' };
  if (tier === 'GOLD') return { id: 'gold', emoji: '🥇', color: '#fbbf24' };
  if (tier === 'SILVER') return { id: 'silver', emoji: '🥈', color: '#818cf8' };
  return { id: 'bronze', emoji: '🥉', color: '#f59e0b' };
}
