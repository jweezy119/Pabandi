import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../utils/database';
import { CustomError } from './errorHandler';
import { logger } from '../utils/logger';

interface AgentUser {
  id: string;
  email: string;
  role: string;
  agentKeyId?: string;
  agentId?: string;
  scopes?: string[];
  spendLimitUsd?: number | null;
  spendUsedUsd?: number;
}

interface SignedRequest extends Request {
  user?: AgentUser;
  hmacVerified?: boolean;
}

/**
 * Signatures are timestamp-bounded but still replayable inside that window.
 * Keep a bounded, in-process set of accepted signatures; a Redis-backed set can
 * replace this when agents run across multiple instances.
 */
const seenSignatures = new Set<string>();
const MAX_SEEN = 5000;

function markSeen(key: string): boolean {
  if (seenSignatures.has(key)) return false;
  if (seenSignatures.size >= MAX_SEEN) seenSignatures.clear();
  seenSignatures.add(key);
  return true;
}

const REQUIRED_HEADERS = [
  'x-pabandi-timestamp',
  'x-pabandi-signature',
  'x-pabandi-signed-headers',
];

function parseSignedHeaders(header: string): string[] {
  return header.split(';').map(h => h.trim().toLowerCase());
}

function buildCanonicalRequest(req: Request, signedHeaders: string[]): string {
  const method = req.method.toUpperCase();
  const path = req.originalUrl || req.url;
  
  const headerParts = signedHeaders.map(h => {
    const value = req.headers[h];
    return `${h}:${Array.isArray(value) ? value[0] : value || ''}`;
  });
  
  const queryString = Object.entries(req.query)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v[0] : v}`)
    .join('&');
  
  const bodyHash = crypto.createHash('sha256').update(JSON.stringify(req.body || {})).digest('hex');
  
  return [
    method,
    path,
    queryString,
    headerParts.join('\n'),
    '',
    signedHeaders.join(';'),
    bodyHash,
  ].join('\n');
}

export const verifyAgentHmac = async (
  req: SignedRequest,
  res: Response,
  next: NextFunction
) => {
  const agentKeyId = req.user?.agentKeyId;
  if (!agentKeyId) {
    return next();
  }

  const missingHeaders = REQUIRED_HEADERS.filter(h => !req.headers[h]);
  if (missingHeaders.length > 0) {
    logger.warn(`[AgentHmac] Missing headers from agent ${agentKeyId}: ${missingHeaders.join(', ')}`);
    return next(new CustomError(`Missing required headers: ${missingHeaders.join(', ')}`, 401));
  }

  const timestamp = req.headers['x-pabandi-timestamp'] as string;
  const now = Math.floor(Date.now() / 1000);
  const requestTime = parseInt(timestamp, 10);
  
  if (isNaN(requestTime) || Math.abs(now - requestTime) > 300) {
    logger.warn(`[AgentHmac] Invalid or stale timestamp from agent ${agentKeyId}: ${timestamp}`);
    return next(new CustomError('Invalid or expired timestamp (max 5 min skew)', 401));
  }

  const providedSignature = req.headers['x-pabandi-signature'] as string;
  const signedHeadersHeader = req.headers['x-pabandi-signed-headers'] as string;
  const signedHeaders = parseSignedHeaders(signedHeadersHeader);

  const key = await prisma.agentApiKey.findUnique({
    where: { id: agentKeyId },
    select: { keyHash: true, hmacSecret: true, ownerUserId: true },
  });

  if (!key) {
    return next(new CustomError('Agent key not found', 401));
  }

  const canonicalRequest = buildCanonicalRequest(req, signedHeaders);
  const expectedSignature = crypto
    .createHmac('sha256', key.hmacSecret || key.keyHash)
    .update(canonicalRequest)
    .digest('hex');

  // timingSafeEqual throws for unequal lengths; a malformed signature header
  // must be a 401, never a 500.
  const provided = Buffer.from(providedSignature, 'hex');
  const expected = Buffer.from(expectedSignature, 'hex');
  if (
    provided.length !== expected.length ||
    !/^[0-9a-f]+$/i.test(providedSignature) ||
    !crypto.timingSafeEqual(provided, expected)
  ) {
    logger.warn(`[AgentHmac] Invalid signature from agent ${agentKeyId} (ip: ${req.ip})`);
    return next(new CustomError('Invalid request signature', 401));
  }

  if (!markSeen(`${agentKeyId}:${providedSignature}`)) {
    logger.warn(`[AgentHmac] Replayed signature from agent ${agentKeyId}`);
    return next(new CustomError('Request signature has already been used', 401));
  }

  req.hmacVerified = true;
  next();
};

export const optionalAgentHmac = async (
  req: SignedRequest,
  res: Response,
  next: NextFunction
) => {
  const agentKeyId = req.user?.agentKeyId;
  if (!agentKeyId || !REQUIRED_HEADERS.every(h => req.headers[h])) {
    return next();
  }
  return verifyAgentHmac(req, res, next);
};