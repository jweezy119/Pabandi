"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const vc_controller_1 = require("../controllers/vc.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Public routes
router.post('/verify', vc_controller_1.verifyCredential);
router.get('/status-list/:index', vc_controller_1.getStatusList);
// Protect subsequent routes with auth
router.use(auth_middleware_1.authenticate);
router.post('/issue', vc_controller_1.issueCredential);
router.post('/presentation', vc_controller_1.createPresentation);
router.get('/', vc_controller_1.listCredentials);
router.post('/revoke/:id', vc_controller_1.revokeCredential);
exports.default = router;
//# sourceMappingURL=vc.routes.js.map