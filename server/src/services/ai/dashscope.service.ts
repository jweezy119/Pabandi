import { logger } from '../../utils/logger';
import { prisma } from '../../utils/database';

export class DashscopeService {
  /**
   * Mock implementation of Alibaba Cloud DashScope (Qwen) API call.
   * In a production environment, this would call the actual Alibaba API.
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

      // 2. Format a mock prompt that we would send to DashScope
      const mockPrompt = `
        System: You are an Alibaba Cloud Qwen AI evaluating user behavioral reliability for Pabandi.
        User Data: ${total} total bookings, ${attendanceRate}% attendance rate.
        Socials: ${user.socialIdentities.length > 0 ? 'Verified Professional' : 'Unverified'}.
        Generate a 2-sentence Trust Profile summary.
      `;

      logger.info(`[DashScope] Calling AI generation with prompt: ${mockPrompt.substring(0, 50)}...`);

      // 3. Mock the AI response based on the metrics
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

      // Add a slight variance for the "AI" feel
      const adverbs = ["Demonstrates", "Shows", "Maintains"];
      const adverb = adverbs[Math.floor(Math.random() * adverbs.length)];
      
      return `[DashScope Qwen AI]: ${adverb} a ${attendanceRate}% adherence rate. ${aiSummary}`;

    } catch (error) {
      logger.error('Error generating AI Trust Profile via DashScope:', error);
      return "AI Trust Profile temporarily unavailable.";
    }
  }
}

export const dashscopeService = new DashscopeService();
