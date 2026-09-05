import { Router, Request, Response } from 'express';
import { inventoryService } from '../services/inventory.service';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// ── Products ──────────────────────────────────────────────────────────────
router.get('/venues/:venueId/products', authenticate, async (req: any, res: Response) => {
  try {
    const products = await inventoryService.getProducts(req.params.venueId);
    res.json({ success: true, data: products });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load products' });
  }
});

router.post('/products', authenticate, async (req: any, res: Response) => {
  try {
    const product = await inventoryService.createProduct(req.body);
    res.status(201).json({ success: true, data: product });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create product' });
  }
});

router.post('/products/:id/stock', authenticate, async (req: any, res: Response) => {
  try {
    const { quantity, reason } = req.body;
    const result = await inventoryService.updateStock(req.params.id, quantity, reason);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to update stock' });
  }
});

// ── Vendors ──────────────────────────────────────────────────────────────
router.get('/venues/:venueId/vendors', authenticate, async (req: any, res: Response) => {
  try {
    const vendors = await inventoryService.getVendors(req.params.venueId);
    res.json({ success: true, data: vendors });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load vendors' });
  }
});

router.post('/vendors', authenticate, async (req: any, res: Response) => {
  try {
    const vendor = await inventoryService.createVendor(req.body);
    res.status(201).json({ success: true, data: vendor });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create vendor' });
  }
});

// ── Purchase Orders ──────────────────────────────────────────────────────
router.post('/purchase-orders', authenticate, async (req: any, res: Response) => {
  try {
    const po = await inventoryService.createPurchaseOrder(req.body);
    res.status(201).json({ success: true, data: po });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create purchase order' });
  }
});

router.post('/purchase-orders/:id/submit', authenticate, async (req: any, res: Response) => {
  try {
    const result = await inventoryService.submitPurchaseOrder(req.params.id);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to submit PO' });
  }
});

router.post('/purchase-orders/:id/receive', authenticate, async (req: any, res: Response) => {
  try {
    const result = await inventoryService.receivePurchaseOrder(req.params.id);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to receive PO' });
  }
});

// ── Waste ────────────────────────────────────────────────────────────────
router.post('/waste', authenticate, async (req: any, res: Response) => {
  try {
    const result = await inventoryService.recordWaste(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to record waste' });
  }
});

// ── Reports ──────────────────────────────────────────────────────────────
router.get('/venues/:venueId/inventory-value', authenticate, async (req: any, res: Response) => {
  try {
    const value = await inventoryService.getInventoryValue(req.params.venueId);
    res.json({ success: true, data: value });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get inventory value' });
  }
});

router.get('/venues/:venueId/report', authenticate, async (req: any, res: Response) => {
  try {
    const report = await inventoryService.getInventoryReport(req.params.venueId);
    res.json({ success: true, data: report });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get report' });
  }
});

export default router;
