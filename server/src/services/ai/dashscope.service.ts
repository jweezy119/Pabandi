import { logger } from '../../utils/logger';
import { prisma } from '../../utils/database';
import axios from 'axios';

export class DashscopeService {
  /**
   * Implementation of Alibaba Cloud DashScope (Qwen) API call for Trust Profiles.
   * Falls back to a heuristic algorithm if the API key is missing or fails.
   */
  async generateTrustProfile(userId: string): Promise<string> {
    try {
      // 1. Gather context for the AI model
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          socialIdentities: true,
          reservations: {
            where: { status: { in: ['COMPLETED', 'NO_SHOW', 'CANCELLED'] } },
            orderBy: { reservationDate: 'desc' },
            take: 20
          }
        }
      });

      if (!user) return "Insufficient data to generate Trust Profile.";

      const total = user.reservations.length;
      if (total === 0) return "New patron on Pabandi. Awaiting history.";

      const completed = user.reservations.filter(r => r.status === 'COMPLETED').length;
      const noShows = user.reservations.filter(r => r.status === 'NO_SHOW').length;
      
      const attendanceRate = Math.round((completed / total) * 100);

      // 2. Format a prompt for DashScope
      const prompt = `
        System: You are an Alibaba Cloud Qwen AI evaluating user behavioral reliability for Pabandi, a premium booking platform.
        User Data: ${total} total bookings, ${attendanceRate}% attendance rate.
        Socials: ${user.socialIdentities.length > 0 ? 'Verified Professional' : 'Unverified'}.
        Generate a 2-sentence Trust Profile summary outlining their reliability. Do not include introductory text, just the summary.
      `;

      // 3. Try to call DashScope API
      const apiKey = process.env.DASHSCOPE_API_KEY;
      if (apiKey && apiKey !== 'REPLACE_WITH_YOUR_DASHSCOPE_API_KEY') {
        try {
          logger.info(`[DashScope] Calling Alibaba Cloud API for user: ${userId}`);
          const response = await axios.post('https://ws-zjb69iy6ysvy9j7z.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
            model: 'qwen-turbo',
            input: {
              messages: [
                { role: 'system', content: 'You are an AI assistant analyzing user reliability.' },
                { role: 'user', content: prompt }
              ]
            },
            parameters: {
              result_format: 'message'
            }
          }, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.data && response.data.output && response.data.output.choices && response.data.output.choices.length > 0) {
            const aiText = response.data.output.choices[0].message.content.trim();
            return `[DashScope AI]: ${aiText}`;
          }
        } catch (apiError: any) {
          logger.error(`[DashScope API Error] Failed to generate profile via API, falling back to heuristics: ${apiError.message}`);
        }
      } else {
        logger.warn('[DashScope] DASHSCOPE_API_KEY is not set or placeholder. Falling back to heuristic Trust Profile.');
      }

      // 4. Fallback heuristic logic
      let aiSummary = "";
      if (attendanceRate >= 95) {
        aiSummary = "Highly reliable patron with exceptional attendance. Verified professional who consistently fulfills booking commitments.";
      } else if (attendanceRate >= 80) {
        aiSummary = "Dependable user with a solid track record. Occasionally reschedules but maintains good communication.";
      } else if (attendanceRate >= 60) {
        aiSummary = "Moderate reliability. History shows a mix of completed bookings and no-shows. Proceed with standard deposit protocols.";
      } else {
        aiSummary = "High-risk profile with frequent no-shows. strict deposit requirements strongly recommended.";
      }

      const adverbs = ["Demonstrates", "Shows", "Maintains"];
      const adverb = adverbs[Math.floor(Math.random() * adverbs.length)];
      
      return `[DashScope Qwen AI (Fallback)]: ${adverb} a ${attendanceRate}% adherence rate. ${aiSummary}`;

    } catch (error) {
      logger.error('Error generating AI Trust Profile via DashScope:', error);
      return "AI Trust Profile temporarily unavailable.";
    }
  }

  /**
   * Helper to perform generic text generation using Alibaba Cloud Qwen AI model.
   */
  async generateText(systemPrompt: string, userPrompt: string): Promise<string> {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey || apiKey === 'REPLACE_WITH_YOUR_DASHSCOPE_API_KEY') {
      throw new Error('DASHSCOPE_API_KEY is not configured');
    }

    const response = await axios.post('https://ws-zjb69iy6ysvy9j7z.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
      model: 'qwen-turbo',
      input: {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      },
      parameters: {
        result_format: 'message'
      }
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data && response.data.output && response.data.output.choices && response.data.output.choices.length > 0) {
      return response.data.output.choices[0].message.content.trim();
    }
    throw new Error('No content returned from DashScope');
  }
}

export const dashscopeService = new DashscopeService();
