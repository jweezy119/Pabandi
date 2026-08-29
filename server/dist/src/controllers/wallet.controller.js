"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportSecret = exports.getBalances = void 0;
const database_1 = require("../utils/database");
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const logger_1 = require("../utils/logger");
// Use the mainnet-beta RPC, or the one from ENV if set
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const connection = new web3_js_1.Connection(SOLANA_RPC_URL, 'confirmed');
const getBalances = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        // 1. Get Off-Chain (Database) Balance
        const user = await database_1.prisma.user.findUnique({
            where: { id: userId },
            include: { wallet: true },
        });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        const offChainBalance = user.wallet?.balance || 0;
        const totalStaked = user.wallet?.totalStaked || 0;
        let onChainBalance = 0;
        // 2. Get On-Chain (Solana) Balance if they have linked a wallet
        const mintAddress = process.env.SOLANA_PAB_MINT_ADDRESS || '4MLskKmcnz8bVaPfEuVbhZGsbeUMZqKjQYQQDEX6WQcQ';
        if (user.wallet?.address && mintAddress) {
            try {
                const userPubKey = new web3_js_1.PublicKey(user.wallet.address);
                const mintPubKey = new web3_js_1.PublicKey(mintAddress);
                const ata = await (0, spl_token_1.getAssociatedTokenAddress)(mintPubKey, userPubKey);
                const tokenAccountInfo = await connection.getTokenAccountBalance(ata);
                if (tokenAccountInfo.value.uiAmount !== null) {
                    onChainBalance = tokenAccountInfo.value.uiAmount;
                }
            }
            catch (solErr) {
                // If the ATA doesn't exist yet, it throws an error. We just treat it as 0 balance.
                logger_1.logger.debug(`Could not fetch Solana balance for ${user.wallet.address}: ${solErr.message}`);
            }
        }
        res.json({
            success: true,
            data: {
                offChainBalance,
                onChainBalance,
                totalStaked,
                totalBalance: offChainBalance + onChainBalance + totalStaked,
                solanaWalletAddress: user.wallet?.address || null,
                mintAddress: mintAddress
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching wallet balances:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch balances' });
    }
};
exports.getBalances = getBalances;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const encryption_1 = require("../utils/encryption");
const errorHandler_1 = require("../middleware/errorHandler");
const exportSecret = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const { password } = req.body;
        if (!userId) {
            throw new errorHandler_1.CustomError('Unauthorized', 401);
        }
        if (!password) {
            throw new errorHandler_1.CustomError('Password is required to export wallet secret', 400);
        }
        const user = await database_1.prisma.user.findUnique({
            where: { id: userId },
            include: { wallet: true },
        });
        if (!user) {
            throw new errorHandler_1.CustomError('User not found', 404);
        }
        const isValidPassword = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isValidPassword) {
            throw new errorHandler_1.CustomError('Invalid password. Export denied.', 403);
        }
        if (!user.wallet?.encryptedSecret) {
            throw new errorHandler_1.CustomError('No custodial wallet found for this account.', 404);
        }
        const secretKeyBase58 = (0, encryption_1.decrypt)(user.wallet.encryptedSecret);
        // Audit log this sensitive action
        await database_1.prisma.systemAuditLog.create({
            data: {
                actorId: userId,
                action: 'EXPORT_WALLET_SECRET',
                targetId: user.wallet.id,
                metadata: { ip: req.ip }
            }
        });
        res.json({
            success: true,
            data: {
                secretKey: secretKeyBase58
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.exportSecret = exportSecret;
//# sourceMappingURL=wallet.controller.js.map