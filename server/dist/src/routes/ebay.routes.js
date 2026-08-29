"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ebay_controller_1 = require("../controllers/ebay.controller");
const router = (0, express_1.Router)();
// Starts the OAuth Flow
router.get('/auth', ebay_controller_1.ebayAuthRedirect);
// Callback from eBay OAuth
router.get('/callback', ebay_controller_1.ebayAuthCallback);
exports.default = router;
//# sourceMappingURL=ebay.routes.js.map