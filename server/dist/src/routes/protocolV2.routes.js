"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * protocolV2.routes.ts — HTTP surface for the five Pabandi Protocol v2.0 pillars.
 *   /zk      ZK Nullifier Proof of Rent
 *   /act     ACTUS tokenized rent cashflow engine
 *   /arb     Kleros-style arbitration
 *   /dao     Aragon-style bicameral QV DAO
 *   /mesh    Data Mesh (CourtListener key pool)
 * All anchor artifacts on Solana (chain untouched — hash commitments only).
 */
const express_1 = require("express");
const zkNullifier_service_1 = require("../services/zkNullifier.service");
const actusEngine_service_1 = require("../services/actusEngine.service");
const klerosArbitration_service_1 = require("../services/klerosArbitration.service");
const aragonDao_service_1 = require("../services/aragonDao.service");
const dataMesh_service_1 = require("../services/dataMesh.service");
const router = (0, express_1.Router)();
// ── ZK Nullifier PoR ────────────────────────────────────────────────────────
router.post('/zk/issue', async (req, res) => {
    const { tenantDID, propertyDID, consecutiveMonths, secret } = req.body || {};
    if (!tenantDID || !propertyDID || !consecutiveMonths)
        return res.status(400).json({ success: false, error: 'tenantDID, propertyDID, consecutiveMonths required' });
    try {
        res.json({ success: true, data: await zkNullifier_service_1.zkNullifierService.issueProof(tenantDID, propertyDID, consecutiveMonths, secret) });
    }
    catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});
router.post('/zk/verify', async (req, res) => {
    const v = await zkNullifier_service_1.zkNullifierService.verifyProof(req.body || {});
    res.json({ success: true, data: v });
});
// ── ACTUS ───────────────────────────────────────────────────────────────────
router.post('/act/contract', async (req, res) => {
    const { tenantId, landlordId, principalUSD, apyPct, termMonths, startDate } = req.body || {};
    if (!tenantId || !landlordId || !principalUSD)
        return res.status(400).json({ success: false, error: 'tenantId, landlordId, principalUSD required' });
    try {
        const c = await actusEngine_service_1.actusEngine.createContract({ tenantId, landlordId, principalUSD, apyPct, termMonths, startDate });
        res.json({ success: true, data: { ...c, npv: actusEngine_service_1.actusEngine.npv(c) } });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// ── Kleros-style Arbitration ─────────────────────────────────────────────────
router.post('/arb/open', async (req, res) => {
    const { disputeId, tenantId, landlordId, claim } = req.body || {};
    if (!disputeId || !tenantId || !landlordId)
        return res.status(400).json({ success: false, error: 'disputeId, tenantId, landlordId required' });
    res.json({ success: true, data: await klerosArbitration_service_1.klerosArbitration.openDispute(disputeId, tenantId, landlordId, claim || '') });
});
router.post('/arb/vote', async (req, res) => {
    const { disputeId, jurorId, stakePab, vote } = req.body || {};
    if (!disputeId || !jurorId || !vote)
        return res.status(400).json({ success: false, error: 'disputeId, jurorId, vote required' });
    try {
        res.json({ success: true, data: await klerosArbitration_service_1.klerosArbitration.castJurorVote(disputeId, jurorId, stakePab || 0, vote) });
    }
    catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});
router.post('/arb/resolve', async (req, res) => {
    const { disputeId } = req.body || {};
    if (!disputeId)
        return res.status(400).json({ success: false, error: 'disputeId required' });
    try {
        res.json({ success: true, data: await klerosArbitration_service_1.klerosArbitration.resolve(disputeId) });
    }
    catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});
router.post('/arb/appeal', async (req, res) => {
    const { disputeId, byParty, bondPab } = req.body || {};
    if (!disputeId)
        return res.status(400).json({ success: false, error: 'disputeId required' });
    try {
        res.json({ success: true, data: await klerosArbitration_service_1.klerosArbitration.appeal(disputeId, byParty || '', bondPab || 0) });
    }
    catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});
// ── Aragon-style DAO ──────────────────────────────────────────────────────────
router.post('/dao/proposal', async (req, res) => {
    const { proposalId, title, body } = req.body || {};
    if (!proposalId || !title)
        return res.status(400).json({ success: false, error: 'proposalId, title required' });
    res.json({ success: true, data: await aragonDao_service_1.aragonDao.createProposal(proposalId, title, body || '') });
});
router.post('/dao/vote', async (req, res) => {
    const { proposalId, voterId, trustBand, stakedPpd, choice } = req.body || {};
    if (!proposalId || !voterId || !trustBand || !choice)
        return res.status(400).json({ success: false, error: 'proposalId, voterId, trustBand, choice required' });
    try {
        res.json({ success: true, data: await aragonDao_service_1.aragonDao.castVote(proposalId, voterId, trustBand, stakedPpd || 0, choice) });
    }
    catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});
router.get('/dao/vote-power', (req, res) => {
    const { trustBand, stakedPpd } = req.query;
    if (!trustBand)
        return res.status(400).json({ success: false, error: 'trustBand required' });
    res.json({ success: true, data: { power: aragonDao_service_1.aragonDao.votePower(trustBand, Number(stakedPpd) || 0) } });
});
// ── Data Mesh ─────────────────────────────────────────────────────────────────
router.get('/mesh/query', async (req, res) => {
    const { name, state } = req.query;
    if (!name)
        return res.status(400).json({ success: false, error: 'name required' });
    try {
        res.json({ success: true, data: await dataMesh_service_1.dataMesh.queryCivilLitigation(name, state) });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
router.get('/mesh/health', (_req, res) => {
    res.json({ success: true, data: { keys: dataMesh_service_1.dataMesh.getKeyHealth() } });
});
exports.default = router;
//# sourceMappingURL=protocolV2.routes.js.map