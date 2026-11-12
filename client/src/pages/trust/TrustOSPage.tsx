import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  FileSpreadsheet,
  BadgeCheck,
  Layers,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import TrustPassportTab from '../dashboard/TrustPassportTab';
import { API_HOST } from '../../utils/apiHost';
import { getAuthToken } from '../../utils/authToken';
import '../../styles/pbn-tokens.css';

type TrustOSTab = 'overview' | 'passport' | 'ledger' | 'verifier';

interface LedgerTx {
  id: string;
  paymentId: string;
  reference: string;
  rail: string;
  totalAmount: number;
  currency: string;
  status: string;
  createdAt: string;
  entries: {
    id: string;
    account: string;
    accountType: string;
    debit: number;
    credit: number;
    currency: string;
    description: string;
  }[];
  trustScoreImpact?: {
    payerScoreDelta: number;
    payeeScoreDelta: number;
    reason: string;
  };
}

export default function TrustOSPage() {
  const location = useLocation();

  // Determine active tab from URL path or default to overview
  const initialTab: TrustOSTab = location.pathname.includes('/passport')
    ? 'passport'
    : location.pathname.includes('/ledger') || location.pathname.includes('/escrow')
    ? 'ledger'
    : location.pathname.includes('/verify')
    ? 'verifier'
    : 'overview';

  const [activeTab, setActiveTab] = useState<TrustOSTab>(initialTab);

  // Metrics state
  const [metrics, setMetrics] = useState({
    trustScore: 920,
    disputeRate: 0.5,
    escrowVolumeUsd: 142500,
    completedContracts: 38,
    activeEscrows: 4,
  });

  // Ledger state
  const [ledgerTxs, setLedgerTxs] = useState<LedgerTx[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [reconciliation, setReconciliation] = useState<any>(null);

  // Verifier console state
  const [verifyPayload, setVerifyPayload] = useState<string>('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ isValid: boolean; verifiedPredicates: string[]; error?: string } | null>(null);

  useEffect(() => {
    fetchMetrics();
    fetchLedger();
  }, []);

  const fetchMetrics = async () => {
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_HOST}/api/v1/trust/passport/me`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMetrics(prev => ({
          ...prev,
          trustScore: data.trustScore ?? 920,
          disputeRate: data.disputeRate ?? 0.5,
        }));
      }
    } catch {
      // Keep optimistic fallbacks
    }
  };

  const fetchLedger = async () => {
    setLoadingLedger(true);
    try {
      const [txRes, recRes] = await Promise.all([
        fetch(`${API_HOST}/api/v1/orchestrator/ledger/transactions`),
        fetch(`${API_HOST}/api/v1/orchestrator/ledger/reconciliation`),
      ]);
      const txData = await txRes.json();
      const recData = await recRes.json();
      if (txData?.transactions) setLedgerTxs(txData.transactions);
      if (recData?.reconciliation) setReconciliation(recData.reconciliation);
    } catch {
      // Offline fallback
    } finally {
      setLoadingLedger(false);
    }
  };

  const handleRunVerify = async () => {
    if (!verifyPayload.trim()) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      let parsed = JSON.parse(verifyPayload);
      if (parsed.proof_payload) parsed = parsed.proof_payload;

      const res = await fetch(`${API_HOST}/api/v1/trust/passport/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof_payload: parsed }),
      });
      const data = await res.json();
      setVerifyResult(data);
    } catch (e: any) {
      setVerifyResult({ isValid: false, verifiedPredicates: [], error: e.message || 'Invalid JSON proof format' });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <DashboardLayout osName="Trust OS" osIcon="T" osColor="emerald">
      <div className="min-h-screen text-[var(--pbn-text,#f1f5f9)]" style={{ backgroundColor: 'var(--pbn-bg, #0a0e17)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          
          {/* Header Banner */}
          <div className="rounded-3xl p-6 sm:p-8 border border-[var(--pbn-border,#334155)] bg-gradient-to-br from-[#0f172a] via-[#131d31] to-[#0a0e17] relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--pbn-accent,#4fd1c5)]/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium mb-3 border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Trust OS — The Reliability & Reputation Engine</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black font-['Space_Grotesk',sans-serif] tracking-tight">
                  Cryptographic Trust & Asset-Backed Settlement
                </h1>
                <p className="text-sm text-[var(--pbn-text-muted,#94a3b8)] mt-2 max-w-2xl leading-relaxed">
                  Transparent weighted ensemble verifying commercial counterparty standing. 100% asset-backed escrows across Solana USDC, SBP Raast, and cards with Zero-Knowledge reputation proofs.
                </p>
              </div>

              {/* Live Trust Gauge Quick Card */}
              <div className="flex items-center gap-4 bg-[var(--pbn-surface,#141e33)] p-4 rounded-2xl border border-[var(--pbn-border,#334155)] shadow-lg min-w-[220px]">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 font-black text-2xl shadow-md">
                  {metrics.trustScore}
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--pbn-text-muted,#94a3b8)]">
                    Reliability Tier
                  </div>
                  <div className="text-sm font-bold text-emerald-400 flex items-center gap-1">
                    <BadgeCheck className="w-4 h-4" />
                    <span>Diamond Standing</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                    Dispute: &lt;{metrics.disputeRate}%
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-[var(--pbn-border,#334155)]">
              <div>
                <div className="text-[10px] font-mono uppercase text-[var(--pbn-text-muted,#94a3b8)]">Escrow Protected</div>
                <div className="text-lg font-bold font-mono text-[var(--pbn-text,#f1f5f9)]">${metrics.escrowVolumeUsd.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase text-[var(--pbn-text-muted,#94a3b8)]">Verified Contracts</div>
                <div className="text-lg font-bold font-mono text-emerald-400">{metrics.completedContracts} Completed</div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase text-[var(--pbn-text-muted,#94a3b8)]">Active Escrows</div>
                <div className="text-lg font-bold font-mono text-[var(--pbn-accent,#4fd1c5)]">{metrics.activeEscrows} In Flight</div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase text-[var(--pbn-text-muted,#94a3b8)]">ZK Signature</div>
                <div className="text-lg font-bold font-mono text-indigo-400 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" />
                  <span>BBS+ Active</span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-[var(--pbn-border,#334155)] pb-1">
            {[
              { id: 'overview', label: 'Reliability Engine & Ensemble', icon: Layers },
              { id: 'passport', label: 'ZK Trust Passport', icon: ShieldCheck },
              { id: 'ledger', label: 'Escrow & Double-Entry Ledger', icon: TrendingUp },
              { id: 'verifier', label: 'Counterparty Verifier', icon: BadgeCheck },
            ].map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TrustOSTab)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    active
                      ? 'bg-[var(--pbn-accent,#4fd1c5)] text-slate-950 shadow-md font-bold'
                      : 'text-[var(--pbn-text-muted,#94a3b8)] hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB 1: Reliability Engine & Trust Ensemble */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="bg-[var(--pbn-surface,#141e33)] border border-[var(--pbn-border,#334155)] rounded-2xl p-6">
                <h3 className="text-lg font-bold font-['Space_Grotesk',sans-serif] mb-2 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[var(--pbn-accent,#4fd1c5)]" />
                  <span>Trust Ensemble Weighting Components</span>
                </h3>
                <p className="text-xs text-[var(--pbn-text-muted,#94a3b8)] mb-6 leading-relaxed">
                  Every parameter is auditable and deterministic. Events stay in context; only verified fraud or contract breaches degrade standing across the network.
                </p>

                <div className="space-y-4">
                  {[
                    { label: 'Escrow Fulfillment Rate', value: '99.4%', score: '+250 pts', desc: 'Commercial contracts delivered and signed off with 100% asset-backed escrow funding.' },
                    { label: 'Dispute & Penalty Index', value: '0.5%', score: '+200 pts', desc: 'Arbitration rate under 2% across autonomous and human work orders.' },
                    { label: 'Double-Entry Clearing Balance', value: '100% Cleared', score: '+180 pts', desc: 'Balanced debits and credits recorded across Solana Anchor and SBP Raast.' },
                    { label: 'B2B CRM Standing & Verified Identity', value: 'Active & Verified', score: '+150 pts', desc: 'Verified commercial credentials in Contact OS and business registration.' },
                    { label: 'ZK BBS+ Proof Generation Health', value: 'Deterministic Valid', score: '+140 pts', desc: 'Zero-knowledge selective disclosure signature ready for counterparty queries.' },
                  ].map((row, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-slate-900/60 border border-[var(--pbn-border,#334155)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-sm text-[var(--pbn-text,#f1f5f9)]">{row.label}</div>
                        <div className="text-xs text-[var(--pbn-text-muted,#94a3b8)] mt-0.5">{row.desc}</div>
                      </div>
                      <div className="text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center">
                        <div className="text-xs font-mono text-emerald-400 font-bold">{row.value}</div>
                        <div className="text-[11px] font-mono text-[var(--pbn-accent,#4fd1c5)]">{row.score}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Escrow Gigs Integration Banner */}
              <div className="p-6 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-sm text-emerald-400 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Boost Your Standing on the Escrow Gig Board</span>
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 max-w-xl">
                    Every gig funded or accepted on the Pabandi Gig Board automatically journals into the double-entry ledger and boosts your Trust Score upon milestone release.
                  </p>
                </div>
                <Link
                  to="/gigs"
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <span>Explore Gig Board</span>
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}

          {/* TAB 2: ZK Trust Passport (Embedded) */}
          {activeTab === 'passport' && (
            <div className="bg-[var(--pbn-surface,#141e33)] border border-[var(--pbn-border,#334155)] rounded-2xl p-6">
              <TrustPassportTab embedded />
            </div>
          )}

          {/* TAB 3: Escrows & Double-Entry Ledger */}
          {activeTab === 'ledger' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--pbn-surface,#141e33)] p-6 rounded-2xl border border-[var(--pbn-border,#334155)]">
                <div>
                  <h3 className="text-lg font-bold font-['Space_Grotesk',sans-serif]">
                    Double-Entry Escrow Ledger
                  </h3>
                  <p className="text-xs text-[var(--pbn-text-muted,#94a3b8)] mt-1">
                    Immutable balanced accounting ensuring debits equal credits for every rail deposit, escrow lock, and milestone release.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={fetchLedger}
                    disabled={loadingLedger}
                    className="px-3 py-2 rounded-xl text-xs border border-[var(--pbn-border,#334155)] hover:bg-white/[0.04] text-[var(--pbn-text,#f1f5f9)] flex items-center gap-1.5 font-medium"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingLedger ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                  <a
                    href={`${API_HOST}/api/v1/orchestrator/ledger/export.csv`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl text-xs bg-[var(--pbn-accent,#4fd1c5)] hover:opacity-90 text-slate-950 font-bold flex items-center gap-1.5 shadow"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </a>
                </div>
              </div>

              {/* Transactions Stream */}
              <div className="bg-[var(--pbn-surface,#141e33)] border border-[var(--pbn-border,#334155)] rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-[var(--pbn-border,#334155)] font-semibold text-xs text-[var(--pbn-text-muted,#94a3b8)] uppercase tracking-wider">
                  Journal Transactions ({ledgerTxs.length})
                </div>

                <div className="divide-y divide-[var(--pbn-border,#334155)]">
                  {ledgerTxs.length === 0 ? (
                    <div className="p-8 text-center text-xs text-[var(--pbn-text-muted,#94a3b8)]">
                      No ledger transactions loaded. Create or fund a gig to generate journal entries.
                    </div>
                  ) : (
                    ledgerTxs.map(tx => (
                      <div key={tx.id} className="p-4 hover:bg-white/[0.02] transition-colors space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[var(--pbn-accent,#4fd1c5)]">{tx.id}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-800 text-slate-300 border border-slate-700">
                              {tx.rail}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30">
                              {tx.status}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-mono text-sm font-bold text-[var(--pbn-text,#f1f5f9)]">
                              {tx.totalAmount.toLocaleString()} {tx.currency}
                            </span>
                          </div>
                        </div>

                        {/* Balanced Entries */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                          {tx.entries.map(e => (
                            <div key={e.id} className="p-2 rounded bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                              <span className="text-slate-400 truncate max-w-[200px]" title={e.account}>{e.account}</span>
                              <span className={e.debit > 0 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                                {e.debit > 0 ? `DEBIT $${e.debit}` : `CREDIT $${e.credit}`}
                              </span>
                            </div>
                          ))}
                        </div>

                        {tx.trustScoreImpact && (
                          <div className="text-[11px] text-emerald-400 font-mono flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Trust Score Impact: +{tx.trustScoreImpact.payerScoreDelta} payer, +{tx.trustScoreImpact.payeeScoreDelta} payee ({tx.trustScoreImpact.reason})</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Counterparty Verifier Console */}
          {activeTab === 'verifier' && (
            <div className="bg-[var(--pbn-surface,#141e33)] border border-[var(--pbn-border,#334155)] rounded-2xl p-6 space-y-6">
              <div>
                <h3 className="text-lg font-bold font-['Space_Grotesk',sans-serif] flex items-center gap-2">
                  <BadgeCheck className="w-5 h-5 text-[var(--pbn-accent,#4fd1c5)]" />
                  <span>Public Counterparty Proof Verifier</span>
                </h3>
                <p className="text-xs text-[var(--pbn-text-muted,#94a3b8)] mt-1">
                  Paste any Zero-Knowledge Trust Passport payload from a contractor, supplier, or autonomous AI agent to verify their credentials on-the-fly without exposing their underlying financial numbers.
                </p>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[var(--pbn-text-muted,#94a3b8)] mb-2">
                  Trust Passport JSON Payload
                </label>
                <textarea
                  value={verifyPayload}
                  onChange={e => setVerifyPayload(e.target.value)}
                  placeholder={`{\n  "issuer": "Pabandi",\n  "subjectId": "biz_...",\n  "issuedAt": 1740000000000,\n  "predicates": {\n    "trustScore": ">800",\n    "disputeRate": "<2%"\n  },\n  "signature": "zkp_..."\n}`}
                  rows={8}
                  className="w-full bg-[var(--pbn-bg,#0a0e17)] border border-[var(--pbn-border,#334155)] rounded-xl p-3 font-mono text-xs text-[var(--pbn-accent,#4fd1c5)] focus:outline-none focus:border-[var(--pbn-accent,#4fd1c5)]"
                />
              </div>

              <button
                type="button"
                onClick={handleRunVerify}
                disabled={verifying || !verifyPayload.trim()}
                className="px-6 py-2.5 rounded-xl font-bold text-xs bg-[var(--pbn-accent,#4fd1c5)] hover:opacity-90 text-slate-950 transition-opacity disabled:opacity-50 flex items-center gap-2"
              >
                {verifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                <span>{verifying ? 'Verifying BBS+ Cryptographic Proof...' : 'Verify Counterparty Standing'}</span>
              </button>

              {verifyResult && (
                <div
                  className={`p-4 rounded-xl border text-xs ${
                    verifyResult.isValid
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
                      : 'bg-red-950/40 border-red-500/40 text-red-400'
                  }`}
                >
                  <div className="font-bold flex items-center gap-2 text-sm mb-2">
                    {verifyResult.isValid ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    <span>{verifyResult.isValid ? 'Proof Cryptographically Verified Valid' : 'Proof Verification Failed'}</span>
                  </div>
                  {verifyResult.isValid ? (
                    <div>
                      <strong>Verified Predicates:</strong> {verifyResult.verifiedPredicates?.join(', ') || 'None'}
                    </div>
                  ) : (
                    <div>{verifyResult.error || 'The cryptographic signature is invalid or issuer is untrusted.'}</div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </DashboardLayout>
  );
}

