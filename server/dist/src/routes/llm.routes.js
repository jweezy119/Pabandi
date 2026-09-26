"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function() {
        return _default;
    }
});
const _express = require("express");
const _llmcontroller = require("../controllers/llm.controller");
const _expressratelimit = /*#__PURE__*/ _interop_require_default(require("express-rate-limit"));
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
const router = (0, _express.Router)();
// Rate limit: 100 requests per 15 minutes by IP for the LLM ingest endpoint
const llmRateLimiter = (0, _expressratelimit.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        error: 'Too many requests from this IP for LLM ingest.'
    },
    standardHeaders: true,
    legacyHeaders: false
});
// GET /api/v1/llm/businesses
router.get('/businesses', llmRateLimiter, _llmcontroller.getLlmBusinesses);
const _default = router;

//# sourceMappingURL=llm.routes.js.map