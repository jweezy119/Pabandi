"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../utils/database");
const router = (0, express_1.Router)();
/**
 * GET /api/v1/trust/passport/:userId
 * Get trust passport with reliability score
 */
router.get('/passport/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        let passport = await database_1.prisma.trustPassport.findUnique({ where: { userId } });
        if (!passport) {
            passport = await database_1.prisma.trustPassport.create({
                data: {
                    userId,
                    handle: `user-${userId}`,
                    displayName: `User ${userId}`,
                    score: 50,
                    level: 'bronze',
                    verified: false
                },
            });
        }
        res.json({ success: true, data: passport });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * PUT /api/v1/trust/score/:userId
 * Update trust score (with audit trail)
 */
router.put('/score/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { delta, reason } = req.body;
        let passport = await database_1.prisma.trustPassport.findUnique({ where: { userId } });
        if (!passport) {
            passport = await database_1.prisma.trustPassport.create({
                data: {
                    userId,
                    handle: `user-${userId}`,
                    displayName: `User ${userId}`,
                    score: 50,
                    level: 'bronze',
                    verified: false
                },
            });
        }
        const newScore = Math.max(0, Math.min(100, (passport.score || 50) + (delta || 0)));
        const level = newScore >= 90 ? 'platinum' : newScore >= 70 ? 'gold' : newScore >= 50 ? 'silver' : 'bronze';
        const updated = await database_1.prisma.trustPassport.update({
            where: { userId },
            data: { score: newScore, level },
        });
        res.json({ success: true, data: updated });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * GET /api/v1/trust/risk/:userId
 * Get risk assessment for a user
 */
router.get('/risk/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const passport = await database_1.prisma.trustPassport.findUnique({ where: { userId } });
        if (!passport) {
            return res.status(404).json({ success: false, message: 'Passport not found' });
        }
        const risk = (passport.score || 50) >= 70 ? 'low' : (passport.score || 50) >= 40 ? 'medium' : 'high';
        res.json({ success: true, data: { userId, score: passport.score, risk, level: passport.level } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * GET /api/v1/trust/escrow/:userId
 * Check if user is eligible for escrow
 */
router.get('/escrow/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        let passport = await database_1.prisma.trustPassport.findUnique({ where: { userId } });
        if (!passport) {
            passport = await database_1.prisma.trustPassport.create({
                data: {
                    userId,
                    handle: `user-${userId}`,
                    displayName: `User ${userId}`,
                    score: 50,
                    level: 'bronze',
                    verified: false
                },
            });
        }
        const eligible = (passport.score || 50) >= 30;
        res.json({ success: true, data: { userId, eligible, score: passport.score || 50 } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=trust.routes.js.map