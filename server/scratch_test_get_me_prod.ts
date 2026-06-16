import jwt from 'jsonwebtoken';
import axios from 'axios';

const secret = process.env.JWT_SECRET || 'fallback_secret_for_development_only_12345';
const token = jwt.sign(
  { id: 'cmo92doif0000ct1yelzcoudf', email: 's.hussain119@gmail.com', role: 'BUSINESS_OWNER' },
  secret,
  { expiresIn: '7d' }
);

async function test() {
  try {
    const res = await axios.get('https://pabandi-server-97129395003.asia-south1.run.app/api/v1/businesses/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("SUCCESS:", JSON.stringify(res.data, null, 2));
  } catch (error: any) {
    console.error("ERROR:", error.response?.data || error.message);
  }
}

test();
