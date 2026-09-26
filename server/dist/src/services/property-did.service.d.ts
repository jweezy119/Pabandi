export declare class PropertyDIDService {
    private vcService;
    constructor();
    registerProperty(landlordId: string, propertyData: {
        address: string;
        city: string;
        state: string;
        postalCode?: string;
        propertyType?: string;
        metadata?: any;
    }): Promise<{
        property: {
            did: string;
            id: string;
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
            createdAt: Date;
            state: string;
            updatedAt: Date;
            isActive: boolean;
            address: string;
            city: string;
            country: string;
            postalCode: string | null;
            propertyType: string;
            landlordId: string;
        };
        titleVC: {
            id: string;
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
            userId: string | null;
            expiresAt: Date;
            credentialType: import(".prisma/client").$Enums.CredentialType;
            isRevoked: boolean;
            jwtProof: string;
            statusListIndex: number;
            issuedAt: Date;
            context: string[];
            subject: import("@prisma/client/runtime/library").JsonValue;
            propertyId: string | null;
        };
    }>;
    issueInspectionCredential(propertyId: string, inspectorId: string, inspectionData: any): Promise<{
        id: string;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        userId: string | null;
        expiresAt: Date;
        credentialType: import(".prisma/client").$Enums.CredentialType;
        isRevoked: boolean;
        jwtProof: string;
        statusListIndex: number;
        issuedAt: Date;
        context: string[];
        subject: import("@prisma/client/runtime/library").JsonValue;
        propertyId: string | null;
    }>;
    issueEnergyRatingCredential(propertyId: string, rating: string, validUntil: string): Promise<{
        id: string;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        userId: string | null;
        expiresAt: Date;
        credentialType: import(".prisma/client").$Enums.CredentialType;
        isRevoked: boolean;
        jwtProof: string;
        statusListIndex: number;
        issuedAt: Date;
        context: string[];
        subject: import("@prisma/client/runtime/library").JsonValue;
        propertyId: string | null;
    }>;
    getPropertyCredentials(propertyId: string): Promise<{
        id: string;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        userId: string | null;
        expiresAt: Date;
        credentialType: import(".prisma/client").$Enums.CredentialType;
        isRevoked: boolean;
        jwtProof: string;
        statusListIndex: number;
        issuedAt: Date;
        context: string[];
        subject: import("@prisma/client/runtime/library").JsonValue;
        propertyId: string | null;
    }[]>;
}
export declare const propertyDIDService: PropertyDIDService;
//# sourceMappingURL=property-did.service.d.ts.map