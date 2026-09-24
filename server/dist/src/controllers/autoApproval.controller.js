"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransferHistory = exports.generateNewWallet = exports.autoTransfer = exports.getPlatformBalance = exports.getAutoApprovalStatus = void 0;
const autoApproval_service_1 = require("../services/autoApproval.service");
const database_1 = require("../utils/database");
const getAutoApprovalStatus = async (req, res, next) => {
    try {
        const enabled = autoApproval_service_1.autoApproval.isEnabled();
        const address = autoApproval_service_1.autoApproval.getPlatformAddress();
        res.json({ success: true, enabled, platformWallet: address });
    }
    catch (err) {
        next(err);
    }
};
exports.getAutoApprovalStatus = getAutoApprovalStatus;
const getPlatformBalance = async (req, res, next) => {
    try {
        const balance = await autoApproval_service_1.autoApproval.getFullBalance();
        res.json({ success: true, balance });
    }
    catch (err) {
        next(err);
    }
};
exports.getPlatformBalance = getPlatformBalance;
const autoTransfer = async (req, res, next) => {
    try {
        const { toWallet, amountUsdc, referenceId } = req.body;
        const result = await autoApproval_service_1.autoApproval.autoTransfer({ toWallet, amountUsdc, referenceId });
        if (result.success && result.txHash) {
            // Record in treasury
            await database_1.prisma.usdcTransfer.create({
                data: {
                    fromWallet: autoApproval_service_1.autoApproval.getPlatformAddress(),
                    toWallet,
                    amountUsdc,
                    txHash: result.txHash,
                    type: 'AGENT_PAYMENT',
                    referenceId,
                    status: 'CONFIRMED',
                    blockTime: new Date(),
                },
            });
        }
        res.json(result);
    }
    catch (err) {
        next(err);
    }
};
exports.autoTransfer = autoTransfer;
const generateNewWallet = async (req, res, next) => {
    try {
        const wallet = autoApproval_service_1.autoApproval.constructor.generateWallet();
        res.json({
            success: true,
            message: 'NEW PLATFORM WALLET GENERATED — SAVE THE PRIVATE KEY SECRETLY',
            publicKey: wallet.publicKey,
            privateKeyBase64: wallet.privateKeyBase64,
            instructions: [
                '1. Copy the private key to your password manager',
                '2. Set PLATFORM_PRIVATE_KEY in Render dashboard',
                '3. Send USDC on Solana to the public address',
                '4. Delete this response — the key is now in your env vars',
            ],
        });
    }
    catch (err) {
        next(err);
    }
};
exports.generateNewWallet = generateNewWallet;
const getTransferHistory = async (req, res, next) => {
    try {
        const history = await database_1.prisma.usdcTransfer.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        res.json({ success: true, history });
    }
    catch (err) {
        next(err);
    }
};
exports.getTransferHistory = getTransferHistory;
//# sourceMappingURL=autoApproval.controller.js.map