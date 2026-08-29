"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rentYieldService = exports.RentYieldService = void 0;
const database_1 = require("../utils/database");
class RentYieldService {
    /**
     * Processes a rent payment, deposits into a DeFi Yield Vault (mocked),
     * and splits the yield equity between tenant and landlord.
     */
    async processRentAndGenerateYield(leaseId, amountUsd) {
        const lease = await database_1.prisma.lease.findUnique({
            where: { id: leaseId },
            include: { tenant: true, property: { include: { landlord: true } } }
        });
        if (!lease)
            throw new Error('Lease not found');
        // 1. Process Rent Payment
        const payment = await database_1.prisma.rentPayment.create({
            data: {
                leaseId,
                amount: amountUsd,
                dueDate: new Date(),
                status: 'COMPLETED'
            }
        });
        // 2. Deposit into Yield Vault (Mocked DeFi Integration like Ondo USDY)
        const yieldVault = await database_1.prisma.yieldVault.findFirst({
            where: { protocol: 'ONDO_USDY' }
        });
        if (!yieldVault) {
            await database_1.prisma.yieldVault.create({
                data: {
                    protocol: 'ONDO_USDY',
                    totalDepositedUsd: amountUsd
                }
            });
        }
        else {
            await database_1.prisma.yieldVault.update({
                where: { id: yieldVault.id },
                data: { totalDepositedUsd: { increment: amountUsd } }
            });
        }
        // 3. Simulate Yield Generation (e.g. 5% APY over 1 month on the amount paid)
        // Formula: amount * (0.05 / 12)
        const simulatedMonthlyYield = amountUsd * (0.05 / 12);
        // 50/50 Split
        const tenantYield = simulatedMonthlyYield / 2;
        const landlordYield = simulatedMonthlyYield / 2;
        // 4. Update Wallets
        // Update Tenant Wallet
        await database_1.prisma.wallet.upsert({
            where: { userId: lease.tenantId },
            create: {
                userId: lease.tenantId,
                renterEquityUsd: tenantYield
            },
            update: {
                renterEquityUsd: { increment: tenantYield }
            }
        });
        // Update Landlord Wallet
        await database_1.prisma.wallet.upsert({
            where: { userId: lease.property.landlordId },
            create: {
                userId: lease.property.landlordId,
                usdcBalance: landlordYield // Landlord gets yield in USDC
            },
            update: {
                usdcBalance: { increment: landlordYield }
            }
        });
        return {
            paymentId: payment.id,
            amountProcessed: amountUsd,
            tenantYieldEarned: tenantYield,
            landlordYieldEarned: landlordYield
        };
    }
}
exports.RentYieldService = RentYieldService;
exports.rentYieldService = new RentYieldService();
//# sourceMappingURL=rent-yield.service.js.map