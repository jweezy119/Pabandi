"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.trustAuditWriter = exports.TrustAuditWriter = void 0;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const crypto_1 = __importDefault(require("crypto"));
class TrustAuditWriter {
    constructor() {
        this.buffer = [];
        this.maxBuffer = 100;
        this.interval = null;
        this.isFlushing = false;
        this.startInterval();
    }
    startInterval() {
        // 5 seconds
        this.interval = setInterval(() => this.flush(), 5000);
    }
    async enqueue(entry) {
        // Determine previous hash for this user
        let previousHash = null;
        // We can fetch the last recorded hash for this user from DB,
        // or from the buffer if there's one pending.
        // To ensure strict chain, we get the last one in the buffer first.
        const lastInBuffer = this.buffer.slice().reverse().find(e => e.userId === entry.userId);
        if (lastInBuffer) {
            previousHash = lastInBuffer.currentHash;
        }
        else {
            const lastInDb = await database_1.prisma.trustAuditTrail.findFirst({
                where: { userId: entry.userId },
                orderBy: { createdAt: 'desc' },
            });
            if (lastInDb) {
                previousHash = lastInDb.currentHash;
            }
        }
        const payloadToHash = JSON.stringify({
            userId: entry.userId,
            previousScore: entry.previousScore,
            newScore: entry.newScore,
            changeReason: entry.changeReason,
            component: entry.component,
            previousHash: previousHash || 'GENESIS',
            timestamp: Date.now()
        });
        const currentHash = crypto_1.default.createHash('sha256').update(payloadToHash).digest('hex');
        const auditRecord = {
            userId: entry.userId,
            previousScore: entry.previousScore,
            newScore: entry.newScore,
            changeReason: entry.changeReason,
            component: entry.component,
            severity: entry.severity,
            weightUsed: entry.weightUsed || null,
            metadata: entry.metadata || {},
            previousHash,
            currentHash,
            methodology: entry.methodology || "1.0.0",
        };
        this.buffer.push(auditRecord);
        if (this.buffer.length >= this.maxBuffer) {
            await this.flush();
        }
    }
    async flush() {
        if (this.buffer.length === 0 || this.isFlushing)
            return;
        this.isFlushing = true;
        try {
            const batch = [...this.buffer];
            this.buffer = [];
            await database_1.prisma.trustAuditTrail.createMany({ data: batch });
        }
        catch (err) {
            logger_1.logger.error('[TrustAuditWriter] Flush error', err);
            // In a robust system, we would put the batch back to the front of the buffer
        }
        finally {
            this.isFlushing = false;
        }
    }
    stop() {
        if (this.interval)
            clearInterval(this.interval);
    }
}
exports.TrustAuditWriter = TrustAuditWriter;
exports.trustAuditWriter = new TrustAuditWriter();
//# sourceMappingURL=trustAuditWriter.js.map