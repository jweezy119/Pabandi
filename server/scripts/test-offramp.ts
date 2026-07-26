import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Target the production Cloud Run URL
const API_URL = 'https://pabandi-backend-97129395003.asia-south1.run.app/api/v1/offramp';
// The API Key from offramp.routes.ts for LP auth
const LP_API_KEY = process.env.OFFRAMP__LP_API_KEY || 'lp_test_key_123';

async function runOfframpTest() {
  console.log('🚀 Starting Phase 0.1 Offramp E2E Test...');
  
  // 1. Customer Requests Intent
  console.log('\n[1] Customer requesting offramp intent...');
  const intentPayload = {
    amountUsdc: 50.0,
    minRatePkr: 278.50,
    destinationType: 'Easypaisa',
    destinationRef: '03001234567',
    customerWallet: '0xabc123customerWalletMockAddress'
  };

  const intentRes = await axios.post(`${API_URL}/intent`, intentPayload, {
    headers: { 'X-Idempotency-Key': `test-intent-${Date.now()}` }
  });
  
  const intentId = intentRes.data.intentId;
  console.log(`✅ Intent created! ID: ${intentId}`);
  console.log(`Status: ${intentRes.data.status}`);

  // Wait a moment for match
  console.log('Waiting 2 seconds for LP matching...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 2. Poll Status
  console.log(`\n[2] Polling intent status...`);
  const statusRes = await axios.get(`${API_URL}/intent/${intentId}`);
  console.log(`Current Status: ${statusRes.data.intent.status}`);
  const lpWallet = statusRes.data.intent.lpWallet;

  if (statusRes.data.intent.status !== 'MATCHED' || !lpWallet) {
    console.error('❌ Intent did not match with an LP. Is there active LP liquidity in the DB?');
    return;
  }
  console.log(`✅ Matched with LP Wallet: ${lpWallet}`);

  // 3. LP Submits Proof
  console.log('\n[3] LP submitting fiat payment proof...');
  
  // For the test, we'll need a mock receipt image in base64.
  // In a real scenario, this would be a real JazzCash/Easypaisa screenshot.
  // We'll use a tiny transparent 1x1 png just to test the endpoint wiring,
  // but note that DashScope might reject it as not a valid receipt.
  const dummyBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

  try {
    const proofRes = await axios.post(`${API_URL}/lp/submit-proof`, {
      intentId: intentId,
      lpWallet: lpWallet,
      imageBase64: dummyBase64
    }, {
      headers: { 'x-api-key': LP_API_KEY }
    });

    console.log('✅ Proof submitted and processed by AI!');
    console.log(JSON.stringify(proofRes.data, null, 2));
  } catch (error: any) {
    console.error('❌ Proof submission failed:');
    if (error.response) {
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }
  }

  // 4. Final Status Check
  console.log(`\n[4] Final status check...`);
  const finalStatus = await axios.get(`${API_URL}/intent/${intentId}`);
  console.log(`Final Status: ${finalStatus.data.intent.status}`);
}

runOfframpTest().catch(console.error);
