import { prisma } from '../utils/database';
import jwt from 'jsonwebtoken';
import { CredentialType } from '@prisma/client';

export class VCService {
  private readonly issuerDid = 'did:web:pabandi.local';

  async issueTrustCredential(userId: string, credentialType: CredentialType) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const activeKey = await prisma.issuerKey.findFirst({
      where: { isActive: true },
      orderBy: { rotatedAt: 'desc' }
    });

    if (!activeKey) throw new Error('Active issuer key not found');

    const subjectDid = `did:web:pabandi.local:user:${user.id}`;
    const iat = Math.floor(Date.now() / 1000);
    // 1 year expiry
    const exp = iat + (365 * 24 * 60 * 60);

    const credentialSubject = {
      id: subjectDid,
      trustScore: user.trustScore,
      tier: user.verificationTier,
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
    const jwtProof = jwt.sign(payload, activeKey.privateKeyPem, {
      algorithm: 'ES256',
      keyid: `${this.issuerDid}#${activeKey.kid}`
    });

    const vcRecord = await prisma.verifiableCredential.create({
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

  async createSelectiveDisclosurePresentation(vcId: string, userId: string, disclosedFields: string[]) {
    const vcRecord = await prisma.verifiableCredential.findUnique({
      where: { id: vcId },
    });

    if (!vcRecord || vcRecord.userId !== userId) {
      throw new Error('Verifiable credential not found or unauthorized');
    }

    const subject = (vcRecord.subject as Record<string, unknown>) || {};
    const sanitizedSubject = disclosedFields.length
      ? Object.fromEntries(
          Object.entries(subject).filter(([key]) => disclosedFields.includes(key)),
        )
      : subject;

    return {
      vcId: vcRecord.id,
      credentialType: vcRecord.credentialType,
      subject: sanitizedSubject,
      jwtProof: vcRecord.jwtProof,
      issuanceDate: vcRecord.issuedAt,
      expirationDate: vcRecord.expiresAt,
      issuer: 'did:web:pabandi.local',
    };
  }
}
