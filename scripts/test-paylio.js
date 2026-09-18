#!/usr/bin/env node
// PayLio API test — uses the /wallet endpoint with correct params
// Run: node scripts/test-paylio.js

const API_KEY = process.env.PAYLIO_API_KEY || 'plio_live_xWTb-tF6z5AoqZlbSSw80B2Ib-XhZXdf';
const API_URL = 'https://paylio.org/api/v1';

async function main() {
  console.log('=== PayLio API Test ===');
  console.log(`Key: ${API_KEY.substring(0, 12)}...${API_KEY.slice(-4)}`);
  console.log('');

  // Test 1: Create a $1.00 checkout via /wallet
  console.log('[1] Creating $1.00 checkout via POST /wallet...');
  try {
    const res = await fetch(`${API_URL}/wallet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        address: '0x5d838a283b78f17b6e482fed23f16e391a570ec7',
        amount: '1.00',
        currency: 'USD',
        callback: 'https://pabandi.com/api/v1/payments/webhook/paylio',
        passFeeToCustomer: true,
        email: 'test@pabandi.com',
        note: 'Pabandi API test',
      }),
    });

    const text = await res.text();
    console.log(`Status: ${res.status}`);
    console.log(`Content-Type: ${res.headers.get('content-type')}`);

    let data;
    try { data = JSON.parse(text); } catch { data = null; }

    if (data) {
      console.log(`Response: ${JSON.stringify(data, null, 2)}`);

      const url = data.checkout_url || data.url;
      if (url) {
        console.log('');
        console.log('=== RESULT: PASS ===');
        console.log(`API key is valid. Open this URL to pay $1.00:`);
        console.log(url);
        return;
      }

      if (data.error) {
        console.log('');
        console.log(`=== RESULT: ERROR ===`);
        console.log(`PayLio says: ${data.error}`);
        return;
      }
    } else {
      console.log(`Raw response: ${text.substring(0, 300)}`);
    }
  } catch (err) {
    console.log(`Error: ${err.message}`);
  }

  // Test 2: Check payment status endpoint
  console.log('\n[2] Testing GET /payment-status...');
  try {
    const res = await fetch(`${API_URL}/payment-status?ipn_token=test`, {
      headers: { 'Authorization': `Bearer ${API_KEY}` },
    });
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      console.log(`Response: ${JSON.stringify(data, null, 2)}`);
    } catch {
      console.log(`Raw: ${text.substring(0, 200)}`);
    }
  } catch (err) {
    console.log(`Error: ${err.message}`);
  }

  console.log('\n=== DONE ===');
}

main();
