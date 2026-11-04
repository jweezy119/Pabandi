/**
 * triDirectionalConcierge.routes.ts
 *
 * REST & SSE endpoints for the Tri-Directional Concierge Engine:
 * - A2A: Autonomous machine-to-machine booking negotiations and alert feeds.
 * - A2H: Machine-to-human action alerts & escalation dispatch.
 * - H2A: Human interaction handling (WhatsApp webhook relay, dashboard responses).
 */
import { Router, Request, Response } from 'express';
import { triDirectionalConciergeService, A2AProposalRequest } from '../services/triDirectionalConcierge.service';
import { agentAlertService, AlertEventType } from '../services/agentAlert.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/concierge/a2a/negotiate
 * A2A: External Agent submits a booking proposal with escrow parameters.
 */
router.post('/a2a/negotiate', async (req: Request, res: Response) => {
  try {
    const {
      agentId,
      agentName,
      trustScore,
      businessId,
      customerName,
      customerPhone,
      reservationDate,
      reservationTime,
      numberOfGuests,
      escrowDepositUsdc,
      specialRequests,
      webhookCallbackUrl,
    } = req.body;

    if (!agentId || !businessId || !customerName || !reservationDate || !reservationTime || !numberOfGuests) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: agentId, businessId, customerName, reservationDate, reservationTime, numberOfGuests',
      });
    }

    const payload: A2AProposalRequest = {
      agentId,
      agentName,
      trustScore: typeof trustScore === 'number' ? trustScore : undefined,
      businessId,
      customerName,
      customerPhone,
      reservationDate,
      reservationTime,
      numberOfGuests: parseInt(numberOfGuests, 10),
      escrowDepositUsdc: parseFloat(escrowDepositUsdc || '0'),
      specialRequests,
      webhookCallbackUrl,
    };

    const result = await triDirectionalConciergeService.handleA2ARequest(payload);

    return res.status(result.status === 'AUTO_CONFIRMED' ? 200 : 202).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error(`[TriConcierge A2A] Negotiation error: ${error?.message}`);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to process A2A negotiation',
    });
  }
});

/**
 * POST /api/v1/concierge/a2a/subscribe
 * A2A: External Agent registers webhook callback or alert topic preferences.
 */
router.post('/a2a/subscribe', (req: Request, res: Response) => {
  try {
    const { agentId, targetUrl, events, signingSecret } = req.body;

    if (!agentId) {
      return res.status(400).json({ success: false, error: 'agentId is required' });
    }

    const sub = agentAlertService.subscribe({
      agentId,
      targetUrl,
      events: (events as AlertEventType[]) || [],
      signingSecret,
    });

    return res.json({
      success: true,
      data: {
        subscriptionId: sub.id,
        agentId: sub.agentId,
        events: sub.events,
        signingSecret: sub.signingSecret,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error?.message });
  }
});

/**
 * GET /api/v1/concierge/a2a/feed
 * A2A: Server-Sent Events (SSE) live feed for connected AI Agents.
 */
router.get('/a2a/feed', (req: Request, res: Response) => {
  const agentId = (req.query.agentId as string) || `agent_guest_${Date.now()}`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial handshake
  res.write(`data: ${JSON.stringify({ event: 'connected', agentId, timestamp: new Date().toISOString() })}\n\n`);

  const unregister = agentAlertService.registerSseListener(agentId, (payload) => {
    res.write(`event: ${payload.eventType}\ndata: ${JSON.stringify(payload)}\n\n`);
  });

  // Keep-alive heartbeat every 20s
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unregister();
  });
});

/**
 * GET /api/v1/concierge/a2a/proposals/:proposalId
 * Query proposal status.
 */
router.get('/a2a/proposals/:proposalId', (req: Request, res: Response) => {
  const proposal = triDirectionalConciergeService.getProposal(req.params.proposalId);
  if (!proposal) {
    return res.status(404).json({ success: false, error: 'Proposal not found' });
  }
  return res.json({ success: true, data: proposal });
});

/**
 * POST /api/v1/concierge/h2a/message
 * H2A: Inbound message from a human host or customer.
 * Checks for pending A2H interactive prompts (Accept/Decline/Counter) first.
 */
router.post('/h2a/message', async (req: Request, res: Response) => {
  try {
    const { fromPhone, text } = req.body;
    if (!fromPhone || !text) {
      return res.status(400).json({ success: false, error: 'fromPhone and text required' });
    }

    const outcome = await triDirectionalConciergeService.handleH2AMessage(fromPhone, text);

    return res.json({
      success: true,
      handled: outcome.handled,
      replyText: outcome.replyText,
    });
  } catch (error: any) {
    logger.error(`[TriConcierge H2A] Message error: ${error?.message}`);
    return res.status(500).json({ success: false, error: error?.message });
  }
});

export default router;
