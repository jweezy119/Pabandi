import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { agentPassportService } from '../services/api';
import { tokens } from '../design-system';

const CAPABILITY_OPTIONS = [
  { cap: 'act:book', label: 'Book on the owner’s behalf', hint: 'Create reservations / demo-bookings' },
  { cap: 'act:list', label: 'List & manage inventory', hint: 'Publish offers, update availability' },
  { cap: 'act:message', label: 'Send messages', hint: 'Customer / host comms' },
  { cap: 'data.read:*', label: 'Read data', hint: 'Read-only access to scoped records' },
  { cap: 'transfer.under:100USD', label: 'Transfer ≤ $100', hint: 'Move value, capped at $100' },
  { cap: 'transfer.under:1000USD', label: 'Transfer ≤ $1,000', hint: 'Move value, capped at $1,000' },
  { cap: 'kyc.band:B', label: 'Assert KYC band B', hint: 'Stake a trust-band claim' },
  { cap: 'webhooks.send', label: 'Send webhooks', hint: 'Emit event notifications' },
];

const MAX_CAPS = 8;

export default function AgentPassportPage() {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();

  const [agentId, setAgentId] = useState('');
  const [selected, setSelected] = useState<string[]>(['act:book']);
  const [issuing, setIssuing] = useState(false);
  const [issued, setIssued] = useState<{
    token: string;
    idempotencyKey: string;
    feePab: number;
    balanceAfter?: number;
  } | null>(null);
  const [issueError, setIssueError] = useState('');

  // Verify panel
  const [verifyToken, setVerifyToken] = useState('');
  const [verifyNeed, setVerifyNeed] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any | null>(null);
  const [verifyError, setVerifyError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) navigate('/login', { state: { returnTo: '/agent-passport' } });
  }, [isAuthenticated, navigate]);

  const toggleCap = (cap: string) => {
    setSelected((prev) =>
      prev.includes(cap)
        ? prev.filter((c) => c !== cap)
        : prev.length < MAX_CAPS
        ? [...prev, cap]
        : prev
    );
  };

  const issue = async () => {
    if (!agentId.trim()) {
      setIssueError('Agent ID is required (e.g. the agent’s handle or wallet).');
      return;
    }
    if (selected.length === 0) {
      setIssueError('Select at least one capability.');
      return;
    }
    setIssueError('');
    setIssuing(true);
    setIssued(null);
    try {
      const res = await agentPassportService.issue({
        agentId: agentId.trim(),
        capabilities: selected,
        ownerUserId: user?.id,
      });
      const d = res.data?.data || res.data;
      setIssued({
        token: d.token,
        idempotencyKey: d.idempotencyKey,
        feePab: d.feePab,
        balanceAfter: d.balanceAfter,
      });
    } catch (e: any) {
      setIssueError(e.response?.data?.error || e.message || 'Issuance failed');
    } finally {
      setIssuing(false);
    }
  };

  const verify = async () => {
    if (!verifyToken.trim()) {
      setVerifyError('Paste a passport token to verify.');
      return;
    }
    setVerifyError('');
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await agentPassportService.verify(
        verifyToken.trim(),
        verifyNeed.trim() || undefined
      );
      setVerifyResult(res.data?.data || res.data);
    } catch (e: any) {
      setVerifyError(e.response?.data?.error || e.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text);
  };

  if (!isAuthenticated) return null;

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '40px 20px', color: tokens.color.text, fontFamily: tokens.font.body }}>
      <header style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 28 }}>🛂</span>
          <h1 style={{ fontSize: 28, margin: 0, letterSpacing: -0.5 }}>Agent Capability Passport</h1>
        </div>
        <p style={{ color: tokens.color.muted, margin: 0, fontSize: 15, lineHeight: 1.6 }}>
          The trust standard for AI agents on Pabandi. Issue a signed, capability-scoped passport your
          agent presents to book, transfer, or act — verified by any counterparty, metered in $PAB.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
        {/* ISSUE */}
        <section style={card}>
          <h2 style={h2}>Issue a passport</h2>
          <p style={muted}>Signed by Pabandi, scoped to the capabilities you grant. Costs <b>2 $PAB</b> per issue (debited from your agent balance).</p>

          <label style={label}>Agent ID / handle</label>
          <input
            style={input}
            placeholder="e.g. concierge-01 or 7xKq…9fA"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
          />

          <label style={label}>Capabilities ({selected.length}/{MAX_CAPS})</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {CAPABILITY_OPTIONS.map((o) => {
              const on = selected.includes(o.cap);
              return (
                <button
                  key={o.cap}
                  onClick={() => toggleCap(o.cap)}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: tokens.radius.md,
                    border: `1px solid ${on ? tokens.color.primary : tokens.color.border}`,
                    background: on ? 'rgba(129,140,248,0.12)' : tokens.color.surface,
                    color: tokens.color.text,
                    cursor: 'pointer',
                    transition: 'all .15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{o.label}</span>
                    <span style={{ color: on ? tokens.color.primary : tokens.color.muted, fontSize: 16 }}>{on ? '✓' : '+'}</span>
                  </div>
                  <div style={{ fontSize: 11, color: tokens.color.muted, marginTop: 4, fontFamily: tokens.font.mono }}>{o.cap}</div>
                  <div style={{ fontSize: 11, color: tokens.color.muted }}>{o.hint}</div>
                </button>
              );
            })}
          </div>

          {issueError && <div style={errBox}>{issueError}</div>}

          <button onClick={issue} disabled={issuing} style={{ ...btn, marginTop: 16, opacity: issuing ? 0.6 : 1 }}>
            {issuing ? 'Issuing…' : 'Issue passport (2 $PAB)'}
          </button>

          {issued && (
            <div style={{ marginTop: 18, padding: 16, borderRadius: tokens.radius.md, background: 'rgba(34,197,94,0.08)', border: `1px solid ${tokens.color.success}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong style={{ color: tokens.color.success }}>✓ Passport issued</strong>
                <span style={{ fontSize: 12, color: tokens.color.muted }}>fee {issued.feePab} $PAB · balance {issued.balanceAfter ?? '—'}</span>
              </div>
              <label style={{ ...label, fontSize: 12 }}>Passport token (present this to counterparties)</label>
              <textarea readOnly value={issued.token} style={{ ...input, fontFamily: tokens.font.mono, fontSize: 11, height: 90 }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <button style={miniBtn} onClick={() => copy(issued.token)}>Copy token</button>
                <button style={miniBtn} onClick={() => { setVerifyToken(issued.token); setVerifyNeed(''); }}>Verify this</button>
              </div>
              <div style={{ fontSize: 11, color: tokens.color.muted, marginTop: 8, fontFamily: tokens.font.mono }}>
                idempotency: {issued.idempotencyKey}
              </div>
            </div>
          )}
        </section>

        {/* VERIFY */}
        <section style={card}>
          <h2 style={h2}>Verify a passport</h2>
          <p style={muted}>Paste any agent’s passport token to check validity, expiry, and the capabilities it grants.</p>

          <label style={label}>Passport token</label>
          <textarea
            style={{ ...input, fontFamily: tokens.font.mono, fontSize: 11, height: 80 }}
            placeholder="Paste a passport token…"
            value={verifyToken}
            onChange={(e) => setVerifyToken(e.target.value)}
          />

          <label style={label}>Required capability (optional)</label>
          <input
            style={input}
            placeholder="e.g. act:book  (leave blank to just check validity)"
            value={verifyNeed}
            onChange={(e) => setVerifyNeed(e.target.value)}
          />

          {verifyError && <div style={errBox}>{verifyError}</div>}

          <button onClick={verify} disabled={verifying} style={{ ...btn, marginTop: 12, opacity: verifying ? 0.6 : 1 }}>
            {verifying ? 'Verifying…' : 'Verify'}
          </button>

          {verifyResult && (
            <div style={{ marginTop: 16 }}>
              <div style={{
                padding: '12px 14px', borderRadius: tokens.radius.md,
                border: `1px solid ${verifyResult.valid ? tokens.color.success : tokens.color.danger}`,
                background: verifyResult.valid ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
              }}>
                <strong style={{ color: verifyResult.valid ? tokens.color.success : tokens.color.danger }}>
                  {verifyResult.valid ? '✓ Valid' : '✕ Invalid'}
                </strong>
                {verifyResult.reason && <span style={{ color: tokens.color.muted, marginLeft: 8, fontSize: 13 }}>— {verifyResult.reason}</span>}
              </div>

              {verifyResult.valid && (
                <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                  <Row k="Subject" v={verifyResult.subject?.id || verifyResult.subject} />
                  <Row k="Risk band" v={verifyResult.riskBand} />
                  <Row k="Expires" v={verifyResult.expiresAt ? new Date(verifyResult.expiresAt).toLocaleString() : '—'} />
                  <Row k="Capabilities" v={(verifyResult.capabilities || []).join(', ')} />
                  {verifyResult.score !== undefined && <Row k="Trust score" v={String(verifyResult.score)} />}
                </div>
              )}
            </div>
          )}
        </section>

        {/* HOW IT WORKS */}
        <section style={card}>
          <h2 style={h2}>Why this is the standard</h2>
          <ul style={{ color: tokens.color.muted, fontSize: 14, lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
            <li><b style={{ color: tokens.color.text }}>Signed & offline-verifiable</b> — HMAC-signed attestation; counterparties verify without calling us.</li>
            <li><b style={{ color: tokens.color.text }}>Capability-scoped</b> — an agent only gets what you grant; low-trust bands can’t request dangerous caps.</li>
            <li><b style={{ color: tokens.color.text }}>Enforced</b> — booking & value-transfer actions reject agents without a valid passport.</li>
            <li><b style={{ color: tokens.color.text }}>Metered & auditable</b> — each issue debits 2 $PAB; every charge is publicly auditable by idempotency key.</li>
            <li><b style={{ color: tokens.color.text }}>Agent-native</b> — available over MCP at <code style={{ fontFamily: tokens.font.mono, fontSize: 12 }}>/mcp</code> for Claude, LangChain & other frameworks.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
      <span style={{ color: tokens.color.muted, minWidth: 110 }}>{k}</span>
      <span style={{ color: tokens.color.text, fontFamily: tokens.font.mono, fontSize: 12, wordBreak: 'break-word' }}>{v}</span>
    </div>
  );
}

const card = {
  background: tokens.color.surface,
  border: `1px solid ${tokens.color.border}`,
  borderRadius: tokens.radius.lg,
  padding: 22,
} as const;

const h2 = { fontSize: 18, margin: '0 0 6px' } as const;
const muted = { color: tokens.color.muted, fontSize: 14, margin: '0 0 16px', lineHeight: 1.6 } as const;
const label = { display: 'block', fontSize: 13, color: tokens.color.muted, margin: '14px 0 6px' } as const;
const input = {
  width: '100%',
  background: tokens.color.background,
  border: `1px solid ${tokens.color.border}`,
  borderRadius: tokens.radius.md,
  color: tokens.color.text,
  padding: '10px 12px',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
} as const;
const btn = {
  background: tokens.color.primary,
  color: '#0b1020',
  border: 'none',
  borderRadius: tokens.radius.md,
  padding: '11px 18px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
} as const;
const miniBtn = {
  background: tokens.color.border,
  color: tokens.color.text,
  border: 'none',
  borderRadius: tokens.radius.sm,
  padding: '7px 12px',
  fontSize: 12,
  cursor: 'pointer',
} as const;
const errBox = {
  marginTop: 12,
  padding: '10px 12px',
  borderRadius: tokens.radius.md,
  background: 'rgba(239,68,68,0.1)',
  border: `1px solid ${tokens.color.danger}`,
  color: tokens.color.danger,
  fontSize: 13,
} as const;
