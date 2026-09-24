"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const database_1 = require("../utils/database");
const bestFitEngine_service_1 = require("../services/ai/bestFitEngine.service");
const logger_1 = require("../utils/logger");
async function runTest() {
    logger_1.logger.info('🚀 Starting Best Fit Engine Test...');
    // 1. Create a dummy passport for testing
    const passport1 = await database_1.prisma.trustPassport.create({
        data: {
            handle: `test-freelancer-${Date.now()}`,
            category: 'FREELANCER',
            displayName: 'Jane Doe (Morning Plumber)',
            riskScore: 850,
            visibility: 'PUBLIC'
        }
    });
    const passport2 = await database_1.prisma.trustPassport.create({
        data: {
            handle: `test-freelancer-${Date.now() + 1}`,
            category: 'FREELANCER',
            displayName: 'John Smith (Night Caterer)',
            riskScore: 750,
            visibility: 'PUBLIC'
        }
    });
    // 2. Add skills
    await database_1.prisma.skillEndorsement.createMany({
        data: [
            { passportId: passport1.id, skillName: 'Plumbing', rating: 5, weight: 1.5 },
            { passportId: passport2.id, skillName: 'Catering', rating: 4, weight: 1.0 }
        ]
    });
    logger_1.logger.info('✅ Created dummy passports and skills');
    // 3. Simulate gig history for Jane (mostly mornings, high rating)
    logger_1.logger.info('Simulating gig history for Jane (Morning Gigs)...');
    for (let i = 0; i < 10; i++) {
        // 8am gigs
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(8, 0, 0, 0);
        await bestFitEngine_service_1.bestFitEngineService.ingestGigOutcome({
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
    logger_1.logger.info('Simulating gig history for John (Night Gigs)...');
    for (let i = 0; i < 10; i++) {
        // 9pm gigs
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(21, 0, 0, 0);
        await bestFitEngine_service_1.bestFitEngineService.ingestGigOutcome({
            passportId: passport2.id,
            title: `Night Catering Job ${i}`,
            scheduledDate: date,
            status: i % 10 === 0 ? 'NO_SHOW' : 'COMPLETED', // 90% completion
            clientRating: 4,
            leadTimeHours: 24, // slower response
            zipCode: '10002'
        });
    }
    logger_1.logger.info('✅ Ingested gig history and generated vectors');
    // 5. Test 1: Looking for a morning plumber
    logger_1.logger.info('\n🔍 TEST 1: Searching for Morning Plumber (8am)...');
    const morningDate = new Date();
    morningDate.setHours(8, 0, 0, 0);
    const morningMatches = await bestFitEngine_service_1.bestFitEngineService.predictBestFit({
        scheduledDate: morningDate,
        skills: ['Plumbing'],
        limit: 2
    });
    console.log(JSON.stringify(morningMatches, null, 2));
    // 6. Test 2: Looking for a night caterer
    logger_1.logger.info('\n🔍 TEST 2: Searching for Night Caterer (9pm)...');
    const nightDate = new Date();
    nightDate.setHours(21, 0, 0, 0);
    const nightMatches = await bestFitEngine_service_1.bestFitEngineService.predictBestFit({
        scheduledDate: nightDate,
        skills: ['Catering'],
        limit: 2
    });
    console.log(JSON.stringify(nightMatches, null, 2));
    // Cleanup
    await database_1.prisma.trustPassport.deleteMany({
        where: { id: { in: [passport1.id, passport2.id] } }
    });
    logger_1.logger.info('✅ Test Complete & Cleaned up.');
}
runTest().catch(console.error).finally(() => process.exit(0));
//# sourceMappingURL=testBestFitEngine.js.map