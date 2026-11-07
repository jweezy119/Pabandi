import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { writeLimiter } from '../middleware/rateLimit.middleware';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import { validateBody } from '../middleware/validateZod';
import { agentRegistrationSchema } from '../schemas/agentic.schemas';
import type { AgentRegistration } from '../schemas/agentic.schemas';
import { authenticate } from '../middleware/auth.middleware';
import { grantStarterMcpCredit } from '../services/mcpMeter.service';
import { AGENT_API_BASE, AGENT_MCP_URL } from '../mcp/agentEndpoint';

const router = Router();

// Starter $PAB granted to a freshly signed-up agent principal. 0 = the agent must
// be funded before it can pay for metered operations (fail-closed, by design).
const AGENT_SIGNUP_PAB_GRANT = Number(process.env.AGENT_SIGNUP_PAB_GRANT || 0);

async function provisionAgentPrincipal(
  ownerEmail: string,
  displayName: string,
  agentHandle: string
): Promise<{ userId: string; created: boolean }> {
  const existing = await prisma.user.findUnique({
    where: { email: ownerEmail },
    select: { id: true },
  });

  const user = existing ?? await prisma.user.create({
    data: {
      email: ownerEmail,
      // No interactive login for agent-owned accounts; the API key is the credential.
      passwordHash: crypto.randomBytes(32).toString('hex'),
      firstName: displayName.split(' ')[0] || agentHandle,
      lastName: displayName.split(' ').slice(1).join(' ') || 'Agent',
      companyName: agentHandle,
    } as any,
    select: { id: true },
  });

  const agentRow = await prisma.web3Agent.findUnique({
    where: { profileId: user.id },
    select: { id: true },
  });

  if (!agentRow) {
    await prisma.web3Agent.create({
      data: {
        profileId: user.id,
        walletAddress: `pab_${user.id}`,
        encryptedPrivateKey: 'pabandi-agent',
        category: 'solo',
        balancePab: AGENT_SIGNUP_PAB_GRANT,
      } as any,
    });
  }

  return { userId: user.id, created: !existing };
}

router.post('/register', writeLimiter, validateBody(agentRegistrationSchema), async (req: Request, res: Response) => {
  try {
    // Shape is guaranteed by agentRegistrationSchema. The middleware has
    // already replaced req.body with the parsed output, so these are typed
    // values -- not the untrusted strings the hand-rolled checks used to cast.
    const { agentHandle, ownerEmail, name, capabilities } = req.body as AgentRegistration;

    const existing = await prisma.$queryRaw`
      SELECT id FROM "AgentMarketplace"
      WHERE name = ${agentHandle} OR "ownerEmail" = ${ownerEmail}
      LIMIT 1
    ` as Array<{ id: string }>;

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Agent with this handle or email already exists',
      });
    }

    const apiKey = `pab_${crypto.randomBytes(24).toString('hex')}`;
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    await prisma.$executeRaw`
      INSERT INTO "AgentMarketplace" (id, name, "ownerEmail", "displayName", description, capabilities, status, "trustScore", "completedTasks", rating, "apiKeyHash", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${agentHandle}, ${ownerEmail}, ${name}, ${`AI agent: ${name}`}, ${JSON.stringify(capabilities || [])}::jsonb, 'active', 50, 0, 0, ${apiKeyHash}, NOW(), NOW())
    `;

    const agent = { id: agentHandle, name: agentHandle, displayName: name };

    // Provision the principal stack. Without a User + Web3Agent the agent has no
    // trust score and no wallet, so every gated call (passport issue, escrow,
    // metered MCP tools) would fail with "not found" on a fresh signup.
    const owner = await provisionAgentPrincipal(ownerEmail, name, agentHandle);
    const starterCreditUsdc = await grantStarterMcpCredit(apiKeyHash, 0.25);

    // Register onchain identity (optional, gasless for agent)
    try {
      const { agentIdentityService } = await import('../services/agent-identity.service');
      const passport = await prisma.trustPassport.findFirst({
        where: { handle: agentHandle },
      });
      if (passport) {
        await agentIdentityService.registerAgentOnChain(passport.id);
      }
    } catch (e) {
      logger.warn('[AgentSignup] Onchain registration skipped:', e);
    }

    const mcpConfig = {
      mcpServers: {
        pabandi: {
          url: AGENT_MCP_URL,
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
      },
    };

    const setupChecklist = [
      {
        step: 1,
        title: 'Verify your identity (PTP)',
        note: 'Metered: debits $PAB from your agent wallet (fail-closed if unfunded). Idempotent via idempotencyKey.',
        curl: `curl -X POST ${AGENT_API_BASE}/api/v1/agent-passport/issue \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"agentId": "${agent.id}", "capabilities": ${JSON.stringify(capabilities || [])}, "idempotencyKey": "${agentHandle}-first-passport"}'`,
      },
      {
        step: 2,
        title: 'Search Chicago High-Ticket Contractors via MCP',
        note: 'Free discovery call over Streamable HTTP MCP.',
        curl: `curl -X POST ${AGENT_MCP_URL} \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"pabandi_search_services","arguments":{"city":"Chicago","category":"ROOFING"}}}'`,
      },
      {
        step: 3,
        title: 'Test a trust lookup',
        curl: `curl ${AGENT_API_BASE}/api/v1/trust/resolve/user@example.com \\
  -H "Authorization: Bearer ${apiKey}"`,
      },
      {
        step: 4,
        title: 'Create your first booking',
        curl: `curl -X POST ${AGENT_API_BASE}/api/v1/fluid-booking/book \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"businessId": "matthews-roofing-chicago", "date": "2026-11-15", "time": "10:00", "customerName": "Test User", "customerEmail": "test@example.com"}'`,
      },
      {
        step: 5,
        title: 'Connect via MCP (Claude Desktop / Cursor / Windsurf)',
        code: JSON.stringify(mcpConfig, null, 2),
      },
    ];

    return res.json({
      success: true,
      data: {
        agentId: agent.id,
        name: agent.name,
        displayName: agent.displayName,
        apiKey,
        ownerUserId: owner.userId,
        ownerAccountCreated: owner.created,
        pabGranted: AGENT_SIGNUP_PAB_GRANT,
        starterCreditUsdc,
        mcpConfig,
        setupChecklist,
        mcpEndpoint: AGENT_MCP_URL,
        trustApiEndpoint: `${AGENT_API_BASE}/api/v1/trust/resolve/{identifier}`,
        documentation: 'https://pabandi.com/llms.txt',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[AgentSignup] register error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

// Generate M2M API key for authenticated user
router.post('/generate-key', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const apiKey = `pab_m2m_${crypto.randomBytes(32).toString('hex')}`;
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    // Store in ApiClient for authenticated user
    const client = await prisma.apiClient.create({
      data: {
        name: `M2M Agent Key - ${(req as any).user?.email || userId}`,
        email: (req as any).user?.email || `agent-${userId}@pabandi.local`,
        apiKey: apiKey,
        apiKeyHash,
        tier: 'STARTER',
        callsLimit: 10000,
        isActive: true,
      },
    });

    const starterCreditUsdc = await grantStarterMcpCredit(apiKeyHash, 0.25);
    const mcpConfig = {
      mcpServers: {
        pabandi: {
          url: AGENT_MCP_URL,
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
      },
    };

    return res.json({
      success: true,
      data: {
        apiKey,
        id: client.id,
        name: client.name,
        createdAt: client.createdAt,
        starterCreditUsdc,
        mcpEndpoint: AGENT_MCP_URL,
        mcpConfig,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[AgentSignup] generate-key error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

export default router;
