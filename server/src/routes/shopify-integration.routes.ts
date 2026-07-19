import { Router } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @route POST /api/v1/shopify-integration/checkout
 * @desc Accepts a Shopify Cart JSON payload and creates a Pabandi Escrow Checkout session.
 */
router.post('/checkout', async (req, res) => {
  try {
    const { shopUrl, cartData } = req.body;

    if (!shopUrl || !cartData || !cartData.items) {
      return res.status(400).json({ error: 'Missing shopUrl or cart data' });
    }

    // 1. Find the connected store
    const store = await prisma.shopifyStore.findUnique({
      where: { shopUrl },
      include: { business: true }
    });

    if (!store || !store.businessId || !store.escrowEnabled) {
      return res.status(400).json({ error: 'Store not found or Escrow is not enabled.' });
    }

    // 2. Calculate Total Amount in USD
    const totalAmount = cartData.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity / 100), 0);
    
    // 3. Create Escrow Session
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry for cart

    const session = await prisma.checkoutSession.create({
      data: {
        businessId: store.businessId,
        amount: totalAmount,
        currency: 'USD',
        metadata: {
          platform: 'shopify',
          shopUrl,
          cartToken: cartData.token,
          items: cartData.items.map((i: any) => ({ title: i.title, quantity: i.quantity, price: i.price / 100 }))
        },
        successUrl: `https://${shopUrl}/pages/pabandi-success`, // The user will create this page on Shopify
        cancelUrl: `https://${shopUrl}/cart`,
        expiresAt,
        status: 'PENDING'
      }
    });

    const checkoutUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/${session.id}`;

    res.json({ checkoutUrl });
  } catch (error: any) {
    logger.error('Shopify Checkout Error:', error);
    res.status(500).json({ error: 'Failed to create Escrow Checkout' });
  }
});

/**
 * @route POST /api/v1/shopify-integration/webhook/funded
 * @desc Internal webhook called by Pabandi Payment engine when a Shopify Escrow is fully funded.
 */
router.post('/webhook/funded', async (req, res) => {
  try {
    // In production, secure this endpoint so only our internal server can call it.
    const { sessionId } = req.body;

    const session = await prisma.checkoutSession.findUnique({
      where: { id: sessionId },
      include: { business: true }
    });

    if (!session || (session.metadata as any)?.platform !== 'shopify') {
      return res.status(400).json({ error: 'Invalid or non-Shopify session' });
    }

    const metadata = session.metadata as any;
    
    const store = await prisma.shopifyStore.findUnique({
      where: { shopUrl: metadata.shopUrl }
    });

    if (!store || !store.accessToken) {
      return res.status(400).json({ error: 'Store credentials not found' });
    }

    // Create the Shopify Draft Order / Order using their REST API
    // Since we don't have the actual Shopify module initialized for the specific shop context in this exact request context,
    // we use standard fetch against Shopify Admin API.
    const shopifyApiUrl = `https://${store.shopUrl}/admin/api/2025-01/orders.json`;

    const orderPayload = {
      order: {
        line_items: metadata.items.map((item: any) => ({
          title: item.title,
          price: item.price,
          quantity: item.quantity
        })),
        financial_status: 'paid', // Mark as paid since Escrow is funded
        note: `Pabandi Escrow Session ID: ${session.id}`,
        tags: 'Pabandi, Escrow, Trust-Verified'
      }
    };

    const response = await fetch(shopifyApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': store.accessToken
      },
      body: JSON.stringify(orderPayload)
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error('Shopify Order Creation Failed:', errText);
      return res.status(500).json({ error: 'Failed to push order to Shopify' });
    }

    res.json({ success: true, message: 'Shopify order created and marked as paid via Escrow' });
  } catch (error: any) {
    logger.error('Shopify Webhook Error:', error);
    res.status(500).json({ error: 'Internal Error' });
  }
});

export default router;
