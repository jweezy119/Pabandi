"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSettlementStatus = exports.runSettlement = void 0;
const settlement_service_1 = require("../services/settlement.service");
const runSettlement = async (req, res, next) => {
    try {
        const result = await settlement_service_1.settlementService.runSettlement();
        res.json({ success: true, result });
    }
    catch (err) {
        next(err);
    }
};
exports.runSettlement = runSettlement;
const getSettlementStatus = async (req, res, next) => {
    try {
        res.json({ success: true, settlement: { intervalMs: 60 * 60 * 1000 } });
    }
    catch (err) {
        next(err);
    }
};
exports.getSettlementStatus = getSettlementStatus;
//# sourceMappingURL=settlement.controller.js.map