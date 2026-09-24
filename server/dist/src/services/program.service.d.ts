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
    durationWeeks?: number;
    skillMix?: string[];
    intensity?: number;
    clientWallet?: string;
    referralCode?: string;
}
export declare function createProgram(input: ProgramInput): Promise<any>;
/** Staff the next PLANNED task in a program: create its gig on the open board (milestone escrow). */
export declare function staffNextTask(programId: string): Promise<any>;
export declare function programStatus(programId: string): Promise<any>;
export declare const programService: {
    createProgram: typeof createProgram;
    staffNextTask: typeof staffNextTask;
    programStatus: typeof programStatus;
    runProgramLoop: typeof runProgramLoop;
    runAllPrograms: typeof runAllPrograms;
    listPrograms: typeof listPrograms;
};
/** List all programs with per-phase breakdown + live progress (for the public UI). */
export declare function listPrograms(): Promise<any[]>;
/**
 * Autonomous program loop: advance ONE program toward completion.
 *  - If the current OPEN task's gig is delivered (COMPLETED), mark the task done and staff the next.
 *  - If no task is OPEN, staff the next PLANNED task (creates its gig on the board).
 *  - When all tasks are COMPLETED, mark the program COMPLETED.
 * This lets a whole year-long, multi-task engagement run itself through the autonomous economy.
 */
export declare function runProgramLoop(programId: string): Promise<any>;
/** Run the autonomous loop across every ACTIVE/PLANNED program (used by heartbeat + startLoops). */
export declare function runAllPrograms(): Promise<any[]>;
//# sourceMappingURL=program.service.d.ts.map