"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const compounding_controller_1 = require("../controllers/compounding.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.get('/report', auth_middleware_1.authenticate, compounding_controller_1.getCompoundReport);
router.get('/settings', auth_middleware_1.authenticate, compounding_controller_1.getSettings);
router.post('/add-capital', auth_middleware_1.authenticate, compounding_controller_1.addCapital);
exports.default = router;
//# sourceMappingURL=compounding.routes.js.map