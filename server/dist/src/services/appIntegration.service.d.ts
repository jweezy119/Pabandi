export interface AppConnectInput {
    appName: string;
    ownerUserId: string;
    scopes: string[];
    webhookUrl?: string;
    redirectUrl?: string;
}
export interface AgentInvokeInput {
    appId: string;
    toolName: string;
    args?: Record<string, any>;
    maxFeePab?: number;
    maxFeeSol?: number;
}
export declare function connectApp(input: AppConnectInput): Promise<any>;
export declare function getAppConfig(appId: string): Promise<any>;
export declare function invokeAgent(input: AgentInvokeInput): Promise<any>;
export declare const appIntegrationService: {
    connectApp: typeof connectApp;
    getAppConfig: typeof getAppConfig;
    invokeAgent: typeof invokeAgent;
};
//# sourceMappingURL=appIntegration.service.d.ts.map