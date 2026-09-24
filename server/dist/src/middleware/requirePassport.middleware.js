"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePassport = void 0;
const ptp_spec_1 = require("../protocol/ptp.spec");
const logger_1 = require("../utils/logger");
/**
 * Build a passport guard for a required capability.
 * @param need  capability string the agent must hold (e.g. 'act:book', 'act:transfer')
 */
const requirePassport = (need) => {
    return (req, res, next) => {
        const token = req.header('X-Agent-Passport');
        // Human path: no agent header -> proceed untouched.
        if (!token)
            return next();
        // Agent path: must present a valid, capability-scoped passport.
        let att;
        try {
            att = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
        }
        catch {
            return res.status(401).json({ success: false, error: 'X-Agent-Passport is not valid base64 JSON' });
        }
        const result = ptp_spec_1.ptpEngine.verifyAgentPassport(att, need);
        if (!result.valid) {
            logger_1.logger.warn(`[requirePassport] denied agent ${att?.subject?.id || '?'} for '${need}': ${result.error}`);
            return res.status(403).json({
                success: false,
                error: `Agent passport required for '${need}': ${result.error || 'invalid'}`,
                agentId: att?.subject?.id || null,
            });
        }
        req.agentPassport = att;
        next();
    };
};
exports.requirePassport = requirePassport;
//# sourceMappingURL=requirePassport.middleware.js.map