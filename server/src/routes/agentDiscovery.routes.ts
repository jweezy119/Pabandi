import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { apiLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.get('/.well-known/agent.json', apiLimiter, (_req: Request, res: Response) => {
  return res.json({
    name: 'Pabandi Autonomous Settlement & Payment Network',
    version: '2.0.0',
    description: 'Payment Orchestration and Trust Abstraction Layer for AI Agents, domestic Pakistani rails, and Solana USDC',
    url: 'https://pabandi.com',
    mcpEndpoint: process.env.API_URL ? `${process.env.API_URL}/mcp` : 'https://pabandi.onrender.com/mcp',
    protocols: [
      {
        name: 'x402',
        version: '2.0',
        standard: 'Machine Payments Protocol (MPP)',
        supportedChains: ['solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'],
        assets: ['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'],
      },
      {
        name: 'OpenPayments',
        version: '1.0',
        standard: 'Interledger / Account Servicing Entity compatible',
      },
      {
        name: 'SolanaPay',
        version: '1.0',
        standard: 'solana: transfer specification',
      },
      {
        name: 'Raast',
        standard: 'State Bank of Pakistan ISO 20022 / Mojaloop Interoperable Rail',
      },
    ],
    capabilities: [
      'orchestrated_payments',
      'sharia_compliance_verification',
      'sub_second_escrow',
      'zero_fee_remittance',
      'http_402_micropayments',
      'double_entry_ledger',
    ],
    endpoints: {
      orchestrator: 'https://pabandi.onrender.com/api/v1/payments',
      connectors: 'https://pabandi.onrender.com/api/v1/connectors',
      recommendRail: 'https://pabandi.onrender.com/api/v1/payments/recommend-rail',
      shariaCompliance: 'https://pabandi.onrender.com/api/v1/sharia-compliance',
      agentMicropayments: 'https://pabandi.onrender.com/api/v1/agent/premium-resource',
    },
  });
});

router.get('/.well-known/agent-registry.json', apiLimiter, async (_req: Request, res: Response) => {
  try {
    const agents = await prisma.$queryRaw`
      SELECT id, name, description, capabilities, "trustScore", "completedTasks", rating
      FROM "AgentMarketplace"
      WHERE status = 'active'
      LIMIT 50
    ` as Array<{ id: string; name: string; description: string; capabilities: unknown; trustScore: number; completedTasks: number; rating: number }>;

    return res.json({
      version: '1.0',
      generatedAt: new Date().toISOString(),
      registry: {
        name: 'Pabandi Agent Registry',
        description: 'Discover and connect with AI agents on the Pabandi platform',
        endpoint: process.env.API_URL ? `${process.env.API_URL}/api/v1/agent-comm` : 'https://pabandi.onrender.com/api/v1/agent-comm',
        mcpEndpoint: process.env.API_URL ? `${process.env.API_URL}/mcp` : 'https://pabandi.onrender.com/mcp',
        agents: agents.map(a => ({
          id: a.id,
          name: a.name,
          description: a.description,
          capabilities: a.capabilities,
          trust: { score: a.trustScore, tasksCompleted: a.completedTasks, rating: a.rating },
        })),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, error: message });
  }
});

router.get('/.well-known/agent-status', apiLimiter, async (_req: Request, res: Response) => {
  try {
    const totalBookings = await prisma.booking.count();
    const totalTasks = await prisma.agentTask.count();

    return res.json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      services: {
        booking: { status: 'up', bookingsProcessed: totalBookings },
        crm: { status: 'up', tasksProcessed: totalTasks },
        agentRegistry: { status: 'up' },
        mcp: { status: 'up' },
        trust: { status: 'up' },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ status: 'degraded', error: message });
  }
});

router.get('/.well-known/oauth-authorization-server', apiLimiter, (_req: Request, res: Response) => {
  return res.json({
    issuer: 'https://pabandi.com',
    authorization_endpoint: 'https://pabandi.com/oauth/authorize',
    token_endpoint: 'https://pabandi.com/api/v1/auth/token',
    registration_endpoint: 'https://pabandi.com/api/v1/auth/register',
    scopes_supported: ['read', 'write', 'book', 'crm', 'escrow', 'trust'],
    response_types_supported: ['code', 'token'],
    grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
    code_challenge_methods_supported: ['S256'],
  });
});

router.get('/.well-known/oauth-protected-resource', apiLimiter, (_req: Request, res: Response) => {
  return res.json({
    resource: 'https://pabandi.com',
    authorization_servers: ['https://pabandi.com'],
    bearer_methods_supported: ['header'],
    resource_registration: 'https://pabandi.com/.well-known/oauth-authorization-server',
  });
});

export default router;
