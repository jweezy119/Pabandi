import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

async function runTests() {
  console.log('Seeding test data...');
  
  // Clean up previous test data
  await prisma.apiClient.deleteMany({ where: { email: 'test-api@pabandi.com' } });
  const oldUsers = await prisma.user.findMany({ where: { email: 'test-user@pabandi.com' } });
  for (const u of oldUsers) {
    await prisma.dispute.deleteMany({ where: { userId: u.id } });
    await prisma.wallet.deleteMany({ where: { userId: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
  }

  // Create test user
  const user = await prisma.user.create({
    data: {
      email: 'test-user@pabandi.com',
      firstName: 'Test',
      lastName: 'User',
      passwordHash: 'dummy',
      reliabilityScore: 800, // Should be Platinum or Gold (700+)
    }
  });

  // Create wallet
  const walletAddress = 'test_wallet_xyz123';
  await prisma.wallet.create({
    data: {
      userId: user.id,
      address: walletAddress,
    }
  });

  // Create API Client
  const apiKey = 'pk_live_testkey999';
  await prisma.apiClient.create({
    data: {
      name: 'Test Client',
      email: 'test-api@pabandi.com',
      apiKey: apiKey,
      tier: 'STARTER',
      callsLimit: 100,
    }
  });

  console.log('Test data created. Wallet:', walletAddress, '| API Key:', apiKey);

  // We will run the server in another process, so we just return now.
  console.log('Done.');
  process.exit(0);
}

runTests().catch(console.error);
