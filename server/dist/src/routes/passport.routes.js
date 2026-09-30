"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../utils/database");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// POST /api/v1/passport/ensure — creates TrustPassport if none exists for this user
router.post('/ensure', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const existing = await database_1.prisma.trustPassport.findFirst({ where: { userId } });
        if (existing) {
            return res.json({ success: true, data: existing });
        }
        const handle = `user-${userId.slice(0, 8)}`;
        const passport = await database_1.prisma.trustPassport.create({
            data: {
                userId,
                handle,
                displayName: req.user?.firstName || 'User',
                visibility: 'PRIVATE',
            },
        });
        res.json({ success: true, data: passport });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=passport.routes.js.map