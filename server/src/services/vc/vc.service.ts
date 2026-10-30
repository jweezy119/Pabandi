import { didService } from './did.service';
import { prisma } from '../../utils/database';

export class VcService {
  async issueJobCompletionCredential(params: {
    holderDid?: string;
    passportId: string;
    projectId: string;
    projectTitle: string;
    amount: number;
    completedAt: Date;
  }) {
    const { holderDid, passportId, projectId, projectTitle, amount, completedAt } = params;

    const credential = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://w3id.org/security/suites/ed25519-2020/v1',
      ],
      id: `urn:uuid:${crypto.randomUUID()}`,
      type: ['VerifiableCredential', 'PabandiJobCompletionCredential'],
      issuer: didService.getDid(),
      issuanceDate: completedAt.toISOString(),
      credentialSubject: {
        id: holderDid || `did:pab:passport:${passportId}`,
        type: 'PabandiProvider',
        jobCompletion: {
          projectId,
          projectTitle,
          amountUsd: amount,
          completedAt: completedAt.toISOString(),
          platform: 'pabandi.com',
        },
        trustEvent: 'job.completed',
      },
      credentialStatus: {
        id: `https://pabandi.onrender.com/api/v1/vc/status/${passportId}`,
        type: 'CredentialStatusList2017',
      },
    };

    const proof = this.createProof(credential);
    return { ...credential, proof };
  }

  async issueTrustPassportCredential(params: {
    holderDid?: string;
    passportId: string;
    handle: string;
    score: number;
    level?: string;
    issuedAt?: Date;
  }) {
    const { holderDid, passportId, handle, score, level, issuedAt = new Date() } = params;

    const credential = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://w3id.org/security/suites/ed25519-2020/v1',
      ],
      id: `urn:uuid:${crypto.randomUUID()}`,
      type: ['VerifiableCredential', 'PabandiTrustPassportCredential'],
      issuer: didService.getDid(),
      issuanceDate: issuedAt.toISOString(),
      credentialSubject: {
        id: holderDid || `did:pab:passport:${passportId}`,
        type: 'PabandiTrustPassport',
        handle,
        score,
        level: level || this.getLevel(score),
        verified: true,
        platform: 'pabandi.com',
        profileUrl: `https://pabandi.com/trust/${handle}`,
      },
    };

    const proof = this.createProof(credential);
    return { ...credential, proof };
  }

  private createProof(credential: any) {
    const data = JSON.stringify({
      id: credential.id,
      issuer: credential.issuer,
      issuanceDate: credential.issuanceDate,
      credentialSubject: credential.credentialSubject,
    });
    const signature = didService.sign(data);
    return {
      type: 'Ed25519Signature2020',
      created: new Date().toISOString(),
      verificationMethod: didService.getKeyId(),
      proofPurpose: 'assertionMethod',
      proofValue: signature,
    };
  }

  async verifyCredential(credential: any) {
    try {
      if (!credential?.proof?.proofValue || !credential?.issuer) {
        return { valid: false, reason: 'Missing proof or issuer' };
      }
      if (credential.issuer !== didService.getDid()) {
        return { valid: false, reason: 'Unknown issuer' };
      }
      const data = JSON.stringify({
        id: credential.id,
        issuer: credential.issuer,
        issuanceDate: credential.issuanceDate,
        credentialSubject: credential.credentialSubject,
      });
      const valid = didService.verify(data, credential.proof.proofValue);
      return {
        valid,
        issuer: credential.issuer,
        type: credential.type,
        subject: credential.credentialSubject,
        reason: valid ? 'Signature verified' : 'Invalid signature',
      };
    } catch (e: any) {
      return { valid: false, reason: e.message };
    }
  }

  private getLevel(score: number) {
    if (score >= 900) return 'Platinum';
    if (score >= 750) return 'Gold';
    if (score >= 600) return 'Silver';
    if (score >= 400) return 'Bronze';
    return 'Starter';
  }
}

export const vcService = new VcService();
