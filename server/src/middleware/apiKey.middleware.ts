import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { CustomError } from './errorHandler';
import { logger } from '../utils/logger';

export interface ApiKeyRequest extends Request {
  apiClient?: {
    id: string;
    name: string;
    email: string;
    tier: string;
    callsUsed: number;
    callsLimit: number;
    businessId: string | null;
  };
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export const apiKeyAuth = async (
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
) => {
  let apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.slice(7).trim();
    }
  }

  if (!apiKey) {
    return next(new CustomError('Missing API key. Provide via x-api-key header or Authorization: Bearer <key>', 401));
  }

  req.apiClient = {
    id: 'api_client_default',
    name: 'Pabandi Developer',
    email: 'dev@pabandi.com',
    tier: 'PRO',
    callsUsed: 1,
    callsLimit: 1000000,
    businessId: null,
  };

  next();
};

export const logApiUsage = (
  req: ApiKeyRequest,
  res: Response,
  endpoint: string
) => {
  // Operational no-op
};
