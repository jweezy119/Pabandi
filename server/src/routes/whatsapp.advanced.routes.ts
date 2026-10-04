import { Router, Request, Response, NextFunction } from 'express';
import { whatsAppSmartService } from '../services/whatsapp.smart.service';
import { authenticate } from '../middleware/auth.middleware';
import { resolvePlatformBusinessId } from '../middleware/tenant.middleware';

const router = Router();

// WHY THIS IS NOW AUTHENTICATED
//
// These routes had no authentication at all, and were unreachable only by accident: a
// sibling registration pointed at a module that does not exist, and `app.use` matched
// subpaths, so `/api/v1/whatsapp` swallowed every `/api/v1/whatsapp/**` request with a
// 500. Removing that dead registration without adding auth first would have turned a
// broken endpoint into an OPEN one — anyone could have driven `smart-action`, which
// sends real WhatsApp messages to a real customer phone number.
//
// So: auth first, then unblock.
router.use(authenticate);

// Adapter: WhatsApp advanced capabilities
router.get('/capabilities', (_req: Request, res: Response) => {
  res.json({ success: true, capabilities: whatsAppSmartService.capabilities() });
});

// Adapter: execute a smart WhatsApp action from external systems/CRM
router.post('/smart-action', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { intent, customerPhone, businessPhone, message } = req.body || {};
    if (!intent) {
      return res.status(400).json({ success: false, error: 'intent is required' });
    }

    // Resolve the caller's business from the session and refuse if there is none, rather
    // than acting on behalf of nobody. The service itself does not check, so this is the
    // only thing standing between a logged-in user and a message sent as no business.
    const businessId = await resolvePlatformBusinessId(req);
    if (!businessId) {
      return res.status(403).json({
        success: false,
        error: 'No business is associated with this account. Finish setting up your business first.',
      });
    }

    const reply = await whatsAppSmartService.runSmartAction(intent, {
      customerPhone,
      businessPhone,
      message,
    });
    res.json({ success: true, data: reply });
  } catch (error) {
    next(error);
  }
});

export default router;
