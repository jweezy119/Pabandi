/**
 * Pabandi Chainlink External Adapter & Attestation Schemas
 *
 * This service lays the foundation for Decentralized Oracle Network (DON)
 * integration. By structuring verifiable real-world events into standardized
 * schemas, Chainlink nodes can pull this data from Pabandi and push it
 * on-chain, unlocking massive composability with other smart contracts.
 */
export declare class ChainlinkService {
    /**
     * Generates a verifiable attestation payload for a booking check-in.
     * Can be exposed via an API endpoint for a Chainlink External Adapter to consume.
     */
    generateAppointmentCheckInAttestation(reservationId: string, userId: string, locationData: {
        lat: number;
        lng: number;
        radius: number;
    }): {
        schema: string;
        reservationId: string;
        userId: string;
        event: {
            type: string;
            timestamp: string;
            locationVerified: boolean;
            geoHash: string;
        };
        payloadHash: string;
        oracleSignature: string;
    };
    /**
     * Generates an attestation for a Freelance Milestone delivery.
     * Useful for Hyve, DeeLance, or other decentralized freelance platforms.
     */
    generateFreelanceMilestoneAttestation(escrowId: string, milestoneId: string, deliveryIpfsHash: string): {
        schema: string;
        escrowId: string;
        milestoneId: string;
        event: {
            type: string;
            timestamp: string;
            deliveryHash: string;
            clientApproved: boolean;
        };
        payloadHash: string;
        oracleSignature: string;
    };
    /**
     * Generates an attestation for a user's current Trust Score.
     * Useful for Insurance Protocols (Nexus Mutual) to price premiums dynamically on-chain.
     */
    generateTrustScoreAttestation(userId: string, trustScore: number): {
        schema: string;
        userId: string;
        event: {
            type: string;
            timestamp: string;
            score: number;
            tier: string;
        };
        payloadHash: string;
        oracleSignature: string;
    };
}
export declare const chainlinkService: ChainlinkService;
//# sourceMappingURL=chainlink.service.d.ts.map