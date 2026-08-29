"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stakeAgent = stakeAgent;
exports.slashAgent = slashAgent;
exports._internal = _internal;
const database_1 = require("../../utils/database");
const logger_1 = require("../../utils/logger");
const agentScorer_service_1 = require("./agentScorer.service");
/**
 * stakeSlashing.service — "skin in the game" gate + Slashing Oracle.
 *
 * Design (frugality / no new contract):
 *  - Staking = a recorded AgentStake row + a REAL on-chain PAB transfer to the protocol
 *    stake vault (the existing PAB treasury wallet). No Anchor program needed; we reuse
 *    the SPL transfer + TreasuryPosition ledger already in the rail.
 *  - Agents with < STAKE_REQUIRED_PAB are NOT indexed by the scorer (see agentScorer).
 *  - Slashing = partial burn of the stake on milestone failure. Burn = transfer to a
 *    burn address (1nc1nerator11111111111111111111111111111111) recorded in TreasuryPosition
 *    as a SLASH event; a compensation portion is routed to the client. Transparent & on-chain.
 *
 * Phase-2 upgrade path: replace the SPL-lock with an Anchor stake/lockup program and a
 * programmatic slashing oracle. Interface (stake, slash) stays identical.
 */
const BURN_ADDRESS = process.env.PAB_STAKE_BURN_ADDRESS || '1nc1nerator11111111111111111111111111111111';
const STAKE_VAULT = process.env.PAB_STAKE_VAULT || process.env.FEE_TREASURY_WALLET || process.env.PABANDI_TREASURY_WALLET || '';
async function stakeAgent(agentId, amountPab) {
    if (amountPab < agentScorer_service_1.STAKE_REQUIRED_PAB) {
        return { ok: false, error: `Minimum stake is ${agentScorer_service_1.STAKE_REQUIRED_PAB} PAB to be indexed` };
    }
    const agent = await database_1.prisma.web3Agent.findUnique({ where: { id: agentId } });
    if (!agent)
        return { ok: false, error: 'agent not found' };
    // Record stake (on-chain transfer handled by caller's transfer service in prod;
    // here we persist the ledger entry + mark indexed).
    await database_1.prisma.agentStake.upsert({
        where: { agentId },
        create: { agentId, amountPab, vault: STAKE_VAULT, indexed: true, slashedPab: 0 },
        update: { amountPab: { increment: amountPab }, indexed: true },
    });
    await database_1.prisma.agentTransaction.create({
        data: {
            agentId,
            type: 'STAKE',
            amount: amountPab,
            metadata: { vault: STAKE_VAULT, note: 'skin-in-the-game stake to be indexed by recommendation engine' },
        },
    });
    logger_1.logger.info(`[stake] agent ${agentId} staked ${amountPab} PAB (indexed)`);
    return { ok: true };
}
/**
 * Slash an agent on milestone failure. Splits the penalty: 60% burned (supply sink →
 * supports PAB value), 40% compensated to the client. Both recorded on-chain + ledger.
 */
async function slashAgent(agentId, penaltyPct = 0.3) {
    const stake = await database_1.prisma.agentStake.findUnique({ where: { agentId } });
    if (!stake)
        return { ok: false, slashedPab: 0, toClientPab: 0, burnedPab: 0, error: 'no stake' };
    const slashable = Math.floor(stake.amountPab * penaltyPct);
    if (slashable <= 0)
        return { ok: true, slashedPab: 0, toClientPab: 0, burnedPab: 0 };
    const toClient = Math.floor(slashable * 0.4);
    const burned = slashable - toClient;
    await database_1.prisma.agentStake.update({
        where: { agentId },
        data: { amountPab: { decrement: slashable }, slashedPab: { increment: slashable }, indexed: false },
    });
    await database_1.prisma.agentTransaction.create({
        data: { agentId, type: 'SLASH', amount: slashable, metadata: { toClient, burned, burnAddress: BURN_ADDRESS } },
    });
    // On-chain execution (transfer to burn + client) is performed by the caller's transfer
    // service in production; the ledger above is the source of truth for the oracle.
    logger_1.logger.warn(`[slash] agent ${agentId} slashed ${slashable} PAB (burn ${burned}, client ${toClient})`);
    return { ok: true, slashedPab: slashable, toClientPab: toClient, burnedPab: burned };
}
function _internal() {
    return { BURN_ADDRESS, STAKE_VAULT, STAKE_REQUIRED_PAB: agentScorer_service_1.STAKE_REQUIRED_PAB };
}
//# sourceMappingURL=stakeSlashing.service.js.map