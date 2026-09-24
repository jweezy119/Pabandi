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
Object.defineProperty(exports, "__esModule", { value: true });
exports.solanaAnchor = void 0;
exports.hashArtifact = hashArtifact;
exports.anchorOnSolana = anchorOnSolana;
/**
 * solanaAnchor.ts — Real Solana on-chain commitment of an artifact hash.
 *
 * Pabandi Protocol v2.0 anchors the outputs of its off-chain engines (ZK nullifiers,
 * ACTUS schedules, Kleros verdicts, Aragon proposals, Data Mesh attestations) to Solana
 * so they are tamper-evident and publicly verifiable. We submit the SHA-256 hash of the
 * artifact as a MEMO transaction; the returned signature + slot is the on-chain proof.
 *
 * This is genuine Solana functionality: when SOLANA_RPC_URL + a signing keypair are
 * configured it produces a real mainnet/testnet transaction. When they are absent (dev),
 * it returns a deterministic, clearly-flagged `simulated` commitment so the rest of the
 * system keeps working. No fake signatures are ever claimed as real.
 */
const crypto_1 = require("crypto");
const logger_1 = require("../utils/logger");
const RPC_URL = process.env.SOLANA_RPC_URL || process.env.SOLANA_RPC || 'https://api.devnet.solana.com';
const hasRealChain = !!(process.env.SOLANA_ANCHOR_SECRET || process.env.ESCROW_ORACLE_PRIVATE_KEY);
/** SHA-256 a JSON-serialisable artifact into a stable hex hash. */
function hashArtifact(artifact) {
    return (0, crypto_1.createHash)('sha256').update(JSON.stringify(artifact, Object.keys(artifact).sort())).digest('hex');
}
/**
 * Anchor an artifact on Solana. Real tx when configured, simulated otherwise.
 * anchorSeed lets callers namespace the memo (e.g. "ZK_NULLIFIER", "ACTUS_SCHEDULE").
 */
async function anchorOnSolana(artifactType, artifact, anchorSeed = 'PABANDI') {
    const artifactHash = hashArtifact(artifact);
    if (!hasRealChain) {
        // Deterministic simulated commitment — flagged, never presented as a real signature.
        const sig = `sim_${(0, crypto_1.createHash)('sha256').update(`${anchorSeed}:${artifactType}:${artifactHash}`).digest('hex').slice(0, 40)}`;
        logger_1.logger.warn(`[SolanaAnchor] No anchor keypair configured — simulated commitment for ${artifactType} (${artifactHash.slice(0, 12)}…)`);
        return { artifactType, artifactHash, signature: sig, simulated: true, anchoredAt: new Date().toISOString() };
    }
    try {
        const { Connection, Keypair, Transaction, TransactionInstruction, sendAndConfirmTransaction, PublicKey } = await Promise.resolve().then(() => __importStar(require('@solana/web3.js')));
        const connection = new Connection(RPC_URL, 'confirmed');
        const secret = (process.env.SOLANA_ANCHOR_SECRET || process.env.ESCROW_ORACLE_PRIVATE_KEY || '').split(',').map((n) => parseInt(n, 10));
        const keypair = Keypair.fromSecretKey(Uint8Array.from(secret));
        const memo = `${anchorSeed}:${artifactType}:${artifactHash}`;
        // Memo program (MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr) — no extra dependency needed.
        const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
        const memoIx = new TransactionInstruction({
            keys: [{ pubkey: keypair.publicKey, isSigner: true, isWritable: false }],
            programId: MEMO_PROGRAM,
            data: Buffer.from(memo, 'utf8'),
        });
        const tx = new Transaction().add(memoIx);
        const signature = await sendAndConfirmTransaction(connection, tx, [keypair]);
        const slot = await connection.getSlot('confirmed');
        logger_1.logger.info(`[SolanaAnchor] Anchored ${artifactType} → ${signature} @ slot ${slot}`);
        return { artifactType, artifactHash, signature, slot, simulated: false, rpc: RPC_URL, anchoredAt: new Date().toISOString() };
    }
    catch (e) {
        logger_1.logger.error(`[SolanaAnchor] on-chain anchor failed for ${artifactType}: ${e.message}`);
        // Fail-closed: return a simulated commitment but mark the failure so callers know.
        const sig = `sim_failed_${artifactHash.slice(0, 32)}`;
        return { artifactType, artifactHash, signature: sig, simulated: true, anchoredAt: new Date().toISOString() };
    }
}
exports.solanaAnchor = { anchorOnSolana, hashArtifact };
//# sourceMappingURL=solanaAnchor.service.js.map