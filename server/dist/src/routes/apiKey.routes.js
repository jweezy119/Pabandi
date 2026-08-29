"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const apiKey_controller_1 = require("../controllers/apiKey.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.post('/generate', apiKey_controller_1.generateApiKey);
router.get('/', apiKey_controller_1.getApiKeys);
exports.default = router;
//# sourceMappingURL=apiKey.routes.js.map