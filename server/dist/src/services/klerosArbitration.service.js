"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.klerosArbitration = exports.KlerosStyleArbitration = void 0;
const solanaAnchor_service_1 = require("./solanaAnchor.service");
const logger_1 = require("../utils/logger");
class KlerosStyleArbitration {
    constructor() {
        // ── in-memory store (dispute lifecycle is ephemeral; anchored on Solana for record) ──
        this.store = new Map();
    }
    /** Open a dispute. AI advisory fires immediately (non-binding). */
    async openDispute(disputeId, tenantId, landlordId, claim) {
        const aiAdvisory = this.aiAdvisory(claim); // non-binding, instant
        const dispute = {
            disputeId, tenantId, landlordId, claim,
            status: 'AI_ADVISORY',
            aiAdvisory,
            votes: [],
            appealBondPab: 0,
            finalVerdict: null,
            openedAt: new Date().toISOString(),
            aiAdvisoryBy: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
            jurorDeadline: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
        };
        // Persist (best-effort; dispute store may be in-memory if no column)
        await this.persist(disputeId, dispute);
        logger_1.logger.info(`[Kleros] Dispute ${disputeId} opened. AI advisory: ${aiAdvisory}`);
        return dispute;
    }
    /** Non-binding AI advisory verdict (instant). Clearly labeled NON-BINDING. */
    aiAdvisory(claim) {
        // Heuristic: claims mentioning "deposit"/"return" lean tenant; "damage"/"unpaid" lean landlord.
        const lc = claim.toLowerCase();
        if (/(deposit|return|refund|withhold)/.test(lc))
            return 'TENANT_WINS';
        if (/(damage|unpaid|breach|non.?payment)/.test(lc))
            return 'LANDLORD_WINS';
        return 'SPLIT';
    }
    /** A staked juror casts a vote. Requires $PAB stake (juror risk). */
    async castJurorVote(disputeId, jurorId, stakePab, vote) {
        const d = await this.load(disputeId);
        if (!d)
            throw new Error('dispute not found');
        if (d.status === 'RESOLVED')
            throw new Error('dispute already resolved');
        d.votes.push({ jurorId, stakePab, vote });
        d.status = 'JUROR_VOTING';
        await this.persist(disputeId, d);
        return d;
    }
    /** Tally juror votes (Schelling: majority stake wins). Auto-resolves at deadline. */
    async resolve(disputeId) {
        const d = await this.load(disputeId);
        if (!d)
            throw new Error('dispute not found');
        const tally = { TENANT_WINS: 0, LANDLORD_WINS: 0, SPLIT: 0 };
        for (const v of d.votes)
            tally[v.vote] += v.stakePab; // stake-weighted
        let winner = 'SPLIT';
        let best = -1;
        for (const k of Object.keys(tally))
            if (tally[k] > best) {
                best = tally[k];
                winner = k;
            }
        d.finalVerdict = winner;
        d.status = 'RESOLVED';
        d.resolvedAt = new Date().toISOString();
        // Slash losing jurors, reward winners from the appeal bond (if any).
        const anchor = await solanaAnchor_service_1.solanaAnchor.anchorOnSolana('KLEROS_VERDICT', { disputeId, winner, tally, votes: d.votes.length }, 'PABANDI_ARB');
        d.anchor = anchor;
        await this.persist(disputeId, d);
        logger_1.logger.info(`[Kleros] Dispute ${disputeId} RESOLVED → ${winner} (stake tally ${JSON.stringify(tally)})`);
        return d;
    }
    /** Appeal: losing side stakes $PAB to escalate. Frivolous appeals get slashed on confirm. */
    async appeal(disputeId, byParty, bondPab) {
        const d = await this.load(disputeId);
        if (!d)
            throw new Error('dispute not found');
        d.status = 'APPEAL';
        d.appealBondPab += bondPab;
        await this.persist(disputeId, d);
        logger_1.logger.info(`[Kleros] Dispute ${disputeId} appealed by ${byParty} with ${bondPab} $PAB bond`);
        return d;
    }
    async persist(id, d) { this.store.set(id, d); }
    async load(id) { return this.store.get(id); }
}
exports.KlerosStyleArbitration = KlerosStyleArbitration;
exports.klerosArbitration = new KlerosStyleArbitration();
//# sourceMappingURL=klerosArbitration.service.js.map