import { Request, Response } from 'express';
import { prisma } from '../utils/database';
import { LiveSellerService } from '../services/live-seller.service';
import { logger } from '../utils/logger';

const liveSellerService = new LiveSellerService(prisma);

export const ebayAuthRedirect = async (req: Request, res: Response) => {
  try {
    const businessId = req.query.businessId as string;
    if (!businessId) return res.status(400).json({ error: 'Business ID required' });
    
    // Simulated eBay OAuth Redirect
    const clientId = 'PABANDI_APP_ID_DEMO';
    const scopes = encodeURIComponent('https://api.ebay.com/oauth/api_scope/sell.inventory.readonly');
    const redirectUrl = `https://auth.sandbox.ebay.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=Pabandi_Live-PabandiLi-paband-oxdjd&scope=${scopes}&state=${businessId}`;
    
    // We send a JSON response containing the URL so the frontend can redirect the user
    res.json({ authUrl: redirectUrl });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const ebayAuthCallback = async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    const businessId = state as string;

    if (!code || !businessId) {
      return res.status(400).json({ error: 'Invalid callback parameters' });
    }

    // Simulate exchanging code for token
    const mockAccessToken = `v^1.1#i^1#r^0#I^3#f^0#p^3#t^H4sIAAA...${Date.now()}`;
    
    await liveSellerService.connect(businessId, {
      platform: 'EBAY_LIVE',
      accessToken: mockAccessToken,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours expiry
    });

    logger.info(`[eBay] Successfully connected eBay account for business ${businessId}`);

    // In a real flow, redirect back to frontend Live Seller hub
    // Since this is just an API, we can redirect to a predefined frontend route
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/business/${businessId}?ebay_connected=true`);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
