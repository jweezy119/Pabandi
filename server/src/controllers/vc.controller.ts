import { Request, Response } from 'express';
import { prisma } from '../utils/database';
import jwt from 'jsonwebtoken';
import { VCService } from '../services/vc.service';
import { CredentialType } from '@prisma/client';
import crypto from 'crypto';

const VC_CONTEXTS = [
  'https://www.w3.org/2018/credentials/v1',
  'https://purl.imsglobal.org/spec/ob/v3p0/context.json',
];

const STATUS_LIST_CONTEXTS = [
  'https://www.w3.org/2018/credentials/v1',
  'https://w3id.org/vc/status-list/2021/v1',
];

const ISSUER_DID = 'did:web:pabandi.local';

function buildStatusListBitstring(indices: number[], totalBits = 131072): string {
  const byteLength = Math.ceil(totalBits / 8);
  const buffer = Buffer.alloc(byteLength, 0xff);

  for (const index of indices) {
    if (index >= 0 && index < totalBits) {
      const byteIndex = Math.floor(index / 8);
      const bitIndex = 7 - (index % 8);
      buffer[byteIndex] &= ~(1 << bitIndex);
    }
  }

  return buffer.toString('base64');
}

function decodeRevocationIndicesFromBitstring(encodedList: string, totalBits = 131072): number[] {
  try {
    const buffer = Buffer.from(encodedList, 'base64');
    const indices: number[] = [];

    for (let byteIndex = 0; byteIndex < buffer.length && byteIndex * 8 < totalBits; byteIndex++) {
      const byte = buffer[byteIndex];
      for (let bitIndex = 0; bitIndex < 8; bitIndex++) {
        const bitPosition = byteIndex * 8 + bitIndex;
        if (bitPosition >= totalBits) break;
        const isSet = (byte >> (7 - bitIndex)) & 1;
        if (!isSet) indices.push(bitPosition);
      }
    }

    return indices;
  } catch {
    return [];
  }
}

const vcService = new VCService();

export const getDidDocument = async (req: Request, res: Response) => {
  try {
    const keys = await prisma.issuerKey.findMany({
      orderBy: { rotatedAt: 'desc' },
      take: 5,
    });

    if (keys.length === 0) {
      return res.status(404).json({ error: 'Issuer keys not found' });
    }

    const verificationMethods = keys.map((k) => ({
      id: `${ISSUER_DID}#${k.kid}`,
      type: 'JsonWebKey',
      controller: ISSUER_DID,
      publicKeyJwk: k.publicKeyJwk as any,
    }));

    const didDocument = {
      '@context': 'https://www.w3.org/ns/did/v1',
      id: ISSUER_DID,
      verificationMethod: verificationMethods,
      authentication: verificationMethods.map((vm) => vm.id),
      assertionMethod: verificationMethods.map((vm) => vm.id),
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
      orderBy: { issuedAt: 'desc' },
    });
    res.json(credentials);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const revokeCredential = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.verifiableCredential.update({
      where: { id },
      data: { isRevoked: true },
    });
    res.json({ success: true, message: 'Credential revoked' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const verifyCredential = async (req: Request, res: Response) => {
  try {
    const { jwtProof, nonce, vpNonce } = req.body;
    if (!jwtProof) {
      return res.status(400).json({ error: 'jwtProof is required', valid: false });
    }

    if (nonce && vpNonce !== nonce) {
      return res.status(400).json({ error: 'Nonce mismatch. Possible replay attack.', valid: false });
    }

    const decodedToken = jwt.decode(jwtProof, { complete: true });
    if (!decodedToken) {
      return res.status(400).json({ error: 'Invalid JWT', valid: false });
    }

    const kid = decodedToken.header.kid?.split('#')[1] || 'key-1';
    const issuerKey = await prisma.issuerKey.findUnique({ where: { kid } });
    if (!issuerKey) {
      return res.status(400).json({ error: 'Issuer key not found for verification', valid: false });
    }

    const issuerKeyRaw = issuerKey as any;
    const privateKey = String(issuerKeyRaw.privateKeyPem || issuerKeyRaw.publicKeyJwk || '');
    if (!privateKey) {
      return res.status(400).json({ error: 'Issuer key material missing', valid: false });
    }

    const verified = jwt.verify(jwtProof, privateKey, {
      algorithms: ['ES256'],
    }) as any;

    const credential = await prisma.verifiableCredential.findFirst({
      where: { jwtProof },
    });

    const statusListIndices = credential?.isRevoked
      ? [credential.statusListIndex]
      : [];
    const statusList = buildStatusListBitstring(statusListIndices);

    const revocationIndices = decodeRevocationIndicesFromBitstring(statusList);

    res.json({
      success: true,
      valid: true,
      payload: verified,
      status: {
        valid: !credential?.isRevoked,
        isRevoked: !!credential?.isRevoked,
        statusListIndex: credential?.statusListIndex ?? null,
        statusList,
        revocationIndices,
        statusPurpose: 'revocation',
        statusListId: `https://pabandi.local/api/v1/passport/vc/status-list/${credential?.statusListIndex ?? 0}`,
      },
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message, valid: false });
  }
};

export const getStatusList = async (req: Request, res: Response) => {
  try {
    const { index } = req.params;
    const listIndex = parseInt(index, 10);

    const revokedCount = await prisma.verifiableCredential.count({
      where: { isRevoked: true, statusListIndex: listIndex },
    });

    const credential = await prisma.verifiableCredential.findFirst({
      where: { statusListIndex: listIndex, isRevoked: true },
      orderBy: { issuedAt: 'desc' },
    });

    const statusList = revokedCount > 0 && credential
      ? buildStatusListBitstring([credential.statusListIndex])
      : buildStatusListBitstring([]);

    const statusListCredential = {
      '@context': STATUS_LIST_CONTEXTS,
      id: `https://pabandi.local/api/v1/passport/vc/status-list/${listIndex}`,
      type: ['VerifiableCredential', 'StatusList2021Credential'],
      issuer: ISSUER_DID,
      issued: new Date().toISOString(),
      credentialSubject: {
        id: `https://pabandi.local/api/v1/passport/vc/status-list/${listIndex}#list`,
        type: 'StatusList2021',
        statusPurpose: 'revocation',
        encodedList: statusList,
      },
    };

    res.json(statusListCredential);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createPresentation = async (req: Request, res: Response) => {
  try {
    const { vcId, disclosedFields } = req.body;
    const userId = req.user!.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const result = await vcService.createSelectiveDisclosurePresentation(vcId, userId, disclosedFields || []);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
