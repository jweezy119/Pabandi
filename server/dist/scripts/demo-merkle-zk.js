"use strict";
/**
 * DEMO: Prove the Zero-Knowledge Merkle Engine actually works.
 *
 * Run: npx ts-node scripts/demo-merkle-zk.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
const merkle_zk_engine_1 = require("../src/services/merkle-zk.engine");
console.log('═══════════════════════════════════════════════════════');
console.log('  Pabandi Zero-Knowledge Merkle Proof — Live Demo');
console.log('═══════════════════════════════════════════════════════\n');
// Simulate 5 eligible wallet addresses
const wallets = [
    '8Fj4K8K5cWkU1G2pPz8qM6R4j9G3z6yY2wQ8X5cK1jP2',
    'DkT4K9K2xWaU8H5tQr7fL3R7k8G9w5bB6eC9Y2nP8mQ5',
    'HnP2M6J8yRbS4D9rLk3gN7T2m6J5x8cC1fA7V4oQ6wR9',
    'Bv7X3L5gTnW2F6sOp8hK4U9n3L2v7dD8gB5Z1rS9xE4',
    'Yw2R8N4kVoX9G3pMq5jF7W2r8N1a4eE5hC6X3tU7zK8'
];
// ── PHASE 1: Build the tree (Pabandi backend does this) ─────────────
console.log('PHASE 1: Building Merkle Tree from', wallets.length, 'wallets...\n');
const { root, proofs, leafCount } = merkle_zk_engine_1.merkleZKEngine.buildTree(wallets);
console.log(`  Merkle Root:  ${root}`);
console.log(`  Leaf Count:   ${leafCount}`);
console.log(`  Proofs Built: ${proofs.size}`);
// ── What the BRAND sees ─────────────────────────────────────────────
console.log('\n┌─────────────────────────────────────────────────────┐');
console.log('│  BRAND VIEW (this is ALL they receive):             │');
console.log('│                                                     │');
console.log(`│  Audience Size: ${leafCount}                                   │`);
console.log(`│  Merkle Root:   ${root.substring(0, 40)}... │`);
console.log('│                                                     │');
console.log('│  Can they derive ANY wallet address from this? NO.  │');
console.log('└─────────────────────────────────────────────────────┘');
// ── PHASE 2: User claims with their proof ───────────────────────────
console.log('\n\nPHASE 2: User Claims Reward\n');
const testWallet = wallets[2]; // Pick the 3rd user
const userProof = proofs.get(testWallet);
if (userProof) {
    console.log(`  User Wallet:  ${testWallet}`);
    console.log(`  Proof Steps:  ${userProof.proof.length} hashes`);
    console.log(`  Proof Size:   ${JSON.stringify(userProof).length} bytes\n`);
    // Verify the proof
    const isValid = merkle_zk_engine_1.merkleZKEngine.verifyProof(testWallet, userProof);
    console.log(`  ✅ Verification Result: ${isValid ? 'VALID — Pay the user!' : 'INVALID — Reject.'}`);
}
// ── PHASE 3: Try to cheat with a fake wallet ────────────────────────
console.log('\n\nPHASE 3: Attacker Tries to Claim\n');
const fakeWallet = 'FAKE_WALLET_ADDRESS_12345678901234567890';
const stolenProof = proofs.get(wallets[0]); // Try to use someone else's proof
const isFakeValid = merkle_zk_engine_1.merkleZKEngine.verifyProof(fakeWallet, stolenProof);
console.log(`  Fake Wallet:  ${fakeWallet}`);
console.log(`  Using stolen proof from: ${wallets[0].substring(0, 20)}...`);
console.log(`  ❌ Verification Result: ${isFakeValid ? 'VALID (BUG!)' : 'INVALID — Attack blocked.'}`);
console.log('\n═══════════════════════════════════════════════════════');
console.log('  Proof complete. Zero external dependencies. $0 cost.');
console.log('═══════════════════════════════════════════════════════\n');
//# sourceMappingURL=demo-merkle-zk.js.map