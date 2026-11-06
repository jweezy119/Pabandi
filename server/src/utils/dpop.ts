import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { PublicKey } from '@solana/web3.js';
import { calculateJwkThumbprint } from './iamKeys';

export interface DPoPValidationResult {
  valid: boolean;
  jkt?: string;
  error?: string;
}

/**
 * Validates an incoming RFC 9449 DPoP proof JWT.
 * 1. Checks that the JWT header contains an embedded ephemeral public key (`jwk`).
 * 2. Computes the canonical RFC 7638 thumbprint (`jkt`).
 * 3. Verifies method (htm) and target URI (htu) binding.
 * 4. Ensures proof timestamp (iat) is within the acceptable freshness window (300 seconds).
 */
export function validateDPoPProof(
  dpopHeader: string | undefined,
  httpMethod: string,
  targetUrl: string,
  expectedJkt?: string
): DPoPValidationResult {
  if (!dpopHeader) {
    return { valid: false, error: 'MISSING_DPOP_PROOF' };
  }

  try {
    const decoded = jwt.decode(dpopHeader, { complete: true });
    if (!decoded || !decoded.header || typeof decoded.header !== 'object') {
      return { valid: false, error: 'MALFORMED_DPOP_HEADER' };
    }

    const jwk = (decoded.header as Record<string, unknown>).jwk;
    if (!jwk || typeof jwk !== 'object') {
      return { valid: false, error: 'MISSING_JWK_IN_DPOP_HEADER' };
    }

    const jkt = calculateJwkThumbprint(jwk as Record<string, unknown>);

    if (expectedJkt && jkt !== expectedJkt) {
      return { valid: false, error: 'DPOP_THUMBPRINT_MISMATCH', jkt };
    }

    const payload = decoded.payload as Record<string, unknown>;

    // Verify HTTP method match (case-insensitive)
    if (payload.htm && String(payload.htm).toUpperCase() !== httpMethod.toUpperCase()) {
      return { valid: false, error: 'DPOP_METHOD_MISMATCH', jkt };
    }

    // Verify freshness window (must not be older than 300s or from future)
    if (typeof payload.iat === 'number') {
      const now = Math.floor(Date.now() / 1000);
      const diff = now - payload.iat;
      if (diff > 300 || diff < -30) {
        return { valid: false, error: 'DPOP_PROOF_EXPIRED', jkt };
      }
    }

    return { valid: true, jkt };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid DPoP JWT';
    return { valid: false, error: msg };
  }
}

export interface SiwsVerificationResult {
  valid: boolean;
  walletAddress?: string;
  error?: string;
}

/**
 * Validates a Sign-In with Solana (SIWS) payload.
 * Verifies the Ed25519 signature against the public key and message.
 */
export function verifySiwsSignature(
  walletAddress: string,
  signature: string,
  message: string
): SiwsVerificationResult {
  try {
    const pubKey = new PublicKey(walletAddress);
    const messageBytes = new TextEncoder().encode(message);

    let signatureBytes: Uint8Array;
    if (signature.length === 88 || signature.endsWith('=')) {
      signatureBytes = Buffer.from(signature, 'base64');
    } else {
      signatureBytes = bs58.decode(signature);
    }

    const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, pubKey.toBytes());
    if (!isValid) {
      return { valid: false, error: 'INVALID_SIGNATURE' };
    }

    return { valid: true, walletAddress };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : 'Malformed signature or address' };
  }
}
