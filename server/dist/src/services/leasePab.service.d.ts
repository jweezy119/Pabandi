export declare function createLeaseWithPabDeposit(params: {
    leaseId: string;
    tenantEmail: string;
    depositAmount: number;
    userId?: string;
}): Promise<any>;
export declare function returnLeaseDeposit(params: {
    leaseId: string;
    userId?: string;
    earlyTermination?: boolean;
}): Promise<any>;
export declare function getLeaseDepositStatus(leaseId: string): Promise<any>;
export declare function processPabPayment(params: {
    rentPaymentId: string;
    tenantEmail: string;
    propertyId: string;
    unitId?: string;
    amountUsdc: number;
    tokenUsed: 'USDC' | 'PAB';
    userId?: string;
}): Promise<any>;
export declare function getPaymentHistory(tenantEmail: string): Promise<any>;
export declare function rewardAgentForTask(params: {
    agentId: string;
    taskType: 'TENANT_SCREENING' | 'LEASE_SIGNING' | 'INSPECTION_COMPLETION' | 'MAINTENANCE_COORDINATION';
    taskDescription: string;
    propertyId?: string;
    unitId?: string;
    tenantEmail?: string;
    rewardAmount: number;
    autoConvert?: boolean;
}): Promise<any>;
export declare function getAgentPabEarnings(agentId: string): Promise<any>;
export declare function setAutoConvertPreference(agentId: string, autoConvert: boolean): Promise<any>;
export declare const leasePabService: {
    createLeaseWithPabDeposit: typeof createLeaseWithPabDeposit;
    returnLeaseDeposit: typeof returnLeaseDeposit;
    getLeaseDepositStatus: typeof getLeaseDepositStatus;
    processPabPayment: typeof processPabPayment;
    getPaymentHistory: typeof getPaymentHistory;
    rewardAgentForTask: typeof rewardAgentForTask;
    getAgentPabEarnings: typeof getAgentPabEarnings;
    setAutoConvertPreference: typeof setAutoConvertPreference;
    PAB_DISCOUNT_RATE: number;
    AUTO_STAKE_RATE: number;
    LEASE_DEPOSIT_APY: number;
};
//# sourceMappingURL=leasePab.service.d.ts.map