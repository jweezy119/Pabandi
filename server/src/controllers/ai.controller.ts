import { Request, Response } from 'express';
import { prisma } from '../utils/database';
import axios from 'axios';

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || '';

export const handleConciergeQuery = async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    const user = (req as any).user; // from authMiddleware

    if (!DASHSCOPE_API_KEY || DASHSCOPE_API_KEY === 'REPLACE_WITH_YOUR_DASHSCOPE_API_KEY') {
      return res.status(500).json({ error: "DashScope API key is not configured." });
    }

    // Context for Qwen AI
    let systemContext = `You are the Pabandi AI Concierge.
You help users find restaurants and make reservations.
The user asking is ${user?.firstName || 'a guest'}. 
Please respond concisely. 
If the user wants to book, output a JSON block at the end of your message in this exact format:
\`\`\`json
{
  "proposedBusinessId": "id-of-the-business",
  "businessName": "Name of Business",
  "reservationDate": "YYYY-MM-DD",
  "reservationTime": "HH:MM",
  "numberOfGuests": 2
}
\`\`\`
If you don't know the exact business ID, leave it empty or make a best guess from the list provided.`;

    // Fetch some available businesses to give the AI context
    const businesses = await prisma.business.findMany({
      where: { isActive: true },
      take: 10,
      select: { id: true, name: true, category: true, city: true }
    });

    systemContext += `\n\nAvailable Businesses:\n` + businesses.map(b => `- ${b.name} (ID: ${b.id}, City: ${b.city})`).join('\n');

    const payload = {
      model: 'qwen-turbo',
      input: {
        messages: [
          { role: 'system', content: systemContext },
          { role: 'user', content: query }
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

    let aiMessage = "I'm sorry, I couldn't process your request.";
    let proposal = null;

    if (response.data?.output?.choices?.length > 0) {
      aiMessage = response.data.output.choices[0].message.content.trim();
      
      // Try to parse JSON block from AI output
      const jsonMatch = aiMessage.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        try {
          proposal = JSON.parse(jsonMatch[1]);
          aiMessage = aiMessage.replace(jsonMatch[0], '').trim();
        } catch (e) {
          console.error("Failed to parse AI proposal JSON", e);
        }
      }
    }

    res.json({ message: aiMessage, proposal });

  } catch (error: any) {
    console.error("Concierge Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to communicate with AI Concierge." });
  }
};
