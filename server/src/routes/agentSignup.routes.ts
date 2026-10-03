import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { writeLimiter } from '../middleware/rateLimit.middleware';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import { isValidEmailShape } from '../utils/validators';

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

router.post('/register', writeLimiter, async (req: Request, res: Response) => {
  try {
    const { agentHandle, ownerEmail, name, capabilities } = req.body as {
      agentHandle: string;
      ownerEmail: string;
      name: string;
      capabilities?: string[];
    };

    if (!agentHandle || !ownerEmail || !name) {
      return res.status(400).json({
        success: false,
        error: 'agentHandle, ownerEmail, and name are required',
      });
    }

    if (!/^[a-z0-9-]{3,30}$/.test(agentHandle)) {
      return res.status(400).json({
        success: false,
        error: 'agentHandle must be 3-30 chars, lowercase alphanumeric + dash',
      });
    }

    if (!isValidEmailShape(ownerEmail)) {
      return res.status(400).json({ success: false, error: 'Invalid email' });
    }

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

    const setupChecklist = [
      {
        step: 1,
        title: 'Verify your identity (PTP)',
        note: 'Metered: debits $PAB from your agent wallet (fail-closed if unfunded). Idempotent via idempotencyKey.',
        curl: `curl -X POST https://pabandi.com/api/v1/agent-passport/issue \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"agentId": "${agent.id}", "capabilities": ${JSON.stringify(capabilities || [])}, "idempotencyKey": "${agentHandle}-first-passport"}'`,
      },
      {
        step: 2,
        title: 'Set your webhook URL',
        note: 'businessId is required unless your API key is already bound to a business.',
        curl: `curl -X POST https://pabandi.com/api/v1/webhooks \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"businessId": "YOUR_BUSINESS_ID", "url": "https://your-agent.com/webhook", "events": ["booking.created", "booking.confirmed"]}'`,
      },
      {
        step: 3,
        title: 'Test a trust lookup',
        curl: `curl https://pabandi.com/api/v1/trust/resolve/user@example.com \\
  -H "Authorization: Bearer ${apiKey}"`,
      },
      {
        step: 4,
        title: 'Create your first booking',
        curl: `curl -X POST https://pabandi.com/api/v1/fluid-booking/book \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"businessId": "YOUR_BUSINESS_ID", "date": "2026-10-15", "time": "10:00", "customerName": "Test User", "customerEmail": "test@example.com"}'`,
      },
      {
        step: 5,
        title: 'Connect via MCP',
        code: `// Add to your MCP client config
{
  "mcpServers": {
    "pabandi": {
      "url": "https://pabandi.com/mcp",
      "headers": {
        "Authorization": "Bearer ${apiKey}"
      }
    }
  }
}`,
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
        setupChecklist,
        mcpEndpoint: 'https://pabandi.com/mcp',
        trustApiEndpoint: 'https://pabandi.com/api/v1/trust/resolve/{identifier}',
        documentation: 'https://pabandi.com/llms.txt',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[AgentSignup] register error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

export default router;
