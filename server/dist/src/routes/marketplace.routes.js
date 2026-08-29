"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const marketplace_controller_1 = require("../controllers/marketplace.controller");
const router = (0, express_1.Router)();
// Phase 1: Brand previews audience size + Merkle Root (no PII leaked)
router.post('/audience', marketplace_controller_1.getAudiencePreview);
// Phase 2: Brand funds campaign → users notified with Merkle Proofs
router.post('/campaign', marketplace_controller_1.createAndExecuteCampaign);
// Phase 3: User claims reward with wallet + Merkle Proof (pure math verification)
router.post('/claim', marketplace_controller_1.claimReward);
exports.default = router;
//# sourceMappingURL=marketplace.routes.js.map