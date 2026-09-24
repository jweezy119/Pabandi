"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoApproval = exports.AutoApprovalService = void 0;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const bs58_1 = __importDefault(require("bs58"));
const crypto_1 = __importDefault(require("crypto"));
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
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
class AutoApprovalService {
    constructor() {
        this.connection = null;
        this.platformKeypair = null;
        this.loadPlatformKey();
    }
    getConnection() {
        if (!this.connection) {
            const url = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
            this.connection = new web3_js_1.Connection(url, 'confirmed');
        }
        return this.connection;
    }
    loadPlatformKey() {
        const privateKeyBase58 = process.env.PLATFORM_PRIVATE_KEY;
        if (!privateKeyBase58) {
            console.warn('[AutoApproval] PLATFORM_PRIVATE_KEY not set');
            return;
        }
        try {
            const secretKey = bs58_1.default.decode(privateKeyBase58);
            this.platformKeypair = web3_js_1.Keypair.fromSecretKey(secretKey);
            console.log(`[AutoApproval] Wallet: ${this.platformKeypair.publicKey.toBase58()}`);
        }
        catch (err) {
            console.error('[AutoApproval] Key load failed:', err.message);
        }
    }
    isEnabled() {
        return this.platformKeypair !== null;
    }
    getPlatformAddress() {
        return this.platformKeypair?.publicKey.toBase58() || '';
    }
    async getUsdcBalance(walletAddress) {
        try {
            const mintKey = new web3_js_1.PublicKey(USDC_MINT);
            const walletKey = new web3_js_1.PublicKey(walletAddress || this.platformKeypair?.publicKey.toBase58() || '');
            const tokenAddress = await (0, spl_token_1.getAssociatedTokenAddress)(mintKey, walletKey);
            const accountInfo = await this.getConnection().getAccountInfo(tokenAddress);
            if (!accountInfo)
                return 0;
            const balance = await this.getConnection().getTokenAccountBalance(tokenAddress);
            return parseFloat(balance.value.uiAmount?.toString() || '0');
        }
        catch {
            return 0;
        }
    }
    async autoTransfer(params) {
        if (!this.platformKeypair) {
            return { success: false, error: 'Auto-approval not enabled' };
        }
        try {
            const mintKey = new web3_js_1.PublicKey(USDC_MINT);
            const fromKey = this.platformKeypair.publicKey;
            const toKey = new web3_js_1.PublicKey(params.toWallet);
            const fromTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(mintKey, fromKey);
            const toTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(mintKey, toKey);
            const transaction = new web3_js_1.Transaction();
            const toAccountInfo = await this.getConnection().getAccountInfo(toTokenAccount);
            if (!toAccountInfo) {
                transaction.add((0, spl_token_1.createAssociatedTokenAccountInstruction)(fromKey, toTokenAccount, toKey, mintKey));
            }
            const amountRaw = Math.round(params.amountUsdc * 1000000);
            transaction.add((0, spl_token_1.createTransferInstruction)(fromTokenAccount, toTokenAccount, fromKey, amountRaw, [], spl_token_1.TOKEN_PROGRAM_ID));
            const { blockhash } = await this.getConnection().getRecentBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = fromKey;
            transaction.sign(this.platformKeypair);
            const txHash = await this.getConnection().sendRawTransaction(transaction.serialize());
            await this.getConnection().confirmTransaction(txHash, 'confirmed');
            return { success: true, txHash };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async getFullBalance() {
        if (!this.platformKeypair)
            return { usdc: 0, sol: 0 };
        const usdc = await this.getUsdcBalance();
        try {
            const sol = await this.getConnection().getBalance(this.platformKeypair.publicKey) / web3_js_1.LAMPORTS_PER_SOL;
            return { usdc, sol };
        }
        catch {
            return { usdc, sol: 0 };
        }
    }
}
exports.AutoApprovalService = AutoApprovalService;
exports.autoApproval = new AutoApprovalService();
//# sourceMappingURL=autoApproval.service.js.map