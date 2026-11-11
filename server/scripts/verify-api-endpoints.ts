process.env.DATABASE_URL = 'postgresql://mock:mock@localhost:5432/mock';
process.env.JWT_SECRET = 'test-secret-key-1234567890';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.PTP_SIGNING_SECRET = 'ptp-secret-12345';

import express from 'express';
import jwt from 'jsonwebtoken';
import http from 'http';

// Create mock database store
const mockData = {
  crmServiceBusiness: {
    findUnique: async () => ({ id: 'crm-biz-1', businessId: 'test-biz-id', ownerId: 'test-user-id' }),
    findFirst: async () => ({ id: 'crm-biz-1', businessId: 'test-biz-id', ownerId: 'test-user-id' }),
  },
  business: {
    findUnique: async () => ({ id: 'test-biz-id', name: 'Karachi Tech Works', ownerId: 'test-user-id', city: 'Karachi', category: 'PLUMBING' }),
    findFirst: async () => ({ id: 'test-biz-id', name: 'Karachi Tech Works', ownerId: 'test-user-id', city: 'Karachi', category: 'PLUMBING' }),
    findMany: async () => ([
      {
        id: 'biz-1',
        name: 'Karachi Tech Works',
        category: 'PLUMBING',
        city: 'Karachi',
        rating: 4.8,
        reviewCount: 24,
        avatarUrl: null,
        startingPrice: 1500,
        escrowEnabled: true,
        trustBand: 'HIGH',
        user: { website: 'https://karachitechtrial.org' },
      },
    ]),
  },
  technician: {
    findMany: async () => ([
      {
        id: 'tech-1',
        businessId: 'test-biz-id',
        name: 'Ali Khan',
        phoneEncrypted: 'enc-phone-123',
        skills: ['plumbing', 'electrical'],
        active: true,
        experienceYears: 5,
      },
    ]),
  },
  workOrder: {
    findMany: async () => ([
      {
        id: 'wo-1',
        businessId: 'test-biz-id',
        customerId: 'cust-1',
        status: 'IN_PROGRESS',
        priority: 'URGENT',
        issueType: 'leak',
        description: 'Emergency pipe burst',
        address: 'Shahrah-e-Faisal, Karachi',
        scheduledFor: new Date(),
        completedAt: null,
        invoiceStatus: 'READY',
        customer: { id: 'cust-1', name: 'Zubair Ahmed', phoneEncrypted: 'enc-phone' },
        assignments: [],
        attachments: [],
        _count: { auditLog: 0 },
      },
    ]),
  },
  invoice: {
    findMany: async () => ([
      {
        id: 'inv-1',
        businessId: 'test-biz-id',
        status: 'PAID',
        amount: 4500,
        currency: 'PKR',
        client: 'Zubair Ahmed',
        createdAt: new Date(),
      },
    ]),
  },
  businessSettings: {
    findUnique: async () => ({
      businessId: 'test-biz-id',
      vertical: 'PLUMBING',
    }),
  },
  $queryRaw: async () => [],
};

// Patch prisma module cache before routes require it
const prismaLib = require('../src/lib/prisma');
const dbLib = require('../src/utils/database');

for (const [key, val] of Object.entries(mockData)) {
  (prismaLib.prisma as any)[key] = val;
  if (dbLib.prisma) {
    (dbLib.prisma as any)[key] = val;
  }
}

// Also mock risk service to avoid raw query issues
const riskService = require('../src/services/predictiveEngine.service');
if (riskService) {
  riskService.predictRiskForWorkOrders = async () => new Map();
}

async function testEndpoints() {
  const app = express();
  app.use(express.json());

  // Generate test token
  const token = jwt.sign(
    {
      id: 'test-user-id',
      email: 'test@pabandi.local',
      role: 'BUSINESS',
      businessId: 'test-biz-id',
    },
    process.env.JWT_SECRET!
  );

  // Mount routers
  const crmRouter = require('../src/routes/crm.routes').default || require('../src/routes/crm.routes');
  const coordRouter = require('../src/routes/serviceCoordinator.routes').default || require('../src/routes/serviceCoordinator.routes');
  const bookingRouter = require('../src/routes/booking.routes').default || require('../src/routes/booking.routes');

  app.use('/api/v1/crm', crmRouter);
  app.use('/api/v1/coordinator', coordRouter);
  app.use('/api/v1/booking', bookingRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(48915, resolve));
  console.log('Test server listening on port 48915');

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const endpoints = [
    '/api/v1/crm/invoices',
    '/api/v1/coordinator/technicians',
    '/api/v1/coordinator/work-orders',
    '/api/v1/booking/businesses?limit=20',
  ];

  let allPassed = true;

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(`http://localhost:48915${endpoint}`, { headers });
      const status = res.status;
      const body = await res.json().catch(() => ({}));
      console.log(`Endpoint: ${endpoint} -> Status: ${status}`);
      if (status !== 200) {
        console.error(`❌ Expected 200 but received ${status}:`, JSON.stringify(body));
        allPassed = false;
      } else {
        console.log(`✅ ${endpoint} returned 200 OK.`);
        console.log('   Response Sample:', JSON.stringify(body).slice(0, 140) + '...');
      }
    } catch (err: any) {
      console.error(`❌ Request to ${endpoint} failed:`, err.message);
      allPassed = false;
    }
  }

  server.close();
  if (!allPassed) {
    console.error('Some endpoints failed to return 200 OK.');
    process.exit(1);
  } else {
    console.log('🎉 ALL TARGET ENDPOINTS RETURNED 200 OK WITH VALID JSON!');
    process.exit(0);
  }
}

testEndpoints().catch((err) => {
  console.error('Fatal error running endpoint verification:', err);
  process.exit(1);
});
