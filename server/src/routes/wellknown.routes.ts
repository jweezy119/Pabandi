import { Router, Request, Response } from 'express';
import { ptpEngine } from '../protocol/ptp.spec';

const router = Router();

/**
 * GET /.well-known/ptp.json
 * Protocol discovery document for Pabandi Trust Protocol (PTP).
 * Allows third parties to dynamically discover PTP endpoints and capabilities.
 */
router.get('/ptp.json', (req: Request, res: Response) => {
  // Construct the base URL from the request
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const baseUrl = `${protocol}://${host}`;

  const discoveryDoc = ptpEngine.getDiscoveryDocument(baseUrl);
  
  res.setHeader('Content-Type', 'application/json');
  res.json(discoveryDoc);
});

/**
 * GET /.well-known/ptp-key.pem
 * Public key for offline verification of PTP Attestations.
 */
router.get('/ptp-key.pem', (_req: Request, res: Response) => {
  const pem = ptpEngine.getPublicKeyPEM();
  
  res.setHeader('Content-Type', 'application/x-pem-file');
  res.send(pem);
});

export default router;
