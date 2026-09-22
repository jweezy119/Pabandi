import React from 'react';
import { useQuery } from 'react-query';
import { tokens, Surface, Badge } from '../design-system';
import { protocolService } from '../services/protocolService';

const StatCard: React.FC<{ label: string; value: string | number; accent?: string; icon?: string }> = ({
  label,
  value,
  accent = tokens.color.primary,
  icon,
}) => (
  <Surface className="p-4 md:p-5">
    <div className="flex items-center gap-2 mb-2">
      {icon && <span className="text-lg">{icon}</span>}
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: tokens.color.textDim }}>
        {label}
      </span>
    </div>
    <div className="text-2xl md:text-3xl font-black" style={{ color: accent }}>
      {value}
    </div>
  </Surface>
);

export const ProtocolDashboard: React.FC = () => {
  const { data: statsData, isLoading } = useQuery('protocol-stats', async () => {
    const res = await protocolService.getStats();
    return res?.data?.data;
  }, { refetchInterval: 15000 });

  const stats = statsData || {};

  const tvl = stats.staking?.totalStaked ?? 0;
  const totalStaked = stats.staking?.totalStaked ?? 0;
  const escrowTotal = stats.escrow?.total ?? 0;
  const escrowActive = stats.escrow?.active ?? 0;
  const agentsTotal = stats.agents?.total ?? 0;
  const agentsActive = stats.agents?.active ?? 0;
  const fraudBlocked = stats.security?.fraudBlocked ?? 0;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: tokens.color.background }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-[var(--clay)]/30 border-t-indigo-500 animate-spin" />
          <span className="text-sm" style={{ color: tokens.color.textDim }}>Loading protocol data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Badge tone="info" className="mb-3">Protocol Overview</Badge>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--warm-ink)]">
            Pabandi Protocol
          </h1>
          <p className="mt-3 text-[var(--soft-stone)] max-w-2xl mx-auto">
            Real-time metrics for staking, escrow, agents, and security.
          </p>
        </div>

        {/* TVL Hero */}
        <div
          className="rounded-2xl p-6 md:p-8 text-center"
          style={{
            background: 'linear-gradient(135deg, var(--warm-sand) 0%, var(--cream) 100%)',
            border: '1px solid rgba(99,102,241,0.2)',
          }}
        >
          <div className="text-xs font-bold uppercase tracking-widest text-[var(--clay)] mb-2">Total Value Locked</div>
          <div className="text-4xl md:text-6xl font-black bg-gradient-to-r from-[var(--clay)] to-[var(--dusty-rose)] bg-clip-text text-transparent">
            {Number(tvl).toLocaleString()} PAB
          </div>
          <div className="mt-2 text-sm text-[var(--soft-stone)]">Secured by Jev AI</div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <StatCard label="Total Staked" value={Number(totalStaked).toLocaleString()} accent="var(--sage)" icon="🔒" />
          <StatCard label="Active Escrows" value={escrowActive} accent="var(--muted-ochre)" icon="📦" />
          <StatCard label="Total Agents" value={agentsTotal} accent="var(--clay)" icon="🤖" />
          <StatCard label="Fraud Blocked" value={fraudBlocked} accent="var(--terracotta)" icon="🛡️" />
        </div>

        {/* Tier Distribution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Surface className="p-5">
            <h3 className="text-sm font-bold text-[var(--warm-ink)] mb-4">🏆 Staking Tiers</h3>
            <div className="space-y-3">
              {[
                { name: 'Bronze', min: 0, color: 'var(--terracotta)' },
                { name: 'Silver', min: 100, color: 'var(--soft-stone)' },
                { name: 'Gold', min: 500, color: 'var(--muted-ochre)' },
                { name: 'Platinum', min: 2000, color: 'var(--soft-stone)' },
              ].map((tier) => (
                <div key={tier.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: tier.color }} />
                    <span className="text-sm text-[var(--warm-ink)]">{tier.name}</span>
                  </div>
                  <span className="text-xs font-mono" style={{ color: tokens.color.textDim }}>
                    {tier.min}+ PAB
                  </span>
                </div>
              ))}
            </div>
          </Surface>

          <Surface className="p-5">
            <h3 className="text-sm font-bold text-[var(--warm-ink)] mb-4">📊 Escrow Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--warm-ink)]">Total Escrows</span>
                <span className="font-mono font-bold text-[var(--warm-ink)]">{escrowTotal}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--warm-ink)]">Active</span>
                <span className="font-mono font-bold text-[var(--sage)]">{escrowActive}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--warm-ink)]">Completed</span>
                <span className="font-mono font-bold text-[var(--clay)]">{escrowTotal - escrowActive}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[var(--warm-sand)] mt-2">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--sage)] to-[var(--dusty-rose)]"
                  style={{ width: `${escrowTotal > 0 ? (escrowActive / escrowTotal) * 100 : 0}%` }}
                />
              </div>
            </div>
          </Surface>
        </div>

        {/* Agent Stats */}
        <Surface className="p-5">
          <h3 className="text-sm font-bold text-[var(--warm-ink)] mb-4">🤖 Agent Network</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-black text-[var(--clay)]">{agentsTotal}</div>
              <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>Total Agents</div>
            </div>
            <div>
              <div className="text-2xl font-black text-[var(--sage)]">{agentsActive}</div>
              <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>Active</div>
            </div>
            <div>
              <div className="text-2xl font-black text-[var(--dusty-rose)]">
                {agentsTotal > 0 ? Math.round((agentsActive / agentsTotal) * 100) : 0}%
              </div>
              <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>Activity Rate</div>
            </div>
          </div>
        </Surface>

        {/* Security Engine */}
        <Surface className="p-5">
          <h3 className="text-sm font-bold text-[var(--warm-ink)] mb-4">🛡️ Security Engine (Jev)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-[var(--warm-sand)] text-center">
              <div className="text-lg font-bold text-[var(--sage)]">Active</div>
              <div className="text-xs" style={{ color: tokens.color.textDim }}>Status</div>
            </div>
            <div className="p-3 rounded-lg bg-[var(--warm-sand)] text-center">
              <div className="text-lg font-bold text-[var(--clay)]">400x</div>
              <div className="text-xs" style={{ color: tokens.color.textDim }}>Cheaper than LLM</div>
            </div>
            <div className="p-3 rounded-lg bg-[var(--warm-sand)] text-center">
              <div className="text-lg font-bold text-[var(--muted-ochre)]">&lt;50ms</div>
              <div className="text-xs" style={{ color: tokens.color.textDim }}>Latency</div>
            </div>
            <div className="p-3 rounded-lg bg-[var(--warm-sand)] text-center">
              <div className="text-lg font-bold text-[var(--dusty-rose)]">3</div>
              <div className="text-xs" style={{ color: tokens.color.textDim }}>Check Types</div>
            </div>
          </div>
        </Surface>
      </div>
    </div>
  );
};

export default ProtocolDashboard;
