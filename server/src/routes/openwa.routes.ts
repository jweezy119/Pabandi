import { Router } from 'express';
import { openwaService } from '../services/openwa.service';

const router = Router();

router.get('/status', async (_req, res) => {
  try {
    const sessions = await openwaService.listSessions();
    const best = await openwaService.findBestSession();
    const connected = sessions.filter((s) => s.connected || s.status === 'connected');
    res.json({
      sessions,
      connectedCount: connected.length,
      bestSessionId: best?.id || null,
      status: best?.connected || best?.status === 'connected' ? 'connected' : 'disconnected',
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'OpenWA status check failed' });
  }
});

export default router;
