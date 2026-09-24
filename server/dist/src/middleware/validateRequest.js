"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = void 0;
const express_validator_1 = require("express-validator");
const validateRequest = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        const fieldErrors = {};
        errors.array().forEach((e) => {
            const field = e.path || e.param || 'general';
            if (!fieldErrors[field])
                fieldErrors[field] = humanizeError(field, e.msg);
        });
        return res.status(400).json({
            success: false,
            message: Object.values(fieldErrors)[0], // first human-readable message
            errors: fieldErrors,
        });
    }
    next();
};
exports.validateRequest = validateRequest;
function humanizeError(field, msg) {
    const map = {
        email: 'Please enter a valid email address.',
        password: 'Password must be at least 8 characters long.',
        firstName: 'First name is required.',
        lastName: 'Last name is required.',
        phone: 'Please enter a valid phone number (e.g. +1 312 489 6967).',
    };
    return map[field] || msg;
}
//# sourceMappingURL=validateRequest.js.map