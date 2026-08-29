"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startDbKeepalive = startDbKeepalive;
const node_cron_1 = __importDefault(require("node-cron"));
const database_1 = require("./database");
const logger_1 = require("./logger");
// Every 4 days at 03:00 AM
// Using a variable avoids ts-node misreading "* /" as a comment closer
const EVERY_4_DAYS = ['0', '3', '*', '*', '*'].join(' ').replace('* *', '*/4 *');
function startDbKeepalive() {
    // Fire-and-forget: never block server startup on DB keepalive
    pingDatabase('startup').catch((err) => {
        logger_1.logger.warn('[Keepalive] Startup DB ping skipped: ' + (err?.message || err));
    });
    node_cron_1.default.schedule(EVERY_4_DAYS, () => {
        pingDatabase('scheduled').catch((err) => {
            logger_1.logger.warn('[Keepalive] Scheduled DB ping failed: ' + (err?.message || err));
        });
    });
    logger_1.logger.info('[Keepalive] DB keepalive scheduled - runs every 4 days');
}
async function pingDatabase(reason) {
    try {
        const count = await database_1.prisma.user.count();
        logger_1.logger.info('[Keepalive] DB ping OK [' + reason + '] - ' + count + ' users');
    }
    catch (err) {
        logger_1.logger.error('[Keepalive] DB ping FAILED [' + reason + ']: ' + (err && err.message));
    }
}
//# sourceMappingURL=dbKeepalive.js.map