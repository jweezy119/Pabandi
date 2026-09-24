"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const singleWalletTreasury_controller_1 = require("../controllers/singleWalletTreasury.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.get('/address', auth_middleware_1.authenticate, singleWalletTreasury_controller_1.getWalletAddress);
router.post('/fund', auth_middleware_1.authenticate, singleWalletTreasury_controller_1.fundWallet);
router.get('/breakdown', auth_middleware_1.authenticate, singleWalletTreasury_controller_1.getBreakdown);
router.post('/recycle', auth_middleware_1.authenticate, singleWalletTreasury_controller_1.recycleProfits);
router.post('/reserve', auth_middleware_1.authenticate, singleWalletTreasury_controller_1.allocateToReserve);
exports.default = router;
//# sourceMappingURL=singleWalletTreasury.routes.js.map