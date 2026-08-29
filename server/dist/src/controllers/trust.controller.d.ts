import { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
export interface TrustProfileResponseData {
    score: number;
    tier: string;
    uiTier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
    methodology?: string;
    trustVelocity?: unknown;
    attestation?: unknown;
}
export interface TrustAuditTimelineItem {
    date: string;
    pointsDelta: number;
    reason: string;
    severity: string;
    component: string;
    previousScore: number;
    newScore: number;
}
export interface TrustActionRequirementResponseData {
    action: string;
    requiredScore: number;
    requiredStamps: string[];
}
export interface TrustActionAccessResponseData {
    allowed: boolean;
    action: string;
    score: number;
    requiredScore: number;
    missingStamps: string[];
    reason?: string;
}
export interface TrustStampResponse {
    id: string;
    userId: string;
    stampType: string;
    weight: number;
    issuer?: string;
    context?: string;
    attestationHash: string;
    revoked: boolean;
    issuedAt: string;
    effectiveWeight?: number;
    isTrusted?: boolean;
    isExpired?: boolean;
}
export interface GuestEscrowEventResponse {
    success: boolean;
    recorded: boolean;
    eventType: string;
}
export declare const getMyTrustProfile: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getMyTrustAuditTimeline: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getActionRequirements: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const checkMyActionAccess: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getMyTrustStamps: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const createMyTrustStamp: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const recordGuestEscrowEvent: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const streamTrustPulse: (req: any, res: Response) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=trust.controller.d.ts.map