"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../utils/database");
const vc_service_1 = require("../services/vc.service");
const pyd_service_1 = require("../services/pyd.service");
const ppd_service_1 = require("../services/ppd.service");
const logger_1 = require("../utils/logger");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const vcService = new vc_service_1.VCService();
/**
 * seedPilotProgram.ts
 *
 * Validates the "Trust-As-Infrastructure" loop end-to-end.
 * Provisions 1 Landlord, 50 Tenants.
 * Issues Property DIDs.
 * Processes 3 months of Tokenized Rent streams (Ondo USDY).
 * Generates ZK Proofs of Rent (PoR).
 * Outputs a clean JSON metric report for investor pitches.
 */
async function seedPilotProgram() {
    logger_1.logger.info('🚀 Starting Pabandi Pilot Program Seed...');
    const metrics = {
        totalTenants: 0,
        totalRentProcessedUSD: 0,
        totalYieldGeneratedUSD: 0,
        totalTenantEquityBuiltUSD: 0,
        totalProofsOfRentGenerated: 0,
        propertyDIDsIssued: 0,
    };
    // 1. Create the Lighthouse Landlord
    const landlordEmail = `lighthouse_landlord_${Date.now()}@pabandi.com`;
    const landlord = await database_1.prisma.user.create({
        data: {
            email: landlordEmail,
            firstName: 'Lighthouse',
            lastName: 'Landlord',
            passwordHash: 'hashed_password_mock',
            walletAddress: `0xLANDLORD${Date.now()}`,
            trustScore: 90,
            verificationTier: 'GOLD',
            wallet: {
                create: { usdcBalance: 0 }
            }
        }
    });
    logger_1.logger.info(`✅ Created Landlord: ${landlord.id}`);
    // 2. Provision 50 Tenants & Simulate 3 Months of Activity
    const NUM_TENANTS = 50;
    const MONTHLY_RENT = 1500; // $1,500 average rent
    const RENT_HOLDING_DAYS = 5; // Rent held in Ondo USDY for 5 days per month
    for (let i = 1; i <= NUM_TENANTS; i++) {
        // Create Tenant
        const tenantEmail = `pilot_tenant_${i}_${Date.now()}@pabandi.com`;
        const tenant = await database_1.prisma.user.create({
            data: {
                email: tenantEmail,
                firstName: `Tenant`,
                lastName: `${i}`,
                passwordHash: 'hashed_password_mock',
                walletAddress: `0xTENANT${i}${Date.now()}`,
                trustScore: Math.floor(Math.random() * (95 - 60) + 60), // Random score 60-95
                verificationTier: 'SILVER',
                wallet: {
                    create: { usdcBalance: 0 }
                }
            }
        });
        metrics.totalTenants++;
        // Issue Property DID (Self-Sovereign Property VC)
        const propertyId = `prop_unit_${i}_${Date.now()}`;
        await vcService.issuePropertyCredential(landlord.id, propertyId, 'PROPERTY_TITLE', {
            address: `100 Pilot Way, Unit ${i}, Tech City`,
            complianceStatus: 'VERIFIED',
            energyRating: 'A'
        });
        metrics.propertyDIDsIssued++;
        // Create the Deposit (Using PydService)
        const { deposit } = await pyd_service_1.pydService.createDeposit({
            tenantId: tenant.id,
            landlordId: landlord.id,
            depositContext: 'PROPERTY',
            assetDescription: `Lease for Unit ${i}`,
            requiredAmountUSD: MONTHLY_RENT,
            yieldOptIn: true,
            pool: 'ONDO_USDC'
        });
        // Simulate 3 Months of Tokenized Rent
        for (let month = 1; month <= 3; month++) {
            const rentResult = await pyd_service_1.pydService.processTokenizedRent(tenant.id, landlord.id, MONTHLY_RENT, RENT_HOLDING_DAYS);
            metrics.totalRentProcessedUSD += rentResult.rentAmountUSD;
            metrics.totalYieldGeneratedUSD += rentResult.totalYieldUSD;
            metrics.totalTenantEquityBuiltUSD += rentResult.tenantEquityUSD;
        }
        // Generate ZK Proof of Rent for 3 consecutive months
        const por = await ppd_service_1.ppdService.generateProofOfRent(tenant.id, deposit.id, 3);
        if (por) {
            metrics.totalProofsOfRentGenerated++;
        }
        if (i % 10 === 0) {
            logger_1.logger.info(`⏳ Processed ${i} / ${NUM_TENANTS} tenants...`);
        }
    }
    // Round off metrics
    metrics.totalYieldGeneratedUSD = +metrics.totalYieldGeneratedUSD.toFixed(2);
    metrics.totalTenantEquityBuiltUSD = +metrics.totalTenantEquityBuiltUSD.toFixed(2);
    logger_1.logger.info('✅ Pilot Seed Complete!');
    // Output JSON Report
    const reportPath = path_1.default.join(__dirname, '..', '..', '..', 'pilot_metrics.json');
    fs_1.default.writeFileSync(reportPath, JSON.stringify(metrics, null, 2));
    logger_1.logger.info(`📊 Metrics written to ${reportPath}`);
    console.log(JSON.stringify(metrics, null, 2));
}
seedPilotProgram()
    .catch(e => {
    logger_1.logger.error('Error seeding pilot program:', e);
    process.exit(1);
})
    .finally(async () => {
    await database_1.prisma.$disconnect();
});
//# sourceMappingURL=seedPilotProgram.js.map