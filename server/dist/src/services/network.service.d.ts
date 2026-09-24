import { DisputeType } from '@prisma/client';
export declare class NetworkService {
    /**
     * Check a hashed phone number against the network.
     */
    checkHash(hash: string): Promise<any>;
    /**
     * Report an incident (like COD Rejection) against a hashed phone number.
     */
    reportHash(hash: string, type: DisputeType, description?: string, apiClientId?: string): Promise<{
        success: boolean;
        incidentId: string;
        newRiskScore: number;
        totalIncidents: number;
    }>;
}
export declare const networkService: NetworkService;
//# sourceMappingURL=network.service.d.ts.map