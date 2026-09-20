import React, { useState, useEffect } from 'react';

interface JevDecisionProps {
  type: 'trading' | 'risk' | 'payment' | 'quality';
  entityId: string;
  title: string;
}

export const JevDecision: React.FC<JevDecisionProps> = ({ type, entityId, title }) => {
  const [decision, setDecision] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchDecision = async () => {
    setLoading(true);
    try {
      const endpoints: Record<string, string> = {
        trading: `/api/v1/jev/trading-decision/${entityId}`,
        risk: `/api/v1/jev/tenant-risk/${entityId}`,
        payment: `/api/v1/jev/payment-route/${entityId}`,
        quality: `/api/v1/jev/agent-quality/${entityId}`,
      };

      const res = await fetch(endpoints[type], {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(type === 'payment' ? { amount: 1000 } : {}),
      });
      const data = await res.json();
      if (data.success) setDecision(data.data);
    } catch (err) {}
    setLoading(false);
  };

  useEffect(() => {
    fetchDecision();
  }, [type, entityId]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence > 0.7) return '#14f195';
    if (confidence > 0.4) return '#fbbf24';
    return '#ef4444';
  };

  return (
    <div style={{
      padding: '16px',
      borderRadius: '8px',
      background: 'rgba(15, 23, 42, 0.6)',
      border: '1px solid rgba(148, 163, 184, 0.1)',
      marginBottom: '12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h4 style={{ margin: 0, fontSize: '14px', color: '#e2e8f0' }}>{title}</h4>
        <button onClick={fetchDecision} disabled={loading} style={{
          padding: '4px 12px',
          borderRadius: '4px',
          border: 'none',
          background: 'rgba(20, 241, 149, 0.1)',
          color: '#14f195',
          cursor: 'pointer',
          fontSize: '12px',
        }}>
          {loading ? '...' : '↻ Refresh'}
        </button>
      </div>

      {decision ? (
        <div style={{ fontSize: '13px', color: '#94a3b8' }}>
          {decision.shouldTrade !== undefined && (
            <div>
              <span style={{ color: decision.shouldTrade ? '#14f195' : '#ef4444' }}>
                {decision.shouldTrade ? '✓ TRADE' : '✗ HOLD'}
              </span>
              {decision.direction && <span> | {decision.direction.toUpperCase()}</span>}
              {decision.sizePercent && <span> | {decision.sizePercent}%</span>}
            </div>
          )}
          {decision.riskLevel && (
            <div>
              Risk: <span style={{ color: decision.riskLevel === 'low' ? '#14f195' : decision.riskLevel === 'medium' ? '#fbbf24' : '#ef4444' }}>
                {decision.riskLevel.toUpperCase()}
              </span>
              {decision.requireDeposit && <span> | Deposit: {decision.depositMonths} months</span>}
            </div>
          )}
          {decision.route && (
            <div>
              Route: <span style={{ color: '#a855f7' }}>{decision.route.toUpperCase()}</span>
              {decision.pabPercent > 0 && <span> | PAB: {decision.pabPercent}%</span>}
              {decision.discount > 0 && <span> | Save: ${decision.discount.toFixed(2)}</span>}
            </div>
          )}
          {decision.tier && (
            <div>
              Tier: <span style={{ color: decision.tier === 'platinum' ? '#E5E4E2' : decision.tier === 'gold' ? '#FFD700' : decision.tier === 'silver' ? '#C0C0C0' : '#CD7F32' }}>
                {decision.tier.toUpperCase()}
              </span>
              {decision.bonusPab > 0 && <span> | Bonus: {decision.bonusPab} PAB</span>}
            </div>
          )}
          {decision.confidence && (
            <div style={{ marginTop: '4px' }}>
              Confidence: <span style={{ color: getConfidenceColor(decision.confidence) }}>
                {(decision.confidence * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      ) : (
        <div style={{ color: '#64748b', fontSize: '12px' }}>Click refresh to get decision</div>
      )}
    </div>
  );
};

export default JevDecision;
