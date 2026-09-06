import { Router, Response } from 'express';
import { apiKeyAuth, logApiUsage, ApiKeyRequest } from '../middleware/apiKey.middleware';
import { networkService } from '../services/network.service';
import { cryptoService } from '../services/crypto.service';
import { strictApiLimiter } from '../middleware/rateLimit.middleware';
import { logger } from '../utils/logger';
import { discoverAgents } from '../controllers/discovery.controller';

// Lazy-load to avoid runtime crash when bloom-filters is not installed
let _bloomFilterService: any = null;
async function getBloomFilterService() {
  if (_bloomFilterService) return _bloomFilterService;
  try {
    const mod = await import('../services/bloomFilter.service');
    _bloomFilterService = mod.bloomFilterService;
    return _bloomFilterService;
  } catch {
    return null;
  }
}

const router = Router();

/**
 * ── PUBLIC KEY EXCHANGE & FILTER ──────────────────────────────────────────
 * Allows the browser SDK to fetch the daily HMAC salt and the Bloom Filter.
 */
router.get('/public-salt', (req, res) => {
  res.json({ salt: cryptoService.getPublicSalt() });
});

router.get('/bloom-filter', async (req, res) => {
  const svc = await getBloomFilterService();
  if (!svc) return res.status(503).json({ error: 'Bloom filter service unavailable' });
  res.json({ filter: svc.getSerializedFilter() });
});

// Protect all network routes with B2B API Key validation
router.use(apiKeyAuth);
router.use(logApiUsage);

/**
 * POST /api/v1/network/check-hash
 * 
 * Check a hashed identity against the zero-knowledge blocklist.
 * Used by e-commerce checkout flows (e.g. Shopify plugins) to decide whether to hide COD.
 */
router.post('/check-hash', strictApiLimiter, async (req: ApiKeyRequest, res: Response): Promise<any> => {
  try {
    const { hash } = req.body;
    
    if (!hash || typeof hash !== 'string' || hash.length !== 64) {
      return res.status(400).json({
        success: false,
        error: 'Invalid hash. Must be a 64-character SHA256 string.',
      });
    }

    const result = await networkService.checkHash(hash);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('[Network] /check-hash error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/**
 * POST /api/v1/network/report-hash
 * 
 * Report a hashed identity for an incident (e.g., COD_REJECTION).
 */
router.post('/report-hash', async (req: ApiKeyRequest, res: Response): Promise<any> => {
  try {
    const { hash, type, description } = req.body;

    if (!hash || typeof hash !== 'string' || hash.length !== 64) {
      return res.status(400).json({
        success: false,
        error: 'Invalid hash. Must be a 64-character SHA256 string.',
      });
    }

    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'type is required (e.g., COD_REJECTION, RETURN_FRAUD).',
      });
    }

    const apiClientId = req.apiClient?.id;
    const result = await networkService.reportHash(hash, type, description, apiClientId);

    return res.status(201).json(result);
  } catch (error) {
    logger.error('[Network] /report-hash error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/**
 * POST /api/v1/network/discover
 * 
 * Natural-Language Discovery API (GB/Z 185.5 Compliance)
 * Allows external agents to discover merchants/agents on the network using 
 * semantic natural language queries rather than strict identifiers.
 */
router.post('/discover', discoverAgents);

export default router;
