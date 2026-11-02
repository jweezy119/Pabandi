import { create } from 'zustand';

/**
 * Shared state for the Advanced Gamified Sandbox.
 * Fed by the mock $500 Plumbing Job scenario — no backend, pure frontend sim.
 * Both the Standard (Customer) and Pro (Business) views read/write this one
 * store so toggling perspectives stays perfectly in sync.
 */

export type SandboxMode = 'standard' | 'pro';

export type SandboxPhase =
  | 'start' // Contractor hired, nothing locked yet
  | 'locked' // Customer locked $500 in escrow
  | 'job_complete' // Business marked the job complete
  | 'released'; // Customer verified via VCAP + claimed rebate

export type QuestId = 'escrow' | 'complete' | 'vcap' | 'yield';

interface Quest {
  id: QuestId;
  label: string;
  xp: number;
}

export const QUESTS: Quest[] = [
  { id: 'escrow', label: 'Customer locks $500 in escrow.', xp: 25 },
  { id: 'complete', label: 'Business completes the job.', xp: 25 },
  { id: 'vcap', label: 'Customer verifies work (VCAP).', xp: 25 },
  { id: 'yield', label: 'Claim yield rebates.', xp: 25 },
];

export const SCENARIO = {
  jobTitle: 'Plumbing Job — Kitchen Leak Repair',
  contractor: 'Nadeem & Sons Plumbing',
  customer: 'Ayesha (Homeowner)',
  amount: 500,
  apy: 0.05,
  /** Simulated flow-of-funds yield rebate paid to whoever "held" the money. */
  creditPerTick: 0.01,
  minRebate: 2.5,
};

interface SandboxState {
  mode: SandboxMode;
  phase: SandboxPhase;
  /** Quests completed so far, in order of completion. */
  completedQuests: QuestId[];
  /** Live yield counter, ticks in the Customer view. */
  yieldEarned: number;
  /** Business SaaS credit balance, starts at $12.40 of mock value. */
  saasCredit: number;
  /** Filled when Pro marks the job complete — surfaces a toast in Customer view. */
  customerNotification: string | null;
  /** True once the yield-side credit has been added to the business account. */
  creditGranted: boolean;

  setMode: (mode: SandboxMode) => void;
  reset: () => void;
  lockEscrow: () => void;
  markJobComplete: () => void;
  releaseFunds: () => void;
  claimYield: () => void;
  tickYield: () => void;
  dismissNotification: () => void;
}

const initial = {
  mode: 'standard' as SandboxMode,
  phase: 'start' as SandboxPhase,
  completedQuests: [] as QuestId[],
  yieldEarned: 0,
  saasCredit: 12.4,
  customerNotification: null as string | null,
  creditGranted: false,
};

export const useSandboxStore = create<SandboxState>()((set) => ({
  mode: initial.mode,
  phase: initial.phase,
  completedQuests: initial.completedQuests,
  yieldEarned: initial.yieldEarned,
  saasCredit: initial.saasCredit,
  customerNotification: initial.customerNotification,
  creditGranted: initial.creditGranted,

  setMode: (mode) => set({ mode }),

  reset: () =>
    set({
      phase: initial.phase,
      completedQuests: initial.completedQuests,
      yieldEarned: initial.yieldEarned,
      customerNotification: initial.customerNotification,
      creditGranted: initial.creditGranted,
      // Keep the running SaaS credit — it's a business-lifetime figure.
    }),

  lockEscrow: () =>
    set((s) => {
      if (s.phase !== 'start') return {};
      return {
        phase: 'locked' as SandboxPhase,
        completedQuests: addQuest(s.completedQuests, 'escrow'),
      };
    }),

  markJobComplete: () =>
    set((s) => {
      if (s.phase !== 'locked') return {};
      return {
        phase: 'job_complete' as SandboxPhase,
        completedQuests: addQuest(s.completedQuests, 'complete'),
        customerNotification: `🔧 ${SCENARIO.contractor} marked your ${SCENARIO.jobTitle.split(' — ')[0].toLowerCase()} complete. Verify the work to release funds — and keep earning yield on $${SCENARIO.amount.toLocaleString('en-US')} while you wait.`,
      };
    }),

  releaseFunds: () =>
    set((s) => {
      if (s.phase !== 'job_complete') return {};
      return {
        phase: 'released' as SandboxPhase,
        completedQuests: addQuest(s.completedQuests, 'vcap'),
        customerNotification: null,
      };
    }),

  claimYield: () =>
    set((s) => {
      if (s.phase !== 'released' || s.creditGranted) return {};
      const amount = Math.max(SCENARIO.minRebate, s.yieldEarned);
      return {
        creditGranted: true,
        completedQuests: addQuest(s.completedQuests, 'yield'),
        saasCredit: round2(s.saasCredit + amount),
        customerNotification: null,
      };
    }),

  /** +$0.01/s — simulated APY drift while money is pooled in escrow. */
  tickYield: () =>
    set((s) => {
      if (s.phase !== 'locked' && s.phase !== 'job_complete') return {};
      return { yieldEarned: round2(Math.min(s.yieldEarned + SCENARIO.creditPerTick, 99)) };
    }),

  dismissNotification: () => set({ customerNotification: null }),
}));

function addQuest(current: QuestId[], id: QuestId): QuestId[] {
  return current.includes(id) ? current : [...current, id];
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
