"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("../controllers/user.controller");
const router = (0, express_1.Router)();
// Public routes for searching and viewing users
router.get('/', user_controller_1.searchUsers);
router.get('/:id', user_controller_1.getPublicUserProfile);
exports.default = router;
//# sourceMappingURL=user.routes.js.map