import { Router, Response } from 'express';
import { apiKeyAuth, logApiUsage, ApiKeyRequest } from '../middleware/apiKey.middleware';
import { networkService } from '../services/network.service';
import { logger } from '../utils/logger';

const router = Router();

// Protect all network routes with B2B API Key validation
router.use(apiKeyAuth);
router.use(logApiUsage);

/**
 * POST /api/v1/network/check-hash
 * 
 * Check a hashed identity against the zero-knowledge blocklist.
 * Used by e-commerce checkout flows (e.g. Shopify plugins) to decide whether to hide COD.
 */
router.post('/check-hash', async (req: ApiKeyRequest, res: Response): Promise<any> => {
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

export default router;
