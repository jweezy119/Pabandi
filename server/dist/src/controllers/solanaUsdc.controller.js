"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAgentWallets = exports.getTransfers = exports.getAgentBalance = exports.createAgentWallet = exports.recordTransfer = exports.buildTransfer = exports.getPlatformBalance = void 0;
const solanaUsdc_service_1 = require("../services/solanaUsdc.service");
const database_1 = require("../utils/database");
const getPlatformBalance = async (req, res, next) => {
    try {
        const balance = await solanaUsdc_service_1.solanaUsdc.getPlatformBalance();
        res.json({ success: true, balance, platformWallet: solanaUsdc_service_1.solanaUsdc.getPlatformWallet() });
    }
    catch (err) {
        next(err);
    }
};
exports.getPlatformBalance = getPlatformBalance;
const buildTransfer = async (req, res, next) => {
    try {
        const { fromWallet, toWallet, amountUsdc } = req.body;
        const tx = await solanaUsdc_service_1.solanaUsdc.buildTransferTransaction({ fromWallet, toWallet, amountUsdc });
        res.json({ success: true, ...tx });
    }
    catch (err) {
        next(err);
    }
};
exports.buildTransfer = buildTransfer;
const recordTransfer = async (req, res, next) => {
    try {
        const record = await solanaUsdc_service_1.solanaUsdc.recordTransfer(req.body);
        res.json({ success: true, record });
    }
    catch (err) {
        next(err);
    }
};
exports.recordTransfer = recordTransfer;
const createAgentWallet = async (req, res, next) => {
    try {
        const { agentId } = req.params;
        const result = await solanaUsdc_service_1.solanaUsdc.createAgentWallet(agentId);
        res.json({ success: true, ...result });
    }
    catch (err) {
        next(err);
    }
};
exports.createAgentWallet = createAgentWallet;
const getAgentBalance = async (req, res, next) => {
    try {
        const { agentId } = req.params;
        const wallet = await database_1.prisma.agentWallet.findUnique({ where: { agentId } });
        if (!wallet)
            return res.status(404).json({ error: 'Wallet not found' });
        const balance = await solanaUsdc_service_1.solanaUsdc.getUsdcBalance(wallet.publicKey);
        res.json({ success: true, balance, publicKey: wallet.publicKey });
    }
    catch (err) {
        next(err);
    }
};
exports.getAgentBalance = getAgentBalance;
const getTransfers = async (req, res, next) => {
    try {
        const transfers = await database_1.prisma.usdcTransfer.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        res.json({ success: true, transfers });
    }
    catch (err) {
        next(err);
    }
};
exports.getTransfers = getTransfers;
const getAgentWallets = async (req, res, next) => {
    try {
        const wallets = await database_1.prisma.agentWallet.findMany({
            include: { agent: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, wallets });
    }
    catch (err) {
        next(err);
    }
};
exports.getAgentWallets = getAgentWallets;
//# sourceMappingURL=solanaUsdc.controller.js.map