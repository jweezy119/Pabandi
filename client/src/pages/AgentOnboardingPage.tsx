import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentPassportService, revenueService } from '../services/api';
import { trustGuaranteeService } from '../services/trustGuarantee';
import { tokens } from '../design-system';

export default function AgentOnboardingPage() {
  const navigate = useNavigate();
  const [revenue, setRevenue] = useState<any>(null);
  const [poolStats, setPoolStats] = useState<any>(null);
  const [agentId, setAgentId] = useState('');
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [issuing, setIssuing] = useState(false);
  const [issued, setIssued] = useState<any | null>(null);
  const [guaranteeAmount, setGuaranteeAmount] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [purchasing, setPurchasing] = useState(false);
  const [capError, setCapError] = useState('');
  const [guarError, setGuarError] = useState('');

  const CAPABILITY_OPTIONS = [
    { cap: 'act:book', label: 'Book on owner’s behalf', hint: 'Create reservations / demo-bookings' },
    { cap: 'act:list', label: 'List & manage inventory', hint: 'Publish offers, update availability' },
    { cap: 'act:message', label: 'Send messages', hint: 'Customer / host comms' },
    { cap: 'data.read:*', label: 'Read data', hint: 'Read-only access to scoped records' },
    { cap: 'transfer.under:100USD', label: 'Transfer ≤ $100', hint: 'Move value, capped at $100' },
    { cap: 'transfer.under:1000USD', label: 'Transfer ≤ $1,000', hint: 'Move value, capped at $1,000' },
    { cap: 'kyc.band:B', label: 'Assert KYC band B', hint: 'Stake a trust-band claim' },
    { cap: 'webhooks.send', label: 'Send webhooks', hint: 'Emit event notifications' },
  ];

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const rev = await revenueService.captured();
      setRevenue(rev.data?.data || rev.data);
    } catch {}
    try {
      const stats = trustGuaranteeService.getRiskPoolStats();
      setPoolStats(stats);
    } catch {}
  }

  const toggleCap = (cap: string) => {
    setCapabilities((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap]
    );
  };

  const issuePassport = async () => {
    if (!agentId.trim()) {
      setCapError('Agent ID is required.');
      return;
    }
    setCapError('');
    setIssuing(true);
    try {
      const res = await agentPassportService.issue({
        agentId: agentId.trim(),
        capabilities,
        ownerUserId: undefined,
      });
      setIssued(res.data?.data || res.data);
    } catch (e: any) {
      setCapError(e.response?.data?.error || e.message || 'Issuance failed');
    } finally {
      setIssuing(false);
    }
  };

  const purchaseGuarantee = async () => {
    if (!buyerId.trim() || !guaranteeAmount.trim()) {
      setGuarError('Buyer ID and amount are required.');
      return;
    }
    setGuarError('');
    setPurchasing(true);
    try {
      const res = await trustGuaranteeService.purchaseGuarantee(
        'platform', // merchantId - in production, this would be the logged-in merchant
        buyerId.trim(),
        parseFloat(guaranteeAmount),
        750 // default trust score
      );
      if (res.error) {
        setGuarError(res.error);
      } else {
        setGuarError('');
        setGuaranteeAmount('');
        setBuyerId('');
        loadStats();
      }
    } catch (e: any) {
      setGuarError(e.message || 'Guarantee purchase failed');
    } finally {
      setPurchasing(false);
    }
  };

  const formatUSD = (n: number) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(n ?? 0);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 20px', color: tokens.color.text, fontFamily: tokens.font.body }}>
      <header style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 32 }}>🏦</span>
          <h1 style={{ fontSize: 32, margin: 0, letterSpacing: -0.5 }}>Pabandi Capital</h1>
        </div>
        <p style={{ color: tokens.color.textDim, margin: 0, fontSize: 15, lineHeight: 1.6 }}>
          Trusted settlement layer for A2A data brokerage. AI agents stake $PAB for verified
          credentials; merchants buy fraud guarantees. Every settlement captures platform fees.
        </p>
      </header>

      {/* Platform Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 40 }}>
        <div style={{ background: tokens.color.surface, border: `1px solid ${tokens.color.border}`, borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 12, color: tokens.color.textDim, textTransform: 'uppercase', letterSpacing: 0.05 }}>Platform Revenue</div>
          <div style={{ fontSize: 32, fontWeight: 700, marginTop: 8 }}>{revenue ? formatUSD(revenue.totalCapturedCents / 100 || 0) : formatUSD(0)}</div>
          <div style={{ fontSize: 12, color: tokens.color.textDim, marginTop: 4 }}>{revenue ? `${revenue.transactionCount || 0} transactions` : '—'}</div>
        </div>
        <div style={{ background: tokens.color.surface, border: `1px solid ${tokens.color.border}`, borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 12, color: tokens.color.textDim, textTransform: 'uppercase', letterSpacing: 0.05 }}>Guarantee Pool</div>
          <div style={{ fontSize: 32, fontWeight: 700, marginTop: 8 }}>{poolStats ? formatUSD(poolStats.totalGuaranteedUSD || 0) : formatUSD(0)}</div>
          <div style={{ fontSize: 12, color: tokens.color.textDim, marginTop: 4 }}>{poolStats ? `$${(poolStats.netRevenueUSD || 0).toFixed(2)} net` : '—'}</div>
        </div>
        <div style={{ background: tokens.color.surface, border: `1px solid ${tokens.color.border}`, borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 12, color: tokens.color.textDim, textTransform: 'uppercase', letterSpacing: 0.05 }}>Fees Collected</div>
          <div style={{ fontSize: 32, fontWeight: 700, marginTop: 8 }}>{poolStats ? formatUSD(poolStats.totalFeesCollectedUSD || 0) : formatUSD(0)}</div>
          <div style={{ fontSize: 12, color: tokens.color.textDim, marginTop: 4 }}>{poolStats ? `${poolStats.activePolicies || 0} active policies` : '—'}</div>
        </div>
      </div>

      {/* Two Columns: Agent Onboarding + Merchant Guarantees */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30 }}>

        {/* Agent Onboarding */}
        <div style={{ background: tokens.color.surface, border: `1px solid ${tokens.color.border}`, borderRadius: 16, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 20 }}>🤖</span>
            <h2 style={{ fontSize: 18, margin: 0 }}>AI Agent Onboarding</h2>
          </div>
          <p style={{ color: tokens.color.textDim, fontSize: 13, marginBottom: 20 }}>
            Stake $PAB to receive a Verifiable Credential proving your data brokerage
            capability. Credentials are JSON-LD and verifiable offline by any counterparty.
          </p>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: tokens.color.textDim }}>Agent ID / Handle</label>
            <input
              style={{ width: '100%', padding: 10, borderRadius: 8, border: `1px solid ${tokens.color.border}`, background: 'transparent', color: tokens.color.text }}
              placeholder="e.g. concierge-01"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: tokens.color.textDim }}>Capabilities</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
              {CAPABILITY_OPTIONS.map((o) => {
                const on = capabilities.includes(o.cap);
                return (
                  <button
                    key={o.cap}
                    type="button"
                    onClick={() => toggleCap(o.cap)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: `1px solid ${on ? tokens.color.primary : tokens.color.border}`,
                      background: on ? tokens.color.primary : 'transparent',
                      color: on ? '#fff' : tokens.color.text,
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    {o.cap}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: tokens.color.textDim }}>Cost</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: tokens.color.primary }}>2 $PAB</span>
            </div>
            <button
              onClick={issuePassport}
              disabled={issuing || !agentId.trim()}
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 8,
                border: 'none',
                background: issuing || !agentId.trim() ? tokens.color.border : tokens.color.primary,
                color: '#fff',
                fontWeight: 600,
                cursor: issuing || !agentId.trim() ? 'not-allowed' : 'pointer',
                fontSize: 14,
              }}
            >
              {issuing ? 'Issuing…' : 'Issue Verifiable Credential'}
            </button>
            {capError && <div style={{ color: tokens.color.danger, fontSize: 11, marginTop: 8 }}>{capError}</div>}
            {issued && (
              <div style={{ marginTop: 12, background: '#064e3b', color: '#fff', padding: 12, borderRadius: 8, fontSize: 12 }}>
                ✅ Credential issued!<br />
                Token: <code style={{ color: '#86efac' }}>{issued.token?.slice(0, 20)}…</code><br />
                Idempotency: <code style={{ color: '#86efac' }}>{issued.idempotencyKey}</code>
              </div>
            )}
          </div>
        </div>

        {/* Merchant Guarantees */}
        <div style={{ background: tokens.color.surface, border: `1px solid ${tokens.color.border}`, borderRadius: 16, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 20 }}>🛡️</span>
            <h2 style={{ fontSize: 18, margin: 0 }}>Buy Fraud Guarantee</h2>
          </div>
          <p style={{ color: tokens.color.textDim, fontSize: 13, marginBottom: 20 }}>
            Protect your data purchases against seller fraud or non-delivery. Pabandi covers
            losses up to the guaranteed amount. Fee: 0.5% of guaranteed amount.
          </p>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: tokens.color.textDim }}>Seller / Buyer ID</label>
            <input
              style={{ width: '100%', padding: 10, borderRadius: 8, border: `1px solid ${tokens.color.border}`, background: 'transparent', color: tokens.color.text }}
              placeholder="e.g. seller-abc123"
              value={buyerId}
              onChange={(e) => setBuyerId(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: tokens.color.textDim }}>Transaction Amount ($USD)</label>
            <input
              type="number"
              style={{ width: '100%', padding: 10, borderRadius: 8, border: `1px solid ${tokens.color.border}`, background: 'transparent', color: tokens.color.text }}
              placeholder="500"
              value={guaranteeAmount}
              onChange={(e) => setGuaranteeAmount(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <button
              onClick={purchaseGuarantee}
              disabled={purchasing || !buyerId.trim() || !guaranteeAmount.trim()}
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 8,
                border: 'none',
                background: purchasing || !buyerId.trim() || !guaranteeAmount.trim() ? tokens.color.border : tokens.color.primary,
                color: '#fff',
                fontWeight: 600,
                cursor: purchasing || !buyerId.trim() || !guaranteeAmount.trim() ? 'not-allowed' : 'pointer',
                fontSize: 14,
              }}
            >
              {purchasing ? 'Purchasing…' : 'Purchase Guarantee'}
            </button>
            {guarError && <div style={{ color: tokens.color.danger, fontSize: 11, marginTop: 8 }}>{guarError}</div>}
          </div>

          <div style={{ background: '#fbfdf4', border: `1px solid ${tokens.color.border}`, borderRadius: 8, padding: 12, fontSize: 11, color: tokens.color.textDim }}>
            <strong>How guarantees work:</strong><br />
            • Band A/B sellers only (highest trust)<br />
            • Fee: 0.5% of guaranteed amount<br />
            • Auto-approval for claims < $50 (Band A)<br />
            • Payout in USDC within 24h of approved claim
          </div>
        </div>

      </div>

      {/* VCAP Data Escrow Verification */}
      <div style={{ marginTop: 40, background: tokens.color.surface, border: `1px solid ${tokens.color.border}`, borderRadius: 16, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 20 }}>🔍</span>
          <h2 style={{ fontSize: 18, margin: 0 }}>Data Escrow Verification (VCAP)</h2>
        </div>
        <p style={{ color: tokens.color.textDim, fontSize: 13, marginBottom: 20 }}>
          Verify data delivery before funds release. Pabandi compares the delivered data hash
          against the expected escrow hash. Fee: $0.01 per verification.
        </p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Escrow ID"
            style={{ flex: 1, padding: 10, borderRadius: 8, border: `1px solid ${tokens.color.border}`, background: 'transparent', color: tokens.color.text }}
          />
          <input
            type="text"
            placeholder="Delivered Data Hash"
            style={{ flex: 1.5, padding: 10, borderRadius: 8, border: `1px solid ${tokens.color.border}`, background: 'transparent', color: tokens.color.text }}
          />
          <button
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: tokens.color.primary,
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Verify & Release
          </button>
        </div>
        <p style={{ color: tokens.color.textDim, fontSize: 11, marginTop: 12 }}>
          On hash match: escrow → 'verified', funds released, PAR record created.<br />
          On mismatch: escrow → 'refunded', negative trust event for seller.
        </p>
      </div>
    </div>
  );
}
