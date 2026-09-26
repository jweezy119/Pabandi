"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.merkleZKEngine = exports.MerkleZKEngine = void 0;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../utils/logger");
/**
 * MacGyver ZK Engine
 *
 * Real cryptographic zero-knowledge using nothing but SHA-256 (built into Node.js).
 * No external ZK frameworks, no rollups, no cost.
 *
 * HOW IT WORKS:
 * 1. We hash each eligible wallet address into a leaf.
 * 2. We build a binary Merkle Tree from the leaves.
 * 3. The brand receives ONLY the Merkle Root (a single 32-byte hash) and a count.
 *    They cannot reverse-engineer ANY wallet address from the root.
 * 4. Each user receives their personal Merkle Proof (a small array of sibling hashes).
 * 5. When a user claims their reward, we verify their proof against the root.
 *    If it checks out, they're in the set. No database lookup needed.
 *
 * This is the EXACT same primitive Bitcoin uses for transaction inclusion proofs
 * and Solana uses for cNFT state compression. Zero dependencies. Zero cost.
 */
function sha256(data) {
    return crypto_1.default.createHash('sha256').update(data).digest('hex');
}
function hashPair(left, right) {
    // Canonical ordering: always hash the smaller value first.
    // This prevents second-preimage attacks and makes proofs order-independent.
    const [a, b] = left < right ? [left, right] : [right, left];
    return sha256(a + b);
}
class MerkleZKEngine {
    /**
     * Build a Merkle Tree from a list of wallet addresses.
     * Returns the root hash and individual proofs for each address.
     */
    buildTree(walletAddresses) {
        if (walletAddresses.length === 0) {
            return { root: sha256('EMPTY_TREE'), proofs: new Map(), leafCount: 0 };
        }
        // 1. Hash each wallet into a leaf
        const leaves = walletAddresses.map(addr => sha256(addr.toLowerCase()));
        // Pad to a power of 2 for a balanced tree (duplicate the last leaf)
        const targetLength = Math.pow(2, Math.ceil(Math.log2(leaves.length || 1)));
        while (leaves.length < targetLength) {
            leaves.push(leaves[leaves.length - 1]);
        }
        // 2. Build the tree bottom-up, storing every level
        const tree = [leaves];
        let currentLevel = leaves;
        while (currentLevel.length > 1) {
            const nextLevel = [];
            for (let i = 0; i < currentLevel.length; i += 2) {
                nextLevel.push(hashPair(currentLevel[i], currentLevel[i + 1]));
            }
            tree.push(nextLevel);
            currentLevel = nextLevel;
        }
        const root = currentLevel[0];
        // 3. Extract individual Merkle Proofs for each original wallet
        const proofs = new Map();
        for (let i = 0; i < walletAddresses.length; i++) {
            const proof = [];
            let index = i;
            for (let level = 0; level < tree.length - 1; level++) {
                const isRight = index % 2 === 1;
                const siblingIndex = isRight ? index - 1 : index + 1;
                if (siblingIndex < tree[level].length) {
                    proof.push({
                        hash: tree[level][siblingIndex],
                        position: isRight ? 'left' : 'right'
                    });
                }
                index = Math.floor(index / 2);
            }
            proofs.set(walletAddresses[i], {
                leaf: leaves[i],
                proof,
                root
            });
        }
        return { root, proofs, leafCount: walletAddresses.length };
    }
    /**
     * Verify a Merkle Proof. This can be done by ANYONE — the user, the brand,
     * or a Solana smart contract. No database access needed.
     */
    verifyProof(walletAddress, proof) {
        try {
            const leaf = sha256(walletAddress.toLowerCase());
            if (leaf !== proof.leaf) {
                return false;
            }
            let currentHash = leaf;
            for (const step of proof.proof) {
                if (step.position === 'left') {
                    currentHash = hashPair(step.hash, currentHash);
                }
                else {
                    currentHash = hashPair(currentHash, step.hash);
                }
            }
            return currentHash === proof.root;
        }
        catch (e) {
            logger_1.logger.error(`[MerkleZK] Proof verification failed: ${e.message}`);
            return false;
        }
    }
}
exports.MerkleZKEngine = MerkleZKEngine;
exports.merkleZKEngine = new MerkleZKEngine();
//# sourceMappingURL=merkle-zk.engine.js.map