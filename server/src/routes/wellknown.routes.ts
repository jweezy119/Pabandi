import { Router, Request, Response } from 'express';
import { ptpEngine } from '../protocol/ptp.spec';
import path from 'path';
import fs from 'fs';

const router = Router();

/**
 * GET /.well-known/ptp.json
 * Protocol discovery document for Pabandi Trust Protocol (PTP).
 * Allows third parties to dynamically discover PTP endpoints and capabilities.
 */
router.get('/ptp.json', (req: Request, res: Response) => {
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

/**
 * GET /.well-known/agents.json
 * Agent discovery document for PabandiOS.
 */
router.get('/agents.json', (req: Request, res: Response) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const baseUrl = `${protocol}://${host}`;

  const agentsDoc = {
    name: 'PabandiOS',
    version: '1.0.0',
    description: 'The trust operating system for service businesses — bookings, freight, property, CRM, and finance with AI-powered reliability scoring and Solana escrow.',
    base_url: baseUrl,
    mcp_endpoint: `${baseUrl}/mcp`,
    openapi_spec: `${baseUrl}/openapi.yaml`,
    capabilities: [
      'booking.create',
      'booking.status',
      'freight.quote',
      'property.list',
      'property.verify',
      'crm.lead',
      'crm.contact',
      'ledger.invoice',
      'ledger.cashflow',
      'escrow.initiate',
      'escrow.release',
      'trust.verify',
      'trust.score',
      'passport.issue',
      'passport.verify'
    ],
    payment: {
      schemes: ['x402', 'solana-usdc'],
      network: 'solana',
      currency: 'USDC'
    },
    authorization: {
      schemes: ['ap2', 'bearer', 'ptp'],
      mandates: ['intent', 'cart', 'payment']
    },
    contact: 'agents@pabandi.com',
    license: 'MIT'
  };

  res.setHeader('Content-Type', 'application/json');
  res.json(agentsDoc);
});

export default router;
