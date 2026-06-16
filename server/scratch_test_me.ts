import jwt from 'jsonwebtoken';
import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

const token = jwt.sign(
  { id: 'cmpzj5xpv0000mrnrofeci9xa', email: 'fizzali782@gmail.com', role: 'BUSINESS_OWNER' },
  process.env.JWT_SECRET || '',
  { expiresIn: '1h' }
);

async function test() {
  try {
    const res = await axios.get('http://localhost:5000/api/v1/businesses/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err: any) {
    console.error(err.response?.data || err.message);
  }
}

test();
