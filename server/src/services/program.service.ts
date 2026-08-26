import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { generateProject, topDemandSkills } from './recommendation/autogen.service';
import { gigService } from './gig.service';

/**
 * Program service — turns a big, long engagement (up to a year, many tasks) into a
 * budgeted, staffed plan where NO ONE has to worry about being wrong:
 *
 *   1. DECOMPOSE  — split the engagement into ordered tasks by phase (discovery → build →
 *                   integrate → scale), each mapped to a real skill from the demand seed.
 *   2. BUDGET     — every task is priced with generateProject() (market median rate × complexity
 *                   × urgency × hours), so the total is a real number, not a guess.
 *   3. STAFF      — each task becomes its own gig with milestone escrow, so risk is sliced per task.
 *                   If one task fails, only that slice is at risk and the next task re-staffs.
 *
 * The client approves ONE program budget; the system handles scoping, pricing, and matching.
 */

export interface ProgramInput {
  title: string;
  description?: string;
  durationWeeks?: number;     // default 52
  skillMix?: string[];       // preferred skills; falls back to top demand if omitted
  intensity?: number;        // tasks per phase multiplier (1..3)
  clientWallet?: string;
  referralCode?: string;
}

const PHASES = ['Discovery & Spec', 'Build & Core', 'Integrate & Harden', 'Scale & Handoff'];

function pickSkills(mix?: string[]): string[] {
  if (mix && mix.length) return mix;
  return topDemandSkills(8).map((s) => s.skill);
}

export async function createProgram(input: ProgramInput): Promise<any> {
  const durationWeeks = input.durationWeeks || 52;
  const skills = pickSkills(input.skillMix);
  const intensity = Math.min(3, Math.max(1, input.intensity || 1));

  // Decompose: distribute skills across phases, repeating the rotation to fill the program.
  const tasks: { seq: number; phase: string; skill: string }[] = [];
  let seq = 1;
  for (const phase of PHASES) {
    for (let i = 0; i < intensity; i++) {
      const skill = skills[(seq - 1) % skills.length];
      tasks.push({ seq: seq++, phase, skill });
    }
  }

  // Budget each task from the demand seed (market-accurate, complexity scales with phase).
  const fallbackSkill = topDemandSkills(1)[0].skill;
  const taskRows = tasks.map((t, idx) => {
    const complexity = (idx % 4) as 0 | 1 | 2 | 3; // later phases = more complex
    const spec = generateProject(t.skill, { complexity, urgency: idx < 2 ? 2 : 0 }) || generateProject(fallbackSkill)!;
    const hoursShare = Math.max(8, Math.round((durationWeeks * intensity * 10) / tasks.length)); // rough weekly load
    return {
      seq: t.seq,
      phase: t.phase,
      skill: t.skill,
      category: spec.category,
      title: `${t.phase}: ${spec.title}`,
      budgetUsd: spec.budgetUsd,
      estimatedHours: spec.estimatedHours,
    };
  });

  const totalBudgetUsd = taskRows.reduce((s, t) => s + t.budgetUsd, 0);

  const program = await prisma.program.create({
    data: {
      title: input.title,
      description: input.description,
      clientWallet: input.clientWallet || null,
      referralCode: input.referralCode || 'PABANDI',
      durationWeeks,
      totalBudgetUsd,
      taskCount: taskRows.length,
      status: 'PLANNED',
      tasks: { create: taskRows.map((t) => ({ seq: t.seq, title: t.title, skill: t.skill, category: t.category, budgetUsd: t.budgetUsd, estimatedHours: t.estimatedHours, status: 'PLANNED' })) },
    },
    include: { tasks: true },
  });

  logger.info(`[program] created "${input.title}" — ${taskRows.length} tasks, $${totalBudgetUsd} total budget, ${durationWeeks}w`);
  return {
    programId: program.id,
    title: program.title,
    durationWeeks,
    taskCount: program.taskCount,
    totalBudgetUsd,
    perPhase: PHASES.map((p) => ({
      phase: p,
      tasks: taskRows.filter((t) => t.phase === p).map((t) => ({ skill: t.skill, budgetUsd: t.budgetUsd })),
    })),
    openBoardUrl: `https://pabandi.onrender.com/sdk/board.html?program=${program.id}`,
  };
}

/** Staff the next PLANNED task in a program: create its gig on the open board (milestone escrow). */
export async function staffNextTask(programId: string): Promise<any> {
  const task = await prisma.programTask.findFirst({ where: { programId, status: 'PLANNED' }, orderBy: { seq: 'asc' } });
  if (!task) return { staffed: false, note: 'no pending tasks' };
  const gig = await gigService.createGigFromSme({
    skill: task.skill,
    budgetUsd: task.budgetUsd,
    referralCode: (await prisma.program.findUnique({ where: { id: programId } }))?.referralCode || 'PABANDI',
  });
  await prisma.programTask.update({ where: { id: task.id }, data: { gigId: gig.gigId, status: 'OPEN' } });
  await prisma.program.update({ where: { id: programId }, data: { status: 'ACTIVE' } });
  logger.info(`[program] staffed task ${task.seq} (${task.skill}) → gig ${gig.gigId}`);
  return { staffed: true, taskSeq: task.seq, skill: task.skill, gigId: gig.gigId, budgetUsd: task.budgetUsd };
}

export async function programStatus(programId: string): Promise<any> {
  const p = await prisma.program.findUnique({ where: { id: programId }, include: { tasks: { orderBy: { seq: 'asc' } } } });
  if (!p) throw new Error('Program not found');
  const done = p.tasks.filter((t) => t.status === 'COMPLETED').length;
  return {
    programId: p.id, title: p.title, durationWeeks: p.durationWeeks, status: p.status,
    totalBudgetUsd: p.totalBudgetUsd, taskCount: p.taskCount, completed: done,
    progressPct: +((done / p.taskCount) * 100).toFixed(1),
    tasks: p.tasks.map((t) => ({ seq: t.seq, skill: t.skill, budgetUsd: t.budgetUsd, status: t.status, gigId: t.gigId })),
  };
}

export const programService = { createProgram, staffNextTask, programStatus };
