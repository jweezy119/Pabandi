"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAppCheck = void 0;
const logger_1 = require("../utils/logger");
const requireAppCheck = async (req, res, next) => {
    // Do NOT bypass App Check globally. Individual routes that cannot
    // attach custom headers (browser redirects etc.) must be exempted
    // explicitly below.
    // Bypass App Check for OAuth redirect and callback routes because browser
    // redirects (window.location.href) cannot attach custom headers.
    const oauthPaths = ['/auth/google', '/auth/facebook', '/auth/twitter', '/auth/linkedin', '/auth/tiktok'];
    if (oauthPaths.some(path => req.originalUrl.includes(path))) {
        return next();
    }
    // Allow local development without App Check when explicitly opted in.
    if (process.env.NODE_ENV !== 'production' && process.env.SKIP_APP_CHECK === 'true') {
        return next();
    }
    // Public read-only GET routes — these are safe to access without App Check
    // because they only return public business data (venue listings, freight load
    // board stats, maps geocoding). The frontend does not send App Check tokens,
    // so these routes would otherwise always fail.
    const publicGetPaths = ['/venues/search', '/freight/stats', '/freight/loads', '/maps/geocode', '/businesses'];
    if (req.method === 'GET' && publicGetPaths.some(path => req.originalUrl.includes(path))) {
        return next();
    }
    const appCheckToken = req.header('X-Firebase-AppCheck');
    if (!appCheckToken) {
        logger_1.logger.warn(`Unauthorized request: Missing App Check token from ${req.ip}`);
        return res.status(401).json({
            success: false,
            error: 'Unauthorized: App Check token is missing.',
            code: 'app-check/missing-token'
        });
    }
    try {
        const admin = await Promise.resolve().then(() => __importStar(require('firebase-admin')));
        if (!admin.appCheck) {
            return res.status(500).json({ success: false, error: 'App Check is not configured.', code: 'app-check/not-configured' });
        }
        const appCheckClaims = await admin.appCheck().verifyToken(appCheckToken);
        return next();
    }
    catch (error) {
        logger_1.logger.error('Failed to verify App Check token:', error);
        return res.status(401).json({
            success: false,
            error: 'Unauthorized: Invalid App Check token.',
            code: 'app-check/invalid-token'
        });
    }
};
exports.requireAppCheck = requireAppCheck;
//# sourceMappingURL=appCheck.middleware.js.map