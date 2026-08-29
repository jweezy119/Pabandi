"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.programService = void 0;
exports.createProgram = createProgram;
exports.staffNextTask = staffNextTask;
exports.programStatus = programStatus;
exports.listPrograms = listPrograms;
exports.runProgramLoop = runProgramLoop;
exports.runAllPrograms = runAllPrograms;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const autogen_service_1 = require("./recommendation/autogen.service");
const gig_service_1 = require("./gig.service");
const PHASES = ['Discovery & Spec', 'Build & Core', 'Integrate & Harden', 'Scale & Handoff'];
function pickSkills(mix) {
    if (mix && mix.length)
        return mix;
    return (0, autogen_service_1.topDemandSkills)(8).map((s) => s.skill);
}
async function createProgram(input) {
    const durationWeeks = input.durationWeeks || 52;
    const skills = pickSkills(input.skillMix);
    const intensity = Math.min(3, Math.max(1, input.intensity || 1));
    // Decompose: distribute skills across phases, repeating the rotation to fill the program.
    const tasks = [];
    let seq = 1;
    for (const phase of PHASES) {
        for (let i = 0; i < intensity; i++) {
            const skill = skills[(seq - 1) % skills.length];
            tasks.push({ seq: seq++, phase, skill });
        }
    }
    // Budget each task from the demand seed (market-accurate, complexity scales with phase).
    const fallbackSkill = (0, autogen_service_1.topDemandSkills)(1)[0].skill;
    const taskRows = tasks.map((t, idx) => {
        const complexity = (idx % 4); // later phases = more complex
        const spec = (0, autogen_service_1.generateProject)(t.skill, { complexity, urgency: idx < 2 ? 2 : 0 }) || (0, autogen_service_1.generateProject)(fallbackSkill);
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
    const program = await database_1.prisma.program.create({
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
    logger_1.logger.info(`[program] created "${input.title}" — ${taskRows.length} tasks, $${totalBudgetUsd} total budget, ${durationWeeks}w`);
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
async function staffNextTask(programId) {
    const task = await database_1.prisma.programTask.findFirst({ where: { programId, status: 'PLANNED' }, orderBy: { seq: 'asc' } });
    if (!task)
        return { staffed: false, note: 'no pending tasks' };
    const gig = await gig_service_1.gigService.createGigFromSme({
        skill: task.skill,
        budgetUsd: task.budgetUsd,
        referralCode: (await database_1.prisma.program.findUnique({ where: { id: programId } }))?.referralCode || 'PABANDI',
    });
    await database_1.prisma.programTask.update({ where: { id: task.id }, data: { gigId: gig.gigId, status: 'OPEN' } });
    await database_1.prisma.program.update({ where: { id: programId }, data: { status: 'ACTIVE' } });
    logger_1.logger.info(`[program] staffed task ${task.seq} (${task.skill}) → gig ${gig.gigId}`);
    return { staffed: true, taskSeq: task.seq, skill: task.skill, gigId: gig.gigId, budgetUsd: task.budgetUsd };
}
async function programStatus(programId) {
    const p = await database_1.prisma.program.findUnique({ where: { id: programId }, include: { tasks: { orderBy: { seq: 'asc' } } } });
    if (!p)
        throw new Error('Program not found');
    const done = p.tasks.filter((t) => t.status === 'COMPLETED').length;
    return {
        programId: p.id, title: p.title, durationWeeks: p.durationWeeks, status: p.status,
        totalBudgetUsd: p.totalBudgetUsd, taskCount: p.taskCount, completed: done,
        progressPct: +((done / p.taskCount) * 100).toFixed(1),
        tasks: p.tasks.map((t) => ({ seq: t.seq, skill: t.skill, budgetUsd: t.budgetUsd, status: t.status, gigId: t.gigId })),
    };
}
exports.programService = { createProgram, staffNextTask, programStatus, runProgramLoop, runAllPrograms, listPrograms };
/** List all programs with per-phase breakdown + live progress (for the public UI). */
async function listPrograms() {
    const programs = await database_1.prisma.program.findMany({ orderBy: { createdAt: 'desc' }, include: { tasks: { orderBy: { seq: 'asc' } } } });
    const PHASES = ['Discovery & Spec', 'Build & Core', 'Integrate & Harden', 'Scale & Handoff'];
    return programs.map((p) => {
        const done = p.tasks.filter((t) => t.status === 'COMPLETED').length;
        return {
            programId: p.id, title: p.title, durationWeeks: p.durationWeeks, status: p.status,
            totalBudgetUsd: p.totalBudgetUsd, taskCount: p.taskCount, completed: done,
            progressPct: +((done / p.taskCount) * 100).toFixed(1),
            perPhase: PHASES.map((ph) => ({
                phase: ph,
                tasks: p.tasks.filter((t) => t.title.startsWith(ph)).map((t) => ({ skill: t.skill, status: t.status, budgetUsd: t.budgetUsd })),
            })).filter((ph) => ph.tasks.length),
        };
    });
}
/**
 * Autonomous program loop: advance ONE program toward completion.
 *  - If the current OPEN task's gig is delivered (COMPLETED), mark the task done and staff the next.
 *  - If no task is OPEN, staff the next PLANNED task (creates its gig on the board).
 *  - When all tasks are COMPLETED, mark the program COMPLETED.
 * This lets a whole year-long, multi-task engagement run itself through the autonomous economy.
 */
async function runProgramLoop(programId) {
    const p = await database_1.prisma.program.findUnique({ where: { id: programId }, include: { tasks: { orderBy: { seq: 'asc' } } } });
    if (!p)
        return { programId, error: 'not found' };
    if (p.status === 'COMPLETED')
        return { programId, status: 'COMPLETED' };
    // 1) Complete any OPEN task whose gig has already been delivered by the freelancer economy.
    for (const t of p.tasks) {
        if (t.status === 'OPEN' && t.gigId) {
            const gig = await database_1.prisma.project.findUnique({ where: { id: t.gigId } });
            if (gig && gig.status === 'COMPLETED') {
                await database_1.prisma.programTask.update({ where: { id: t.id }, data: { status: 'COMPLETED', assignedAgentId: gig.bestAgentId || null } });
                await database_1.prisma.gigEvent.create({ data: { kind: 'PROGRAM_TASK_DONE', role: 'freelancer', gigId: t.gigId, source: 'ai-loop', skill: t.skill, budgetUsd: t.budgetUsd } }).catch(() => { });
            }
        }
    }
    // 2) Drive delivery of the earliest still-OPEN task (accept best bid + release). Bids land via the
    //    freelancer loop; if none yet, this is a no-op and the next advance delivers it.
    const openTask = p.tasks.find((t) => t.status === 'OPEN' && t.gigId);
    if (openTask && openTask.gigId) {
        try {
            const gid = openTask.gigId;
            await gig_service_1.gigService.acceptBestBid(gid);
            const done = await gig_service_1.gigService.completeGig(gid);
            await database_1.prisma.programTask.update({ where: { id: openTask.id }, data: { status: 'COMPLETED' } });
            await database_1.prisma.gigEvent.create({ data: { kind: 'PROGRAM_TASK_DONE', role: 'freelancer', gigId: gid, source: 'ai-loop', skill: openTask.skill, budgetUsd: openTask.budgetUsd, rakeSol: done.rakeSol } }).catch(() => { });
        }
        catch { /* no bids yet, or already delivered — next advance handles it */ }
    }
    // 3) Staff the next PLANNED task (creates its gig on the open board).
    const pending = p.tasks.find((t) => t.status === 'PLANNED');
    let staffed = null;
    if (pending)
        staffed = await staffNextTask(programId);
    const refreshed = await database_1.prisma.program.findUnique({ where: { id: programId }, include: { tasks: true } });
    const done = refreshed.tasks.filter((t) => t.status === 'COMPLETED').length;
    if (done === refreshed.taskCount) {
        await database_1.prisma.program.update({ where: { id: programId }, data: { status: 'COMPLETED' } });
    }
    return { programId, status: refreshed.status, completed: done, total: refreshed.taskCount, staffed: staffed?.staffed || false };
}
/** Run the autonomous loop across every ACTIVE/PLANNED program (used by heartbeat + startLoops). */
async function runAllPrograms() {
    const programs = await database_1.prisma.program.findMany({ where: { status: { in: ['PLANNED', 'ACTIVE'] } } });
    const out = [];
    for (const p of programs) {
        try {
            out.push(await runProgramLoop(p.id));
        }
        catch (e) { /* keep going */ }
    }
    return out;
}
//# sourceMappingURL=program.service.js.map