"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cryptoService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../utils/logger");
class CryptoService {
    constructor() {
        this.currentSalt = this.generateSalt();
        this.saltDate = new Date().toISOString().split('T')[0];
        // In a real multi-instance backend, this would be stored in Redis
        // and rotated by a cron job globally at midnight UTC.
        setInterval(() => this.checkRotation(), 1000 * 60 * 60); // Check every hour
    }
    generateSalt() {
        return crypto_1.default.randomBytes(32).toString('hex');
    }
    checkRotation() {
        const today = new Date().toISOString().split('T')[0];
        if (today !== this.saltDate) {
            this.currentSalt = this.generateSalt();
            this.saltDate = today;
            logger_1.logger.info(`[Crypto] Rotated daily HMAC salt for ${today}`);
        }
    }
    getPublicSalt() {
        return this.currentSalt;
    }
    /**
     * Used by backend processes (like webhooks) to hash raw PII
     * using the current active salt, matching the SDK's behavior.
     */
    hmacHash(data) {
        return crypto_1.default
            .createHmac('sha256', this.currentSalt)
            .update(data)
            .digest('hex');
    }
}
exports.cryptoService = new CryptoService();
//# sourceMappingURL=crypto.service.js.map