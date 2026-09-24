"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOptimalConfig = exports.simulateDeployment = void 0;
const microProfitEngine_service_1 = require("../services/microProfitEngine.service");
const simulateDeployment = async (req, res, next) => {
    try {
        const startingUsd = parseFloat(req.query.usd) || 25;
        const solBalance = parseFloat(req.query.sol) || 0.50;
        const simulation = microProfitEngine_service_1.microProfitEngine.constructor.simulateDeployment(startingUsd, solBalance);
        res.json({ success: true, simulation });
    }
    catch (err) {
        next(err);
    }
};
exports.simulateDeployment = simulateDeployment;
const getOptimalConfig = async (req, res, next) => {
    try {
        const capital = parseFloat(req.query.capital) || 25;
        const batchSize = microProfitEngine_service_1.microProfitEngine.getOptimalBatchSize(capital);
        const taskValue = microProfitEngine_service_1.microProfitEngine.getOptimalTaskValue(capital);
        const usdPerCycle = batchSize * taskValue;
        const cyclesPerDay = Math.max(1, Math.floor(25 / (capital / 25)));
        res.json({
            success: true,
            config: {
                capital,
                batchSize,
                taskValue,
                usdPerCycle,
                cyclesPerDay,
                estimatedDailyRevenue: (usdPerCycle * 0.02 - 0.00025) * cyclesPerDay,
            },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getOptimalConfig = getOptimalConfig;
//# sourceMappingURL=microProfit.controller.js.map