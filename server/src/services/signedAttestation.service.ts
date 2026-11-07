import crypto from 'node:crypto';
import { TrustBandEvaluation } from './privyTrustScoring';
import { AttributionVector, hashAttributionVector } from './trustGovernance.service';

/**
 * Year-0 Pragmatic Extraction — Piece 2: Lightweight Ed25519 Signed Attestation (Tier 2 without Nitro)
 *
 * Delivers 90% of the auditability value at 1% of the engineering cost:
 *   - Signs (modelHash || inputFeatureHash || predictedScore || trustBand || shapVectorHash || nonce || timestamp)
 *     using an Ed25519 signing key (`node:crypto`).
 *   - Publishes the model version hash and public verification key so any partner,
 *     auditor, or counterparty can verify that a score + explanation tuple was
 *     authentically issued by Pabandi's scoring service and was not tampered with.
 */

export const PUBLISHED_SCORING_MODEL_ID = 'pabandi-trust-heuristics-bayesian-v1.0.0';
export const PUBLISHED_SCORING_MODEL_HASH = crypto
  .createHash('sha256')
  .update(PUBLISHED_SCORING_MODEL_ID)
  .digest('hex');

export interface SignedTrustAttestationPayload {
  version: '1.0';
  modelId: string;
  modelHash: string;
  subjectIdHash: string;
  inputFeatureHash: string;
  predictedScore: number;
  trustBand: 'A' | 'B' | 'C' | 'D';
  shapVectorHash: string;
  nonce: string;
  timestamp: string;
}

export interface SignedTrustAttestation {
  payload: SignedTrustAttestationPayload;
  canonicalTuple: string;
  signature: string;
  publicKeyPem: string;
  keyId: string;
  algorithm: 'Ed25519';
}

interface SignerKeyBundle {
  privateKey: crypto.KeyObject;
  publicKey: crypto.KeyObject;
  publicKeyPem: string;
  keyId: string;
}

let cachedKeyBundle: SignerKeyBundle | null = null;

/**
 * Resolves the Ed25519 signing keypair from env (`PABANDI_ATTESTATION_SEED_HEX` or PEM)
 * or deterministically derives a stable keypair from `JWT_SECRET` / runtime seed.
 */
export function getAttestationKeyBundle(): SignerKeyBundle {
  if (cachedKeyBundle) return cachedKeyBundle;

  const seedSource =
    process.env.PABANDI_ATTESTATION_SEED_HEX ||
    process.env.JWT_SECRET ||
    'pabandi-default-attestation-seed-v1';

  // Derive a 32-byte deterministic seed via SHA-256 and wrap in PKCS#8 Ed25519 DER prefix
  const seed = crypto.createHash('sha256').update(seedSource).digest();
  // RFC 8410 Ed25519 PKCS#8 DER prefix for a 32-byte private key seed:
  const pkcs8Prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
  const pkcs8Der = Buffer.concat([pkcs8Prefix, seed]);

  const privateKey = crypto.createPrivateKey({
    key: pkcs8Der,
    format: 'der',
    type: 'pkcs8',
  });
  const publicKey = crypto.createPublicKey(privateKey);
  const publicKeyPem = publicKey.export({ format: 'pem', type: 'spki' }).toString();
  const keyId = crypto.createHash('sha256').update(publicKeyPem).digest('hex').slice(0, 16);

  cachedKeyBundle = {
    privateKey,
    publicKey,
    publicKeyPem,
    keyId,
  };
  return cachedKeyBundle;
}

/**
 * Canonical string representation of the attestation payload for signing and verification.
 */
export function serializeAttestationTuple(payload: SignedTrustAttestationPayload): string {
  return [
    payload.version,
    payload.modelHash,
    payload.subjectIdHash,
    payload.inputFeatureHash,
    payload.predictedScore.toFixed(2),
    payload.trustBand,
    payload.shapVectorHash,
    payload.nonce,
    payload.timestamp,
  ].join('||');
}

/**
 * Signs a trust evaluation and its SHAP/attribution commitment with Ed25519.
 */
export function createSignedTrustAttestation(params: {
  subjectId: string;
  evaluation: TrustBandEvaluation;
  attribution: AttributionVector;
  nonce?: string;
  timestamp?: string;
}): SignedTrustAttestation {
  const { subjectId, evaluation, attribution } = params;
  const nonce = params.nonce || crypto.randomBytes(16).toString('hex');
  const timestamp = params.timestamp || new Date().toISOString();

  const subjectIdHash = crypto.createHash('sha256').update(subjectId).digest('hex');
  const inputFeatureCanonical = JSON.stringify({
    totalLinks: evaluation.totalLinks,
    nonEmailLinks: evaluation.nonEmailLinks,
    hasPhishingResistant: evaluation.hasPhishingResistant,
    hasOAuth: evaluation.hasOAuth,
    hasMfa: evaluation.hasMfa,
  });
  const inputFeatureHash = crypto.createHash('sha256').update(inputFeatureCanonical).digest('hex');
  const shapVectorHash = hashAttributionVector(attribution);

  const payload: SignedTrustAttestationPayload = {
    version: '1.0',
    modelId: PUBLISHED_SCORING_MODEL_ID,
    modelHash: PUBLISHED_SCORING_MODEL_HASH,
    subjectIdHash,
    inputFeatureHash,
    predictedScore: evaluation.score,
    trustBand: evaluation.band,
    shapVectorHash,
    nonce,
    timestamp,
  };

  const canonicalTuple = serializeAttestationTuple(payload);
  const keyBundle = getAttestationKeyBundle();
  const signatureBuffer = crypto.sign(null, Buffer.from(canonicalTuple, 'utf8'), keyBundle.privateKey);

  return {
    payload,
    canonicalTuple,
    signature: signatureBuffer.toString('base64url'),
    publicKeyPem: keyBundle.publicKeyPem,
    keyId: keyBundle.keyId,
    algorithm: 'Ed25519',
  };
}

/**
 * Verifies an Ed25519 signed trust attestation against the public key and recomputes the tuple.
 */
export function verifySignedTrustAttestation(attestation: SignedTrustAttestation): {
  valid: boolean;
  reason?: string;
} {
  try {
    if (!attestation?.payload || !attestation.signature || !attestation.publicKeyPem) {
      return { valid: false, reason: 'Missing attestation payload, signature, or public key' };
    }

    const expectedTuple = serializeAttestationTuple(attestation.payload);
    if (attestation.canonicalTuple !== expectedTuple) {
      return { valid: false, reason: 'Canonical tuple mismatch with payload fields' };
    }

    const pubKey = crypto.createPublicKey(attestation.publicKeyPem);
    const sigBuffer = Buffer.from(attestation.signature, 'base64url');
    const isVerified = crypto.verify(
      null,
      Buffer.from(expectedTuple, 'utf8'),
      pubKey,
      sigBuffer
    );

    if (!isVerified) {
      return { valid: false, reason: 'Ed25519 signature verification failed' };
    }

    return { valid: true };
  } catch (err: unknown) {
    return {
      valid: false,
      reason: err instanceof Error ? err.message : 'Invalid attestation format',
    };
  }
}
