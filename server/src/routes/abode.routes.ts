import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { abodeRevenue, abodeTenant, abodeLease, abodeMaintenance, abodeCommunication } from '../services/abode.service';

const router = Router();

// Revenue
router.get('/revenue', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const period = (req.query.period as 'week' | 'month' | 'year') || 'month';
    const summary = await abodeRevenue.getRevenueSummary(userId, period);
    res.json({ success: true, data: summary });
  } catch (e: any) { res.status(500).json({ error: 'Failed to get revenue summary' }); }
});

router.get('/revenue/collection-rate', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const rate = await abodeRevenue.getRentCollectionRate(userId);
    res.json({ success: true, data: rate });
  } catch (e: any) { res.status(500).json({ error: 'Failed to get collection rate' }); }
});

router.get('/revenue/top-properties', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const properties = await abodeRevenue.getTopProperties(userId);
    res.json({ success: true, data: properties });
  } catch (e: any) { res.status(500).json({ error: 'Failed to get top properties' }); }
});

// Tenants
router.get('/tenants', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const tenants = await abodeTenant.getTenants(userId);
    res.json({ success: true, data: tenants });
  } catch (e: any) { res.status(500).json({ error: 'Failed to get tenants' }); }
});

router.get('/tenants/:id', authenticate, async (req: any, res: Response) => {
  try {
    const tenant = await abodeTenant.getTenantDetail(req.params.id);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.json({ success: true, data: tenant });
  } catch (e: any) { res.status(500).json({ error: 'Failed to get tenant details' }); }
});

router.put('/tenants/:id/risk', authenticate, async (req: any, res: Response) => {
  try {
    const { riskBand } = req.body;
    const tenant = await abodeTenant.updateTenantRisk(req.params.id, riskBand);
    res.json({ success: true, data: tenant });
  } catch (e: any) { res.status(500).json({ error: 'Failed to update tenant risk' }); }
});

// Leases
router.get('/leases', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const status = req.query.status as string | undefined;
    const leases = await abodeLease.getLeases(userId, status);
    res.json({ success: true, data: leases });
  } catch (e: any) { res.status(500).json({ error: 'Failed to get leases' }); }
});

router.post('/leases', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const lease = await abodeLease.createLease({ ...req.body, managerId: userId });
    res.status(201).json({ success: true, data: lease });
  } catch (e: any) { res.status(500).json({ error: e.message || 'Failed to create lease' }); }
});

router.put('/leases/:id/renew', authenticate, async (req: any, res: Response) => {
  try {
    const lease = await abodeLease.renewLease(req.params.id, req.body);
    res.json({ success: true, data: lease });
  } catch (e: any) { res.status(500).json({ error: 'Failed to renew lease' }); }
});

router.put('/leases/:id/terminate', authenticate, async (req: any, res: Response) => {
  try {
    const { reason } = req.body;
    const lease = await abodeLease.terminateLease(req.params.id, reason);
    res.json({ success: true, data: lease });
  } catch (e: any) { res.status(500).json({ error: 'Failed to terminate lease' }); }
});

// Maintenance
router.get('/maintenance', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const status = req.query.status as string | undefined;
    const requests = await abodeMaintenance.getRequests(userId, status);
    res.json({ success: true, data: requests });
  } catch (e: any) { res.status(500).json({ error: 'Failed to get maintenance requests' }); }
});

router.post('/maintenance', authenticate, async (req: any, res: Response) => {
  try {
    const { tenantId, ...data } = req.body;
    const request = await abodeMaintenance.submitRequest(tenantId, data);
    res.status(201).json({ success: true, data: request });
  } catch (e: any) { res.status(500).json({ error: e.message || 'Failed to submit request' }); }
});

router.put('/maintenance/:id/status', authenticate, async (req: any, res: Response) => {
  try {
    const { status, notes } = req.body;
    const request = await abodeMaintenance.updateRequestStatus(req.params.id, status, notes);
    res.json({ success: true, data: request });
  } catch (e: any) { res.status(500).json({ error: 'Failed to update request status' }); }
});

router.post('/maintenance/:id/assign', authenticate, async (req: any, res: Response) => {
  try {
    const { vendorId } = req.body;
    const request = await abodeMaintenance.assignVendor(req.params.id, vendorId);
    res.json({ success: true, data: request });
  } catch (e: any) { res.status(500).json({ error: 'Failed to assign vendor' }); }
});

// Messages
router.post('/messages', authenticate, async (req: any, res: Response) => {
  try {
    const { propertyId, senderEmail, recipientEmail, body } = req.body;
    const result = await abodeCommunication.sendMessage(propertyId, senderEmail, recipientEmail, body);
    res.status(201).json({ success: true, data: result });
  } catch (e: any) { res.status(500).json({ error: 'Failed to send message' }); }
});

router.post('/broadcast', authenticate, async (req: any, res: Response) => {
  try {
    const { propertyId, message } = req.body;
    const result = await abodeCommunication.broadcastToTenants(propertyId, message);
    res.json({ success: true, data: result });
  } catch (e: any) { res.status(500).json({ error: 'Failed to broadcast' }); }
});

router.get('/messages/:conversationId', authenticate, async (req: any, res: Response) => {
  try {
    const messages = await abodeCommunication.getMessageHistory(req.params.conversationId);
    res.json({ success: true, data: messages });
  } catch (e: any) { res.status(500).json({ error: 'Failed to get messages' }); }
});

export default router;
