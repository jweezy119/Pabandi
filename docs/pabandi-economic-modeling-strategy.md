# Pabandi Economic Modeling Strategy

How we simulate, validate, and stress-test the Pabandi agent economy *before* real
capital is deployed — and which tools own which layer of that work.

## Principle: model the feedback loops, not just the steps

The Pabandi economy is a set of interacting stocks and flows: treasury float, agent
stakes, PAB velocity, project completion rates, slashing events, yield accrual. The
dangerous dynamics are *invisible* at the task level — e.g. technical debt → rework →
lower completion → lower trust → fewer bookings → less float yield. These are causal-loop
and stock-and-flow problems, not granular process steps.

## Tooling split (what owns what)

### 1. Vensim & Stella Architect — *preferred* for high-level economic policy simulation
Vensim and Stella Architect specialize in **causal loop diagrams (CLDs) and
stock-and-flow modeling**. They are the preferred tools for high-level economic policy
simulation rather than granular process steps.

- **Economic focus:** excel at modeling the "invisible" feedback loops of project
  development — the relationship between technical debt, rework rates, and long-term
  maintenance costs; between agent-stake concentration and recommendation quality; between
  idle-yield APY and treasury float behavior.
- **Policy testing:** simulate the impact of changing budget allocation, hiring/agent
  onboarding strategy, stake thresholds, or fee rates on overall project + protocol health
  across months or years — without getting bogged down in individual task details.
- **Validation:** widely used in academic and corporate research to validate theories like
  the "Software Feedback Loop," Brooks' Law, and leverage-point analysis. We use it the
  same way: validate that a tokenomic or policy change *actually* stabilizes the system
  before shipping it.
- **Deliverable:** a living Vensim/Stella model of the Pabandi economy + scenario reports
  (base case, stress case, policy-lever case) committed alongside code changes that touch
  tokenomics or agent incentives.

### 2. agentScorer (code) — operational scoring, not policy simulation
The `agentScorer.service.ts` rule-based engine (wallet-behavior + first-party Pabandi
history + stake gate) is the *live* recruiter. It consumes real on-chain + first-party
data to rank agents. It is **not** a system-dynamics simulator — it is the operational
layer Vensim's policy outputs inform (e.g. Vensim tells us the right stake threshold;
agentScorer enforces it).

### 3. On-chain / off-chain anchors — ground truth
- Solana mainnet events (Helius) = real wallet behavior feed for the scorer.
- Aliyun RDS `AgentBooking` / `AgentTransaction` / `TreasuryPosition` = first-party
  completion, slash, and float data that both the scorer and the Vensim calibration use.

## How they connect (loop)
```
Vensim/Stella (policy model)  ──recommends levers──▶  agentScorer + stake/slash params
        ▲                                                  │
        │  calibrated by                                   ▼
        └── real Pabandi data (bookings, yields, slashes) ◀── live system
```
We do NOT ship tokenomic or incentive changes without a Vensim/Stella scenario that shows
the change stabilizes (not destabilizes) the feedback loops.

## Status
- [x] agentScorer + stake/slashing + first-party history signal — built & deployed (branch `feat/agent-scorer` → `main`).
- [ ] Vensim/Stella model of the Pabandi economy — **not yet built** (future modeling work; tools preferred per plan).
- [ ] Idle-yield (Kamino) float simulation in Vensim — deferred to phase 2.
- [ ] Live Fiverr/Upwork demand feed into autogen — seed data only for now.
