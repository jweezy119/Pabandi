"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startBnplDefaultChecker = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const database_1 = require("../utils/database");
const vc_service_1 = require("../services/vc.service");
const vcService = new vc_service_1.VCService();
/**
 * Sweeps for REPUTATION_BNPL loans that are past their dueDate and are still ACTIVE.
 * Marks them as DEFAULTED and revokes the user's W3C Trust VC globally.
 */
const startBnplDefaultChecker = () => {
    // Run daily at midnight
    node_cron_1.default.schedule('0 0 * * *', async () => {
        console.log('[Cron] Running BNPL default checker...');
        try {
            const now = new Date();
            const defaultedLoans = await database_1.prisma.loan.findMany({
                where: {
                    loanType: 'REPUTATION_BNPL',
                    status: 'ACTIVE',
                    dueDate: { lt: now },
                },
            });
            if (defaultedLoans.length === 0) {
                console.log('[Cron] No defaulted BNPL loans found.');
                return;
            }
            for (const loan of defaultedLoans) {
                // 1. Mark loan as defaulted
                await database_1.prisma.loan.update({
                    where: { id: loan.id },
                    data: { status: 'DEFAULTED' },
                });
                // 2. Revoke the VC
                await vcService.revokeForDefault(loan.userId, `Defaulted on BNPL Loan ${loan.id}`);
                console.log(`[Cron] Default processed for Loan ${loan.id} (User: ${loan.userId})`);
            }
            console.log(`[Cron] Processed ${defaultedLoans.length} BNPL defaults.`);
        }
        catch (error) {
            console.error('[Cron] Error running BNPL default checker:', error);
        }
    });
};
exports.startBnplDefaultChecker = startBnplDefaultChecker;
//# sourceMappingURL=bnpl-default-checker.js.map