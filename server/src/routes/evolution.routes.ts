import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { evolutionAPI } from '../services/evolution.service';

const router = Router();

// ── EVOLUTION API MANAGEMENT ──────────────────────────

// Create new WhatsApp instance
router.post('/instance/create', authenticate, async (req, res) => {
  try {
    const { instanceName } = req.body;
    const result = await evolutionAPI.createInstance(instanceName || `pabandi-${req.user!.id}`);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get QR code for instance
router.get('/instance/:instanceName/qrcode', authenticate, async (req, res) => {
  try {
    const result = await evolutionAPI.getQRCode(req.params.instanceName);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get instance connection state
router.get('/instance/:instanceName/state', authenticate, async (req, res) => {
  try {
    const result = await evolutionAPI.getInstanceState(req.params.instanceName);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// List all instances
router.get('/instances', authenticate, async (req, res) => {
  try {
    const result = await evolutionAPI.listInstances();
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Logout/delete instance
router.delete('/instance/:instanceName', authenticate, async (req, res) => {
  try {
    const result = await evolutionAPI.logoutInstance(req.params.instanceName);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Send text message
router.post('/send/:instanceName', authenticate, async (req, res) => {
  try {
    const { to, message } = req.body;
    const result = await evolutionAPI.sendTextMessage(req.params.instanceName, to, message);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── WEBHOOK (called by Evolution API) ─────────────────

router.post('/webhook/:instanceName', async (req, res) => {
  try {
    await evolutionAPI.handleWebhook(req.params.instanceName, req.body);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[Evolution Webhook] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── STATUS ────────────────────────────────────────────

router.get('/status', authenticate, async (req, res) => {
  try {
    const status = await evolutionAPI.getUserStatus(req.user!.id);
    res.json({ success: true, data: status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
