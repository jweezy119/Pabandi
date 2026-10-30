import crypto from 'crypto';

const DID_WEB = 'did:web:pabandi.com';

export class DidService {
  private publicKeyPem: string;
  private privateKeyPem: string;
  private keyId: string;

  constructor() {
    // Use existing PTP keys if available, otherwise generate ephemeral for dev
    this.privateKeyPem = process.env.PTP_SIGNING_SECRET || this.generateKeyPair().privateKey;
    this.publicKeyPem = process.env.PTP_PUBLIC_KEY || this.generateKeyPair().publicKey;
    this.keyId = `${DID_WEB}#key-1`;
  }

  private generateKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    return {
      publicKey: publicKey.export({ type: 'spki', format: 'pem' }) as string,
      privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
    };
  }

  getDid() {
    return DID_WEB;
  }

  getDidDocument() {
    return {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/ed25519-2020/v1',
      ],
      id: DID_WEB,
      alsoKnownAs: ['https://pabandi.com'],
      verificationMethod: [
        {
          id: this.keyId,
          type: 'Ed25519VerificationKey2020',
          controller: DID_WEB,
          publicKeyPem: this.publicKeyPem,
        },
      ],
      authentication: [this.keyId],
      assertionMethod: [this.keyId],
      service: [
        {
          id: `${DID_WEB}#vc-issuer`,
          type: 'VerifiableCredentialIssuer',
          serviceEndpoint: 'https://pabandi.onrender.com/api/v1/vc/issue',
        },
        {
          id: `${DID_WEB}#vc-verifier`,
          type: 'VerifiableCredentialVerifier',
          serviceEndpoint: 'https://pabandi.onrender.com/api/v1/vc/verify',
        },
      ],
    };
  }

  getKeyId() {
    return this.keyId;
  }

  sign(data: string): string {
    const sign = crypto.createSign('SHA256');
    sign.update(data);
    sign.end();
    return sign.sign(this.privateKeyPem, 'base64');
  }

  verify(data: string, signature: string): boolean {
    try {
      const verify = crypto.createVerify('SHA256');
      verify.update(data);
      verify.end();
      return verify.verify(this.publicKeyPem, signature, 'base64');
    } catch {
      return false;
    }
  }
}

export const didService = new DidService();
