import { Router, Request, Response, NextFunction } from 'express';
import { openwaService, openwaBaseUrl } from '../services/whatsapp.service';
import { listAdminPlugins, getAdminPlugin, updateAdminPlugin } from '../services/openwa_admin.service';
import { getPluginCatalog } from '../services/openwa.plugins.service';

const router = Router();

/**
 * Is this failure "the gateway is not there"?
 *
 * axios reports a connection failure as ECONNREFUSED / ENOTFOUND / ETIMEDOUT, or as a
 * 5xx from the gateway itself. All of them mean the same thing to an operator: OpenWA is
 * not answering. Left unclassified they surfaced as "Internal Server Error", which says
 * nothing and is indistinguishable from a bug in our own code.
 */
function isGatewayUnreachable(error: any): boolean {
  const code = error?.code ?? error?.cause?.code;
  if (typeof code === 'string' && /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EHOSTUNREACH|ECONNRESET/.test(code)) {
    return true;
  }
  const status = error?.response?.status;
  return typeof status === 'number' && status >= 500;
}


// GET /api/v1/openwa/sessions - list active OpenWA sessions
router.get('/sessions', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = await openwaService.listSessions();
    res.json({ success: true, data: sessions });
  } catch (error: any) {
    // Same treatment as /stats: an unreachable gateway is a configuration state, not an
    // internal error, and "Internal Server Error" gave an operator nothing to act on.
    if (isGatewayUnreachable(error)) {
      return res.status(503).json({
        success: false,
        message: `OpenWA gateway is not reachable at ${openwaBaseUrl()}. ` +
          'Set OPENWA_API_URL and OPENWA_API_KEY, or start the gateway.',
      });
    }
    next(error);
  }
});

// GET /api/v1/openwa/plugins - list OpenWA plugins
router.get('/plugins', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const plugins = listAdminPlugins();
    res.json({ success: true, data: plugins });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/openwa/plugins/available - List all available plugins from the catalog
router.get('/plugins/available', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const catalog = getPluginCatalog();
    res.json({ success: true, data: catalog.plugins });
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

// POST /api/v1/openwa/plugins/:id/activate - Activate/Deactivate a plugin for the business
router.post('/plugins/:id/activate', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { active } = req.body;
    // In a real app, this would persist the plugin preference per-business to the DB.
    // For now, update the admin plugin list in memory.
    const updated = updateAdminPlugin(req.params.id, { enabled: active });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/openwa/health - Get connection health of OpenWA
router.get('/health', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const health = await openwaService.healthCheck();
    res.json({ success: true, data: health });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/openwa/stats
 *
 * The delivery-rate and uptime figures used to be hardcoded:
 *
 *   messageDeliveryRate: 0.98,
 *   uptime: '99.9%',
 *
 * Invented numbers in an ops dashboard, returned with a 200 whether or not a single
 * message had ever been sent. Anyone reading them would conclude the gateway was healthy
 * and 98% of messages were landing, which is the opposite of the truth in every
 * environment where this has run.
 *
 * They are now `null`, with `deliveryStatsAvailable: false` explaining why. A dashboard
 * that shows a dash is honest; one that shows a confident 98% is not.
 *
 * Session counts are still real, and still fail loudly below when the gateway is
 * unreachable rather than pretending to be empty.
 */
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = await openwaService.listSessions();
    res.json({
      success: true,
      data: {
        activeSessions: sessions.filter((s: any) => s.status === 'connected' || s.connected).length,
        totalSessions: sessions.length,
        // Not measurable through this API — the gateway does not expose them.
        messageDeliveryRate: null,
        uptime: null,
        deliveryStatsAvailable: false,
      },
    });
  } catch (error: any) {
    // `listSessions` throws when the gateway is unreachable, which produced an opaque
    // "Internal Server Error". Say what is actually wrong so an operator can tell an
    // unreachable gateway from a broken one.
    if (isGatewayUnreachable(error)) {
      return res.status(503).json({
        success: false,
        message: `OpenWA gateway is not reachable at ${openwaBaseUrl()}. ` +
          'Set OPENWA_API_URL and OPENWA_API_KEY, or start the gateway.',
      });
    }
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
  }
});

export default router;
