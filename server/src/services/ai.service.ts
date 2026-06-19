import { GoogleGenerativeAI, SchemaType, Tool } from '@google/generative-ai';
import { prisma } from '../utils/database';
import axios from 'axios';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

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
  
  if (!GEMINI_API_KEY) {
    console.warn('[AI] Gemini API Key missing, returning default auto-reply.');
    await sendWhatsAppMessage(phoneNumber, 'Welcome to Pabandi! We are currently upgrading our AI systems. Please check back later or use our website to manage your bookings.');
    return;
  }

  try {
    // Determine the role and context for the AI
    let context = 'You are the Pabandi AI Assistant. Pabandi is a reservation and trust platform in Pakistan.\n';
    
    if (user) {
      context += `The person you are talking to is ${user.firstName} ${user.lastName}, a registered ${user.role} on Pabandi.\n`;
      if (user.role === 'BUSINESS_OWNER') {
        context += `As a business owner, they might ask about their reservations or want to manage their profile.\n`;
      } else {
        context += `As a customer, they might want to book a table, check reservations, or ask about No-Show deposits.\n`;
      }
    } else {
      context += `The person you are talking to is an unregistered user. Briefly mention they can sign up on pabandi.com for rewards.\n`;
    }

    context += `
Keep your answers brief, conversational, and helpful. You can use English or Roman Urdu. 
If the user asks to book a table, acknowledge their request and tell them you are checking availability (simulate for now).
Do not generate markdown or long lists.
`;

    const tools: Tool[] = [
      {
        functionDeclarations: [
          {
            name: "check_availability",
            description: "Check if a business has availability at a specific time.",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                businessName: { type: SchemaType.STRING, description: "The name of the business" },
                time: { type: SchemaType.STRING, description: "The requested time, e.g., '8:00 PM'" },
                partySize: { type: SchemaType.NUMBER, description: "Number of people" }
              },
              required: ["businessName", "time", "partySize"]
            }
          },
          {
            name: "create_reservation",
            description: "Create a reservation for the user after they have confirmed the details.",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                businessName: { type: SchemaType.STRING, description: "The name of the business" },
                time: { type: SchemaType.STRING, description: "The requested time" },
                partySize: { type: SchemaType.NUMBER, description: "Number of people" }
              },
              required: ["businessName", "time", "partySize"]
            }
          }
        ]
      }
    ];

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', tools });
    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: context }] },
        { role: 'model', parts: [{ text: 'Understood. I will assist the user.' }] }
      ]
    });
    
    let result = await chat.sendMessage([{ text: message }]);
    
    // Handle function calls if the AI decides to use a tool
    if (result.response.functionCalls() && result.response.functionCalls()!.length > 0) {
      const call = result.response.functionCalls()![0];
      let functionResponseText = "";
      const args: any = call.args;

      if (call.name === "check_availability") {
        console.log(`[AI Function] Checking availability for ${args.businessName} at ${args.time}`);
        // Mock database check
        functionResponseText = `Yes, there is a table available for ${args.partySize} at ${args.time}. The No-Show deposit is 500 PKR.`;
      } else if (call.name === "create_reservation") {
        console.log(`[AI Function] Creating reservation for ${args.businessName} at ${args.time}`);
        // Mock database creation
        functionResponseText = `Reservation successfully created! Your table for ${args.partySize} is confirmed.`;
      }

      result = await chat.sendMessage([{
        functionResponse: {
          name: call.name,
          response: { result: functionResponseText }
        }
      }]);
    }

    const aiResponse = result.response.text().trim();
    await sendWhatsAppMessage(phoneNumber, aiResponse);
  } catch (error) {
    console.error('[AI] Error generating AI response:', error);
    await sendWhatsAppMessage(phoneNumber, 'Sorry, I am having trouble understanding right now. Please try again later!');
  }
};
