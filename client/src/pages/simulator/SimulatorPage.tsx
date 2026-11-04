/**
 * SimulatorPage.tsx — Project Simulator & Execution Swarm UI.
 *
 * Forecasts Budget, Materials, Staffing, and Time using a multi-agent swarm,
 * displays real-time observability traces, allows runtime steering, and enables
 * funding the project via Escrow.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Button, Badge, Chip, Stack, Surface, Section, tokens } from '../../design-system';
import { apiClient, API_HOST } from '../../services/api';
import { crmJobsService } from '../../services/crmJobs.service';
import { useAuthStore } from '../../store/authStore';

type ProjectType = 'roof-repair' | 'app-development' | 'kitchen-remodel' | 'hvac-install' | 'landscaping';

type FactorKey = 'timelineUrgency' | 'quality' | 'scale';

type AgentRole = 'materials' | 'staffing' | 'timeline' | 'cost';

type AgentRun = {
  id: string;
  agentRole: AgentRole;
  inputPayload: unknown;
  outputPayload: unknown;
  status: 'pending' | 'running' | 'completed' | 'failed';
  executionTimeMs?: number;
  createdAt: string;
};

type Simulation = {
  id: string;
  userId: string;
  projectType: string;
  initialFactors: unknown;
  status: 'draft' | 'running' | 'completed' | 'failed';
  finalEstimate?: {
    totalCost: number;
    breakdown: { materials: number; labor: number; contingency: number };
    contingencyPercent: number;
    escrowStatus?: string;
    escrowReferenceId?: string;
    squarePaymentId?: string;
    fundedAt?: string;
  };
  createdAt: string;
  updatedAt: string;
  agentRuns: AgentRun[];
};

type StartResponse = {
  success: boolean;
  data: { simulationId: string; status: string };
};

type SimResponse = {
  success: boolean;
  data: Simulation;
};

const PROJECT_TYPES: Array<{ value: ProjectType; label: string }> = [
  { value: 'roof-repair', label: 'Roof Repair' },
  { value: 'app-development', label: 'App Development' },
  { value: 'kitchen-remodel', label: 'Kitchen Remodel' },
  { value: 'hvac-install', label: 'HVAC Installation' },
  { value: 'landscaping', label: 'Landscaping' },
];

const FACTOR_CONFIG: Array<{ key: FactorKey; label: string; min: number; max: number; step: number; labels: [string, string] }> = [
  { key: 'timelineUrgency', label: 'Timeline Urgency', min: 1, max: 5, step: 1, labels: ['Low', 'High'] },
  { key: 'quality', label: 'Quality', min: 1, max: 5, step: 1, labels: ['Budget', 'Premium'] },
  { key: 'scale', label: 'Scale', min: 1, max: 5, step: 1, labels: ['Small', 'Large'] },
];

const AGENT_LABELS: Record<AgentRole, string> = {
  materials: 'Material Agent',
  staffing: 'Staffing Agent',
  timeline: 'Timeline Agent',
  cost: 'Cost Compiler Agent',
};

const AGENT_MESSAGES: Record<AgentRole, { running: string; completed: (output: unknown) => string }> = {
  materials: {
    running: 'Sourcing materials and pricing vendors...',
    completed: (o: unknown) => {
      const m = o as { totalMaterialCost?: number };
      return `Material Agent: $${m.totalMaterialCost?.toFixed(2) ?? '0.00'}`;
    },
  },
  staffing: {
    running: 'Matching roles and computing labor rates...',
    completed: (o: unknown) => {
      const s = o as { totalLaborCost?: number };
      return `Staffing Agent: $${s.totalLaborCost?.toFixed(2) ?? '0.00'}`;
    },
  },
  timeline: {
    running: 'Building critical path and estimating duration...',
    completed: (o: unknown) => {
      const t = o as { estimatedDays?: number };
      return `Timeline Agent: ~${t.estimatedDays ?? 0} days`;
    },
  },
  cost: {
    running: 'Compiling final estimate and contingency...',
    completed: (o: unknown) => {
      const c = o as { totalCost?: number };
      return `Cost Compiler Agent: $${c.totalCost?.toFixed(2) ?? '0.00'}`;
    },
  },
};

export default function SimulatorPage() {
  const [projectType, setProjectType] = useState<ProjectType>('roof-repair');
  const [factors, setFactors] = useState<Record<FactorKey, number>>({
    timelineUrgency: 3,
    quality: 3,
    scale: 3,
  });
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isSteering, setIsSteering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [escrowSuccess, setEscrowSuccess] = useState<{ rail: 'square' | 'solana'; referenceId: string; paymentUrl?: string } | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const { user } = useAuthStore();

  // Start simulation
  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsStarting(true);

    try {
      const res: StartResponse = await apiClient.post('/simulator/start', {
        projectType,
        factors,
      });

      setSimulation(null);
      const simId = res.data.data.simulationId;
      await fetchSimulation(simId);
      startPolling(simId);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start simulation');
    } finally {
      setIsStarting(false);
    }
  };

  // Fetch simulation + agent trace
  const fetchSimulation = useCallback(async (id: string) => {
    try {
      const res: SimResponse = await apiClient.get(`/simulator/${id}`);
      const sim = res.data.data;
      setSimulation(sim);
      if (sim && (sim.status === 'completed' || sim.status === 'failed')) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    } catch (err: any) {
      console.error('[Simulator] fetch error:', err.message);
    }
  }, []);

  // Poll every 1.5 seconds while running
  const startPolling = (id: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = window.setInterval(() => {
      fetchSimulation(id);
    }, 1500);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  // Steer: update factors and re-run
  const handleSteer = async (newFactors: Record<FactorKey, number>) => {
    if (!simulation) return;
    setIsSteering(true);
    setError(null);

    try {
      await apiClient.post(`/simulator/${simulation.id}/steer`, {
        factors: newFactors,
      });
      setFactors(newFactors);
      setSimulation(null);
      await fetchSimulation(simulation.id);
      startPolling(simulation.id);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Steering failed');
    } finally {
      setIsSteering(false);
    }
  };

  // Fund via Escrow: supports Square Checkout (Card / Cash App / Apple Pay) & Solana Pay (USDC)
  const handleFundEscrow = async (rail: 'square' | 'solana' = 'square') => {
    if (!simulation || !simulation.finalEstimate) return;

    setIsStarting(true);
    setError(null);
    setEscrowSuccess(null);
    try {
      const totalCost = simulation.finalEstimate.totalCost;
      const buyerId = user?.id || simulation.userId || 'simulator-user';
      const referenceId = `sim-${simulation.id}`;

      // 1. Best-effort create CrmJob record if user has a business workspace
      await crmJobsService.createJob({
        title: `${projectType} Project`,
        description: `Simulated project: ${projectType} with factors ${JSON.stringify(factors)}`,
        budgetUsd: totalCost,
        status: 'open',
        clientId: buyerId,
      }).catch(() => null);

      // 2. Create UniversalEscrow record with valid schema (parties + conditions)
      await apiClient.post('/escrow', {
        referenceId,
        template: 'milestone',
        parties: [
          { partyId: buyerId, role: 'buyer' },
        ],
        amount: totalCost,
        currency: rail === 'solana' ? 'USDC' : 'USD',
        conditions: [
          {
            type: 'milestone',
            verify: {
              simulationId: simulation.id,
              projectType,
              rail,
            },
          },
        ],
        metadata: {
          simulationId: simulation.id,
          projectType,
          rail,
          breakdown: simulation.finalEstimate.breakdown,
        },
      }).catch(() => null);

      if (rail === 'square') {
        // Create Square hosted checkout link with exact webhook note prefix (`pabandi:universalescrow:<ref>`)
        const sqRes = await apiClient.post('/square-checkout/checkout', {
          referenceId,
          amount: totalCost,
          currency: 'USD',
          redirectUrl: `${window.location.origin}/simulator?simId=${simulation.id}&funded=${referenceId}&rail=square`,
          cancelUrl: `${window.location.origin}/simulator?simId=${simulation.id}`,
          note: `pabandi:universalescrow:${referenceId}`,
          label: `Pabandi Project Escrow (${projectType})`,
          customerEmail: user?.email,
        }).catch(() => null);

        const checkoutUrl = sqRes?.data?.checkout?.url || sqRes?.data?.checkout?.paymentLink?.url;
        setEscrowSuccess({ rail: 'square', referenceId, paymentUrl: checkoutUrl });
        if (checkoutUrl) {
          window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
        }
      } else {
        // Solana Pay USDC URI
        const merchantWallet = 'PabandiEscrowVault1111111111111111111111111';
        const solanaPayUrl = `solana:${merchantWallet}?amount=${totalCost.toFixed(2)}&spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&label=${encodeURIComponent(`Pabandi Escrow (${projectType})`)}&message=${encodeURIComponent(`Escrow ${referenceId}`)}`;
        setEscrowSuccess({ rail: 'solana', referenceId, paymentUrl: solanaPayUrl });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Escrow funding failed');
    } finally {
      setIsStarting(false);
    }
  };

  // Restore simulation & funded status on return from Square Checkout redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const simId = params.get('simId');
    const fundedRef = params.get('funded');
    const rail = (params.get('rail') as 'square' | 'solana') || 'square';
    if (simId) {
      fetchSimulation(simId);
    }
    if (fundedRef) {
      setEscrowSuccess({ rail, referenceId: fundedRef });
    }
    return () => stopPolling();
  }, [fetchSimulation]);

  // Derive agent display state
  const agentStates: Array<{ role: AgentRole; status: string; output?: unknown; elapsedMs?: number }> =
    simulation?.agentRuns.map((r) => ({
      role: r.agentRole as AgentRole,
      status: r.status,
      output: r.outputPayload,
      elapsedMs: r.executionTimeMs,
    })) || [];

  const isRunning = simulation?.status === 'running';
  const isComplete = simulation?.status === 'completed';
  const hasError = simulation?.status === 'failed';

  return (
    <DashboardLayout osName="Project Simulator" osIcon="🏗️" osColor="indigo" navItems={[]}>
      <div className="min-h-screen bg-[#020617] text-[#e2e8f0]">
        <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <Section title="Project Simulator" description="Forecast Budget, Materials, Staffing, and Time with the multi-agent swarm. Real-time observability and runtime steering included." />

          {/* ── Input Section ── */}
          <Surface className="p-6">
            <h2 className="text-lg font-bold text-[#e2e8f0] mb-4">1. Configure Project</h2>
            <form onSubmit={handleStart} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="col-span-1 md:col-span-2">
                <label className="block text-xs font-semibold text-[#94a3b8] mb-2">Project Type</label>
                <select
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value as ProjectType)}
                  className="w-full px-3 py-2 rounded-lg border border-white/[0.12] bg-[#0f172a] text-[#e2e8f0] focus:border-indigo-400 focus:outline-none"
                >
                  {PROJECT_TYPES.map((pt) => (
                    <option key={pt.value} value={pt.value}>
                      {pt.label}
                    </option>
                  ))}
                </select>
              </div>
              {FACTOR_CONFIG.map((fc) => (
                <div key={fc.key} className="col-span-1 md:col-span-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[#94a3b8]">{fc.label}</label>
                    <span className="text-[10px] text-[#64748b] flex gap-2">
                      <span>{fc.labels[0]}</span>
                      <span>{fc.labels[1]}</span>
                    </span>
                  </div>
                  <input
                    type="range"
                    min={fc.min}
                    max={fc.max}
                    step={fc.step}
                    value={factors[fc.key]}
                    onChange={(e) => setFactors({ ...factors, [fc.key]: parseInt(e.target.value, 10) })}
                    className="w-full accent-indigo-500 h-2 bg-[#1e293b] rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#64748b] mt-1">
                    <span>{factors[fc.key]}</span>
                  </div>
                </div>
              ))}
              <div className="col-span-1 md:col-span-2 lg:col-span-3 flex items-end">
                <Button type="submit" variant="primary" disabled={isStarting || isSteering} loading={isStarting}>
                  {isStarting ? 'Running Swarm…' : 'Run Simulation'}
                </Button>
              </div>
            </form>
            {error && (
              <div className="mt-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
                {error}
              </div>
            )}
          </Surface>

          {simulation && (
            <>
              {/* ── Observability Trace Section ── */}
              <Surface className="p-6 mt-6">
                <h2 className="text-lg font-bold text-[#e2e8f0] mb-4 flex items-center gap-2">
                  <Chip tone="info">{isRunning ? 'LIVE' : simulation.status.toUpperCase()}</Chip>
                  2. Observability Trace
                </h2>
                <div className="space-y-3">
                  {agentStates.length > 0 ? (
                    agentStates.map((a) => {
                      const isRunningAgent = a.status === 'running';
                      const isCompleteAgent = a.status === 'completed';
                      const isFailedAgent = a.status === 'failed';
                      const msg =
                        isRunningAgent
                          ? AGENT_MESSAGES[a.role].running
                          : isCompleteAgent
                          ? AGENT_MESSAGES[a.role].completed(a.output)
                          : isFailedAgent
                          ? `❌ ${AGENT_LABELS[a.role]}: ${(a.output as { error?: string })?.error ?? 'failed'}`
                          : `⏳ ${AGENT_LABELS[a.role]}: queued`;
                      return (
                        <div
                          key={a.role}
                          className={`flex items-start gap-3 p-3 rounded-lg border transition-colors duration-300 ${
                            isCompleteAgent
                              ? 'border-emerald-500/30 bg-emerald-500/5'
                              : isFailedAgent
                              ? 'border-rose-500/30 bg-rose-500/5'
                              : isRunningAgent
                              ? 'border-indigo-500/30 bg-indigo-500/5 animate-pulse'
                              : 'border-white/10'
                          }`}
                        >
                          <div className="flex flex-col items-center min-w-[20px]">
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                isCompleteAgent ? 'bg-emerald-500 text-white' : isRunningAgent ? 'bg-indigo-500 text-white animate-pulse' : 'bg-[#1e293b] text-[#64748b] border border-white/10'
                              }`}
                            >
                              {isCompleteAgent ? '✓' : isRunningAgent ? '⟳' : '○'}
                            </div>
                            <div className="w-px h-4 bg-[#334155] mx-1" />
                            <span className="text-[10px] text-[#64748b]">{a.role.charAt(0).toUpperCase() + a.role.slice(1)}</span>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-[#e2e8f0]">{msg}</p>
                            {a.elapsedMs && isCompleteAgent && (
                              <span className="text-[10px] text-[#94a3b8]">completed in {a.elapsedMs}ms</span>
                            )}
                          </div>
                        </div>
                      );
                    }))
                  : (
                    <div className="p-4 text-center text-[#64748b] text-sm">
                      No agent runs yet. Start a simulation to see the trace.
                    </div>
                  )}
                </div>
              </Surface>

              {/* ── Steering Section ── */}
              {isComplete && simulation.finalEstimate && (
                <Surface className="p-6 mt-6">
                  <h2 className="text-lg font-bold text-[#e2e8f0] mb-4">3. Final Estimate</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-white/[0.07] bg-[#0f172a]">
                      <p className="text-xs font-semibold text-[#94a3b8]">Total Cost</p>
                      <p className="text-2xl font-bold text-[#e2e8f0]">${simulation.finalEstimate.totalCost.toFixed(2)}</p>
                    </div>
                    <div className="p-4 rounded-xl border border-white/[0.07] bg-[#0f172a]">
                      <p className="text-xs font-semibold text-[#94a3b8]">Contingency</p>
                      <p className="text-2xl font-bold text-[#e2e8f0]">{simulation.finalEstimate.contingencyPercent}%</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#94a3b8]">Materials</span>
                      <span className="text-[#e2e8f0]">${simulation.finalEstimate.breakdown.materials.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#94a3b8]">Labor</span>
                      <span className="text-[#e2e8f0]">${simulation.finalEstimate.breakdown.labor.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#94a3b8]">Contingency</span>
                      <span className="text-[#e2e8f0]">${simulation.finalEstimate.breakdown.contingency.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Button
                      variant="outline"
                      disabled={isSteering}
                      onClick={() => handleSteer({ ...factors })}
                      className="w-full"
                    >
                      {isSteering ? 'Recalculating…' : 'Tweak Factors & Recalculate'}
                    </Button>
                  </div>
                </Surface>
              )}

              {/* ── Execution Section ── */}
              <Surface className="p-6 mt-6">
                <h2 className="text-lg font-bold text-[#e2e8f0] mb-4">4. Fund Project</h2>
                <p className="text-sm text-[#94a3b8] mb-4">
                  Lock the forecasted budget in escrow via Pabandi using Square (Card / Apple Pay / Cash App) or Solana Pay (USDC). Funds are released only after verified delivery (Sulha arbitration).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    variant="primary"
                    disabled={!isComplete || !simulation.finalEstimate || isStarting}
                    loading={isStarting}
                    onClick={() => handleFundEscrow('square')}
                    className="w-full py-4 text-base"
                  >
                    💳 Fund via Square — ${simulation.finalEstimate?.totalCost.toFixed(2) ?? '0.00'}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!isComplete || !simulation.finalEstimate || isStarting}
                    loading={isStarting}
                    onClick={() => handleFundEscrow('solana')}
                    className="w-full py-4 text-base"
                  >
                    ⚡ Fund via Solana Pay — {simulation.finalEstimate?.totalCost.toFixed(2) ?? '0.00'} USDC
                  </Button>
                </div>
                {(escrowSuccess || simulation.finalEstimate?.escrowStatus === 'funded') && (
                  <div className="mt-4 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 text-sm space-y-2">
                    <div className="font-bold flex items-center gap-2">
                      <span>
                        ✓ {simulation.finalEstimate?.escrowStatus === 'funded' ? 'Escrow Funded & Verified' : 'Escrow Created'} ({escrowSuccess?.referenceId || simulation.finalEstimate?.escrowReferenceId || `sim-${simulation.id}`}) via {escrowSuccess?.rail === 'solana' ? 'Solana Pay USDC' : 'Square Checkout'}
                      </span>
                      {simulation.finalEstimate?.escrowStatus === 'funded' && (
                        <Chip tone="success">FUNDED</Chip>
                      )}
                    </div>
                    {escrowSuccess?.paymentUrl && (
                      <div className="flex flex-wrap items-center gap-3">
                        <a
                          href={escrowSuccess.paymentUrl}
                          target={escrowSuccess.rail === 'square' ? '_blank' : undefined}
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-colors"
                        >
                          {escrowSuccess.rail === 'square' ? 'Open Square Checkout ↗' : 'Open in Solana Wallet (Phantom / Solflare) ⚡'}
                        </a>
                        <span className="text-xs text-emerald-300/80 break-all">{escrowSuccess.paymentUrl}</span>
                      </div>
                    )}
                  </div>
                )}
                {!isComplete && (
                  <p className="mt-3 text-xs text-[#64748b]">
                    Complete the simulation first to unlock escrow funding.
                  </p>
                )}
              </Surface>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}