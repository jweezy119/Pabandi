import axios from 'axios';

const SERVER_URL = 'http://localhost:5000/api/v1/whatsapp/webhook';

async function simulateWhatsAppMessage(phoneNumber: string, message: string) {
  console.log(`\n--- Simulating WhatsApp Message ---`);
  console.log(`From: ${phoneNumber}`);
  console.log(`Message: "${message}"`);
  console.log(`Sending to: ${SERVER_URL}...\n`);

  try {
    const response = await axios.post(SERVER_URL, {
      Body: message,
      From: `whatsapp:${phoneNumber}`,
      ProfileName: 'TestUser'
    });
    
    console.log(`✅ Webhook Accepted (Status: ${response.status})`);
    console.log(`Check your server console to see the AI processing the message and sending the reply!`);
  } catch (error: any) {
    console.error(`❌ Webhook Failed:`, error.message);
  }
}

// Run the simulation
simulateWhatsAppMessage('+923001234567', 'Hi, do you have a table for 2 tonight at 8 PM at The Monal?');
