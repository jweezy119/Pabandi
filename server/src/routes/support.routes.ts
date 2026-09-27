import { Router } from 'express';
import { SupportService } from '../services/support.service';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Get tickets for user
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const businessId = req.user!.businessId || req.query.businessId as string;
    
    // For simplicity, if admin/support agent, fetch all
    if (req.user!.role === 'ADMIN') {
      const tickets = await SupportService.listAllTicketsAdmin(businessId);
      return res.json(tickets);
    }

    const tickets = await SupportService.listUserTickets(userId, businessId);
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Create ticket
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const businessId = req.user!.businessId || req.body.businessId;
    const ticket = await SupportService.createTicket(userId, businessId, req.body);
    res.status(201).json(ticket);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// Get ticket details
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const businessId = req.user!.businessId || req.query.businessId as string;
    const ticket = await SupportService.getTicket(req.params.id, businessId);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

// Reply to ticket
router.post('/:id/replies', requireAuth, async (req, res) => {
  try {
    const { body, isInternal } = req.body;
    const reply = await SupportService.replyToTicket(req.params.id, req.user!.id, body, isInternal);
    res.status(201).json(reply);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add reply' });
  }
});

// Resolve ticket
router.post('/:id/resolve', requireAuth, async (req, res) => {
  try {
    const ticket = await SupportService.resolveTicket(req.params.id);
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve ticket' });
  }
});

// Assign ticket
router.post('/:id/assign', requireAuth, async (req, res) => {
  try {
    const ticket = await SupportService.assignTicket(req.params.id, req.body.assignedToId);
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign ticket' });
  }
});

export default router;
