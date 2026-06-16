import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { email: 's.hussain119@gmail.com' } });
  if (!user) throw new Error("No user");

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: '7d' }
  );

  const res = await axios.get('http://localhost:5000/api/v1/businesses/me', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log("RESPONSE:", JSON.stringify(res.data, null, 2));
}

main().catch(e => console.error(e?.response?.data || e.message)).finally(() => prisma.$disconnect());
