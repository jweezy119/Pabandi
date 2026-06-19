import { Request, Response } from 'express';
import { processWhatsAppMessage } from '../services/ai.service';
import { prisma } from '../utils/database';

const VERIFY_TOKEN = process.env.META_WA_VERIFY_TOKEN || 'pabandi_wa_secret_2026';

/**
 * Webhook Verification for Meta WhatsApp API (GET request)
 */
export const verifyWebhook = (req: Request, res: Response): void => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[WhatsApp] Webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
};

/**
 * Webhook to receive incoming messages from Meta WhatsApp API (POST request)
 */
export const handleIncomingWhatsApp = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body;

    // Check if it's a WhatsApp status update or message
    if (body.object) {
      if (
        body.entry &&
        body.entry[0].changes &&
        body.entry[0].changes[0].value.messages &&
        body.entry[0].changes[0].value.messages[0]
      ) {
        const message = body.entry[0].changes[0].value.messages[0];
        const contacts = body.entry[0].changes[0].value.contacts;
        
        // Meta formats phone number without '+' sign, e.g., "923001234567"
        let phoneNumber = message.from;
        
        // Ensure standard formatting if we stored it with '+' in DB
        if (!phoneNumber.startsWith('+')) {
          phoneNumber = '+' + phoneNumber;
        }

        const msgBody = message.text?.body;
        const profileName = contacts && contacts[0] ? contacts[0].profile.name : 'Unknown';

        if (!msgBody) {
          // It might be a reaction, image, etc. We only handle text for now.
          res.sendStatus(200);
          return;
        }

        console.log(`[WhatsApp] Received message from ${phoneNumber} (${profileName}): ${msgBody}`);

        // Try to find the user in our database based on their phone number
        const user = await prisma.user.findFirst({
          where: { phone: phoneNumber }
        });

        // Process the message through our AI Service
        // We do this asynchronously so we can quickly respond 200 OK to Meta
        processWhatsAppMessage(phoneNumber, msgBody, user).catch(error => {
          console.error('[WhatsApp] Error processing message:', error);
        });
      }
      
      // Send 200 OK to acknowledge receipt
      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch (error) {
    console.error('[WhatsApp] Webhook Error:', error);
    res.status(500).send('Internal Server Error');
  }
};
