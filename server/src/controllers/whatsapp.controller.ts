import { Request, Response } from 'express';
import { processWhatsAppMessage, findBusinessByPublicPhone, sendWhatsAppMessage } from '../services/ai.service';
import { whatsAppSmartService } from '../services/whatsapp.smart.service';
import { saveConversationSignal } from '../services/whatsapp.conversation.service';
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
        const metadata = body.entry[0].changes[0].value.metadata;
        
        // Meta formats phone number without '+' sign, e.g., "923001234567"
        let customerPhone = message.from;
        let businessPhone = metadata?.display_phone_number || '';
        
        // Ensure standard formatting if we stored it with '+' in DB
        if (!customerPhone.startsWith('+')) {
          customerPhone = '+' + customerPhone;
        }
        if (businessPhone && !businessPhone.startsWith('+')) {
          businessPhone = '+' + businessPhone;
        }

        const msgBody = message.text?.body;
        const profileName = contacts && contacts[0] ? contacts[0].profile.name : 'Unknown';

        if (!msgBody) {
          // It might be a reaction, image, etc. We only handle text for now.
          res.sendStatus(200);
          return;
        }

        console.log(`[WhatsApp] Received message from ${customerPhone} to ${businessPhone} (${profileName}): ${msgBody}`);

        // Try to find the user in our database based on their phone number
        const user = await prisma.user.findFirst({
          where: { phone: customerPhone }
        });

        // Smart booking first, fallback to existing AI flow so cancel/after-hours/faq still run.
        const matchedBusiness = await findBusinessByPublicPhone(businessPhone);
        let smartReply = null;
        if (matchedBusiness) {
          try {
            smartReply = await whatsAppSmartService.processMessage(customerPhone, businessPhone, msgBody);
          } catch (smartErr) {
            console.error('[WhatsApp Smart]', smartErr);
          }
        }
        const smartText = smartReply?.text || null;

        if (smartText) {
          if (matchedBusiness) {
            await saveConversationSignal(customerPhone, matchedBusiness.id, msgBody, smartText);
          }
        } else {
          processWhatsAppMessage(customerPhone, businessPhone, msgBody, user).catch(error => {
            console.error('[WhatsApp] Error processing message:', error);
          });
        }
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
