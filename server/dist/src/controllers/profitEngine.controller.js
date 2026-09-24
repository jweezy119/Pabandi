"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLearningLog = exports.getSettlementSpeed = exports.getArbitrageStatus = exports.runManualCycle = exports.getProfitReport = void 0;
const profitEngine_service_1 = require("../services/profitEngine.service");
const getProfitReport = async (req, res, next) => {
    try {
        const report = profitEngine_service_1.profitEngine.getReport();
        res.json({ success: true, report });
    }
    catch (err) {
        next(err);
    }
};
exports.getProfitReport = getProfitReport;
const runManualCycle = async (req, res, next) => {
    try {
        const result = await profitEngine_service_1.profitEngine.runCycle();
        res.json({ success: true, result });
    }
    catch (err) {
        next(err);
    }
};
exports.runManualCycle = runManualCycle;
const getArbitrageStatus = async (req, res, next) => {
    try {
        const arb = await profitEngine_service_1.profitEngine.checkArbitrageOpportunity();
        res.json({ success: true, arbitrage: arb });
    }
    catch (err) {
        next(err);
    }
};
exports.getArbitrageStatus = getArbitrageStatus;
const getSettlementSpeed = async (req, res, next) => {
    try {
        const speed = profitEngine_service_1.profitEngine.getSettlementSpeed();
        res.json({ success: true, settlement: speed });
    }
    catch (err) {
        next(err);
    }
};
exports.getSettlementSpeed = getSettlementSpeed;
const getLearningLog = async (req, res, next) => {
    try {
        res.json({
            success: true,
            learning: {
                feeRate: profitEngine_service_1.profitEngine.feeRate,
                avgCycleTime: profitEngine_service_1.profitEngine.getAvgCycleTime ? profitEngine_service_1.profitEngine.getAvgCycleTime() : 0,
                cycleCount: profitEngine_service_1.profitEngine.cycleCount,
                adjustments: profitEngine_service_1.profitEngine.cycleTimes?.length || 0,
            },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getLearningLog = getLearningLog;
//# sourceMappingURL=profitEngine.controller.js.map