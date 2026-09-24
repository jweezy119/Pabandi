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
exports.startAllAgents = exports.addLiquidity = exports.executeTrade = exports.getAgent = exports.getAgents = exports.stopAgent = exports.pauseAgent = exports.startAgent = exports.createAgent = exports.getStats = exports.collectFees = exports.fundAgent = exports.executeSwap = exports.getPoolInfoEndpoint = exports.createPool = exports.getTokenInfo = exports.createToken = void 0;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const bs58_1 = __importDefault(require("bs58"));
const pabToken_service_1 = require("../services/pabToken.service");
const raydiumPool_service_1 = require("../services/raydiumPool.service");
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDC_DECIMALS = 6;
function getKeypair() {
    const privateKeyBase58 = process.env.PLATFORM_PRIVATE_KEY || '';
    const secretKey = bs58_1.default.decode(privateKeyBase58);
    return web3_js_1.Keypair.fromSecretKey(secretKey);
}
const createToken = async (req, res, next) => {
    try {
        const result = await pabToken_service_1.pabToken.createToken();
        res.json({ success: true, data: { mintAddress: result.mint, signature: result.txHash, totalSupply: 1000000000, decimals: 9 } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
exports.createToken = createToken;
const getTokenInfo = async (req, res, next) => {
    try {
        res.json({ success: true, data: { platformAddress: pabToken_service_1.pabToken.getPlatformAddress(), totalSupply: 1000000000, decimals: 9 } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
exports.getTokenInfo = getTokenInfo;
const createPool = async (req, res, next) => {
    try {
        const { pabAmount, usdcAmount } = req.body;
        const result = await (0, raydiumPool_service_1.initializePool)(pabAmount || 10000, usdcAmount || 1);
        if (result.success) {
            res.json({ success: true, data: await (0, raydiumPool_service_1.getPoolInfo)() });
        }
        else {
            res.json({ success: false, error: result.error });
        }
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
exports.createPool = createPool;
const getPoolInfoEndpoint = async (req, res, next) => {
    try {
        res.json({ success: true, data: await (0, raydiumPool_service_1.getPoolInfo)() });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
exports.getPoolInfoEndpoint = getPoolInfoEndpoint;
const executeSwap = async (req, res, next) => {
    try {
        const { direction, amount, wallet } = req.body;
        if (!wallet)
            return res.status(400).json({ success: false, error: 'Agent ID required' });
        const result = direction === 'buy'
            ? await (0, raydiumPool_service_1.buyPAB)(wallet, amount)
            : await (0, raydiumPool_service_1.sellPAB)(wallet, amount);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
exports.executeSwap = executeSwap;
const fundAgent = async (req, res, next) => {
    try {
        const { wallet, amount } = req.body;
        if (!wallet || !amount)
            return res.status(400).json({ success: false, error: 'Wallet and amount required' });
        let walletAddress = wallet;
        if (wallet.startsWith('cmu')) {
            const { prisma } = await Promise.resolve().then(() => __importStar(require('../utils/database')));
            const agent = await prisma.agentProfile.findUnique({ where: { id: wallet } });
            if (agent)
                walletAddress = agent.walletAddress;
        }
        const connection = new web3_js_1.Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed');
        const owner = getKeypair();
        const usdcMint = new web3_js_1.PublicKey(USDC_MINT);
        const platformUsdcAta = await (0, spl_token_1.getAssociatedTokenAddress)(usdcMint, owner.publicKey);
        const agentUsdcAta = await (0, spl_token_1.getAssociatedTokenAddress)(usdcMint, new web3_js_1.PublicKey(walletAddress));
        const tx = new web3_js_1.Transaction();
        try {
            await connection.getAccountInfo(agentUsdcAta);
        }
        catch {
            tx.add((0, spl_token_1.createAssociatedTokenAccountInstruction)(owner.publicKey, agentUsdcAta, new web3_js_1.PublicKey(walletAddress), usdcMint));
        }
        const usdcRaw = Math.floor(amount * Math.pow(10, USDC_DECIMALS));
        tx.add((0, spl_token_1.createTransferInstruction)(platformUsdcAta, agentUsdcAta, owner.publicKey, BigInt(usdcRaw)));
        const { blockhash } = await connection.getRecentBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = owner.publicKey;
        tx.sign(owner);
        const txHash = await (0, web3_js_1.sendAndConfirmTransaction)(connection, tx, [owner]);
        res.json({ success: true, txHash, amount });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
exports.fundAgent = fundAgent;
const collectFees = async (req, res, next) => {
    try {
        res.json({ success: true, data: (0, raydiumPool_service_1.getFees)() });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
exports.collectFees = collectFees;
const getStats = async (req, res, next) => {
    try {
        res.json({ success: true, data: { pool: await (0, raydiumPool_service_1.getPoolInfo)(), fees: (0, raydiumPool_service_1.getFees)() } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
exports.getStats = getStats;
const createAgent = async (req, res, next) => {
    try {
        const { name, capabilities, initialUsdc } = req.body;
        // Generate a new Solana keypair for the agent
        const { Keypair } = await Promise.resolve().then(() => __importStar(require('@solana/web3.js')));
        const agentKeypair = Keypair.generate();
        const walletAddress = agentKeypair.publicKey.toBase58();
        const { prisma } = await Promise.resolve().then(() => __importStar(require('../utils/database')));
        const agent = await prisma.agentProfile.create({
            data: {
                name: name || `Agent-${Date.now()}`,
                slug: `agent-${Date.now()}`,
                description: 'Auto-generated trading agent',
                capabilities: capabilities || ['trading'],
                walletAddress,
                publicKey: walletAddress,
                reputation: 50,
                balanceUsdc: initialUsdc || 0,
                balancePab: 0,
            },
        });
        // Fund the agent with USDC if specified
        if (initialUsdc && initialUsdc > 0) {
            const connection = new web3_js_1.Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed');
            const owner = getKeypair();
            const usdcMint = new web3_js_1.PublicKey(USDC_MINT);
            const platformUsdcAta = await (0, spl_token_1.getAssociatedTokenAddress)(usdcMint, owner.publicKey);
            const agentUsdcAta = await (0, spl_token_1.getAssociatedTokenAddress)(usdcMint, new web3_js_1.PublicKey(walletAddress));
            const tx = new web3_js_1.Transaction();
            try {
                await connection.getAccountInfo(agentUsdcAta);
            }
            catch {
                tx.add((0, spl_token_1.createAssociatedTokenAccountInstruction)(owner.publicKey, agentUsdcAta, new web3_js_1.PublicKey(walletAddress), usdcMint));
            }
            const usdcRaw = Math.floor(initialUsdc * Math.pow(10, USDC_DECIMALS));
            tx.add((0, spl_token_1.createTransferInstruction)(platformUsdcAta, agentUsdcAta, owner.publicKey, BigInt(usdcRaw)));
            const { blockhash } = await connection.getRecentBlockhash();
            tx.recentBlockhash = blockhash;
            tx.feePayer = owner.publicKey;
            tx.sign(owner);
            await (0, web3_js_1.sendAndConfirmTransaction)(connection, tx, [owner]);
        }
        res.json({ success: true, data: { id: agent.id, name: agent.name, walletAddress, balanceUsdc: agent.balanceUsdc } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
exports.createAgent = createAgent;
const startAgent = async (req, res, next) => {
    res.json({ success: false, error: 'Not implemented' });
};
exports.startAgent = startAgent;
const pauseAgent = async (req, res, next) => {
    res.json({ success: false, error: 'Not implemented' });
};
exports.pauseAgent = pauseAgent;
const stopAgent = async (req, res, next) => {
    res.json({ success: false, error: 'Not implemented' });
};
exports.stopAgent = stopAgent;
const getAgents = async (req, res, next) => {
    try {
        const { prisma } = await Promise.resolve().then(() => __importStar(require('../utils/database')));
        const agents = await prisma.agentProfile.findMany({
            where: { isActive: true },
            select: { id: true, name: true, balanceUsdc: true, balancePab: true, reputation: true },
        });
        res.json({ success: true, data: agents });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
exports.getAgents = getAgents;
const getAgent = async (req, res, next) => {
    try {
        const { prisma } = await Promise.resolve().then(() => __importStar(require('../utils/database')));
        const agent = await prisma.agentProfile.findUnique({ where: { id: req.params.id } });
        res.json({ success: true, data: agent });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
exports.getAgent = getAgent;
const executeTrade = async (req, res, next) => {
    try {
        const { direction, amount } = req.body;
        const agentId = req.params.id;
        const result = direction === 'buy'
            ? await (0, raydiumPool_service_1.buyPAB)(agentId, amount)
            : await (0, raydiumPool_service_1.sellPAB)(agentId, amount);
        res.json({ success: result.success, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
exports.executeTrade = executeTrade;
const addLiquidity = async (req, res, next) => {
    try {
        const { pabAmount, usdcAmount } = req.body;
        res.json({ success: true, data: { pabAdded: pabAmount, usdcAdded: usdcAmount } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
exports.addLiquidity = addLiquidity;
const startAllAgents = async (req, res, next) => {
    res.json({ success: false, error: 'Not implemented' });
};
exports.startAllAgents = startAllAgents;
//# sourceMappingURL=pabDex.controller.js.map