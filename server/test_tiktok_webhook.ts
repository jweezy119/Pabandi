import axios from 'axios';
import crypto from 'crypto';

const WEBHOOK_URL = 'http://localhost:5000/api/v1/integrations/tiktok/webhook';
const TIKTOK_APP_SECRET = 'demo_tiktok_secret';

async function simulateTikTokWebhook() {
  console.log("--- Simulating TikTok Shop Webhook (New Order) ---");
  
  const payload = {
    type: 'ORDER_STATUS_UPDATE',
    data: {
      order_id: 'TT-SHOP-999888777',
      order_status: 'UNPAID',
      payment_method: 'COD',
      buyer_phone: '+923001234567',
      buyer_name: 'Test Buyer'
    }
  };

  const rawBody = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', TIKTOK_APP_SECRET).update(rawBody).digest('hex');

  try {
    const response = await axios.post(WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'x-tts-signature': signature
      }
    });

    console.log("Webhook Response:", response.data);
    console.log("Check the Pabandi Backend logs to see the Zero-Knowledge processing!");
  } catch (err: any) {
    console.error("Webhook failed:", err.response?.data || err.message);
  }
}

simulateTikTokWebhook();
