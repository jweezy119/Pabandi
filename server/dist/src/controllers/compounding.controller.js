"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSettings = exports.addCapital = exports.getCompoundReport = void 0;
const compounding_service_1 = require("../services/compounding.service");
const getCompoundReport = async (req, res, next) => {
    try {
        const report = compounding_service_1.compoundingService.getReport();
        res.json({ success: true, report });
    }
    catch (err) {
        next(err);
    }
};
exports.getCompoundReport = getCompoundReport;
const addCapital = async (req, res, next) => {
    try {
        const { amount } = req.body;
        compounding_service_1.compoundingService.addCapital(amount);
        res.json({ success: true, newReserve: compounding_service_1.compoundingService.getCurrentSettings().reserve });
    }
    catch (err) {
        next(err);
    }
};
exports.addCapital = addCapital;
const getSettings = async (req, res, next) => {
    try {
        const settings = compounding_service_1.compoundingService.getCurrentSettings();
        res.json({ success: true, settings });
    }
    catch (err) {
        next(err);
    }
};
exports.getSettings = getSettings;
//# sourceMappingURL=compounding.controller.js.map