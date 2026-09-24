"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VCService = void 0;
const database_1 = require("../utils/database");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
class VCService {
    constructor() {
        this.issuerDid = 'did:web:pabandi.local';
    }
    async issueTrustCredential(userId, credentialType) {
        const user = await database_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new Error('User not found');
        const activeKey = await database_1.prisma.issuerKey.findFirst({
            where: { isActive: true },
            orderBy: { rotatedAt: 'desc' }
        });
        if (!activeKey)
            throw new Error('Active issuer key not found');
        const subjectDid = `did:web:pabandi.local:user:${user.id}`;
        const iat = Math.floor(Date.now() / 1000);
        // 1 year expiry
        const exp = iat + (365 * 24 * 60 * 60);
        const finalTier = user.trustScore <= 80 ? 'GUEST' : user.verificationTier;
        const credentialSubject = {
            id: subjectDid,
            trustScore: user.trustScore,
            tier: finalTier,
            commerceScore: user.commerceScore,
            hospitalityScore: user.hospitalityScore
        };
        const payload = {
            iss: this.issuerDid,
            sub: subjectDid,
            nbf: iat,
            exp: exp,
            vc: {
                '@context': [
                    'https://www.w3.org/2018/credentials/v1',
                    'https://purl.imsglobal.org/spec/ob/v3p0/context.json'
                ],
                type: ['VerifiableCredential', 'OpenBadgeCredential'],
                issuer: { id: this.issuerDid },
                issuanceDate: new Date(iat * 1000).toISOString(),
                credentialSubject
            }
        };
        // Note: To produce a valid ES256 JWT, we use the PEM formatted private key
        // with the 'keyid' header set to the kid from the DID Document
        const jwtProof = jsonwebtoken_1.default.sign(payload, activeKey.privateKeyPem, {
            algorithm: 'ES256',
            keyid: `${this.issuerDid}#${activeKey.kid}`
        });
        const vcRecord = await database_1.prisma.verifiableCredential.create({
            data: {
                userId: user.id,
                credentialType,
                jwtProof,
                statusListIndex: Math.floor(Math.random() * 100000), // Placeholder for Phase B
                expiresAt: new Date(exp * 1000),
                subject: credentialSubject,
            }
        });
        return vcRecord;
    }
    async issuePropertyCredential(userId, propertyId, credentialType, claims) {
        const user = await database_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new Error('User not found');
        const activeKey = await database_1.prisma.issuerKey.findFirst({
            where: { isActive: true },
            orderBy: { rotatedAt: 'desc' }
        });
        if (!activeKey)
            throw new Error('Active issuer key not found');
        // Issue to the property itself (Self-Sovereign Property)
        const subjectDid = `did:web:pabandi.local:property:${propertyId}`;
        const iat = Math.floor(Date.now() / 1000);
        const exp = iat + (365 * 24 * 60 * 60);
        const credentialSubject = {
            id: subjectDid,
            ownerDid: `did:web:pabandi.local:user:${user.id}`,
            ...claims
        };
        const payload = {
            iss: this.issuerDid,
            sub: subjectDid,
            nbf: iat,
            exp: exp,
            vc: {
                '@context': [
                    'https://www.w3.org/2018/credentials/v1'
                ],
                type: ['VerifiableCredential', 'PropertyCredential'],
                issuer: { id: this.issuerDid },
                issuanceDate: new Date(iat * 1000).toISOString(),
                credentialSubject
            }
        };
        const jwtProof = jsonwebtoken_1.default.sign(payload, activeKey.privateKeyPem, {
            algorithm: 'ES256',
            keyid: `${this.issuerDid}#${activeKey.kid}`
        });
        const vcRecord = await database_1.prisma.verifiableCredential.create({
            data: {
                userId: user.id, // Store under the owner's userId for DB tracking
                credentialType,
                jwtProof,
                statusListIndex: Math.floor(Math.random() * 100000),
                expiresAt: new Date(exp * 1000),
                subject: credentialSubject,
            }
        });
        return vcRecord;
    }
    async createSelectiveDisclosurePresentation(vcId, userId, disclosedFields, nonce) {
        const vcRecord = await database_1.prisma.verifiableCredential.findUnique({
            where: { id: vcId },
        });
        if (!vcRecord || vcRecord.userId !== userId) {
            throw new Error('Verifiable credential not found or unauthorized');
        }
        const subject = vcRecord.subject || {};
        const sanitizedSubject = disclosedFields.length
            ? Object.fromEntries(Object.entries(subject).filter(([key]) => disclosedFields.includes(key)))
            : subject;
        return {
            vcId: vcRecord.id,
            credentialType: vcRecord.credentialType,
            subject: sanitizedSubject,
            jwtProof: vcRecord.jwtProof,
            issuanceDate: vcRecord.issuedAt,
            expirationDate: vcRecord.expiresAt,
            issuer: 'did:web:pabandi.local',
            nonce: nonce || undefined,
        };
    }
}
exports.VCService = VCService;
//# sourceMappingURL=vc.service.js.map