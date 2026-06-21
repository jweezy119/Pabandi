import { prisma } from '../utils/database';
import axios from 'axios';

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || '';
const META_WA_ACCESS_TOKEN = process.env.META_WA_ACCESS_TOKEN || '';
const META_WA_PHONE_NUMBER_ID = process.env.META_WA_PHONE_NUMBER_ID || '';

/**
 * Send a WhatsApp message to a user using Meta Cloud API
 */
export const sendWhatsAppMessage = async (toPhone: string, message: string) => {
  if (!META_WA_ACCESS_TOKEN || !META_WA_PHONE_NUMBER_ID) {
    console.warn(`[WhatsApp MOCK] To: ${toPhone} | Message: ${message}`);
    return;
  }

  try {
    const url = `https://graph.facebook.com/v19.0/${META_WA_PHONE_NUMBER_ID}/messages`;
    
    // Ensure the phone number doesn't have the '+' sign as Meta expects it without
    const formattedPhone = toPhone.replace('+', '');

    const data = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'text',
      text: {
        preview_url: false,
        body: message
      }
    };

    await axios.post(url, data, {
      headers: {
        'Authorization': `Bearer ${META_WA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      }
    });

    console.log(`[WhatsApp] Sent message to ${toPhone}`);
  } catch (error: any) {
    console.error(`[WhatsApp] Error sending message to ${toPhone}:`, error.response?.data || error.message);
  }
};

/**
 * AI function to process inbound WhatsApp messages
 */
export const processWhatsAppMessage = async (phoneNumber: string, message: string, user: any | null) => {
  console.log(`[AI] Processing message from ${phoneNumber}: ${message}`);
  
  if (!DASHSCOPE_API_KEY || DASHSCOPE_API_KEY === 'REPLACE_WITH_YOUR_DASHSCOPE_API_KEY') {
    console.warn('[AI] DashScope API Key missing, returning default auto-reply.');
    await sendWhatsAppMessage(phoneNumber, 'Welcome to Pabandi! We are currently upgrading our AI systems. Please check back later or use our website to manage your bookings.');
    return;
  }

  try {
    // Determine the role and context for the AI
    let context = 'You are the Pabandi AI Assistant. Pabandi is a global reservation and trust platform.\n';
    
    if (user) {
      context += `The person you are talking to is ${user.firstName} ${user.lastName}, a registered ${user.role} on Pabandi.\n`;
      if (user.role === 'BUSINESS_OWNER') {
        context += `As an enterprise owner, they might ask about their reservations or want to manage their profile.\n`;
      } else {
        context += `As a customer, they might want to book a table, check reservations, or ask about No-Show deposits.\n`;
      }
    } else {
      context += `The person you are talking to is an unregistered user. Briefly mention they can sign up on pabandi.com for rewards.\n`;
    }

    context += `
Keep your answers brief, conversational, and helpful. You must respond in English.
If the user asks to book a table, acknowledge their request and tell them you are checking availability (simulate for now).
Do not generate markdown or long lists.
`;

    const payload = {
      model: 'qwen-turbo',
      input: {
        messages: [
          { role: 'system', content: context },
          { role: 'user', content: message }
        ]
      },
      parameters: {
        result_format: 'message'
      }
    };

    const response = await axios.post(
      'https://ws-zjb69iy6ysvy9j7z.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/text-generation/generation', 
      payload, 
      {
        headers: {
          'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    let aiResponse = "I'm sorry, I couldn't process your request.";
    if (response.data && response.data.output && response.data.output.choices && response.data.output.choices.length > 0) {
      aiResponse = response.data.output.choices[0].message.content.trim();
    }
    
    await sendWhatsAppMessage(phoneNumber, aiResponse);
  } catch (error: any) {
    console.error('[AI] Error generating AI response from DashScope:', error.response?.data || error.message);
    await sendWhatsAppMessage(phoneNumber, 'Sorry, I am having trouble understanding right now. Please try again later!');
  }
};
