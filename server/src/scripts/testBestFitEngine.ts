import dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../utils/database';
import { bestFitEngineService } from '../services/ai/bestFitEngine.service';
import { logger } from '../utils/logger';

async function runTest() {
  logger.info('🚀 Starting Best Fit Engine Test...');

  // 1. Create a dummy passport for testing
  const passport1 = await prisma.trustPassport.create({
    data: {
      handle: `test-freelancer-${Date.now()}`,
      category: 'FREELANCER',
      displayName: 'Jane Doe (Morning Plumber)',
      riskScore: 850,
      visibility: 'PUBLIC'
    }
  });

  const passport2 = await prisma.trustPassport.create({
    data: {
      handle: `test-freelancer-${Date.now() + 1}`,
      category: 'FREELANCER',
      displayName: 'John Smith (Night Caterer)',
      riskScore: 750,
      visibility: 'PUBLIC'
    }
  });

  // 2. Add skills
  await prisma.skillEndorsement.createMany({
    data: [
      { passportId: passport1.id, skillName: 'Plumbing', rating: 5, weight: 1.5 },
      { passportId: passport2.id, skillName: 'Catering', rating: 4, weight: 1.0 }
    ]
  });

  logger.info('✅ Created dummy passports and skills');

  // 3. Simulate gig history for Jane (mostly mornings, high rating)
  logger.info('Simulating gig history for Jane (Morning Gigs)...');
  for (let i = 0; i < 10; i++) {
    // 8am gigs
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(8, 0, 0, 0);

    await bestFitEngineService.ingestGigOutcome({
      passportId: passport1.id,
      title: `Morning Plumbing Job ${i}`,
      scheduledDate: date,
      status: 'COMPLETED',
      clientRating: 5,
      leadTimeHours: 2, // fast response
      zipCode: '10001'
    });
  }

  // 4. Simulate gig history for John (mostly nights, medium rating)
  logger.info('Simulating gig history for John (Night Gigs)...');
  for (let i = 0; i < 10; i++) {
    // 9pm gigs
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(21, 0, 0, 0);

    await bestFitEngineService.ingestGigOutcome({
      passportId: passport2.id,
      title: `Night Catering Job ${i}`,
      scheduledDate: date,
      status: i % 10 === 0 ? 'NO_SHOW' : 'COMPLETED', // 90% completion
      clientRating: 4,
      leadTimeHours: 24, // slower response
      zipCode: '10002'
    });
  }

  logger.info('✅ Ingested gig history and generated vectors');

  // 5. Test 1: Looking for a morning plumber
  logger.info('\n🔍 TEST 1: Searching for Morning Plumber (8am)...');
  const morningDate = new Date();
  morningDate.setHours(8, 0, 0, 0);

  const morningMatches = await bestFitEngineService.predictBestFit({
    scheduledDate: morningDate,
    skills: ['Plumbing'],
    limit: 2
  });
  
  console.log(JSON.stringify(morningMatches, null, 2));

  // 6. Test 2: Looking for a night caterer
  logger.info('\n🔍 TEST 2: Searching for Night Caterer (9pm)...');
  const nightDate = new Date();
  nightDate.setHours(21, 0, 0, 0);

  const nightMatches = await bestFitEngineService.predictBestFit({
    scheduledDate: nightDate,
    skills: ['Catering'],
    limit: 2
  });

  console.log(JSON.stringify(nightMatches, null, 2));

  // Cleanup
  await prisma.trustPassport.deleteMany({
    where: { id: { in: [passport1.id, passport2.id] } }
  });
  logger.info('✅ Test Complete & Cleaned up.');
}

runTest().catch(console.error).finally(() => process.exit(0));
