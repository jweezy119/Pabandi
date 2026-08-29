"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const pabandiReview_controller_1 = require("../controllers/pabandiReview.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
router.post('/', auth_middleware_1.authenticate, pabandiReview_controller_1.createReview);
exports.default = router;
//# sourceMappingURL=pabandiReview.routes.js.map