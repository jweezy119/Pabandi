import axios from 'axios';

const WEBHOOK_URL = 'http://localhost:5000/api/v1/integrations/tiktok/webhook';

async function simulateTikTokWebhook() {
  console.log("--- Simulating TikTok Shop Webhook (New Order) ---");
  
  const payload = {
    type: 'ORDER_STATUS_UPDATE',
    data: {
      order_id: 'TT-SHOP-999888777',
      order_status: 'UNPAID',
      payment_method: 'COD',
      // TikTok Shop provides the raw PII to the seller's webhook:
      buyer_phone: '+923001234567',
      buyer_name: 'Test Buyer'
    }
  };

  try {
    const response = await axios.post(WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        // 'x-tts-signature': '...' (In production we verify this)
      }
    });

    console.log("Webhook Response:", response.data);
    console.log("Check the Pabandi Backend logs to see the Zero-Knowledge processing!");
  } catch (err: any) {
    console.error("Webhook failed:", err.response?.data || err.message);
  }
}

simulateTikTokWebhook();
