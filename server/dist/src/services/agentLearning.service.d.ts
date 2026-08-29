/**
 * agentLearning.service.ts — outcome-driven learning + iteration for agents.
 *
 * Design:
 *  - After every booking outcome (COMPLETED / NO_SHOW / CANCELLED) we record feedback
 *    when available and update a lightweight bandit over candidate behaviors.
 *  - Behaviors are variants like quote style, response template, pricing modifier.
 *  - Each agent keeps its own `AgentIteration` history; the best-performing variant
 *    is selected for the next cycle.
 *  - No external ML dep — pure Postgres + deterministic scoring so it works offline.
 */
export interface IterationVariant {
    variant: string;
    metrics: {
        bookings: number;
        revenue: number;
        rating: number;
        completionRate: number;
        noShowRate: number;
    };
}
export interface LearningInput {
    agentId: string;
    outcome: 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';
    revenue?: number;
    rating?: number;
    tags?: string[];
    bookingId?: string;
}
export declare function recordLearningEvent(input: LearningInput): Promise<any>;
export declare function getAgentLearningState(agentId: string): Promise<any>;
export declare const agentLearningService: {
    recordLearningEvent: typeof recordLearningEvent;
    getAgentLearningState: typeof getAgentLearningState;
};
//# sourceMappingURL=agentLearning.service.d.ts.map