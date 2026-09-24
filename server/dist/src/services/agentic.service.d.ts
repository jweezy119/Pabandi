type AgentAction = {
    type: string;
    payload: any;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    reason: string;
    executed: boolean;
    executedAt?: Date;
    result?: any;
};
type AgentContext = {
    agentId: string;
    agentType: string;
    userId?: string;
    venueId?: string;
    promoterId?: string;
    eventId?: string;
    metadata: any;
};
type Perception = {
    timestamp: Date;
    data: any;
    signals: string[];
    anomalies: string[];
};
export declare const promoterAutonService: {
    perceive(context: AgentContext): Promise<Perception>;
    reason(perception: Perception, context: AgentContext): Promise<AgentAction[]>;
    act(action: AgentAction, context: AgentContext): Promise<AgentAction>;
    executeDepositAdjustment(payload: any): Promise<{
        updatedCount: number;
        multiplier: any;
    }>;
    executePartnershipOffer(payload: any): Promise<{
        offerSent: boolean;
        promoterId: any;
    }>;
    executeGuestListOptimization(payload: any): Promise<{
        paused: boolean;
        eventId: any;
        action?: undefined;
    } | {
        action: any;
        paused?: undefined;
        eventId?: undefined;
    }>;
    executeGuestRecruitment(payload: any): Promise<{
        invitedCount: any;
        targetEvents: any;
    }>;
    executeSmartReminders(payload: any): Promise<{
        remindedCount: any;
        incentive: any;
    }>;
    learn(action: AgentAction, context: AgentContext): Promise<void>;
    runLoop(context: AgentContext): Promise<{
        perception: Perception;
        actions: AgentAction[];
    }>;
};
export declare const venueBrainService: {
    perceive(context: AgentContext): Promise<Perception>;
    reason(perception: Perception, context: AgentContext): Promise<AgentAction[]>;
    act(action: AgentAction, context: AgentContext): Promise<AgentAction>;
    executeCoverChargeChange(payload: any): Promise<{
        updatedCount: number;
        newPrice: any;
    }>;
    executePromoterTierAssignment(payload: any): Promise<{
        assignedCount: any;
        tier: any;
    }>;
    executePromoterRestriction(payload: any): Promise<{
        restrictedCount: any;
        tier: any;
    }>;
    executeInventoryForecast(payload: any): Promise<{
        forecastSent: boolean;
        suggestedItems: any;
    }>;
    executeOverflowActivation(payload: any): Promise<{
        overflowActivated: boolean;
        waitlistOpen: boolean;
    }>;
    learn(action: AgentAction, context: AgentContext): Promise<void>;
    runLoop(context: AgentContext): Promise<{
        perception: Perception;
        actions: AgentAction[];
    }>;
};
export declare const guestFinderService: {
    perceive(context: AgentContext): Promise<Perception>;
    reason(perception: Perception, context: AgentContext): Promise<AgentAction[]>;
    act(action: AgentAction, context: AgentContext): Promise<AgentAction>;
    executeReengagement(payload: any): Promise<{
        messagedCount: any;
        incentive: any;
    }>;
    executeAmbassadorUpgrade(payload: any): Promise<{
        upgradedCount: any;
        perk: any;
    }>;
    executeRiskWarning(payload: any): Promise<{
        warnedVenues: number;
        flaggedCount: any;
    }>;
    learn(action: AgentAction, context: AgentContext): Promise<void>;
    runLoop(context: AgentContext): Promise<{
        perception: Perception;
        actions: AgentAction[];
    }>;
};
export declare const revenueMaxService: {
    perceive(context: AgentContext): Promise<Perception>;
    reason(perception: Perception, context: AgentContext): Promise<AgentAction[]>;
    act(action: AgentAction, context: AgentContext): Promise<AgentAction>;
    executeBottlePriceIncrease(payload: any): Promise<{
        updatedCount: number;
        multiplier: any;
    }>;
    executeUpsellPromotion(payload: any): Promise<{
        campaignCreated: boolean;
        packages: any;
    }>;
    learn(action: AgentAction, context: AgentContext): Promise<void>;
    runLoop(context: AgentContext): Promise<{
        perception: Perception;
        actions: AgentAction[];
    }>;
};
export declare const agentOrchestrator: {
    runAllAgents(context: AgentContext): Promise<{
        results: [PromiseSettledResult<{
            perception: Perception;
            actions: AgentAction[];
        }>, PromiseSettledResult<{
            perception: Perception;
            actions: AgentAction[];
        }>, PromiseSettledResult<{
            perception: Perception;
            actions: AgentAction[];
        }>, PromiseSettledResult<{
            perception: Perception;
            actions: AgentAction[];
        }>];
        conflicts: any[];
    }>;
    detectConflicts(agentResults: any[]): any[];
    runAllVenues(): Promise<{
        venueId: string;
        result: {
            results: [PromiseSettledResult<{
                perception: Perception;
                actions: AgentAction[];
            }>, PromiseSettledResult<{
                perception: Perception;
                actions: AgentAction[];
            }>, PromiseSettledResult<{
                perception: Perception;
                actions: AgentAction[];
            }>, PromiseSettledResult<{
                perception: Perception;
                actions: AgentAction[];
            }>];
            conflicts: any[];
        };
    }[]>;
};
export {};
//# sourceMappingURL=agentic.service.d.ts.map