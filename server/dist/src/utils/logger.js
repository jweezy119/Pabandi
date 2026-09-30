"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const redactPII = (data) => {
    if (typeof data !== 'object' || data === null)
        return data;
    if (Array.isArray(data))
        return data.map(redactPII);
    const result = { ...data };
    const sensitiveKeys = ['password', 'passwordHash', 'token', 'apiKey', 'email', 'phone'];
    for (const key of Object.keys(result)) {
        if (sensitiveKeys.some((k) => key.toLowerCase().includes(k))) {
            result[key] = '[REDACTED]';
        }
        else if (typeof result[key] === 'object') {
            result[key] = redactPII(result[key]);
        }
    }
    return result;
};
const getRequestId = (req) => {
    if (!req)
        return undefined;
    return req.requestId || req.headers?.['x-request-id'];
};
exports.logger = {
    info: (msg, ...meta) => {
        const reqId = getRequestId();
        const prefix = reqId ? `[${reqId}]` : '';
        console.log(`${prefix} [INFO]`, redactPII(msg), ...meta.map(redactPII));
    },
    error: (msg, ...meta) => {
        const reqId = getRequestId();
        const prefix = reqId ? `[${reqId}]` : '';
        console.error(`${prefix} [ERROR]`, redactPII(msg), ...meta.map(redactPII));
    },
    warn: (msg, ...meta) => {
        const reqId = getRequestId();
        const prefix = reqId ? `[${reqId}]` : '';
        console.warn(`${prefix} [WARN]`, redactPII(msg), ...meta.map(redactPII));
    },
    debug: (msg, ...meta) => {
        const reqId = getRequestId();
        const prefix = reqId ? `[${reqId}]` : '';
        console.debug(`${prefix} [DEBUG]`, redactPII(msg), ...meta.map(redactPII));
    },
    add: () => { }
};
//# sourceMappingURL=logger.js.map