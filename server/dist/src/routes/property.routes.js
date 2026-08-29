"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const property_controller_1 = require("../controllers/property.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Protect property registration to authenticated users (landlords)
router.post('/register', auth_middleware_1.authenticate, property_controller_1.registerProperty);
// Public route to view property credentials (used by QR scanner)
router.get('/:propertyId/credentials', property_controller_1.getPropertyCredentials);
exports.default = router;
//# sourceMappingURL=property.routes.js.map