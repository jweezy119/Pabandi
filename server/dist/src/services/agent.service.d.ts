export declare class AgentService {
    private pythonAgentUrl;
    constructor();
    /**
     * Spawns an autonomous AI economic actor via the Python microservice.
     * @param userPhone The user's phone number
     * @param targetPhone The freelancer/business phone number to negotiate with
     * @param budget The budget in USDC
     * @param goal The negotiation goal
     * @param trustScore The user's Trust Score (determines their leverage)
     */
    spawnAgent(userPhone: string, targetPhone: string, budget: number, goal: string, trustScore: number): Promise<any>;
}
export declare const agentService: AgentService;
//# sourceMappingURL=agent.service.d.ts.map