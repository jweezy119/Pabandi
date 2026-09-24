"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.solanaUsdc = exports.SolanaUsdcService = void 0;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const database_1 = require("../utils/database");
const crypto_1 = __importDefault(require("crypto"));
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
let _connection = null;
function getConnection() {
    if (!_connection) {
        const url = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
        _connection = new web3_js_1.Connection(url, 'confirmed');
    }
    return _connection;
}
function getEncKey() {
    const key = process.env.WALLET_ENC_KEY;
    if (!key)
        return crypto_1.default.scryptSync(process.env.JWT_SECRET || 'fallback', 'salt', 32);
    return Buffer.from(key, 'hex');
}
function encrypt(text) {
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, getEncKey(), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
}
class SolanaUsdcService {
    /**
     * Generate a new Solana keypair for an agent
     * Returns public key, stores encrypted secret
     */
    async createAgentWallet(agentId) {
        const existing = await database_1.prisma.agentWallet.findUnique({ where: { agentId } });
        if (existing)
            return { publicKey: existing.publicKey, created: false };
        const { Keypair } = await Promise.resolve().then(() => __importStar(require('@solana/web3.js')));
        const keypair = Keypair.generate();
        const publicKey = keypair.publicKey.toBase58();
        const secretKey = Buffer.from(keypair.secretKey).toString('base64');
        const encryptedSecret = encrypt(secretKey);
        await database_1.prisma.agentWallet.create({
            data: {
                agentId,
                publicKey,
                encryptedSecret,
                balanceUsdc: 0,
            },
        });
        return { publicKey, created: true };
    }
    /**
     * Get the platform wallet address (public only)
     */
    getPlatformWallet() {
        return process.env.PLATFORM_WALLET_ADDRESS || '';
    }
    /**
     * Get USDC balance for any wallet address
     */
    async getUsdcBalance(walletAddress) {
        try {
            const mintKey = new web3_js_1.PublicKey(USDC_MINT);
            const walletKey = new web3_js_1.PublicKey(walletAddress);
            const tokenAddress = await (0, spl_token_1.getAssociatedTokenAddress)(mintKey, walletKey);
            const accountInfo = await getConnection().getAccountInfo(tokenAddress);
            if (!accountInfo)
                return 0;
            const balance = await getConnection().getTokenAccountBalance(tokenAddress);
            return parseFloat(balance.value.uiAmount?.toString() || '0');
        }
        catch {
            return 0;
        }
    }
    /**
     * Record an on-chain USDC transfer in our treasury
     */
    async recordTransfer(params) {
        return database_1.prisma.usdcTransfer.create({
            data: {
                fromWallet: params.fromWallet,
                toWallet: params.toWallet,
                amountUsdc: params.amountUsdc,
                txHash: params.txHash,
                type: params.type,
                referenceId: params.referenceId,
                status: 'CONFIRMED',
                blockTime: new Date(),
            },
        });
    }
    /**
     * Build a transfer instruction for Phantom to sign
     */
    async buildTransferTransaction(params) {
        const mintKey = new web3_js_1.PublicKey(USDC_MINT);
        const fromKey = new web3_js_1.PublicKey(params.fromWallet);
        const toKey = new web3_js_1.PublicKey(params.toWallet);
        const fromTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(mintKey, fromKey);
        const toTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(mintKey, toKey);
        const transaction = new web3_js_1.Transaction();
        const toAccountInfo = await getConnection().getAccountInfo(toTokenAccount);
        if (!toAccountInfo) {
            transaction.add((0, spl_token_1.createAssociatedTokenAccountInstruction)(fromKey, toTokenAccount, toKey, mintKey));
        }
        const amountRaw = Math.round(params.amountUsdc * 1000000);
        transaction.add((0, spl_token_1.createTransferInstruction)(fromTokenAccount, toTokenAccount, fromKey, amountRaw, [], spl_token_1.TOKEN_PROGRAM_ID));
        const { blockhash } = await getConnection().getRecentBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = fromKey;
        return {
            transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
            message: `Transfer ${params.amountUsdc} USDC from ${params.fromWallet.slice(0, 8)}... to ${params.toWallet.slice(0, 8)}...`,
        };
    }
    /**
     * Get platform wallet USDC balance (public query)
     */
    async getPlatformBalance() {
        const platformWallet = this.getPlatformWallet();
        if (!platformWallet)
            return { usdc: 0, sol: 0 };
        const usdc = await this.getUsdcBalance(platformWallet);
        try {
            const sol = await getConnection().getBalance(new web3_js_1.PublicKey(platformWallet)) / web3_js_1.LAMPORTS_PER_SOL;
            return { usdc, sol };
        }
        catch {
            return { usdc, sol: 0 };
        }
    }
}
exports.SolanaUsdcService = SolanaUsdcService;
exports.solanaUsdc = new SolanaUsdcService();
//# sourceMappingURL=solanaUsdc.service.js.map