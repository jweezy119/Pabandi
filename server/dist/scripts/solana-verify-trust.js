"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bs58_1 = __importDefault(require("bs58"));
const tweetnacl_1 = __importDefault(require("tweetnacl"));
/**
 * MOCK SOLANA SMART CONTRACT VERIFICATION
 *
 * In a real Solana program, you would use the `ed25519` native program
 * to verify this signature on-chain. This Node.js script simulates that logic
 * so frontends/clients can verify the Pabandi Oracle signature off-chain as well.
 */
function verifyPabandiTrustOracle(walletAddress, trustScore, timestamp, signatureBase58, oraclePubkeyBase58) {
    try {
        // 1. Reconstruct the exact message the Oracle signed
        const messageString = `${walletAddress}:${trustScore}:${timestamp}`;
        const messageUint8 = new TextEncoder().encode(messageString);
        // 2. Decode the signature and pubkey from base58
        const signatureUint8 = bs58_1.default.decode(signatureBase58);
        const pubkeyUint8 = bs58_1.default.decode(oraclePubkeyBase58);
        // 3. Check expiration (e.g., 5 minutes)
        const currentTimestamp = Math.floor(Date.now() / 1000);
        if (currentTimestamp - timestamp > 300) {
            console.log('❌ Verification Failed: Signature has expired.');
            return false;
        }
        // 4. Cryptographically verify the Ed25519 signature
        const isValid = tweetnacl_1.default.sign.detached.verify(messageUint8, signatureUint8, pubkeyUint8);
        if (isValid) {
            console.log('✅ Verification Successful!');
            console.log(`User ${walletAddress} has a verified Trust Score of ${trustScore}.`);
            return true;
        }
        else {
            console.log('❌ Verification Failed: Invalid signature.');
            return false;
        }
    }
    catch (err) {
        console.error('❌ Verification Error:', err.message);
        return false;
    }
}
// Simulate receiving data from the Pabandi Oracle API
const mockApiResponse = {
    walletAddress: "8Fj4K8K5cWkU1G2pPz8qM6R4j9G3z6yY2wQ8X5cK1jP2", // Dummy wallet
    trustScore: 98,
    timestamp: Math.floor(Date.now() / 1000), // Recent
    signature: "...", // Would be the real base58 signature
    oraclePubkey: "..." // Would be the real base58 pubkey
};
// To test this properly, you can run the server, hit the endpoint
// GET /api/v1/oracle/trust-score/<WALLET_ADDRESS>
// and paste the exact JSON response into this function.
console.log('--- Pabandi Web3 Trust Oracle Verification ---');
// verifyPabandiTrustOracle(
//   mockApiResponse.walletAddress,
//   mockApiResponse.trustScore,
//   mockApiResponse.timestamp,
//   mockApiResponse.signature,
//   mockApiResponse.oraclePubkey
// );
//# sourceMappingURL=solana-verify-trust.js.map