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
    
    // Check if store already exists
    let store = await prisma.shopifyStore.findUnique({
      where: { shopUrl: session.shop }
    });

    if (store) {
      await prisma.shopifyStore.update({
        where: { shopUrl: session.shop },
        data: { accessToken: session.accessToken }
      });
    } else {
      // Create new disconnected store placeholder
      await prisma.shopifyStore.create({
        data: {
          shopUrl: session.shop,
          accessToken: session.accessToken || '',
        }
      });
    }

    // Redirect to the embedded app UI
    res.redirect(`/?shop=${session.shop}&host=${req.query.host}`);
  } catch (error) {
    console.error('Shopify Auth Callback Error:', error);
    res.status(500).json({ error: 'Failed to complete OAuth.' });
  }
};

export const connectShopifyStore = async (req: Request, res: Response) => {
  try {
    const businessId = (req as any).user?.businessId;
    const { shop } = req.body;

    if (!businessId || !shop) {
      return res.status(400).json({ error: 'Missing businessId or shop' });
    }

    const store = await prisma.shopifyStore.findUnique({
      where: { shopUrl: shop }
    });

    if (!store) {
      return res.status(404).json({ error: 'Store not found. Please reinstall the app.' });
    }

    await prisma.shopifyStore.update({
      where: { shopUrl: shop },
      data: { businessId }
    });

    res.status(200).json({ success: true, message: 'Store connected successfully' });
  } catch (error) {
    console.error('Connect Shopify Store Error:', error);
    res.status(500).json({ error: 'Failed to connect store' });
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
