/**
 * PublicProposalPage.tsx — Shareable Interactive Simulator Proposal (/p/estimate/:simulationId)
 *
 * Allows any client who receives a `/p/estimate/:simulationId` link to:
 *   1. Inspect the itemized AI Swarm breakdown (Materials, Staffing, Timeline, Contingency).
 *   2. Adjust scope sliders (Timeline Urgency, Quality, Scale) and re-run the 4-agent swarm live.
 *   3. Lock & fund the agreed scope in 1 click (50% Milestone 1 Deposit or 100% Full Escrow)
 *      via Square Checkout (Card / Apple Pay / Cash App) or Solana Pay (USDC).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient } from '../../services/api';

type FactorKey = 'timelineUrgency' | 'quality' | 'scale';
type AgentRole = 'materials' | 'staffing' | 'timeline' | 'cost';

interface AgentRun {
  id: string;
  agentRole: AgentRole;
  inputPayload: unknown;
  outputPayload: unknown;
  status: 'pending' | 'running' | 'completed' | 'failed';
  executionTimeMs?: number;
  createdAt: string;
}

interface PublicProposalData {
  id: string;
  projectType: string;
  initialFactors: Record<string, unknown>;
  status: 'draft' | 'running' | 'completed' | 'failed';
  finalEstimate?: {
    totalCost: number;
    breakdown: { materials: number; labor: number; contingency: number };
    contingencyPercent: number;
    escrowStatus?: string;
    escrowReferenceId?: string;
    escrowRail?: string;
    milestoneMode?: 'full' | 'deposit_50';
    fundedAmount?: number;
    squarePaymentId?: string;
    solanaTxSignature?: string;
    fundedAt?: string;
  };
  createdAt: string;
  updatedAt: string;
  agentRuns: AgentRun[];
  creator?: {
    id: string;
    name: string;
    businessSlug?: string | null;
  };
  escrow?: {
    referenceId: string;
    status: string;
    amount: number;
    currency: string;
  } | null;
}

const PROJECT_TYPE_LABELS: Record<string, string> = {
  'roof-repair': 'Roof Repair & Structural Weatherproofing',
  'app-development': 'Full-Stack Application Development',
  'kitchen-remodel': 'Kitchen Remodel & Cabinetry',
  'hvac-install': 'HVAC System Installation',
  'landscaping': 'Site Grading & Landscaping',
};

const FACTOR_CONFIG: Array<{
  key: FactorKey;
  label: string;
  min: number;
  max: number;
  step: number;
  labels: [string, string];
  tierNames: Record<number, string>;
}> = [
  {
    key: 'timelineUrgency',
    label: 'Timeline Speed',
    min: 1,
    max: 5,
    step: 1,
    labels: ['Relaxed', 'Rush Delivery'],
    tierNames: { 1: 'Relaxed (1.5x time)', 2: 'Flexible', 3: 'Standard Pace', 4: 'Accelerated', 5: 'Priority Rush' },
  },
  {
    key: 'quality',
    label: 'Material & Spec Quality',
    min: 1,
    max: 5,
    step: 1,
    labels: ['Economy', 'Architectural / Luxury'],
    tierNames: { 1: 'Economy', 2: 'Value', 3: 'Commercial Standard', 4: 'High-Grade', 5: 'Premium / Luxury' },
  },
  {
    key: 'scale',
    label: 'Project Scale',
    min: 1,
    max: 5,
    step: 1,
    labels: ['Compact', 'Enterprise / Full Site'],
    tierNames: { 1: 'Small / Compact', 2: 'Light Medium', 3: 'Standard Scope', 4: 'Expanded', 5: 'Large / Multi-Unit' },
  },
];

const AGENT_LABELS: Record<AgentRole, string> = {
  materials: 'Material Sourcing Agent',
  staffing: 'Staffing & Labor Agent',
  timeline: 'Critical Path Timeline Agent',
  cost: 'Cost & Contingency Compiler',
};

function normalizeNumericFactor(val: unknown): number {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return Math.min(5, Math.max(1, Math.round(val)));
  }
  if (typeof val === 'string') {
    const map: Record<string, number> = {
      small: 1,
      low: 1,
      budget: 1,
      medium: 3,
      standard: 3,
      large: 5,
      high: 5,
      premium: 5,
    };
    return map[val.toLowerCase()] ?? 3;
  }
  return 3;
}

export default function PublicProposalPage() {
  const { simulationId } = useParams<{ simulationId: string }>();
  const [proposal, setProposal] = useState<PublicProposalData | null>(null);
  const [factors, setFactors] = useState<Record<FactorKey, number>>({
    timelineUrgency: 3,
    quality: 3,
    scale: 3,
  });
  const [loading, setLoading] = useState(true);
  const [isSteering, setIsSteering] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Client checkout form state
  const [milestoneMode, setMilestoneMode] = useState<'deposit_50' | 'full'>('deposit_50');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [solanaCheckout, setSolanaCheckout] = useState<{
    solanaPayUrl: string;
    merchantWallet: string;
    referenceId: string;
    amount: number;
  } | null>(null);
  const [safepayCheckout, setSafepayCheckout] = useState<{
    checkoutUrl: string;
    referenceId: string;
    amountPkr: number;
    raastIban: string;
    safepayConfigured: boolean;
  } | null>(null);
  const [solanaTxSig, setSolanaTxSig] = useState('');
  const [verifyingSolana, setVerifyingSolana] = useState(false);
  const [redirectFundedBanner, setRedirectFundedBanner] = useState<{
    referenceId: string;
    rail: string;
  } | null>(null);

  const pollIntervalRef = useRef<number | null>(null);
  const factorsInitializedRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const fetchProposal = useCallback(
    async (id: string) => {
      try {
        const res = await apiClient.get(`/simulator/public/${id}`);
        const data: PublicProposalData = res.data?.data;
        if (data) {
          setProposal(data);
          if (!factorsInitializedRef.current && data.initialFactors) {
            factorsInitializedRef.current = true;
            setFactors({
              timelineUrgency: normalizeNumericFactor(data.initialFactors.timelineUrgency),
              quality: normalizeNumericFactor(data.initialFactors.quality),
              scale: normalizeNumericFactor(data.initialFactors.scale),
            });
          }
          if (data.status === 'completed' || data.status === 'failed') {
            stopPolling();
          }
        }
      } catch (err: any) {
        setError(err.response?.data?.error || 'Could not load this proposal.');
        stopPolling();
      } finally {
        setLoading(false);
      }
    },
    [stopPolling],
  );

  const startPolling = useCallback(
    (id: string) => {
      stopPolling();
      pollIntervalRef.current = window.setInterval(() => {
        void fetchProposal(id);
      }, 1500);
    },
    [fetchProposal, stopPolling],
  );

  useEffect(() => {
    if (!simulationId) return;
    const params = new URLSearchParams(window.location.search);
    const fundedRef = params.get('funded');
    const rail = params.get('rail') || 'square';
    if (fundedRef) {
      setRedirectFundedBanner({ referenceId: fundedRef, rail });
    }
    void fetchProposal(simulationId);
    return () => stopPolling();
  }, [simulationId, fetchProposal, stopPolling]);

  // Trigger polling automatically if proposal is initially in draft/running state
  useEffect(() => {
    if (!simulationId || !proposal) return;
    if ((proposal.status === 'draft' || proposal.status === 'running') && !pollIntervalRef.current) {
      startPolling(simulationId);
    }
  }, [simulationId, proposal, startPolling]);

  const handleRecalculate = async () => {
    if (!simulationId) return;
    setIsSteering(true);
    setError(null);
    setSolanaCheckout(null);
    try {
      await apiClient.post(`/simulator/public/${simulationId}/steer`, {
        factors,
      });
      await fetchProposal(simulationId);
      startPolling(simulationId);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to recalculate estimate');
    } finally {
      setIsSteering(false);
    }
  };

  const handleFund = async (rail: 'square' | 'solana' | 'safepay') => {
    if (!simulationId || !proposal?.finalEstimate) return;
    setIsFunding(true);
    setError(null);
    setSolanaCheckout(null);
    setSafepayCheckout(null);
    try {
      const res = await apiClient.post(`/simulator/public/${simulationId}/fund`, {
        rail,
        milestoneMode,
        clientName: clientName.trim() || undefined,
        clientEmail: clientEmail.trim() || undefined,
        origin: window.location.origin,
      });
      const payload = res.data?.data;
      if (rail === 'square' && payload?.checkoutUrl) {
        window.location.href = payload.checkoutUrl;
        return;
      }
      if (rail === 'safepay' && payload) {
        if (payload.safepayConfigured && payload.checkoutUrl && !payload.checkoutUrl.includes('safepay_disabled=true')) {
          window.location.href = payload.checkoutUrl;
          return;
        }
        setSafepayCheckout({
          checkoutUrl: payload.checkoutUrl,
          referenceId: payload.referenceId,
          amountPkr: payload.amountPkr,
          raastIban: payload.raastIban || 'PK36MEZN0001010100492817',
          safepayConfigured: Boolean(payload.safepayConfigured),
        });
        return;
      }
      if (rail === 'solana' && payload?.solanaPayUrl) {
        setSolanaCheckout({
          solanaPayUrl: payload.solanaPayUrl,
          merchantWallet: payload.merchantWallet,
          referenceId: payload.referenceId,
          amount: payload.amount,
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not initiate escrow checkout');
    } finally {
      setIsFunding(false);
    }
  };

  const handleVerifySolana = async () => {
    if (!simulationId || !solanaTxSig.trim()) return;
    setVerifyingSolana(true);
    setError(null);
    try {
      await apiClient.post(`/simulator/public/${simulationId}/verify-solana`, {
        txSignature: solanaTxSig.trim(),
        milestoneMode,
        clientName: clientName.trim() || undefined,
        clientEmail: clientEmail.trim() || undefined,
      });
      setSolanaCheckout(null);
      await fetchProposal(simulationId);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to verify Solana transaction');
    } finally {
      setVerifyingSolana(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] text-[#e2e8f0] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-400 mx-auto" />
          <p className="text-sm text-[#94a3b8]">Loading interactive proposal & AI Swarm trace…</p>
        </div>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-[#020617] text-[#e2e8f0] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-[#0f172a] p-8 text-center space-y-4">
          <div className="text-3xl">🔍</div>
          <h1 className="text-xl font-bold">Proposal Not Found</h1>
          <p className="text-sm text-[#94a3b8]">
            {error || 'This interactive estimate link may have expired or does not exist.'}
          </p>
          <Link
            to="/"
            className="inline-block px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold"
          >
            Explore Pabandi
          </Link>
        </div>
      </div>
    );
  }

  const isRunning = proposal.status === 'running' || proposal.status === 'draft';
  const isComplete = proposal.status === 'completed' && !!proposal.finalEstimate;
  const isFunded =
    proposal.finalEstimate?.escrowStatus === 'funded' ||
    proposal.escrow?.status === 'funded' ||
    !!redirectFundedBanner;

  const totalCost = proposal.finalEstimate?.totalCost ?? 0;
  const payableAmount =
    milestoneMode === 'deposit_50'
      ? Math.round(totalCost * 0.5 * 100) / 100
      : Math.round(totalCost * 100) / 100;

  // Extract detailed agent outputs for itemized tables
  const materialsRun = proposal.agentRuns.find((r) => r.agentRole === 'materials' && r.status === 'completed')
    ?.outputPayload as {
    materials?: Array<{ item: string; quantity: number; unitCost: number }>;
    totalMaterialCost?: number;
  } | undefined;

  const staffingRun = proposal.agentRuns.find((r) => r.agentRole === 'staffing' && r.status === 'completed')
    ?.outputPayload as {
    roles?: Array<{ role: string; count: number; hourlyRate: number }>;
    totalLaborCost?: number;
  } | undefined;

  const timelineRun = proposal.agentRuns.find((r) => r.agentRole === 'timeline' && r.status === 'completed')
    ?.outputPayload as {
    estimatedDays?: number;
    criticalPath?: string;
  } | undefined;

  const projectTitle = PROJECT_TYPE_LABELS[proposal.projectType] || proposal.projectType;

  return (
    <div className="min-h-screen bg-[#020617] text-[#e2e8f0]">
      {/* Top Trust Bar */}
      <header className="border-b border-white/[0.08] bg-[#0f172a]/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-lg font-extrabold tracking-tight text-white flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-600 text-xs font-bold">
                P
              </span>
              PABANDI
            </Link>
            <span className="text-xs text-[#64748b]">•</span>
            <span className="text-xs font-medium text-[#94a3b8]">
              Interactive Scope & Escrow Proposal
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
              🛡️ Sulha Escrow Protected
            </span>
            {isFunded ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-slate-950">
                ✓ FUNDED & LOCKED
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                ⚡ Interactive Estimate
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Funded celebration banner */}
        {isFunded && (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-emerald-300 font-bold text-base">
                <span>✓ Project Escrow Funded & Scope Locked</span>
              </div>
              <p className="text-sm text-emerald-100/80">
                Reference{' '}
                <code className="px-1.5 py-0.5 rounded bg-black/30 text-emerald-200 font-mono text-xs">
                  {proposal.finalEstimate?.escrowReferenceId ||
                    redirectFundedBanner?.referenceId ||
                    `sim-${proposal.id}`}
                </code>{' '}
                is active. Funds are held in Pabandi Escrow and released only as verified milestones are completed.
              </p>
            </div>
            <Link
              to="/verify-trust"
              className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-colors whitespace-nowrap text-center"
            >
              Verify Escrow Standing →
            </Link>
          </div>
        )}

        {/* Proposal Hero Card */}
        <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0f172a] to-[#1e1b4b]/50 p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-indigo-300 font-semibold uppercase tracking-wider">
                <span>Prepared by {proposal.creator?.name || 'Verified Pabandi Provider'}</span>
                <span>•</span>
                <span>Proposal #{proposal.id.slice(-8).toUpperCase()}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white capitalize">
                {projectTitle}
              </h1>
              <p className="text-sm text-[#94a3b8] max-w-2xl">
                Adjust the scope sliders below to customize timeline speed, material grade, and project scale.
                Our 4-agent AI Swarm recalculates materials, labor, and critical path in real time before you lock the price in escrow.
              </p>
            </div>

            {isComplete && proposal.finalEstimate && (
              <div className="rounded-2xl border border-indigo-500/30 bg-[#020617]/80 p-5 min-w-[240px] text-right">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
                  Total Estimated Budget
                </div>
                <div className="text-3xl font-black text-white mt-1">
                  ${proposal.finalEstimate.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                {timelineRun?.estimatedDays && (
                  <div className="text-xs text-indigo-300 mt-1 font-medium">
                    ⏱️ Est. Duration: ~{timelineRun.estimatedDays} days
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
            {error}
          </div>
        )}

        {/* Interactive Scope Sliders + Live Agent Swarm Trace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Interactive Scope Controls (7 cols) */}
          <section className="lg:col-span-7 rounded-2xl border border-white/10 bg-[#0f172a] p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">1. Customize Scope & Tier</h2>
                <p className="text-xs text-[#94a3b8]">
                  {isFunded
                    ? 'Scope is locked because escrow has been funded.'
                    : 'Move any slider to see how urgency, quality, or scale changes your quote.'}
                </p>
              </div>
              {isRunning && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 animate-pulse">
                  SWARM COMPUTING…
                </span>
              )}
            </div>

            <div className="space-y-4">
              {FACTOR_CONFIG.map((fc) => {
                const val = factors[fc.key];
                return (
                  <div key={fc.key} className="p-4 rounded-xl border border-white/[0.07] bg-[#020617]/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-white">{fc.label}</label>
                      <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 text-xs font-semibold">
                        Level {val}/5 — {fc.tierNames[val]}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={fc.min}
                      max={fc.max}
                      step={fc.step}
                      disabled={isFunded || isSteering || isRunning}
                      value={val}
                      onChange={(e) =>
                        setFactors({ ...factors, [fc.key]: parseInt(e.target.value, 10) })
                      }
                      className="w-full accent-indigo-500 h-2 bg-[#1e293b] rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                    />
                    <div className="flex justify-between text-[11px] text-[#64748b]">
                      <span>{fc.labels[0]}</span>
                      <span>{fc.labels[1]}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {!isFunded && (
              <button
                type="button"
                onClick={handleRecalculate}
                disabled={isSteering || isRunning}
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
              >
                {isSteering || isRunning ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    AI Swarm Recalculating Quote…
                  </>
                ) : (
                  '🔄 Recalculate Scope & Price with AI Swarm'
                )}
              </button>
            )}
          </section>

          {/* Right: Live 4-Agent Swarm Observability Trace (5 cols) */}
          <section className="lg:col-span-5 rounded-2xl border border-white/10 bg-[#0f172a] p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-white">2. AI Swarm Verification Trace</h2>
              <p className="text-xs text-[#94a3b8]">
                4 specialized agents independently price materials, labor, and timeline.
              </p>
            </div>

            <div className="space-y-3">
              {proposal.agentRuns.map((run) => {
                const isDone = run.status === 'completed';
                const isRun = run.status === 'running';
                const out = (run.outputPayload || {}) as Record<string, any>;
                let summary = 'Queued…';
                if (isRun) summary = 'Computing live estimate…';
                if (isDone) {
                  if (run.agentRole === 'materials') {
                    summary = `${out.materials?.length || 0} line items • $${Number(out.totalMaterialCost || 0).toFixed(2)}`;
                  } else if (run.agentRole === 'staffing') {
                    summary = `${out.roles?.length || 0} crew roles • $${Number(out.totalLaborCost || 0).toFixed(2)}`;
                  } else if (run.agentRole === 'timeline') {
                    summary = `~${out.estimatedDays || 0} days (${out.criticalPath || 'Critical Path'})`;
                  } else if (run.agentRole === 'cost') {
                    summary = `Total $${Number(out.totalCost || 0).toFixed(2)} (incl. ${out.contingencyPercent || 15}% contingency)`;
                  }
                }

                return (
                  <div
                    key={run.id}
                    className={`p-3.5 rounded-xl border ${
                      isDone
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : isRun
                        ? 'border-indigo-500/40 bg-indigo-500/10 animate-pulse'
                        : 'border-white/10 bg-[#020617]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-2">
                        <span
                          className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] ${
                            isDone
                              ? 'bg-emerald-500 text-slate-950 font-black'
                              : 'bg-indigo-500/30 text-indigo-200'
                          }`}
                        >
                          {isDone ? '✓' : '⟳'}
                        </span>
                        {AGENT_LABELS[run.agentRole] || run.agentRole}
                      </span>
                      {typeof run.executionTimeMs === 'number' && isDone && (
                        <span className="text-[10px] text-[#64748b]">{run.executionTimeMs}ms</span>
                      )}
                    </div>
                    <p className="text-xs text-[#94a3b8] mt-1.5 pl-7">{summary}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Itemized Breakdown Section */}
        {isComplete && proposal.finalEstimate && (
          <section className="rounded-2xl border border-white/10 bg-[#0f172a] p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-white">3. Transparent Itemized Breakdown</h2>
                <p className="text-xs text-[#94a3b8]">
                  Generated by the Pabandi Project Swarm for your selected scope parameters.
                </p>
              </div>
              {timelineRun?.criticalPath && (
                <div className="text-xs px-3 py-1.5 rounded-lg bg-[#020617] border border-white/10 text-[#94a3b8]">
                  <strong className="text-white">Critical Path:</strong> {timelineRun.criticalPath}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Materials Table */}
              <div className="rounded-xl border border-white/[0.08] bg-[#020617]/60 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                  <h3 className="text-sm font-bold text-white">📦 Materials & Supplies</h3>
                  <span className="text-sm font-bold text-indigo-300">
                    ${proposal.finalEstimate.breakdown.materials.toFixed(2)}
                  </span>
                </div>
                <div className="space-y-2">
                  {materialsRun?.materials?.map((m, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="text-[#cbd5e1]">
                        {m.item} <span className="text-[#64748b]">× {m.quantity} units @ ${m.unitCost.toFixed(2)}</span>
                      </span>
                      <span className="font-semibold text-white">
                        ${(m.quantity * m.unitCost).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Staffing Table */}
              <div className="rounded-xl border border-white/[0.08] bg-[#020617]/60 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                  <h3 className="text-sm font-bold text-white">👷 Crew & Labor Allocation</h3>
                  <span className="text-sm font-bold text-indigo-300">
                    ${proposal.finalEstimate.breakdown.labor.toFixed(2)}
                  </span>
                </div>
                <div className="space-y-2">
                  {staffingRun?.roles?.map((r, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="text-[#cbd5e1]">
                        {r.role} <span className="text-[#64748b]">({r.count}× @ ${r.hourlyRate.toFixed(2)}/hr)</span>
                      </span>
                      <span className="font-semibold text-white">
                        ${(r.count * r.hourlyRate * 40).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Summary Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-[#020617] border border-white/[0.06]">
                <div className="text-[11px] text-[#94a3b8]">Materials Subtotal</div>
                <div className="text-base font-bold text-white mt-0.5">
                  ${proposal.finalEstimate.breakdown.materials.toFixed(2)}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#020617] border border-white/[0.06]">
                <div className="text-[11px] text-[#94a3b8]">Labor Subtotal</div>
                <div className="text-base font-bold text-white mt-0.5">
                  ${proposal.finalEstimate.breakdown.labor.toFixed(2)}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#020617] border border-white/[0.06]">
                <div className="text-[11px] text-[#94a3b8]">
                  Contingency Reserve ({proposal.finalEstimate.contingencyPercent}%)
                </div>
                <div className="text-base font-bold text-white mt-0.5">
                  ${proposal.finalEstimate.breakdown.contingency.toFixed(2)}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-indigo-600/20 border border-indigo-500/40">
                <div className="text-[11px] text-indigo-200 font-semibold">Total Project Estimate</div>
                <div className="text-lg font-extrabold text-white mt-0.5">
                  ${proposal.finalEstimate.totalCost.toFixed(2)}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 4. 1-Click Escrow Acceptance & Funding */}
        {isComplete && proposal.finalEstimate && (
          <section className="rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-[#0f172a] to-[#020617] p-6 sm:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-extrabold text-white">
                  4. Accept Proposal & Lock Escrow
                </h2>
                <p className="text-sm text-[#94a3b8] mt-1">
                  Your funds are held safely in Pabandi Escrow and only released when milestones are verified.
                </p>
              </div>
              <div className="flex items-center gap-2 bg-[#020617] p-1.5 rounded-xl border border-white/10">
                <button
                  type="button"
                  disabled={isFunded}
                  onClick={() => setMilestoneMode('deposit_50')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors ${
                    milestoneMode === 'deposit_50'
                      ? 'bg-indigo-600 text-white'
                      : 'text-[#94a3b8] hover:text-white'
                  }`}
                >
                  50% Milestone 1 Kickoff (${(totalCost * 0.5).toFixed(2)})
                </button>
                <button
                  type="button"
                  disabled={isFunded}
                  onClick={() => setMilestoneMode('full')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors ${
                    milestoneMode === 'full'
                      ? 'bg-indigo-600 text-white'
                      : 'text-[#94a3b8] hover:text-white'
                  }`}
                >
                  100% Full Project (${totalCost.toFixed(2)})
                </button>
              </div>
            </div>

            {!isFunded && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#94a3b8] mb-1.5">
                      Your Name / Company (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Acme Properties LLC"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#020617] text-sm text-white focus:border-indigo-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#94a3b8] mb-1.5">
                      Receipt & Escrow Notification Email (optional)
                    </label>
                    <input
                      type="email"
                      placeholder="client@company.com"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#020617] text-sm text-white focus:border-indigo-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    disabled={isFunding}
                    onClick={() => handleFund('square')}
                    className="py-4 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-extrabold text-sm shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2"
                  >
                    💳 Square (Card / Apple Pay) — ${payableAmount.toFixed(2)}
                  </button>
                  <button
                    type="button"
                    disabled={isFunding}
                    onClick={() => handleFund('solana')}
                    className="py-4 px-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-50 text-emerald-300 font-extrabold text-sm transition-all flex items-center justify-center gap-2"
                  >
                    ⚡ Solana Pay — {payableAmount.toFixed(2)} USDC
                  </button>
                  <button
                    type="button"
                    disabled={isFunding}
                    onClick={() => handleFund('safepay')}
                    className="py-4 px-4 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-50 text-amber-200 font-extrabold text-sm transition-all flex items-center justify-center gap-2"
                  >
                    🇵🇰 Safepay / Raast — PKR {Math.round(payableAmount * 278).toLocaleString('en-US')}
                  </button>
                </div>

                <p className="text-xs text-center text-[#64748b]">
                  Square accepts Visa, Mastercard, Amex, Apple Pay, Google Pay, and Cash App Pay.
                  Solana Pay settles instantly in USDC. Safepay & Raast settle in PKR (Rs.) under Pabandi Sulha Escrow protection.
                </p>
              </>
            )}

            {/* Inline Safepay / Raast PKR Drawer */}
            {safepayCheckout && !isFunded && (
              <div className="p-6 rounded-2xl border border-amber-500/30 bg-[#020617] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-amber-300 flex items-center gap-2">
                      🇵🇰 Safepay & Raast PKR Escrow Checkout
                    </div>
                    <p className="text-xs text-[#94a3b8]">
                      Escrow Reference <code className="text-amber-200">{safepayCheckout.referenceId}</code> • Amount:{' '}
                      <strong className="text-white">
                        PKR {safepayCheckout.amountPkr.toLocaleString('en-US')}
                      </strong>{' '}
                      (${payableAmount.toFixed(2)} USD @ 278 PKR)
                    </p>
                  </div>
                  <Link
                    to="/compliance"
                    className="text-xs font-semibold text-indigo-300 hover:text-indigo-200 underline"
                  >
                    View Safepay Merchant Compliance & Refund Terms →
                  </Link>
                </div>
                <div className="p-4 rounded-xl border border-white/10 bg-[#0f172a] space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[#94a3b8]">Instant Raast / IBAN Escrow Account:</span>
                    <code className="font-mono font-bold text-white">{safepayCheckout.raastIban}</code>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[#94a3b8]">Required Payment Reference / Note:</span>
                    <code className="font-mono font-bold text-amber-300">{safepayCheckout.referenceId}</code>
                  </div>
                </div>
              </div>
            )}

            {/* Inline Solana Pay QR + Verification Drawer */}
            {solanaCheckout && !isFunded && (
              <div className="p-6 rounded-2xl border border-emerald-500/30 bg-[#020617] space-y-4">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                      solanaCheckout.solanaPayUrl,
                    )}`}
                    alt="Solana Pay USDC QR Code"
                    className="w-40 h-40 rounded-xl bg-white p-2"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="text-sm font-bold text-emerald-300">
                      Scan with Phantom / Solflare or Open Wallet
                    </div>
                    <p className="text-xs text-[#94a3b8]">
                      Send exactly <strong className="text-white">{solanaCheckout.amount.toFixed(2)} USDC</strong> to lock Escrow Reference{' '}
                      <code className="text-emerald-200">{solanaCheckout.referenceId}</code>.
                    </p>
                    <div className="text-[11px] font-mono text-[#64748b] break-all">
                      Vault: {solanaCheckout.merchantWallet}
                    </div>
                    <div className="pt-1">
                      <a
                        href={solanaCheckout.solanaPayUrl}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400"
                      >
                        Open in Solana Wallet ⚡
                      </a>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Paste Solana transaction signature after sending USDC…"
                    value={solanaTxSig}
                    onChange={(e) => setSolanaTxSig(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#0f172a] text-xs text-white font-mono focus:border-emerald-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={verifyingSolana || solanaTxSig.trim().length < 20}
                    onClick={handleVerifySolana}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs whitespace-nowrap"
                  >
                    {verifyingSolana ? 'Verifying…' : 'Verify & Lock Escrow'}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Footer with Compliance & Pricing links */}
        <footer className="pt-6 pb-8 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#64748b]">
          <div>
            © {new Date().getFullYear()} Pabandi Inc. • Programmable Escrow & Trust OS
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/pricing" className="hover:text-white transition-colors">
              Pricing (USD & PKR)
            </Link>
            <Link to="/compliance" className="hover:text-white transition-colors">
              Merchant Compliance & Refund Policy
            </Link>
            <Link to="/terms" className="hover:text-white transition-colors">
              Terms of Service
            </Link>
            <Link to="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link to="/verify-trust" className="hover:text-white transition-colors">
              Verify Trust Passport
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
