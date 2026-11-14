import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { optionalAgentAuth } from '../middleware/agentAuth.middleware';
import { handleRpc } from '../mcp/pabandiMcpServer';

const router = Router();

router.post('/', optionalAgentAuth, async (req: AuthRequest, res: Response) => {
  const result = await handleRpc(req.body, req.user);
  if (result === null) {
    res.status(202).end();
    return;
  }
  res.setHeader('MCP-Protocol-Version', '2025-06-18');
  res.json(result);
});

router.get('/', (_req: AuthRequest, res: Response) => {
  res.setHeader('Allow', 'POST');
  res.status(405).json({ error: 'Method not allowed. Use POST with JSON-RPC.' });
});

export default router;
