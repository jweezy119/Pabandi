/**
 * simulator/swarm.service.ts — Project Simulator multi-agent swarm orchestrator.
 *
 * Runs a 4-agent swarm (materials, staffing, timeline in parallel, then cost
 * compiler) to forecast Budget, Materials, Staffing, and Time for a project.
 * Results are persisted to ProjectSimulation / SimulationAgentRun so the
 * frontend can poll the observability trace in real time.
 */

import { z } from 'zod';
import { prisma } from '../../utils/database';
import { logger } from '../../utils/logger';

// ── Zod output schemas (strict, no markdown tolerance) ──────────────────────

const MaterialItemSchema = z.object({
  item: z.string().min(1),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative(),
});

const MaterialsOutputSchema = z.object({
  materials: z.array(MaterialItemSchema),
  totalMaterialCost: z.number().nonnegative(),
});

const StaffingRoleSchema = z.object({
  role: z.string().min(1),
  count: z.number().positive(),
  hourlyRate: z.number().nonnegative(),
});

const StaffingOutputSchema = z.object({
  roles: z.array(StaffingRoleSchema),
  totalLaborCost: z.number().nonnegative(),
});

const TimelineOutputSchema = z.object({
  estimatedDays: z.number().positive(),
  criticalPath: z.string().min(1),
});

const FinalEstimateSchema = z.object({
  totalCost: z.number().nonnegative(),
  breakdown: z.object({
    materials: z.number().nonnegative(),
    labor: z.number().nonnegative(),
    contingency: z.number().nonnegative(),
  }),
  contingencyPercent: z.number().min(0).max(100),
});

export type MaterialsOutput = z.infer<typeof MaterialsOutputSchema>;
export type StaffingOutput = z.infer<typeof StaffingOutputSchema>;
export type TimelineOutput = z.infer<typeof TimelineOutputSchema>;
export type FinalEstimate = z.infer<typeof FinalEstimateSchema>;

export interface SwarmSimulationResult {
  materials: MaterialsOutput;
  staffing: StaffingOutput;
  timeline: TimelineOutput;
  estimate: FinalEstimate;
}

/**
 * Pure, in-memory deterministic forecast compiler.
 * Does not write to database, suitable for stateless public quoting.
 */
export async function computeEstimate(factors: any): Promise<SwarmSimulationResult> {
  const [materials, staffing, timeline] = await Promise.all([
    materialAgent(factors),
    staffingAgent(factors),
    timelineAgent(factors),
  ]);
  const estimate = await costCompilerAgent(materials, staffing, timeline);
  return {
    materials,
    staffing,
    timeline,
    estimate,
  };
}

// ── Agent simulators (deterministic, supports both 1..5 numeric sliders and string enums) ──

function resolveScaleMultiplier(scale: unknown): number {
  if (typeof scale === 'number' && Number.isFinite(scale)) {
    // 1 -> 0.5x, 2 -> 0.75x, 3 -> 1.0x, 4 -> 1.5x, 5 -> 2.0x
    const table: Record<number, number> = { 1: 0.5, 2: 0.75, 3: 1.0, 4: 1.5, 5: 2.0 };
    return table[Math.min(5, Math.max(1, Math.round(scale)))] ?? 1.0;
  }
  if (typeof scale === 'string') {
    return { small: 0.5, medium: 1.0, large: 2.0 }[scale] ?? 1.0;
  }
  return 1.0;
}

function resolveQualityMultiplier(quality: unknown): number {
  if (typeof quality === 'number' && Number.isFinite(quality)) {
    // 1 -> 0.75x, 2 -> 0.9x, 3 -> 1.0x, 4 -> 1.25x, 5 -> 1.6x
    const table: Record<number, number> = { 1: 0.75, 2: 0.9, 3: 1.0, 4: 1.25, 5: 1.6 };
    return table[Math.min(5, Math.max(1, Math.round(quality)))] ?? 1.0;
  }
  if (typeof quality === 'string') {
    return { budget: 0.8, standard: 1.0, premium: 1.5 }[quality] ?? 1.0;
  }
  return 1.0;
}

function resolveUrgencyMultiplier(urgency: unknown): { durationMult: number; laborSurgeMult: number } {
  if (typeof urgency === 'number' && Number.isFinite(urgency)) {
    const clamped = Math.min(5, Math.max(1, Math.round(urgency)));
    const durationTable: Record<number, number> = { 1: 1.5, 2: 1.25, 3: 1.0, 4: 0.8, 5: 0.65 };
    const surgeTable: Record<number, number> = { 1: 0.95, 2: 0.98, 3: 1.0, 4: 1.15, 5: 1.35 };
    return { durationMult: durationTable[clamped] ?? 1.0, laborSurgeMult: surgeTable[clamped] ?? 1.0 };
  }
  if (typeof urgency === 'string') {
    const durationMult = { low: 1.5, medium: 1.0, high: 0.7 }[urgency] ?? 1.0;
    const laborSurgeMult = { low: 0.95, medium: 1.0, high: 1.25 }[urgency] ?? 1.0;
    return { durationMult, laborSurgeMult };
  }
  return { durationMult: 1.0, laborSurgeMult: 1.0 };
}

async function materialAgent(factors: any): Promise<MaterialsOutput> {
  const baseItems = [
    { item: 'Concrete', quantity: 10, unitCost: 120 },
    { item: 'Lumber', quantity: 20, unitCost: 45 },
    { item: 'Roofing Shingles', quantity: 30, unitCost: 25 },
  ];
  const scaleMult = resolveScaleMultiplier(factors?.scale);
  const qualityMult = resolveQualityMultiplier(factors?.quality);
  const materials = baseItems.map((it) => ({
    item: it.item,
    quantity: Math.max(1, Math.round(it.quantity * scaleMult)),
    unitCost: Math.round(it.unitCost * qualityMult * 100) / 100,
  }));
  const totalMaterialCost = Math.round(
    materials.reduce((sum, it) => sum + it.quantity * it.unitCost, 0) * 100,
  ) / 100;
  return MaterialsOutputSchema.parse({ materials, totalMaterialCost });
}

async function staffingAgent(factors: any): Promise<StaffingOutput> {
  const baseRoles = [
    { role: 'Project Manager', count: 1, hourlyRate: 85 },
    { role: 'Skilled Laborer', count: 2, hourlyRate: 45 },
    { role: 'Apprentice', count: 1, hourlyRate: 25 },
  ];
  const scaleMult = resolveScaleMultiplier(factors?.scale);
  const { laborSurgeMult } = resolveUrgencyMultiplier(factors?.timelineUrgency);
  const roles = baseRoles.map((r) => ({
    role: r.role,
    count: Math.max(1, Math.round(r.count * scaleMult)),
    hourlyRate: Math.round(r.hourlyRate * laborSurgeMult * 100) / 100,
  }));
  const totalLaborCost = Math.round(
    roles.reduce((sum, r) => sum + r.count * r.hourlyRate * 40, 0) * 100,
  ) / 100;
  return StaffingOutputSchema.parse({ roles, totalLaborCost });
}

async function timelineAgent(factors: any): Promise<TimelineOutput> {
  const scaleMult = resolveScaleMultiplier(factors?.scale);
  const { durationMult } = resolveUrgencyMultiplier(factors?.timelineUrgency);
  const baseDays = Math.round(14 * scaleMult);
  const estimatedDays = Math.max(1, Math.round(baseDays * durationMult));
  const criticalPath = 'Procurement → Foundation → Framing → Roofing → Finish';
  return TimelineOutputSchema.parse({ estimatedDays, criticalPath });
}

async function costCompilerAgent(
  materials: MaterialsOutput,
  staffing: StaffingOutput,
  timeline: TimelineOutput,
): Promise<FinalEstimate> {
  const materialsCost = materials.totalMaterialCost;
  const laborCost = staffing.totalLaborCost;
  const contingencyPercent = 15;
  const contingency = Math.round(
    (materialsCost + laborCost) * (contingencyPercent / 100) * 100,
  ) / 100;
  const totalCost = Math.round((materialsCost + laborCost + contingency) * 100) / 100;
  return FinalEstimateSchema.parse({
    totalCost,
    breakdown: { materials: materialsCost, labor: laborCost, contingency },
    contingencyPercent,
  });
}

// ── Swarm orchestrator ──────────────────────────────────────────────────────

const MAX_RETRIES = 2;

async function runAgentWithRetry(
  agentRole: string,
  inputPayload: any,
  agentFn: () => Promise<any>,
  schema: z.ZodTypeAny,
): Promise<any> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const raw = await agentFn();
      const validated = schema.parse(raw);
      return validated;
    } catch (err: any) {
      lastError = err;
      logger.warn(
        `[Swarm] agent ${agentRole} attempt ${attempt + 1} failed: ${err.message}`,
      );
    }
  }
  throw lastError ?? new Error(`agent ${agentRole} failed after ${MAX_RETRIES + 1} attempts`);
}

export async function runSwarm(
  simulationId: string,
  factors: any,
): Promise<void> {
  // Mark simulation as running
  await prisma.projectSimulation.update({
    where: { id: simulationId },
    data: { status: 'running' },
  });

  const startTime = Date.now();

  // ── Step 1: Parallel execution of 3 agents ──────────────────────────────

  const agents = [
    {
      role: 'materials',
      fn: () => materialAgent(factors),
      schema: MaterialsOutputSchema,
    },
    {
      role: 'staffing',
      fn: () => staffingAgent(factors),
      schema: StaffingOutputSchema,
    },
    {
      role: 'timeline',
      fn: () => timelineAgent(factors),
      schema: TimelineOutputSchema,
    },
  ];

  const agentRuns: Array<{ id: string; role: string }> = [];

  // Create all agent run records first
  for (const a of agents) {
    const run = await prisma.simulationAgentRun.create({
      data: {
        simulationId,
        agentRole: a.role,
        inputPayload: factors,
        status: 'pending',
      },
    });
    agentRuns.push({ id: run.id, role: a.role });
  }

  // Run agents in parallel
  const results = await Promise.allSettled(
    agents.map(async (a, idx) => {
      const runId = agentRuns[idx].id;
      const t0 = Date.now();
      // Mark this agent run as running
      await prisma.simulationAgentRun.update({
        where: { id: runId },
        data: { status: 'running' },
      });
      try {
        const output = await runAgentWithRetry(
          a.role,
          factors,
          a.fn,
          a.schema,
        );
        const executionTimeMs = Date.now() - t0;
        await prisma.simulationAgentRun.update({
          where: { id: runId },
          data: {
            status: 'completed',
            outputPayload: output,
            executionTimeMs,
          },
        });
        return { role: a.role, output };
      } catch (err: any) {
        const executionTimeMs = Date.now() - t0;
        await prisma.simulationAgentRun.update({
          where: { id: runId },
          data: {
            status: 'failed',
            outputPayload: { error: err.message },
            executionTimeMs,
          },
        });
        throw err;
      }
    }),
  );

  // Check if all three succeeded
  const completed = results.filter(
    (r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled',
  );
  const failed = results.filter(
    (r): r is PromiseRejectedResult => r.status === 'rejected',
  );

  if (failed.length > 0) {
    await prisma.projectSimulation.update({
      where: { id: simulationId },
      data: { status: 'failed' },
    });
    throw new Error(
      `Swarm failed: ${failed.length} agent(s) did not complete`,
    );
  }

  const byRole = Object.fromEntries(
    completed.map((r) => {
      const agent = agents.find((a) => a.role === (r.value as any).role)!;
      return [agent.role, (r.value as any).output];
    }),
  ) as Record<string, any>;

  // ── Step 2: Aggregation via Cost Compiler Agent ─────────────────────────

  const finalEstimate = await costCompilerAgent(
    byRole.materials,
    byRole.staffing,
    byRole.timeline,
  );

  // Create cost compiler agent run record
  const costRun = await prisma.simulationAgentRun.create({
    data: {
      simulationId,
      agentRole: 'cost',
      inputPayload: {
        materials: byRole.materials,
        staffing: byRole.staffing,
        timeline: byRole.timeline,
      },
      outputPayload: finalEstimate,
      status: 'completed',
      executionTimeMs: Date.now() - startTime,
    },
  });

  // ── Step 3: Mark simulation completed ───────────────────────────────────

  await prisma.projectSimulation.update({
    where: { id: simulationId },
    data: {
      status: 'completed',
      finalEstimate,
    },
  });

  logger.info(
    `[Swarm] simulation ${simulationId} completed in ${
      Date.now() - startTime
    }ms with estimate $${finalEstimate.totalCost}`,
  );
}
