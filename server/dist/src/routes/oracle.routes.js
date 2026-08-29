"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const oracle_controller_1 = require("../controllers/oracle.controller");
const router = (0, express_1.Router)();
// GET /api/v1/oracle/trust-score/:walletAddress
router.get('/trust-score/:walletAddress', oracle_controller_1.getTrustScoreAttestation);
exports.default = router;
//# sourceMappingURL=oracle.routes.js.map