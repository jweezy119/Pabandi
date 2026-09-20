import { prisma } from '../utils/database';
import { buyPAB, sellPAB, getPoolInfo, getFees } from './raydiumPool.service';

/**
 * Seed the PAB ecosystem with test data
 */
export async function seedPabEcosystem() {
  console.log('[Seed] Starting PAB ecosystem seed...');

  // 1. Create test tenants with PAB stakes
  const tenants = [];
  for (let i = 0; i < 10; i++) {
    const tenant = await prisma.propertyTenant.create({
      data: {
        email: `tenant${i}@test.com`,
        firstName: `Tenant`,
        lastName: `${i}`,
        phone: `+1-555-000${i}`,
        balanceUsdc: 100 + Math.random() * 500,
        balancePab: 100 + Math.random() * 500,
        trustScore: 50 + Math.floor(Math.random() * 50),
        verificationTier: 'VERIFIED',
        isActive: true,
      },
    });
    tenants.push(tenant);
    console.log(`[Seed] Created tenant ${tenant.id} with ${tenant.balancePab} PAB`);
  }

  // 2. Create test properties
  const properties = [];
  for (let i = 0; i < 5; i++) {
    const property = await prisma.propertyManagerProperty.create({
      data: {
        name: `Property ${i}`,
        address: `${100 + i} Main St`,
        city: 'Chicago',
        state: 'IL',
        zip: `6060${i}`,
        units: 10 + i * 5,
        monthlyRent: 1000 + i * 200,
        depositAmount: 1000 + i * 200,
        isActive: true,
      },
    });
    properties.push(property);
    console.log(`[Seed] Created property ${property.id}`);
  }

  // 3. Create test agents with balances
  const agents = [];
  for (let i = 0; i < 5; i++) {
    const agent = await prisma.agentProfile.create({
      data: {
        name: `Agent ${i}`,
        slug: `agent-${i}`,
        description: 'Test trading agent',
        capabilities: ['trading', 'analysis'],
        walletAddress: `agent_wallet_${i}`,
        publicKey: `agent_pubkey_${i}`,
        reputation: 50 + Math.floor(Math.random() * 50),
        balanceUsdc: 10 + Math.random() * 20,
        balancePab: 1000 + Math.random() * 5000,
        isActive: true,
      },
    });
    agents.push(agent);
    console.log(`[Seed] Created agent ${agent.id} with ${agent.balanceUsdc} USDC, ${agent.balancePab} PAB`);
  }

  // 4. Create leases with PAB deposits
  for (let i = 0; i < Math.min(tenants.length, properties.length); i++) {
    const lease = await prisma.propertyLease.create({
      data: {
        tenantId: tenants[i].id,
        propertyId: properties[i].id,
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 86400000),
        monthlyRent: 1000 + i * 200,
        depositAmount: 1000 + i * 200,
        depositToken: 'PAB',
        status: 'ACTIVE',
      },
    });
    console.log(`[Seed] Created lease ${lease.id}`);
  }

  console.log('[Seed] ✅ Ecosystem seeded successfully');
  console.log(`[Seed] ${tenants.length} tenants, ${properties.length} properties, ${agents.length} agents`);

  return { tenants, properties, agents };
}

// Run if called directly
if (require.main === module) {
  seedPabEcosystem()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[Seed] Failed:', err);
      process.exit(1);
    });
}
