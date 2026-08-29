"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Agent Capability Passport (ACP) routes — the AI-agent trust standard.
 *
 *   POST /api/v1/agent-passport/issue   -> issue a signed passport (auth + metered)
 *   GET  /api/v1/agent-passport/verify  -> public, no-auth one-call verification
 *   GET  /api/v1/agent-passport/ledger/:key -> public audit of a charge
 *   GET  /.well-known/ptp.json          -> discovery doc (public key + endpoints)
 *
 * Economic loop (fault-tolerant + foolproof):
 *   - capabilities are validated against the owner's risk band (no privilege escalation)
 *   - each issue is idempotently charged (retry-safe, never double-billed)
 *   - daily per-owner issue cap prevents abuse
 *   - FAIL-CLOSED: if the ledger can't record the charge, no passport is issued
 *   - verifiers never pay, so verify() stays offline and always works
 */
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const ptp_spec_1 = require("../protocol/ptp.spec");
const database_1 = require("../utils/database");
const passportEconomy_service_1 = require("../services/passportEconomy.service");
const router = (0, express_1.Router)();
// Issue an Agent Capability Passport for the authenticated user's agent.
router.post('/issue', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ success: false, error: 'unauthenticated' });
        const { agentId, capabilities, idempotencyKey } = req.body ?? {};
        if (!agentId || !Array.isArray(capabilities) || capabilities.length === 0) {
            return res.status(400).json({ success: false, error: 'agentId + non-empty capabilities[] required' });
        }
        // Derive the owner's trust band (foolproof ceiling source of truth).
        const user = await database_1.prisma.user.findUnique({ where: { id: userId }, select: { trustScore: true } });
        const score = user?.trustScore || 70;
        const band = ptp_spec_1.ptpEngine.scoreToRiskBand(score);
        // FENCE: reject any capability not allowed / exceeding the band ceiling.
        const capCheck = (0, passportEconomy_service_1.validateCapabilities)(band, capabilities);
        if (!capCheck.ok) {
            return res.status(403).json({ success: false, error: `capability rejected: ${capCheck.reason}` });
        }
        // ECONOMIC LOOP (fail-closed + idempotent). Throws if ledger can't record.
        let charge;
        try {
            charge = await passportEconomy_service_1.passportEconomy.chargeIssue({ ownerUserId: userId, agentId, riskBand: band, capabilities, idempotencyKey });
        }
        catch (e) {
            return res.status(402).json({ success: false, error: `issuance not recorded (not charged): ${e.message}` });
        }
        let velocity = {
            direction: 'STEADY', momentum: 0, confidence: 0.5,
        };
        try {
            const { trustFluxService } = await Promise.resolve().then(() => __importStar(require('../services/trustFlux.service')));
            const flux = await trustFluxService.computeTrustFlux(userId);
            velocity = { direction: flux.trend, momentum: Math.abs(flux.velocity), confidence: flux.confidence };
        }
        catch { /* default velocity */ }
        const att = ptp_spec_1.ptpEngine.issueAgentPassport({ agentId, ownerUserId: userId, capabilities, trustScore: score, velocity });
        res.json({
            success: true,
            data: att,
            economics: {
                feePab: charge.feePab,
                alreadyCharged: charge.alreadyCharged,
                idempotencyKey: charge.idempotencyKey,
                riskBand: band,
                ledgerId: charge.record?.id,
            },
        });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// Public, no-auth verification — the "standard" one-call check any site/agent uses.
// `token` is a base64-encoded PTPAgentAttestation; `need` optionally requires a capability.
router.get('/verify', async (req, res) => {
    try {
        const token = req.query.token;
        const need = req.query.need;
        if (!token)
            return res.status(400).json({ success: false, error: 'token (base64 attestation) required' });
        let att;
        try {
            att = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
        }
        catch {
            return res.status(400).json({ success: false, error: 'token is not valid base64 JSON' });
        }
        const result = ptp_spec_1.ptpEngine.verifyAgentPassport(att, need);
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(400).json({ success: false, error: 'invalid token: ' + e.message });
    }
});
// Public audit of a charge (idempotency key -> record). Anyone can verify billing.
router.get('/ledger/:idempotencyKey', async (req, res) => {
    try {
        const rec = await passportEconomy_service_1.passportEconomy.lookup(req.params.idempotencyKey);
        if (!rec)
            return res.status(404).json({ success: false, error: 'no such issuance' });
        res.json({
            success: true,
            data: {
                idempotencyKey: rec.idempotencyKey,
                ownerUserId: rec.ownerUserId,
                agentId: rec.agentId,
                riskBand: rec.riskBand,
                feePab: rec.feePab,
                capabilities: rec.capabilities,
                chargedAt: rec.chargedAt,
            },
        });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// Discovery document so external agents can find the verify endpoint + public key.
router.get('/.well-known/ptp.json', async (req, res) => {
    const base = `${req.protocol}://${req.get('host')}`;
    res.json(ptp_spec_1.ptpEngine.getDiscoveryDocument(base));
});
exports.default = router;
//# sourceMappingURL=agentPassport.routes.js.map