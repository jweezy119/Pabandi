import { Request, Response } from 'express';
import { prisma } from '../utils/database';
import { VCService } from '../services/vc.service';

const vcService = new VCService();

export const getDidDocument = async (req: Request, res: Response) => {
  try {
    const keys = await prisma.issuerKey.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5 // Keep recent rotated keys alive in DID doc for validation
    });

    if (keys.length === 0) {
      return res.status(404).json({ error: 'Issuer keys not found' });
    }

    // Pabandi's Decentralized Identifier
    const did = 'did:web:pabandi.local';
    
    const verificationMethods = keys.map(k => ({
      id: `${did}#${k.kid}`,
      type: 'JsonWebKey',
      controller: did,
      publicKeyJwk: k.publicKeyJwk as any
    }));

    const didDocument = {
      '@context': 'https://www.w3.org/ns/did/v1',
      id: did,
      verificationMethod: verificationMethods,
      authentication: verificationMethods.map(vm => vm.id),
      assertionMethod: verificationMethods.map(vm => vm.id)
    };

    res.json(didDocument);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const issueCredential = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { credentialType } = req.body;

    const credential = await vcService.issueTrustCredential(userId, credentialType);
    res.json(credential);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const listCredentials = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const credentials = await prisma.verifiableCredential.findMany({
      where: { userId },
      orderBy: { issuedAt: 'desc' }
    });
    res.json(credentials);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const revokeCredential = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // In production, ensure only admins or the owner can revoke
    await prisma.verifiableCredential.update({
      where: { id },
      data: { isRevoked: true }
    });
    res.json({ success: true, message: 'Credential revoked' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const verifyCredential = async (req: Request, res: Response) => {
  try {
    const { jwtProof } = req.body;
    if (!jwtProof) {
      return res.status(400).json({ error: 'jwtProof is required' });
    }

    // Attempt to decode the JWT header to find the kid (Key ID)
    const jwt = require('jsonwebtoken');
    const decodedToken = jwt.decode(jwtProof, { complete: true });
    if (!decodedToken) {
      return res.status(400).json({ error: 'Invalid JWT' });
    }

    const kid = decodedToken.header.kid?.split('#')[1] || 'key-1';

    const issuerKey = await prisma.issuerKey.findUnique({ where: { kid } });
    if (!issuerKey) {
      return res.status(400).json({ error: 'Issuer key not found for verification' });
    }

    // In a real app we'd construct the PEM from the JWK, but since we stored the PEM
    // we can use it to verify (technically a verifier would use the public key)
    // To properly simulate external verification, we use the public key, but for simplicity
    // here we just use jwt.verify which can take the private/public key depending on alg
    
    // Check if revoked in DB (mimicking the StatusList check)
    const vcRecord = await prisma.verifiableCredential.findFirst({
      where: { jwtProof }
    });

    if (vcRecord && vcRecord.isRevoked) {
      return res.status(400).json({ error: 'Credential has been revoked', isRevoked: true });
    }

    const verified = jwt.verify(jwtProof, issuerKey.privateKeyPem, { algorithms: ['ES256'] });

    res.json({ success: true, valid: true, payload: verified });
  } catch (error: any) {
    res.status(400).json({ error: error.message, valid: false });
  }
};

export const getStatusList = async (req: Request, res: Response) => {
  try {
    const { index } = req.params;
    // A real StatusList2021 builds a gzip-compressed bitstring. 
    // For MVP, we return a mock payload per W3C spec indicating active status
    const listIndex = parseInt(index, 10);
    
    const did = 'did:web:pabandi.local';
    
    const statusList = {
      "@context": [
        "https://www.w3.org/2018/credentials/v1",
        "https://w3id.org/vc/status-list/2021/v1"
      ],
      "id": `https://pabandi.local/api/v1/passport/vc/status-list/${listIndex}`,
      "type": ["VerifiableCredential", "StatusList2021Credential"],
      "issuer": did,
      "issued": new Date().toISOString(),
      "credentialSubject": {
        "id": `https://pabandi.local/api/v1/passport/vc/status-list/${listIndex}#list`,
        "type": "StatusList2021",
        "statusPurpose": "revocation",
        "encodedList": "eA3..." // In prod: Gzip deflated, base64url encoded bitstring
      }
    };
    
    res.json(statusList);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createPresentation = async (req: Request, res: Response) => {
  try {
    const { vcId, disclosedFields } = req.body;
    // @ts-ignore - req.user is populated by auth middleware
    const userId = req.user?.userId || req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { VCService } = require('../services/vc.service');
    const vcSvc = new VCService();
    const result = await vcSvc.createSelectiveDisclosurePresentation(vcId, userId, disclosedFields || []);

    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
