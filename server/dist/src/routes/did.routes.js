"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const vc_controller_1 = require("../controllers/vc.controller");
const router = (0, express_1.Router)();
// Endpoint for W3C did:web specification
router.get('/did.json', vc_controller_1.getDidDocument);
exports.default = router;
//# sourceMappingURL=did.routes.js.map