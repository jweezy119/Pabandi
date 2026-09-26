"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.zkRentService = exports.ZKRentService = void 0;
const database_1 = require("../utils/database");
const vc_service_1 = require("./vc.service");
const client_1 = require("@prisma/client");
const crypto_1 = __importDefault(require("crypto"));
/**
 * Service to handle Proof of Rent (PoR) using simulated Zero-Knowledge Proofs.
 * In production, this would interface with @noir-lang/noir_js or a similar
 * ZK proving system to generate and verify UltraPlonk/Honk proofs.
 */
class ZKRentService {
    constructor() {
        this.vcService = new vc_service_1.VCService();
    }
    /**
     * Records a rent payment and updates consecutive on-time metrics.
     */
    async recordPayment(leaseId, amount, isOnTime) {
        const lease = await database_1.prisma.lease.findUnique({ where: { id: leaseId } });
        if (!lease)
            throw new Error('Lease not found');
        const payment = await database_1.prisma.rentPayment.create({
            data: {
                leaseId,
                amount,
                dueDate: new Date(), // Simplified for demonstration
                isOnTime,
                status: 'COMPLETED'
            }
        });
        if (isOnTime) {
            await database_1.prisma.lease.update({
                where: { id: leaseId },
                data: { consecutiveOnTime: { increment: 1 } }
            });
        }
        else {
            await database_1.prisma.lease.update({
                where: { id: leaseId },
                data: { consecutiveOnTime: 0 }
            });
        }
        return payment;
    }
    /**
     * Generates a ZK Proof of Rent asserting consecutive on-time payments,
     * wrapped in a W3C Verifiable Credential.
     */
    async generateProofOfRentVC(leaseId) {
        const lease = await database_1.prisma.lease.findUnique({
            where: { id: leaseId },
            include: { tenant: true }
        });
        if (!lease)
            throw new Error('Lease not found');
        // Simulate generating a ZK Proof
        // In reality, this would prove: `f(consecutivePayments) -> true` without revealing `leaseId` or `propertyId`
        const simulatedProof = this.simulateNoirProofGeneration({
            consecutiveOnTime: lease.consecutiveOnTime
        });
        // We issue a VC containing the ZK Proof, so the tenant can carry it in their wallet.
        const subjectDid = `did:web:pabandi.local:user:${lease.tenantId}`;
        const vcRecord = await this.vcService.issuePropertyCredential(lease.propertyId, // Even though it's a property credential, it relates to the lease
        client_1.CredentialType.PROOF_OF_RENT, {
            id: subjectDid,
            zkProof: simulatedProof,
            publicInputs: {
                consecutiveOnTime: lease.consecutiveOnTime
            }
        });
        // Update VC to be bound to the User instead of just the Property, 
        // since PropertyCredential bounds to Property. We will do a custom update.
        await database_1.prisma.verifiableCredential.update({
            where: { id: vcRecord.id },
            data: {
                userId: lease.tenantId
            }
        });
        return {
            vcId: vcRecord.id,
            proof: simulatedProof,
            consecutiveOnTime: lease.consecutiveOnTime
        };
    }
    /**
     * Verifies a presented ZK Proof of Rent.
     */
    async verifyProofOfRent(proof, publicInputs) {
        // Simulate verification
        return this.simulateNoirProofVerification(proof, publicInputs);
    }
    simulateNoirProofGeneration(inputs) {
        const data = JSON.stringify(inputs);
        const hash = crypto_1.default.createHash('sha256').update(data).digest('hex');
        // Simulated UltraPlonk proof hex
        return `0x${hash}abcf00000000000000000000000000000000000000000000000000000000`;
    }
    simulateNoirProofVerification(proof, publicInputs) {
        const data = JSON.stringify(publicInputs);
        const expectedHash = crypto_1.default.createHash('sha256').update(data).digest('hex');
        return proof.includes(expectedHash);
    }
}
exports.ZKRentService = ZKRentService;
exports.zkRentService = new ZKRentService();
//# sourceMappingURL=zk-rent.service.js.map