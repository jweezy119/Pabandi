import { Request, Response } from 'express';
import { prisma } from '../utils/database';
require('@shopify/shopify-api/adapters/node');
import { shopifyApi, ApiVersion } from '@shopify/shopify-api';

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY || 'dummy_api_key',
  apiSecretKey: process.env.SHOPIFY_API_SECRET || 'dummy_api_secret',
  scopes: ['read_orders', 'write_orders', 'read_products'],
  hostName: process.env.SHOPIFY_HOST_NAME || 'localhost:5000',
  apiVersion: ApiVersion.January25,
  isEmbeddedApp: true,
});

export const shopifyAuth = async (req: Request, res: Response) => {
  try {
    const shop = req.query.shop as string;
    if (!shop) {
      return res.status(400).send('Missing shop parameter.');
    }
    
    // Redirect to Shopify for OAuth
    await shopify.auth.begin({
      shop: shopify.utils.sanitizeShop(shop, true)!,
      callbackPath: '/api/v1/shopify/callback',
      isOnline: false,
      rawRequest: req,
      rawResponse: res,
    });
  } catch (error) {
    console.error('Shopify Auth Error:', error);
    res.status(500).json({ error: 'Failed to initiate OAuth.' });
  }
};

export const shopifyAuthCallback = async (req: Request, res: Response) => {
  try {
    const callback = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    const session = callback.session;
    
    // Check if store already exists or create new placeholder
    let store = await prisma.shopifyStore.findUnique({
      where: { shopUrl: session.shop }
    });

    if (store) {
      await prisma.shopifyStore.update({
        where: { shopUrl: session.shop },
        data: { accessToken: session.accessToken }
      });
    } else {
      // Find business ID to associate (mocking this temporarily, usually passed via state)
      const mockBusinessId = process.env.MOCK_BUSINESS_ID; 
      if (mockBusinessId) {
        await prisma.shopifyStore.create({
          data: {
            businessId: mockBusinessId,
            shopUrl: session.shop,
            accessToken: session.accessToken || '',
          }
        });
      }
    }

    // Redirect to the embedded app UI
    res.redirect(`/?shop=${session.shop}&host=${req.query.host}`);
  } catch (error) {
    console.error('Shopify Auth Callback Error:', error);
    res.status(500).json({ error: 'Failed to complete OAuth.' });
  }
};

export const shopifyWebhooks = async (req: Request, res: Response) => {
  try {
    await shopify.webhooks.process({
      rawBody: req.body,
      rawRequest: req,
      rawResponse: res,
    });
    console.log('Webhook processed successfully.');
  } catch (error: any) {
    console.error('Failed to process webhook:', error.message);
    res.status(500).send(error.message);
  }
};
