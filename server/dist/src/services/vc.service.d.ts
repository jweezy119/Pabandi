import { CredentialType } from '@prisma/client';
export declare class VCService {
    private readonly issuerDid;
    issueTrustCredential(userId: string, credentialType: CredentialType): Promise<{
        id: string;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        userId: string;
        expiresAt: Date;
        credentialType: import(".prisma/client").$Enums.CredentialType;
        isRevoked: boolean;
        jwtProof: string;
        statusListIndex: number;
        issuedAt: Date;
        context: string[];
        subject: import("@prisma/client/runtime/library").JsonValue;
    }>;
    issuePropertyCredential(userId: string, propertyId: string, credentialType: CredentialType, claims: any): Promise<{
        id: string;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        userId: string;
        expiresAt: Date;
        credentialType: import(".prisma/client").$Enums.CredentialType;
        isRevoked: boolean;
        jwtProof: string;
        statusListIndex: number;
        issuedAt: Date;
        context: string[];
        subject: import("@prisma/client/runtime/library").JsonValue;
    }>;
    createSelectiveDisclosurePresentation(vcId: string, userId: string, disclosedFields: string[], nonce?: string): Promise<{
        vcId: string;
        credentialType: import(".prisma/client").$Enums.CredentialType;
        subject: Record<string, unknown>;
        jwtProof: string;
        issuanceDate: Date;
        expirationDate: Date;
        issuer: string;
        nonce: string | undefined;
    }>;
}
//# sourceMappingURL=vc.service.d.ts.map