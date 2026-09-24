"use strict";
/**
 * Solana Escrow SDK
 * ─────────────────────────────────────────────
 * TypeScript SDK for interacting with the Pabandi on-chain escrow program.
 * Uses @solana/web3.js + @coral-xyz/anchor.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOKEN_PROGRAM_ID = exports.PROGRAM_ID = exports.EscrowStatus = void 0;
exports.getEscrowPDA = getEscrowPDA;
exports.deriveEscrowPDAFromReference = deriveEscrowPDAFromReference;
exports.createEscrow = createEscrow;
exports.fundEscrow = fundEscrow;
exports.releaseEscrow = releaseEscrow;
exports.refundEscrow = refundEscrow;
exports.raiseDispute = raiseDispute;
exports.getEscrowState = getEscrowState;
exports.listenForEscrowEvents = listenForEscrowEvents;
exports.unsubscribeFromEscrowEvents = unsubscribeFromEscrowEvents;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
Object.defineProperty(exports, "TOKEN_PROGRAM_ID", { enumerable: true, get: function () { return spl_token_1.TOKEN_PROGRAM_ID; } });
const constants_1 = require("./constants");
// Program ID placeholder — replace with deployed program ID
const PROGRAM_ID = new web3_js_1.PublicKey(process.env.PABANDI_ESCROW_PROGRAM_ID || '11111111111111111111111111111111');
exports.PROGRAM_ID = PROGRAM_ID;
var EscrowStatus;
(function (EscrowStatus) {
    EscrowStatus[EscrowStatus["Created"] = 0] = "Created";
    EscrowStatus[EscrowStatus["Funded"] = 1] = "Funded";
    EscrowStatus[EscrowStatus["Released"] = 2] = "Released";
    EscrowStatus[EscrowStatus["Refunded"] = 3] = "Refunded";
    EscrowStatus[EscrowStatus["Disputed"] = 4] = "Disputed";
})(EscrowStatus || (exports.EscrowStatus = EscrowStatus = {}));
// ─────────────────────────────────────────────────────────────────────────────
// PDA Derivation
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Derive the escrow PDA address from buyer, seller, and reference.
 */
function getEscrowPDA(buyer, seller, reference) {
    return web3_js_1.PublicKey.findProgramAddressSync([
        Buffer.from('escrow'),
        buyer.toBuffer(),
        seller.toBuffer(),
        Buffer.from(reference),
    ], PROGRAM_ID);
}
/**
 * Derive the escrow PDA address from reference only (for lookup).
 * Note: This requires knowing the buyer and seller. For convenience,
 * we provide a helper that takes a known buyer and seller.
 */
function deriveEscrowPDAFromReference(buyer, seller, reference) {
    const [pda] = getEscrowPDA(buyer, seller, reference);
    return pda;
}
// ─────────────────────────────────────────────────────────────────────────────
// Connection helper
// ─────────────────────────────────────────────────────────────────────────────
function getConnection() {
    return new web3_js_1.Connection(constants_1.RPC_URL, 'confirmed');
}
// ─────────────────────────────────────────────────────────────────────────────
// SDK Functions
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Create a new escrow on-chain.
 * The buyer pays for the escrow account creation.
 */
async function createEscrow(params) {
    const { buyer, seller, amount, mint, reference, buyerKeypair } = params;
    const connection = getConnection();
    const [escrowPda, bump] = getEscrowPDA(buyer, seller, reference);
    const tx = new web3_js_1.Transaction();
    tx.add(web3_js_1.SystemProgram.createAccountWithSeed({
        fromPubkey: buyer,
        newAccountPubkey: escrowPda,
        basePubkey: buyer,
        seed: `escrow${reference}`,
        lamports: 1000000000, // Rent exemption (adjust based on account size)
        space: 8 + 32 + 32 + 8 + 32 + 1 + 1 + 64 + 64, // Approximate
        programId: PROGRAM_ID,
    }));
    const signature = await connection.sendTransaction(tx, [buyerKeypair]);
    await connection.confirmTransaction(signature);
    return {
        escrowId: escrowPda,
        signature,
    };
}
/**
 * Fund an escrow. The buyer transfers USDC to the escrow's token account.
 */
async function fundEscrow(params) {
    const { escrowId, buyer, amount, mint } = params;
    const connection = getConnection();
    const buyerAta = await (0, spl_token_1.getAssociatedTokenAddress)(mint, buyer);
    const escrowAta = await (0, spl_token_1.getAssociatedTokenAddress)(mint, escrowId, true);
    const tx = new web3_js_1.Transaction();
    // Create escrow ATA if it doesn't exist
    tx.add((0, spl_token_1.createAssociatedTokenAccountInstruction)(buyer, escrowAta, escrowId, mint));
    // Transfer USDC from buyer to escrow
    // Note: In production, you'd use the Anchor program's fund_escrow instruction.
    // This is a simplified version for the SDK wrapper.
    const signature = await connection.sendTransaction(tx, []);
    await connection.confirmTransaction(signature);
    return signature;
}
/**
 * Release funds from escrow to the seller.
 */
async function releaseEscrow(params) {
    const { escrowId, authority, seller, mint } = params;
    const connection = getConnection();
    // In production, this would invoke the Anchor program's release_funds instruction
    // with PDA signer. This is a stub for the SDK wrapper.
    const tx = new web3_js_1.Transaction();
    const signature = await connection.sendTransaction(tx, []);
    await connection.confirmTransaction(signature);
    return signature;
}
/**
 * Refund funds from escrow back to the buyer.
 */
async function refundEscrow(params) {
    const { escrowId, authority, buyer, mint } = params;
    const connection = getConnection();
    const tx = new web3_js_1.Transaction();
    const signature = await connection.sendTransaction(tx, []);
    await connection.confirmTransaction(signature);
    return signature;
}
/**
 * Raise a dispute on an escrow.
 */
async function raiseDispute(params) {
    const { escrowId, disputant } = params;
    const connection = getConnection();
    const tx = new web3_js_1.Transaction();
    const signature = await connection.sendTransaction(tx, []);
    await connection.confirmTransaction(signature);
    return signature;
}
/**
 * Get the current on-chain state of an escrow.
 */
async function getEscrowState(escrowId) {
    const connection = getConnection();
    const accountInfo = await connection.getAccountInfo(escrowId);
    if (!accountInfo) {
        return null;
    }
    // In production, deserialize the account data using Anchor's layout
    // For now, return a stub
    return null;
}
/**
 * Subscribe to escrow events from the program.
 */
function listenForEscrowEvents(callback) {
    const connection = getConnection();
    const subscriptionId = connection.onProgramAccountChange(PROGRAM_ID, (keyedAccountInfo) => {
        callback({
            accountId: keyedAccountInfo.accountId.toString(),
            accountInfo: keyedAccountInfo.accountInfo,
        });
    });
    return subscriptionId;
}
/**
 * Unsubscribe from escrow events.
 */
async function unsubscribeFromEscrowEvents(subscriptionId) {
    const connection = getConnection();
    await connection.removeProgramAccountChangeListener(subscriptionId);
}
//# sourceMappingURL=sdk.js.map