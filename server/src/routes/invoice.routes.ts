import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { 
  createInvoice, 
  getInvoices, 
  getInvoice, 
  updateInvoice, 
  sendInvoice, 
  markInvoicePaid 
} from '../services/invoice.service';
import { logger } from '../utils/logger';

const router = Router();
router.use(requireAuth);

router.post('/', async (req: any, res) => {
  try {
    const businessId = req.user.businessId;
    const invoice = await createInvoice(businessId, req.body);
    res.status(201).json(invoice);
  } catch (err: any) {
    logger.error(`[Invoice] Create error: ${err.message}`);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/', async (req: any, res) => {
  try {
    const businessId = req.user.businessId;
    const invoices = await getInvoices(businessId, req.query);
    res.json({ data: invoices });
  } catch (err: any) {
    logger.error(`[Invoice] Fetch error: ${err.message}`);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/:id', async (req: any, res) => {
  try {
    const businessId = req.user.businessId;
    const invoice = await getInvoice(businessId, req.params.id);
    res.json(invoice);
  } catch (err: any) {
    logger.error(`[Invoice] Fetch detail error: ${err.message}`);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.patch('/:id', async (req: any, res) => {
  try {
    const businessId = req.user.businessId;
    const updated = await updateInvoice(businessId, req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    logger.error(`[Invoice] Update error: ${err.message}`);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/:id/send', async (req: any, res) => {
  try {
    const businessId = req.user.businessId;
    const sent = await sendInvoice(businessId, req.params.id);
    res.json(sent);
  } catch (err: any) {
    logger.error(`[Invoice] Send error: ${err.message}`);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/:id/pay', async (req: any, res) => {
  try {
    const businessId = req.user.businessId;
    const { transactionHash } = req.body;
    const paid = await markInvoicePaid(businessId, req.params.id, transactionHash);
    res.json(paid);
  } catch (err: any) {
    logger.error(`[Invoice] Mark paid error: ${err.message}`);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

export default router;
