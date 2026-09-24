"use strict";
/**
 * trustPassport.service.ts — Pabandi Trust Passport (north-star: portable trust)
 *
 * Aggregates a provider's trust across all rails into one public, shareable
 * payload keyed by handle:
 *   - Web3Agent trust band / velocity / reliability (the headline)
 *   - Latest BackgroundCheck (verified identity, score, band, timestamp)
 *   - Active protected deposits + performance bonds (skin in the game)
 *   - HOA community pools governed (if applicable)
 *
 * The passport is the flywheel: providers build it (cheaper deposits/bonds),
 * counterparties demand it (homeowners/HOAs/landlords won't deal without one),
 * each verified deal raises the band -> cheaper trust -> more deals.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.trustPassportService = exports.TrustPassportService = void 0;
const database_1 = require("../utils/database");
class TrustPassportService {
    /** Create / update a passport for a provider. */
    async upsert(input) {
        return database_1.prisma.trustPassport.upsert({
            where: { handle: input.handle },
            update: {
                displayName: input.displayName,
                category: input.category ?? 'FREELANCER',
                agentId: input.agentId,
                providerRef: input.providerRef,
                bio: input.bio,
                walletAddress: input.walletAddress,
            },
            create: {
                handle: input.handle,
                displayName: input.displayName,
                category: input.category ?? 'FREELANCER',
                agentId: input.agentId,
                providerRef: input.providerRef,
                bio: input.bio,
                walletAddress: input.walletAddress,
            },
        });
    }
    /** Public directory of passports (discovery). No auth. */
    async list(params) {
        const where = { visibility: 'PUBLIC' };
        if (params?.category && params.category !== 'ALL')
            where.category = params.category;
        if (params?.search) {
            where.OR = [
                { displayName: { contains: params.search, mode: 'insensitive' } },
                { handle: { contains: params.search, mode: 'insensitive' } },
                { bio: { contains: params.search, mode: 'insensitive' } },
            ];
        }
        const rows = await database_1.prisma.trustPassport.findMany({
            where,
            orderBy: [{ claimsCount: 'desc' }],
            take: params?.limit ?? 50,
        });
        return rows.map((p) => ({
            handle: p.handle,
            displayName: p.displayName,
            category: p.category,
            bio: p.bio,
            claimsCount: p.claimsCount,
            trustBand: 'D',
        }));
    }
    /** Public aggregation by handle. No auth. Returns a portable trust snapshot. */
    async getPublic(handle) {
        const p = await database_1.prisma.trustPassport.findUnique({ where: { handle } });
        if (!p)
            throw new Error('Passport not found');
        if (p.visibility !== 'PUBLIC')
            throw new Error('Passport is private');
        // Headline trust from the linked agent
        let agent = null;
        if (p.agentId)
            agent = await database_1.prisma.web3Agent.findUnique({ where: { id: p.agentId } });
        // Provider key used across rails (prefer explicit, else handle-ish)
        const ref = p.providerRef || p.agentId || p.handle;
        // Latest background check (verified identity)
        const bc = await database_1.prisma.backgroundCheck.findFirst({
            where: { OR: [{ subjectId: ref }, { subjectId: p.agentId ?? '__none__' }] },
            orderBy: { createdAt: 'desc' },
        });
        // Active + in-flight protected deposits where this provider is the beneficiary
        const deposits = await database_1.prisma.securityDeposit.findMany({
            where: { landlordId: ref, status: { in: ['PENDING', 'FUNDED', 'ACTIVE'] } },
            include: { milestones: true },
        });
        // Active performance bonds backing this provider
        const bonds = await database_1.prisma.performanceBond.findMany({
            where: { beneficiaryId: ref, status: 'ACTIVE' },
        });
        // HOA pools governed (if category HOA)
        let pools = [];
        if (p.category === 'HOA' && p.walletAddress) {
            pools = await database_1.prisma.communityPool.findMany({ where: { treasuryWallet: p.walletAddress } });
        }
        // Aggregate "skin in the game"
        const totalBondedUSD = bonds.reduce((s, b) => s + (b.coverageUSD || 0), 0);
        const totalDepositsUSD = deposits.reduce((s, d) => s + (d.actualDepositUSD || 0), 0);
        const drawsReleased = deposits.reduce((s, d) => s + (d.milestones?.filter((m) => m.status === 'RELEASED').length || 0), 0);
        // Increment claims count (someone looked) and capture the new value
        const updated = await database_1.prisma.trustPassport.update({ where: { id: p.id }, data: { claimsCount: { increment: 1 } } });
        return {
            public: true,
            handle: p.handle,
            displayName: p.displayName,
            category: p.category,
            bio: p.bio,
            walletAddress: p.walletAddress,
            claimsCount: updated.claimsCount,
            trust: agent
                ? {
                    trustBand: agent.trustBand,
                    trustVelocity: agent.trustVelocity,
                    reliabilityScore: agent.reliabilityScore,
                    profileCompleteness: agent.profileCompleteness,
                    connectionCount: agent.connectionCount,
                }
                : { trustBand: 'D', trustVelocity: 0, reliabilityScore: 750, profileCompleteness: 0.5 },
            backgroundCheck: bc
                ? {
                    recommendation: bc.recommendation,
                    riskScore: bc.riskScore,
                    riskBand: bc.riskBand,
                    completedAt: bc.completedAt,
                }
                : null,
            protections: {
                activeDeposits: deposits.length,
                totalDepositsUSD,
                activeBonds: bonds.length,
                totalBondedUSD,
                drawsReleased,
            },
            communityPools: pools.map((pl) => ({
                communityName: pl.communityName,
                totalYieldUSD: pl.totalYieldUSD,
                availableYieldUSD: +(pl.totalYieldUSD - pl.totalDistributedUSD).toFixed(2),
            })),
            issuedAt: new Date().toISOString(),
        };
    }
    /** The "Request Protected Deal" deep-link target — returns provider context
     *  so the PPD wizard can pre-fill. Reuses existing rails. */
    async getRequestContext(handle) {
        const pub = await this.getPublic(handle);
        return {
            beneficiaryName: pub.displayName,
            beneficiaryId: pub.handle,
            category: pub.category,
            suggestedContext: pub.category === 'BUILDER' ? 'BUILDER' : pub.category === 'FLEET' ? 'FLEET' : pub.category === 'HOA' ? 'HOA' : 'PROPERTY',
        };
    }
}
exports.TrustPassportService = TrustPassportService;
exports.trustPassportService = new TrustPassportService();
//# sourceMappingURL=trustPassport.service.js.map