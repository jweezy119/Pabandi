import crypto from 'crypto';
import axios from 'axios';

// Pabandi Zero-Knowledge Network Base URL
const API_URL = 'http://localhost:5000/api/v1/network';
// You would use an actual B2B API Key from Daraz/Alibaba or a Shopify merchant account
const PABANDI_API_KEY = 'test_api_key_123'; 

/**
 * MOCK SHOPIFY CHECKOUT EVENT
 * This happens completely server-side. The consumer never knows Pabandi exists.
 */
async function shopifyCheckoutWebhookHandler() {
  console.log("--- 1. Order initiated on Shopify ---");
  const buyerPhoneNumber = "+923001234567"; // Raw PII, we NEVER send this to Pabandi
  
  // Hash the phone number locally on the merchant's server
  const hashedPhone = crypto.createHash('sha256').update(buyerPhoneNumber).digest('hex');
  console.log(`🔒 Hashed Identity created: ${hashedPhone}`);
  
  try {
    // Ping Pabandi to check the blocklist history of this hash
    console.log("--- 2. Checking Pabandi Zero-Knowledge Network ---");
    const checkResponse = await axios.post(`${API_URL}/check-hash`, {
      hash: hashedPhone
    }, {
      headers: { 'x-api-key': PABANDI_API_KEY }
    });
    
    console.log("Network Response:", JSON.stringify(checkResponse.data, null, 2));
    
    const { prediction } = checkResponse.data.data;
    
    // The Shopify plugin reads the AI recommendation
    if (prediction.riskLevel === 'CRITICAL' || prediction.recommendation.action.includes('Disable Cash on Delivery')) {
      console.log("⚠️ WARNING: High risk of COD Rejection detected.");
      console.log("🛠️ Action taken: Dynamically removing 'Cash on Delivery' from checkout options.");
    } else {
      console.log("✅ Trust score is acceptable. Proceeding with standard checkout.");
    }
  } catch (err: any) {
    console.error("Failed to check hash:", err.response?.data || err.message);
  }
}

/**
 * MOCK COD REJECTION EVENT (3 days later)
 * The courier returns the package. The merchant reports the hash.
 */
async function reportBadActor() {
  const hashedPhone = crypto.createHash('sha256').update("+923001234567").digest('hex');
  
  console.log("\n--- 3. Reporting COD Rejection to Network ---");
  try {
    const reportResponse = await axios.post(`${API_URL}/report-hash`, {
      hash: hashedPhone,
      type: 'COD_REJECTION',
      description: 'Buyer refused package at the door.'
    }, {
      headers: { 'x-api-key': PABANDI_API_KEY }
    });
    
    console.log("Incident successfully filed against hash:", reportResponse.data);
  } catch (err: any) {
    console.error("Failed to report hash:", err.response?.data || err.message);
  }
}

// Run the demo
async function run() {
  // First time checking, should be low risk
  await shopifyCheckoutWebhookHandler();
  // Reporting a bad event
  await reportBadActor();
  // Checking again, should see the AI flag the high risk
  console.log("\n--- 4. Checking Network AFTER Incident ---");
  await shopifyCheckoutWebhookHandler();
}

// Note: To run this against the actual DB, the Pabandi server must be running.
console.log("Shopify Plugin Demo Ready. Start the server on port 5000 and execute this script to test.");
