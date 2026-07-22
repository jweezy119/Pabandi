
import { Router, Request, Response, NextFunction } from 'express';
import { openwaService } from '../services/openwa.service';
import { listAdminPlugins, getAdminPlugin, updateAdminPlugin } from '../services/openwa_admin.service';

const router = Router();

// GET /api/v1/openwa/sessions - list active OpenWA sessions
router.get('/sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = await openwaService.listSessions();
    res.json({ success: true, data: sessions });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/openwa/plugins - list OpenWA plugins
router.get('/plugins', (req: Request, res: Response, next: NextFunction) => {
  try {
    const plugins = listAdminPlugins();
    res.json({ success: true, data: plugins });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/openwa/plugins/:id - get single plugin
router.get('/plugins/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const plugin = getAdminPlugin(req.params.id);
    if (!plugin) {
      res.status(404).json({ success: false, error: 'Plugin not found' });
      return;
    }
    res.json({ success: true, data: plugin });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/openwa/plugins/:id - update plugin config/enabled
router.patch('/plugins/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = updateAdminPlugin(req.params.id, req.body);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/openwa/send-text - send a text message via OpenWA
router.post('/send-text', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { to, message, sessionId, pluginContext } = req.body;
    if (!to || !message) {
      res.status(400).json({ success: false, error: 'to and message are required' });
      return;
    }
    const result = await openwaService.sendText(to, message, { sessionId, pluginContext });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
