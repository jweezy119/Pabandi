"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allocateToReserve = exports.getWalletAddress = exports.recycleProfits = exports.getBreakdown = exports.fundWallet = void 0;
const singleWalletTreasury_service_1 = require("../services/singleWalletTreasury.service");
const fundWallet = async (req, res, next) => {
    try {
        const { amountUsd, txHash, note } = req.body;
        const result = await singleWalletTreasury_service_1.singleWalletTreasury.fundWallet({ amountUsd, txHash, note });
        res.json(result);
    }
    catch (err) {
        next(err);
    }
};
exports.fundWallet = fundWallet;
const getBreakdown = async (req, res, next) => {
    try {
        const breakdown = await singleWalletTreasury_service_1.singleWalletTreasury.getFullBreakdown();
        res.json({ success: true, breakdown });
    }
    catch (err) {
        next(err);
    }
};
exports.getBreakdown = getBreakdown;
const recycleProfits = async (req, res, next) => {
    try {
        const { amountUsd, txHash } = req.body;
        const result = await singleWalletTreasury_service_1.singleWalletTreasury.recycleProfitsToOperating({ amountUsd, txHash });
        res.json(result);
    }
    catch (err) {
        next(err);
    }
};
exports.recycleProfits = recycleProfits;
const getWalletAddress = async (req, res, next) => {
    try {
        const address = singleWalletTreasury_service_1.singleWalletTreasury.getPlatformWalletAddress();
        res.json({ success: true, platformWallet: address });
    }
    catch (err) {
        next(err);
    }
};
exports.getWalletAddress = getWalletAddress;
const allocateToReserve = async (req, res, next) => {
    try {
        const { amountUsd, txHash } = req.body;
        const result = await singleWalletTreasury_service_1.singleWalletTreasury.allocateToReserve({ amountUsd, txHash });
        res.json(result);
    }
    catch (err) {
        next(err);
    }
};
exports.allocateToReserve = allocateToReserve;
//# sourceMappingURL=singleWalletTreasury.controller.js.map