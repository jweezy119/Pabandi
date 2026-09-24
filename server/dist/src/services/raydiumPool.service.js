"use strict";
/**
 * raydiumPool.service.ts — Backend-Managed AMM with Platform Custody
 * ==================================================================
 *
 * ALL funds are custodied by the platform wallet.
 * Agents track internal balances in the database.
 * Swaps execute from the platform wallet on behalf of agents.
 * LP fees accumulate as REAL USDC in the platform wallet.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializePool = initializePool;
exports.getPoolInfo = getPoolInfo;
exports.buyPAB = buyPAB;
exports.sellPAB = sellPAB;
exports.getFees = getFees;
const web3_js_1 = require("@solana/web3.js");
const bs58_1 = __importDefault(require("bs58"));
const database_1 = require("../utils/database");
const TOKEN_DECIMALS = 9;
const USDC_DECIMALS = 6;
const SWAP_FEE_BPS = 25; // 0.25%
let _connection = null;
let _keypair = null;
// Pool state (backend-managed, platform custody)
let poolPabReserve = 10000 * Math.pow(10, TOKEN_DECIMALS);
let poolUsdcReserve = 1 * Math.pow(10, USDC_DECIMALS);
let poolK = poolPabReserve * poolUsdcReserve;
let poolTotalFeesUsdc = 0;
let poolTotalVolumeUsd = 0;
function getConnection() {
    if (!_connection) {
        const url = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
        _connection = new web3_js_1.Connection(url, 'confirmed');
    }
    return _connection;
}
function getKeypair() {
    if (!_keypair) {
        const privateKeyBase58 = process.env.PLATFORM_PRIVATE_KEY || '';
        const secretKey = bs58_1.default.decode(privateKeyBase58);
        _keypair = web3_js_1.Keypair.fromSecretKey(secretKey);
    }
    return _keypair;
}
// ─── INITIALIZE POOL ────────────────────────────────────
async function initializePool(pabAmount, usdcAmount) {
    try {
        const pabMintStr = process.env.PAB_MINT_ADDRESS || '';
        if (!pabMintStr)
            return { success: false, error: 'PAB_MINT_ADDRESS not set' };
        const connection = getConnection();
        const owner = getKeypair();
        const pabMint = new web3_js_1.PublicKey(pabMintStr);
        // Create pool state
        poolPabReserve = pabAmount * Math.pow(10, TOKEN_DECIMALS);
        poolUsdcReserve = usdcAmount * Math.pow(10, USDC_DECIMALS);
        poolK = poolPabReserve * poolUsdcReserve;
        return { success: true };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
// ─── GET POOL INFO ──────────────────────────────────────
async function getPoolInfo() {
    return {
        pabReserve: poolPabReserve / Math.pow(10, TOKEN_DECIMALS),
        usdcReserve: poolUsdcReserve / Math.pow(10, USDC_DECIMALS),
        price: poolUsdcReserve / poolPabReserve * Math.pow(10, TOKEN_DECIMALS - USDC_DECIMALS),
        totalFeesUsdc: poolTotalFeesUsdc / Math.pow(10, USDC_DECIMALS),
        totalVolumeUsd: poolTotalVolumeUsd / Math.pow(10, USDC_DECIMALS),
        k: poolK,
    };
}
// ─── BUY PAB ────────────────────────────────────────────
async function buyPAB(agentId, usdcAmount) {
    try {
        const usdcRawNum = Math.floor(usdcAmount * Math.pow(10, USDC_DECIMALS));
        // Calculate PAB output (constant product formula with fee)
        const usdcAfterFee = usdcRawNum * (10000 - SWAP_FEE_BPS) / 10000;
        const pabOut = poolPabReserve - (poolK / (poolUsdcReserve + usdcAfterFee));
        if (pabOut <= 0 || pabOut >= poolPabReserve) {
            return { success: false, error: 'Insufficient liquidity' };
        }
        // Update pool state
        poolPabReserve -= pabOut;
        poolUsdcReserve += usdcRawNum;
        poolK = poolPabReserve * poolUsdcReserve;
        const feeUsdc = usdcRawNum * SWAP_FEE_BPS / 10000;
        poolTotalFeesUsdc += feeUsdc;
        poolTotalVolumeUsd += usdcRawNum;
        // Update agent balance in database
        await database_1.prisma.agentProfile.update({
            where: { id: agentId },
            data: {
                balanceUsdc: { decrement: usdcAmount },
                balancePab: { increment: pabOut / Math.pow(10, TOKEN_DECIMALS) },
            },
        });
        return {
            success: true,
            pabReceived: pabOut / Math.pow(10, TOKEN_DECIMALS),
        };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
// ─── SELL PAB ───────────────────────────────────────────
async function sellPAB(agentId, pabAmount) {
    try {
        const pabRawNum = Math.floor(pabAmount * Math.pow(10, TOKEN_DECIMALS));
        // Calculate USDC output (constant product formula with fee)
        const pabAfterFee = pabRawNum * (10000 - SWAP_FEE_BPS) / 10000;
        const usdcOut = poolUsdcReserve - (poolK / (poolPabReserve + pabAfterFee));
        if (usdcOut <= 0 || usdcOut >= poolUsdcReserve) {
            return { success: false, error: 'Insufficient liquidity' };
        }
        // Update pool state
        poolPabReserve += pabRawNum;
        poolUsdcReserve -= usdcOut;
        poolK = poolPabReserve * poolUsdcReserve;
        const feeUsdc = usdcOut * SWAP_FEE_BPS / (10000 - SWAP_FEE_BPS);
        poolTotalFeesUsdc += feeUsdc;
        poolTotalVolumeUsd += usdcOut;
        // Update agent balance in database
        await database_1.prisma.agentProfile.update({
            where: { id: agentId },
            data: {
                balancePab: { decrement: pabAmount },
                balanceUsdc: { increment: usdcOut / Math.pow(10, USDC_DECIMALS) },
            },
        });
        return {
            success: true,
            usdcReceived: usdcOut / Math.pow(10, USDC_DECIMALS),
        };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
// ─── COLLECT FEES ──────────────────────────────────────
function getFees() {
    return {
        totalFeesUsdc: poolTotalFeesUsdc / Math.pow(10, USDC_DECIMALS),
        totalVolumeUsd: poolTotalVolumeUsd / Math.pow(10, USDC_DECIMALS),
    };
}
//# sourceMappingURL=raydiumPool.service.js.map