"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const wallet_controller_1 = require("../controllers/wallet.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/balances', wallet_controller_1.getBalances);
router.post('/export-secret', wallet_controller_1.exportSecret);
exports.default = router;
//# sourceMappingURL=wallet.routes.js.map