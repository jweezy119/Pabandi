export interface ReputationInput {
    agentId: string;
    outcome: 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';
    bookingId?: string;
    gigId?: string;
    qualityScore?: number;
    metadata?: Record<string, any>;
}
export declare function processReputation(input: ReputationInput): Promise<any>;
export declare const agentReputationService: {
    processReputation: typeof processReputation;
};
//# sourceMappingURL=agentReputation.service.d.ts.map