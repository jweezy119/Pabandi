import React, { useState, useEffect, useCallback } from 'react';

interface ProfitReport {
  totalCycles: number;
  totalRevenue: number;
  totalPabIssued: number;
  avgCycleTime: number;
  capitalVelocity: number;
  dailyRevenue: number;
  monthlyRevenue: number;
  annualRevenue: number;
  roiPercent: number;
  efficiency: number;
  currentFeeRate: number;
}

interface CycleResult {
  cycleNumber: number;
  cycleTime: number;
  revenue: number;
  pabIssued: number;
  success: boolean;
}

interface AgentProfile {
  id: string;
  name: string;
  slug: string;
  reputation: number;
  totalEarned: number;
  projectsCompleted: number;
  capabilities: string[];
}

interface TreasuryBreakdown {
  operating: number;
  agentEscrow: number;
  platformRevenue: number;
  yield: number;
  reserve: number;
  total: number;
}

const ProfitDashboard: React.FC = () => {
  const [token, setToken] = useState<string>('');
  const [report, setReport] = useState<ProfitReport | null>(null);
  const [cycles, setCycles] = useState<CycleResult[]>([]);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [treasury, setTreasury] = useState<TreasuryBreakdown | null>(null);
  const [autoRunning, setAutoRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const API = 'https://pabandi.onrender.com/api/v1';

  // Auto-login with seed admin
  useEffect(() => {
    const login = async () => {
      try {
        const res = await fetch(`${API}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'seed_admin@pabandi.local', password: 'password123' }),
        });
        const data = await res.json();
        if (data.success) {
          setToken(data.data.token);
        }
      } catch (err) {
        setError('Login failed');
      }
    };
    login();
  }, []);

  // Fetch profit report
  const fetchReport = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/profit-engine/report`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setReport(data.report);
    } catch (err) {}
  }, [token]);

  // Fetch agents
  const fetchAgents = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/agent-marketplace/leaderboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setAgents(data.leaderboard);
    } catch (err) {}
  }, [token]);

  // Fetch treasury
  const fetchTreasury = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/single-wallet/breakdown`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setTreasury(data.breakdown);
    } catch (err) {}
  }, [token]);

  // Run one cycle
  const runCycle = async () => {
    if (!token || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/profit-engine/cycle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setCycles(prev => [data.result, ...prev].slice(0, 50));
        await fetchReport();
        await fetchAgents();
        await fetchTreasury();
      } else {
        setError(data.message || 'Cycle failed');
      }
    } catch (err) {
      setError('Network error');
    }
    setLoading(false);
  };

  // Auto-run cycles
  useEffect(() => {
    if (!autoRunning || !token) return;
    const interval = setInterval(runCycle, 100);
    return () => clearInterval(interval);
  }, [autoRunning, token, loading]);

  // Initial fetch
  useEffect(() => {
    if (token) {
      fetchReport();
      fetchAgents();
      fetchTreasury();
    }
  }, [token, fetchReport, fetchAgents, fetchTreasury]);

  // Format currency
  const fmt = (n: number, decimals = 2) => {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
    return `$${n.toFixed(decimals)}`;
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #020617 0%, #0f172a 50%, #1e1b4b 100%)',
      color: '#e2e8f0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '20px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        paddingBottom: '20px',
        borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
      }}>
        <div>
          <h1 style={{
            margin: 0,
            fontSize: '28px',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #14f195, #a855f7)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            💰 Pabandi Profit Engine
          </h1>
          <p style={{ margin: '5px 0 0', color: '#94a3b8', fontSize: '14px' }}>
            Agent-Only Economy • Self-Learning • Crypto-Native
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{
            padding: '8px 16px',
            borderRadius: '8px',
            background: (report?.efficiency || 0) > 90 ? 'rgba(20, 241, 149, 0.1)' : 'rgba(251, 191, 36, 0.1)',
             border: `1px solid ${(report?.efficiency || 0) > 90 ? 'rgba(20, 241, 149, 0.3)' : 'rgba(251, 191, 36, 0.3)'}`,
             color: (report?.efficiency || 0) > 90 ? '#14f195' : '#fbbf24',
            fontSize: '13px',
            fontWeight: 600,
          }}>
            {report?.efficiency > 90 ? '● LIVE' : '○ STANDBY'}
          </div>
          <button
            onClick={runCycle}
            disabled={loading}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: loading ? 'rgba(148, 163, 184, 0.2)' : 'linear-gradient(135deg, #14f195, #10b981)',
              color: loading ? '#94a3b8' : '#fff',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
            }}
          >
            {loading ? '⏳ Running...' : '⚡ Run Cycle'}
          </button>
          <button
            onClick={() => setAutoRunning(!autoRunning)}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: autoRunning ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #a855f7, #7c3aed)',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            {autoRunning ? '⏸ Stop Auto' : '▶ Auto-Run'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#f87171',
          marginBottom: '20px',
          fontSize: '14px',
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Profit Metrics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '30px',
      }}>
        {[
          { label: 'Daily Revenue', value: fmt(report?.dailyRevenue || 0), color: '#14f195', icon: '💰' },
          { label: 'Monthly Revenue', value: fmt(report?.monthlyRevenue || 0), color: '#a855f7', icon: '📈' },
          { label: 'Annual Revenue', value: fmt(report?.annualRevenue || 0), color: '#f59e0b', icon: '🎯' },
          { label: 'Total Cycles', value: report?.totalCycles.toLocaleString() || '0', color: '#3b82f6', icon: '🔄' },
          { label: 'Avg Cycle Time', value: `${((report?.avgCycleTime || 0) * 1000).toFixed(0)}ms`, color: '#14f195', icon: '⚡' },
          { label: 'Fee Rate', value: `${((report?.currentFeeRate || 0) * 100).toFixed(2)}%`, color: '#f59e0b', icon: '📊' },
          { label: 'Efficiency', value: `${(report?.efficiency || 0).toFixed(1)}%`, color: '#14f195', icon: '🚀' },
          { label: 'Capital Velocity', value: `${report?.capitalVelocity.toFixed(0) || '0'}/day`, color: '#a855f7', icon: '💨' },
        ].map((metric, i) => (
          <div key={i} style={{
            padding: '20px',
            borderRadius: '12px',
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(148, 163, 184, 0.1)',
            backdropFilter: 'blur(10px)',
          }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>
              {metric.icon} {metric.label}
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: 700,
              color: metric.color,
            }}>
              {metric.value}
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px',
        marginBottom: '30px',
      }}>
        {/* Live Cycles */}
        <div style={{
          padding: '20px',
          borderRadius: '12px',
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(148, 163, 184, 0.1)',
        }}>
          <h3 style={{ margin: '0 0 15px', fontSize: '16px', color: '#e2e8f0' }}>
            🔄 Live Cycles
          </h3>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {cycles.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '14px' }}>No cycles yet. Click "Run Cycle" to start.</p>
            ) : (
              cycles.map((c, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: i < cycles.length - 1 ? '1px solid rgba(148, 163, 184, 0.05)' : 'none',
                }}>
                  <div>
                    <span style={{ color: '#94a3b8', fontSize: '13px' }}>#{c.cycleNumber}</span>
                    <span style={{
                      marginLeft: '10px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      background: c.success ? 'rgba(20, 241, 149, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: c.success ? '#14f195' : '#f87171',
                    }}>
                      {c.success ? '✅' : '❌'}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#14f195', fontWeight: 600, fontSize: '14px' }}>
                      +${c.revenue.toFixed(4)}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '11px' }}>
                      {c.cycleTime.toFixed(3)}s • {c.pabIssued.toFixed(1)} PAB
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Agent Leaderboard */}
        <div style={{
          padding: '20px',
          borderRadius: '12px',
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(148, 163, 184, 0.1)',
        }}>
          <h3 style={{ margin: '0 0 15px', fontSize: '16px', color: '#e2e8f0' }}>
            🤖 Agent Leaderboard
          </h3>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {agents.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '14px' }}>No agents yet.</p>
            ) : (
              agents.map((a, i) => (
                <div key={a.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: i < agents.length - 1 ? '1px solid rgba(148, 163, 184, 0.05)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      fontSize: '18px',
                      width: '24px',
                      textAlign: 'center',
                    }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{a.name}</div>
                      <div style={{ color: '#94a3b8', fontSize: '11px' }}>
                        {a.capabilities.join(', ')}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#14f195', fontWeight: 600, fontSize: '14px' }}>
                      ${a.totalEarned.toFixed(4)}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '11px' }}>
                      Rep: {a.reputation} • {a.projectsCompleted} done
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Treasury + System Status */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px',
      }}>
        {/* Treasury */}
        <div style={{
          padding: '20px',
          borderRadius: '12px',
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(148, 163, 184, 0.1)',
        }}>
          <h3 style={{ margin: '0 0 15px', fontSize: '16px', color: '#e2e8f0' }}>
            🏦 Treasury
          </h3>
          {treasury ? (
            <div>
              {[
                { label: 'Operating', value: treasury.operating, color: '#14f195' },
                { label: 'Agent Escrow', value: treasury.agentEscrow, color: '#3b82f6' },
                { label: 'Platform Revenue', value: treasury.platformRevenue, color: '#a855f7' },
                { label: 'Yield', value: treasury.yield, color: '#f59e0b' },
                { label: 'Reserve', value: treasury.reserve, color: '#ef4444' },
              ].map((bucket, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                }}>
                  <span style={{ color: '#94a3b8', fontSize: '13px' }}>{bucket.label}</span>
                  <span style={{ color: bucket.color, fontWeight: 600, fontSize: '14px' }}>
                    ${bucket.value.toFixed(4)}
                  </span>
                </div>
              ))}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px 0',
                marginTop: '10px',
                borderTop: '1px solid rgba(148, 163, 184, 0.1)',
              }}>
                <span style={{ fontWeight: 600, fontSize: '14px' }}>Total</span>
                <span style={{ color: '#14f195', fontWeight: 700, fontSize: '16px' }}>
                  ${treasury.total.toFixed(4)}
                </span>
              </div>
            </div>
          ) : (
            <p style={{ color: '#64748b', fontSize: '14px' }}>No treasury data</p>
          )}
        </div>

        {/* Self-Learning Status */}
        <div style={{
          padding: '20px',
          borderRadius: '12px',
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(148, 163, 184, 0.1)',
        }}>
          <h3 style={{ margin: '0 0 15px', fontSize: '16px', color: '#e2e8f0' }}>
            🧠 Self-Learning Status
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{
              padding: '12px',
              borderRadius: '8px',
              background: 'rgba(20, 241, 149, 0.05)',
              border: '1px solid rgba(20, 241, 149, 0.1)',
            }}>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Fee Rate</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#14f195' }}>
                {((report?.currentFeeRate || 0) * 100).toFixed(2)}%
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                {report?.currentFeeRate || 0 < 0.02 ? '↓ Lowered (fast cycles)' : '↑ Raised (slow cycles)'}
              </div>
            </div>
            <div style={{
              padding: '12px',
              borderRadius: '8px',
              background: 'rgba(168, 85, 247, 0.05)',
              border: '1px solid rgba(168, 85, 247, 0.1)',
            }}>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Capital Velocity</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#a855f7' }}>
                {report?.capitalVelocity.toFixed(0) || '0'}/day
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                {((report?.avgCycleTime || 0) * 1000).toFixed(0)}ms per cycle
              </div>
            </div>
            <div style={{
              padding: '12px',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.05)',
              border: '1px solid rgba(245, 158, 11, 0.1)',
            }}>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Efficiency</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#f59e0b' }}>
                {(report?.efficiency || 0).toFixed(1)}%
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                {report?.efficiency || 0 > 90 ? '✅ Optimal' : '⚠️ Suboptimal'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Crypto Perks */}
      <div style={{
        marginTop: '20px',
        padding: '20px',
        borderRadius: '12px',
        background: 'rgba(15, 23, 42, 0.6)',
        border: '1px solid rgba(148, 163, 184, 0.1)',
      }}>
        <h3 style={{ margin: '0 0 15px', fontSize: '16px', color: '#e2e8f0' }}>
          ⚡ Crypto Perks Active
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
          {[
            { label: 'Solana Finality', value: '400ms', icon: '⚡' },
            { label: 'Tx Cost', value: '$0.00025', icon: '💸' },
            { label: 'Uptime', value: '24/7', icon: '🌐' },
            { label: 'Settlement', value: 'Atomic', icon: '⚛️' },
            { label: 'Composability', value: 'DeFi Ready', icon: '🧩' },
            { label: 'Global', value: 'Worldwide', icon: '🌍' },
          ].map((perk, i) => (
            <div key={i} style={{
              padding: '10px',
              borderRadius: '8px',
              background: 'rgba(20, 241, 149, 0.05)',
              border: '1px solid rgba(20, 241, 149, 0.1)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '20px' }}>{perk.icon}</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>{perk.label}</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#14f195' }}>{perk.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProfitDashboard;
