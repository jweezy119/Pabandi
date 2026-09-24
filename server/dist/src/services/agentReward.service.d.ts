export declare function distributeAgentReward(params: {
    agentId: string;
    taskType: string;
    taskValue: number;
    userId?: string;
}): Promise<any>;
export declare function getAgentRewards(agentId: string): Promise<any>;
export declare function getUserRewards(userId: string): Promise<any>;
export declare const agentRewardService: {
    distributeAgentReward: typeof distributeAgentReward;
    getAgentRewards: typeof getAgentRewards;
    getUserRewards: typeof getUserRewards;
    REWARD_RATE: number;
};
//# sourceMappingURL=agentReward.service.d.ts.map