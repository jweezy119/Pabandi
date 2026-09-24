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
exports.bookingPabService = void 0;
exports.createBookingWithPab = createBookingWithPab;
exports.checkinBooking = checkinBooking;
exports.handleNoShow = handleNoShow;
exports.cancelBooking = cancelBooking;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const bs58_1 = __importDefault(require("bs58"));
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const DEPOSIT_RATE = 0.10; // 10% deposit
const REWARD_RATE = 0.01; // 1% reward on check-in
function getConnection() {
    const url = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    return new web3_js_1.Connection(url, 'confirmed');
}
function getPlatformKeypair() {
    const privateKey = process.env.PLATFORM_PRIVATE_KEY;
    if (!privateKey) {
        logger_1.logger.error('PLATFORM_PRIVATE_KEY not set');
        return null;
    }
    try {
        const secretKey = bs58_1.default.decode(privateKey);
        return web3_js_1.Keypair.fromSecretKey(secretKey);
    }
    catch (err) {
        logger_1.logger.error('Invalid PLATFORM_PRIVATE_KEY:', err.message);
        return null;
    }
}
function getPabMint() {
    return process.env.PAB_MINT_ADDRESS || 'G811FHWiZrqY1DZKz6dQySpJFPTDfe21B8LRnDqa1z5Y';
}
async function createBookingWithPab(params) {
    const { bookingId, userId, bookingValue, businessId } = params;
    const depositAmount = bookingValue * DEPOSIT_RATE;
    const user = await database_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        return { success: false, error: 'User not found' };
    const wallet = await database_1.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.balance < depositAmount) {
        return { success: false, error: `Insufficient PAB balance. Need ${depositAmount} PAB` };
    }
    const connection = getConnection();
    const platformKey = getPlatformKeypair();
    if (!platformKey)
        return { success: false, error: 'Platform wallet not configured' };
    const mintKey = new web3_js_1.PublicKey(getPabMint());
    const fromKey = new web3_js_1.PublicKey(wallet.address || '');
    const toKey = platformKey.publicKey;
    const fromTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(mintKey, fromKey);
    const toTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(mintKey, toKey);
    const { Transaction } = await Promise.resolve().then(() => __importStar(require('@solana/web3.js')));
    const transaction = new Transaction();
    const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
    if (!toAccountInfo) {
        transaction.add((0, spl_token_1.createAssociatedTokenAccountInstruction)(fromKey, toTokenAccount, toKey, mintKey));
    }
    const amountRaw = Math.round(depositAmount * Math.pow(10, 9));
    transaction.add((0, spl_token_1.createTransferInstruction)(fromTokenAccount, toTokenAccount, fromKey, amountRaw, [], spl_token_1.TOKEN_PROGRAM_ID));
    const { blockhash } = await connection.getRecentBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromKey;
    const bookingPab = await database_1.prisma.bookingRecord.create({
        data: {
            bookingId,
            userId,
            bookingValue,
            depositPab: depositAmount,
            status: 'PENDING',
            businessId,
        },
    });
    // Deduct deposit from wallet
    await database_1.prisma.wallet.update({
        where: { userId },
        data: { balance: { decrement: depositAmount } },
    });
    logger_1.logger.info(`[BookingPab] Created booking ${bookingId} with ${depositAmount} PAB deposit`);
    return {
        success: true,
        bookingPab,
        depositAmount,
        rewardAmount: bookingValue * REWARD_RATE,
    };
}
async function checkinBooking(bookingId) {
    const bookingPab = await database_1.prisma.bookingRecord.findUnique({
        where: { bookingId },
        include: { user: true, business: true },
    });
    if (!bookingPab)
        return { success: false, error: 'Booking PAB record not found' };
    if (bookingPab.status !== 'PENDING') {
        return { success: false, error: `Cannot check in: status is ${bookingPab.status}` };
    }
    const rewardAmount = bookingPab.bookingValue * REWARD_RATE;
    const totalReturn = bookingPab.depositPab + rewardAmount;
    const connection = getConnection();
    const platformKey = getPlatformKeypair();
    if (!platformKey)
        return { success: false, error: 'Platform wallet not configured' };
    const wallet = await database_1.prisma.wallet.findUnique({ where: { userId: bookingPab.userId } });
    const mintKey = new web3_js_1.PublicKey(getPabMint());
    const fromKey = platformKey.publicKey;
    const toKey = new web3_js_1.PublicKey(wallet?.address || bookingPab.user.walletAddress || '');
    const fromTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(mintKey, fromKey);
    const toTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(mintKey, toKey);
    const { Transaction } = await Promise.resolve().then(() => __importStar(require('@solana/web3.js')));
    const transaction = new Transaction();
    const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
    if (!toAccountInfo) {
        transaction.add((0, spl_token_1.createAssociatedTokenAccountInstruction)(fromKey, toTokenAccount, toKey, mintKey));
    }
    const amountRaw = Math.round(totalReturn * Math.pow(10, 9));
    transaction.add((0, spl_token_1.createTransferInstruction)(fromTokenAccount, toTokenAccount, fromKey, amountRaw, [], spl_token_1.TOKEN_PROGRAM_ID));
    const { blockhash } = await connection.getRecentBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromKey;
    transaction.sign(platformKey);
    // Update booking record
    await database_1.prisma.bookingRecord.update({
        where: { bookingId },
        data: {
            status: 'CHECKED_IN',
            rewardPab: rewardAmount,
            checkinAt: new Date(),
        },
    });
    // Return deposit + reward to user
    await database_1.prisma.wallet.update({
        where: { userId: bookingPab.userId },
        data: { balance: { increment: totalReturn } },
    });
    await database_1.prisma.user.update({
        where: { id: bookingPab.userId },
        data: { pabEarned: { increment: rewardAmount } },
    });
    logger_1.logger.info(`[BookingPab] Check-in for booking ${bookingId}, returned ${totalReturn} PAB (deposit + reward)`);
    return {
        success: true,
        depositReturned: bookingPab.depositPab,
        rewardAmount: rewardAmount,
        totalReturned: totalReturn,
    };
}
async function handleNoShow(bookingId) {
    const bookingPab = await database_1.prisma.bookingRecord.findUnique({
        where: { bookingId },
        include: { business: true },
    });
    if (!bookingPab)
        return { success: false, error: 'Booking PAB record not found' };
    if (bookingPab.status !== 'PENDING') {
        return { success: false, error: `Cannot process no-show: status is ${bookingPab.status}` };
    }
    // 50% to business, 50% burned
    const toBusiness = bookingPab.depositPab * 0.5;
    const burned = bookingPab.depositPab * 0.5;
    await database_1.prisma.bookingRecord.update({
        where: { bookingId },
        data: { status: 'NO_SHOW' },
    });
    // If business exists, credit them
    if (bookingPab.businessId && bookingPab.business) {
        const businessOwnerWallet = await database_1.prisma.wallet.findUnique({
            where: { userId: bookingPab.business.ownerId || '' },
        });
        if (businessOwnerWallet) {
            await database_1.prisma.wallet.update({
                where: { userId: bookingPab.business.ownerId || '' },
                data: { balance: { increment: toBusiness } },
            });
        }
    }
    // Burn is implicit (sent to platform, not returned)
    logger_1.logger.info(`[BookingPab] No-show for booking ${bookingId}: ${toBusiness} to business, ${burned} burned`);
    return {
        success: true,
        toBusiness,
        burned,
    };
}
async function cancelBooking(bookingId) {
    const bookingPab = await database_1.prisma.bookingRecord.findUnique({
        where: { bookingId },
    });
    if (!bookingPab)
        return { success: false, error: 'Booking PAB record not found' };
    if (bookingPab.status !== 'PENDING') {
        return { success: false, error: `Cannot cancel: status is ${bookingPab.status}` };
    }
    // Full refund
    await database_1.prisma.bookingRecord.update({
        where: { bookingId },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    await database_1.prisma.wallet.update({
        where: { userId: bookingPab.userId },
        data: { balance: { increment: bookingPab.depositPab } },
    });
    logger_1.logger.info(`[BookingPab] Cancelled booking ${bookingId}, refunded ${bookingPab.depositPab} PAB`);
    return {
        success: true,
        refunded: bookingPab.depositPab,
    };
}
exports.bookingPabService = {
    createBookingWithPab,
    checkinBooking,
    handleNoShow,
    cancelBooking,
    DEPOSIT_RATE,
    REWARD_RATE,
};
//# sourceMappingURL=bookingPab.service.js.map