"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLog = void 0;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const auditLog = async (req, res, next) => {
    // Only log mutating requests (POST, PUT, DELETE, PATCH)
    const mutatingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    if (!mutatingMethods.includes(req.method)) {
        return next();
    }
    // Intercept response finish event
    res.on('finish', async () => {
        try {
            const actorId = req.user?.id || null;
            let action = `${req.method}_${req.originalUrl.split('?')[0].replace(/\/[a-zA-Z0-9_-]{20,}/g, '/:id')}`;
            // Clean up action name
            action = action.toUpperCase().replace(/[^A-Z0-9_]/g, '_').substring(0, 50);
            const ipAddress = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString();
            const userAgent = req.headers['user-agent'] || null;
            // Extract metadata (redact sensitive info before logging)
            const metadata = {
                statusCode: res.statusCode,
                query: req.query,
                // We do not store full body to avoid PII, just keys to show what was altered
                bodyKeys: req.body ? Object.keys(req.body) : [],
            };
            await database_1.prisma.systemAuditLog.create({
                data: {
                    actorId,
                    action,
                    ipAddress,
                    userAgent,
                    metadata,
                },
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to create audit log', error);
        }
    });
    next();
};
exports.auditLog = auditLog;
//# sourceMappingURL=audit.middleware.js.map