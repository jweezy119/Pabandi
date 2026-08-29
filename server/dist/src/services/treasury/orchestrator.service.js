"use strict";
/**
 * Pabandi Autonomous Treasury Orchestrator
 * -----------------------------------------
 * Our own version of the "Meld brain": issues virtual accounts, listens for
 * fiat wires, and sweeps held fiat into on-chain stablecoins.
 *
 * Provider-agnostic via the ITreasuryAdapter interface. The active adapter is
 * chosen by env (TREASURY_PROVIDER). Default = SIMULATOR so the entire flow can
 * be built & tested today without a banking partner.
 *
 * Ledger: every sweep is written to the TreasuryPosition table (bucket = SWEEP)
 * with details in `meta`, so the profitability report has real (simulated)
 * data to show.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.treasuryOrchestrator = exports.TreasuryOrchestrator = void 0;
const logger_1 = require("../../utils/logger");
const database_1 = require("../../utils/database");
const simulator_adapter_1 = require("./adapters/simulator.adapter");
function getAdapter() {
    // When MELD/BRIDGE/STRIPE_TREASURY adapters exist, branch here.
    const provider = process.env.TREASURY_PROVIDER ?? 'SIMULATOR';
    switch (provider) {
        case 'SIMULATOR':
        default:
            return new simulator_adapter_1.SimulatorAdapter();
    }
}
class TreasuryOrchestrator {
    constructor() {
        this.adapter = getAdapter();
        logger_1.logger.info(`[Treasury] Orchestrator initialized with provider: ${this.adapter.providerName}`);
    }
    /** Create (or fetch) a virtual bank account for a Pabandi user. */
    async issueVirtualAccount(userId) {
        const existing = await database_1.prisma.$queryRawUnsafe(`SELECT * FROM "VirtualAccount" WHERE "userId" = $1 LIMIT 1`, userId);
        if (existing && existing.length)
            return existing[0];
        const details = await this.adapter.issueVirtualAccount(userId, 'USD');
        const created = await database_1.prisma.$queryRawUnsafe(`INSERT INTO "VirtualAccount" ("id","userId","routingNumber","accountNumber","bankName","currency","status","provider","createdAt","updatedAt")
       VALUES (gen_random_uuid(), $1,$2,$3,$4,$5,'ACTIVE',$6,now(),now()) RETURNING *`, userId, details.routingNumber, details.accountNumber, details.bankName, details.currency, this.adapter.providerName);
        return created[0];
    }
    /** Simulate / receive an incoming fiat wire to a virtual account. */
    async handleIncomingWire(virtualAccountId, amountUsd) {
        await this.adapter.handleIncomingWire(virtualAccountId, amountUsd);
        return database_1.prisma.treasuryPosition.create({
            data: {
                bucket: 'FIAT_IN',
                amount: amountUsd,
                status: 'PENDING_SWEEP',
                meta: { virtualAccountId, asset: 'USD', note: 'Incoming fiat wire (simulated)' },
            },
        });
    }
    /** Sweep a pending fiat position into on-chain stablecoin. */
    async sweepToWeb3(treasuryPositionId, destinationWallet) {
        const pos = await database_1.prisma.treasuryPosition.findUnique({ where: { id: treasuryPositionId } });
        if (!pos)
            throw new Error('TreasuryPosition not found');
        const result = await this.adapter.sweepToWeb3(pos.amount, destinationWallet);
        await database_1.prisma.treasuryPosition.update({
            where: { id: treasuryPositionId },
            data: {
                status: result.success ? 'DEPLOYED' : 'PENDING',
                txHash: result.txHash,
                meta: {
                    ...(pos.meta ?? {}),
                    asset: 'USDC',
                    sweptAt: new Date().toISOString(),
                    destinationWallet,
                    simulated: result.simulated,
                    note: result.simulated ? 'Simulated stablecoin sweep' : 'On-chain stablecoin sweep',
                },
            },
        });
        if (result.success) {
            await database_1.prisma.treasuryPosition.create({
                data: {
                    bucket: 'SWEEP_OUT',
                    amount: result.amountStable,
                    status: 'DEPLOYED',
                    txHash: result.txHash,
                    meta: { asset: 'USDC', destinationWallet, provider: this.adapter.providerName },
                },
            });
        }
        return { ...result, position: pos };
    }
    /** Full demo flow: issue account → incoming wire → sweep. Used for the report. */
    async runDemoFlow(userId, amountUsd, destinationWallet) {
        const va = await this.issueVirtualAccount(userId);
        const incoming = await this.handleIncomingWire(va.id, amountUsd);
        const sweep = await this.sweepToWeb3(incoming.id, destinationWallet);
        return { virtualAccount: va, incoming, sweep };
    }
    /** Ledger for the profitability report. */
    async getLedger(limit = 50) {
        return database_1.prisma.treasuryPosition.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }
}
exports.TreasuryOrchestrator = TreasuryOrchestrator;
exports.treasuryOrchestrator = new TreasuryOrchestrator();
//# sourceMappingURL=orchestrator.service.js.map