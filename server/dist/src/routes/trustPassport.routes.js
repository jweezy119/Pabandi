"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Trust Passport routes — public portable trust identity.
 *   GET  /api/v1/trust-passport/directory -> public discovery list (no auth)
 *   GET  /api/v1/trust-passport/:handle    -> public snapshot (no auth)
 *   POST /api/v1/trust-passport           -> create/update (auth)
 *   GET  /api/v1/trust-passport/:handle/request -> context for PPD wizard pre-fill
 *   POST /api/v1/trust-passport/migrate    -> create table (Cloud Run FS read-only)
 */
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const trustPassport_service_1 = require("../services/trustPassport.service");
const database_1 = require("../utils/database");
const router = (0, express_1.Router)();
router.get('/directory', async (req, res) => {
    try {
        const list = await trustPassport_service_1.trustPassportService.list({
            category: req.query.category,
            search: req.query.search,
            limit: req.query.limit ? Number(req.query.limit) : 50,
        });
        res.json({ success: true, data: list, count: list.length });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
router.post('/', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { handle, displayName, category, agentId, providerRef, bio, walletAddress } = req.body ?? {};
        if (!handle || !displayName)
            return res.status(400).json({ success: false, error: 'handle, displayName required' });
        const p = await trustPassport_service_1.trustPassportService.upsert({ handle, displayName, category, agentId, providerRef, bio, walletAddress });
        res.json({ success: true, data: p });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
router.get('/:handle', async (req, res) => {
    try {
        const snap = await trustPassport_service_1.trustPassportService.getPublic(req.params.handle);
        res.json({ success: true, data: snap });
    }
    catch (e) {
        res.status(404).json({ success: false, error: e.message });
    }
});
router.get('/:handle/request', async (req, res) => {
    try {
        const ctx = await trustPassport_service_1.trustPassportService.getRequestContext(req.params.handle);
        res.json({ success: true, data: ctx });
    }
    catch (e) {
        res.status(404).json({ success: false, error: e.message });
    }
});
router.post('/migrate', async (req, res) => {
    try {
        const stmts = [
            `CREATE TABLE IF NOT EXISTS "TrustPassport" ("id" TEXT NOT NULL PRIMARY KEY, "handle" TEXT NOT NULL, "agentId" TEXT, "providerRef" TEXT, "category" TEXT NOT NULL DEFAULT 'FREELANCER', "displayName" TEXT NOT NULL, "bio" TEXT, "walletAddress" TEXT, "visibility" TEXT NOT NULL DEFAULT 'PUBLIC', "claimsCount" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE UNIQUE INDEX IF NOT EXISTS "TrustPassport_handle_key" ON "TrustPassport"("handle")`,
            `CREATE INDEX IF NOT EXISTS "TrustPassport_agentId_idx" ON "TrustPassport"("agentId")`,
            `CREATE INDEX IF NOT EXISTS "TrustPassport_providerRef_idx" ON "TrustPassport"("providerRef")`,
        ];
        for (const s of stmts)
            await database_1.prisma.$executeRawUnsafe(s);
        res.json({ success: true, message: 'TrustPassport table migrated' });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=trustPassport.routes.js.map