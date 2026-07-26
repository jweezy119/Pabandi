import { Router, Request, Response, NextFunction } from 'express';
import { webhookManager, OpenWAWebhookPayload } from '../services/openwa.webhook-manager.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/evolution/webhook
 *
 * Receives webhook payloads from Evolution API, normalizes them into the
 * OpenWAWebhookPayload format, and dispatches them to our existing handlers.
 * This guarantees zero breakage for our AI routing and intent services.
 */
router.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawPayload = req.body;
    
    // Respond immediately to Evolution API
    res.status(200).json({ success: true, received: true });
    
    if (!rawPayload || !rawPayload.event) {
      return;
    }

    const instanceId = rawPayload.instance || 'default';
    const timestamp = rawPayload.date_time || new Date().toISOString();
    
    let normalizedEvent = '';
    let normalizedData: any = {};
    
    // Normalize Evolution API events to OpenWA format
    if (rawPayload.event === 'messages.upsert') {
      normalizedEvent = 'message.received';
      const msgData = rawPayload.data?.message;
      
      if (!msgData || !msgData.key) return;

      const remoteJid = msgData.key.remoteJid || '';
      
      normalizedData = {
        id: msgData.key.id,
        chatId: remoteJid.replace('@s.whatsapp.net', '@c.us'),
        from: remoteJid.replace('@s.whatsapp.net', '@c.us'),
        fromMe: msgData.key.fromMe || false,
        isGroup: remoteJid.includes('@g.us'),
        body: msgData.message?.conversation || msgData.message?.extendedTextMessage?.text || '',
        type: msgData.message?.imageMessage ? 'image' : (msgData.message?.videoMessage ? 'video' : 'chat'),
        hasMedia: !!(msgData.message?.imageMessage || msgData.message?.videoMessage || msgData.message?.documentMessage),
        sender: {
          id: remoteJid.replace('@s.whatsapp.net', '@c.us'),
          name: msgData.pushName || 'Unknown',
          pushname: msgData.pushName || 'Unknown',
        }
      };
      
      // If it's media, we might need to fetch it via Evolution API later, but for now we set the flag.
      if (msgData.message?.imageMessage) {
        // We can pass the raw message payload down for Qwen Vision handling
        normalizedData.rawEvolutionMedia = msgData.message;
      }
      
    } else if (rawPayload.event === 'messages.update') {
      normalizedEvent = 'message.ack';
      const updateData = rawPayload.data;
      
      if (!updateData || !updateData.key) return;
      
      // Evolution maps statuses: 1 = sent, 2 = received, 3 = read, 4 = played
      let ackLevel = 0;
      if (updateData.status === 'SERVER_ACK') ackLevel = 1;
      else if (updateData.status === 'DELIVERY_ACK') ackLevel = 2;
      else if (updateData.status === 'READ') ackLevel = 3;
      
      normalizedData = {
        id: updateData.key.id,
        chatId: updateData.key.remoteJid?.replace('@s.whatsapp.net', '@c.us'),
        fromMe: updateData.key.fromMe || false,
        ack: ackLevel,
      };
      
    } else if (rawPayload.event === 'presence.update') {
      // Just pass through for smart presence tracking if we want to use it
      normalizedEvent = 'presence.update';
      normalizedData = rawPayload.data;
      
    } else {
      // Unhandled event
      return;
    }
    
    const normalizedPayload: OpenWAWebhookPayload = {
      event: normalizedEvent,
      sessionId: instanceId,
      timestamp,
      data: normalizedData
    };
    
    // Dispatch to the existing WebhookManager
    webhookManager.dispatch(normalizedPayload).catch(error => {
      logger.error(`[EvolutionWebhook] Dispatch error: ${error?.message || error}`);
    });
    
  } catch (error) {
    logger.error(`[EvolutionWebhook] Processing error: ${(error as any)?.message || error}`);
  }
});

export default router;
