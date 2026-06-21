import { Request, Response } from 'express';
import { accioAgentService } from '../services/ai/accioAgent.service';
import { dashscopeService } from '../services/ai/dashscope.service';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

export const analyzeDemand = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const business = await prisma.business.findUnique({ where: { ownerId: userId } });
    if (!business) {
      return res.status(403).json({ error: 'Not authorized for a business' });
    }
    const businessId = business.id;

    // 1. Analyze upcoming demand
    const analysis = await accioAgentService.analyzeUpcomingDemand(businessId);
    
    // 2. Draft order if there are needs
    let draftOrder = null;
    if (analysis.needs.length > 0) {
      // Check if there's already a suggested order recently
      const existing = await prisma.sourcingOrder.findFirst({
        where: { businessId, status: 'SUGGESTED' },
        orderBy: { createdAt: 'desc' }
      });

      if (existing) {
        draftOrder = existing;
      } else {
        draftOrder = await accioAgentService.draftSourcingOrder(businessId, analysis.needs);
      }
    }

    // 3. Fetch existing orders
    const pastOrders = await prisma.sourcingOrder.findMany({
      where: { businessId, status: { not: 'SUGGESTED' } },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    res.json({
      analysis,
      draftOrder,
      pastOrders
    });
  } catch (error) {
    logger.error('Analyze demand error', error);
    res.status(500).json({ error: 'Failed to analyze demand' });
  }
};

export const confirmOrder = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const business = await prisma.business.findUnique({ where: { ownerId: userId } });
    if (!business) {
      return res.status(403).json({ error: 'Not authorized for a business' });
    }
    const businessId = business.id;
    const { orderId } = req.params;

    const order = await prisma.sourcingOrder.findUnique({ where: { id: orderId } });
    if (!order || order.businessId !== businessId) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const confirmed = await accioAgentService.confirmOrder(orderId);
    
    res.json(confirmed);
  } catch (error) {
    logger.error('Confirm order error', error);
    res.status(500).json({ error: 'Failed to confirm order' });
  }
};

export const getTrends = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(403).json({ error: 'Not authorized' });

    const business = await prisma.business.findUnique({ where: { ownerId: userId } });
    if (!business) return res.status(403).json({ error: 'Not authorized for a business' });

    const trends = await accioAgentService.discoverTrends(business.id);
    res.json({ trends });
  } catch (error) {
    logger.error('Get trends error', error);
    res.status(500).json({ error: 'Failed to discover trends' });
  }
};

export const launchService = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(403).json({ error: 'Not authorized' });

    const business = await prisma.business.findUnique({ where: { ownerId: userId } });
    if (!business) return res.status(403).json({ error: 'Not authorized for a business' });

    const { trendId } = req.params;
    
    // Verify ownership
    const trend = await prisma.trendSuggestion.findUnique({ where: { id: trendId } });
    if (!trend || trend.businessId !== business.id) {
      return res.status(404).json({ error: 'Trend suggestion not found' });
    }

    const launched = await accioAgentService.launchTrendService(trendId);
    res.json({ success: true, service: launched });
  } catch (error) {
    logger.error('Launch service error', error);
    res.status(500).json({ error: 'Failed to launch service' });
  }
};

export const consultAdvisor = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(403).json({ error: 'Not authorized' });

    const business = await prisma.business.findUnique({ where: { ownerId: userId } });
    if (!business) return res.status(403).json({ error: 'Not authorized for a business' });

    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get simple metrics for context
    const totalReservations = await prisma.reservation.count({ where: { businessId: business.id } });
    const completedReservations = await prisma.reservation.count({
      where: { businessId: business.id, status: 'COMPLETED' }
    });
    const noShowReservations = await prisma.reservation.count({
      where: { businessId: business.id, status: 'NO_SHOW' }
    });
    const noShowRate = totalReservations > 0 ? Math.round((noShowReservations / totalReservations) * 100) : 0;

    const systemPrompt = `You are a state-of-the-art AI Business Consultant powered by Alibaba Cloud Qwen (qwen-turbo) for Pabandi, Pakistan's leading AI-Crypto reliability booking platform. You help merchants optimize slots, prevent no-shows, source inventory on Alibaba, and drive growth.`;
    
    const userPrompt = `
      Merchant Message: "${message}"
      
      Business Details:
      - Name: ${business.name}
      - Category: ${business.category}
      - Location: ${business.city || 'Karachi'}, Pakistan
      - Total Bookings to Date: ${totalReservations}
      - Current No-Show Rate: ${noShowRate}%
      
      Provide a highly customized, actionable response in markdown format. Keep it concise (maximum 3 short paragraphs, plus a bulleted list of 3 actionable steps if appropriate). If advising on equipment or supplies, suggest searching and sourcing them directly via Alibaba Accio.
    `;

    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (apiKey && apiKey !== 'REPLACE_WITH_YOUR_DASHSCOPE_API_KEY') {
      try {
        logger.info(`[DashScope Chat] Requesting business consultation for: ${business.id}`);
        const response = await dashscopeService.generateText(systemPrompt, userPrompt);
        return res.json({ response });
      } catch (apiError: any) {
        logger.error(`[DashScope Chat API Error] Sourcing consultation API failed, falling back to heuristic: ${apiError.message}`);
      }
    }

    // Heuristic Fallback Advisor Matrix
    const queryLower = message.toLowerCase();
    let reply = '';

    if (queryLower.includes('no-show') || queryLower.includes('cancel') || queryLower.includes('absent') || queryLower.includes('deposit')) {
      reply = `### 🛡️ No-Show Prevention Strategy for **${business.name}**

Your current no-show rate is **${noShowRate}%**. To secure your revenue, we recommend implementing dynamic deposits and PAB staking options:

1. **Activate Good-Faith Deposits:** For peak weekend hours, require customers with low reliability scores (below 80) to post a deposit. You can set this under settings.
2. **Encourage PAB Staking:** Customers can stake $PAB tokens for free bookings. If they attend, their tokens are returned; if they no-show, the stake is slashed and paid out to you.
3. **Automated WhatsApp/SMS Reminders:** Go to your settings and ensure automated reminder alerts are active 24 hours prior.

*Actionable Next Step:* Navigate to **Settings** and toggle **Auto-Require Deposit** for high-risk customers.`;
    } else if (queryLower.includes('source') || queryLower.includes('buy') || queryLower.includes('order') || queryLower.includes('equipment') || queryLower.includes('inventory') || queryLower.includes('supply')) {
      const suggestedItem = business.category === 'RESTAURANT' ? 'commercial kitchen/espresso equipment' : 'professional therapy/styling appliances';
      reply = `### 📦 Inventory Sourcing & Sizing Advice

Using Alibaba Accio, you can forecast supply needs and purchase directly at wholesale prices.

1. **Accio Sourcing Integration:** Based on your booking forecast, check our Accio Sourcing panel on your dashboard. It automatically tracks upcoming guest counts to recommend bulk supply quantities.
2. **Expand Services:** Sourcing high-margin items like ${suggestedItem} on Alibaba is highly profitable. You can launch these directly with 1-click on the dashboard.
3. **Pabandi Badge Boost:** Display your Pabandi Reliability Badge on your Alibaba supplier inquiries to show you are a trusted business.

*Actionable Next Step:* Look at the **Accio Wholesale Sourcing** widget below to view automated supply drafts for this week.`;
    } else if (queryLower.includes('grow') || queryLower.includes('marketing') || queryLower.includes('customer') || queryLower.includes('more') || queryLower.includes('booking') || queryLower.includes('popular')) {
      reply = `### 🚀 Growth and Customer Acquisition Strategy

To increase booking volume for **${business.name}** in ${business.city || 'Karachi'}:

1. **Offer PAB Rewards:** Ensure you are advertising $PAB rewards for on-time check-ins. Customers are actively seeking businesses that pay crypto dividends for reliability.
2. **Link Social Reputations:** Encourage customers to link their TikTok, LinkedIn, and Fiverr accounts to gain free booking trust tokens.
3. **Implement Referral Loops:** Offer booking discounts or $PAB token incentives to customers who refer new users to your business page.

*Actionable Next Step:* Download your unique QR code flyer from the **Staking and Rewards** portal and display it at your front desk to drive check-in engagement.`;
    } else {
      // Default category specific response
      if (business.category === 'RESTAURANT') {
        reply = `### 🍽️ Optimization Insights for **${business.name}**

As a restaurant in ${business.city || 'Karachi'}, operational efficiency relies on table turnover and ingredient inventory management.

1. **Menu Expansion:** Consider sourcing high-end kitchenware or specialty espresso machinery on Alibaba to introduce premium menu add-ons.
2. **Peak Hour Deposits:** Protect dinner slots on Friday and Saturday by enabling dynamic trust-score deposits.
3. **Real-time SMS alerts:** Ensure customers receive automated confirmation links so they can cancel in advance if plans change.

*Actionable Next Step:* Type a more specific question, like *"How do I stop no-shows?"* or *"What should I source on Alibaba?"* to get targeted strategies.`;
      } else {
        reply = `### 💆 Operational Excellence for **${business.name}**

For your service clinic or salon, managing staff availability and high-value service slots is key.

1. **Professional Equipment:** Upgrade your treatment tables, lighting, or styling chairs by sourcing wholesale on Alibaba to elevate the luxury feel.
2. **Overbooking Margin:** Use our Overbooking Advisor suggestions to safely double-book slots where the customer has low attendance confidence.
3. **PAB Loyalty:** Reward return clients with direct $PAB transfers to build an active, recurring client base.

*Actionable Next Step:* Try asking me about *"inventory sourcing"* or *"reducing cancellations"* for specialized advice.`;
      }
    }

    res.json({ response: reply });
  } catch (error) {
    logger.error('Consult advisor error', error);
    res.status(500).json({ error: 'Failed to consult business advisor agent' });
  }
};
