"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const bs58_1 = __importDefault(require("bs58"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
dotenv_1.default.config({ path: ".env.contracts" }); // Load the mint address
const connection = new web3_js_1.Connection("https://api.mainnet-beta.solana.com", "confirmed");
async function main() {
    console.log("🔒 Starting Solana Authority Revocation Process...");
    let payer;
    if (process.env.SOLANA_PRIVATE_KEY) {
        payer = web3_js_1.Keypair.fromSecretKey(bs58_1.default.decode(process.env.SOLANA_PRIVATE_KEY));
    }
    else {
        console.error("⚠️ No SOLANA_PRIVATE_KEY found in .env.");
        return;
    }
    const mintAddressRaw = process.env.SOLANA_PAB_MINT_ADDRESS;
    if (!mintAddressRaw) {
        console.error("⚠️ No SOLANA_PAB_MINT_ADDRESS found in .env.contracts.");
        return;
    }
    const mintAddress = new web3_js_1.PublicKey(mintAddressRaw);
    console.log(`🪙 Target Mint: ${mintAddress.toBase58()}`);
    console.log(`👛 Authority Key: ${payer.publicKey.toBase58()}`);
    try {
        // 1. Revoke Freeze Authority
        console.log("\n🥶 Revoking Freeze Authority...");
        const txFreeze = await (0, spl_token_1.setAuthority)(connection, payer, // Payer of the transaction
        mintAddress, // Mint account
        payer, // Current authority
        spl_token_1.AuthorityType.FreezeAccount, // Authority type to change
        null // New authority (null = revoked)
        );
        console.log(`✅ Freeze Authority Revoked! TX: ${txFreeze}`);
        // 2. Revoke Mint Authority
        console.log("\n🖨️  Revoking Mint Authority...");
        const txMint = await (0, spl_token_1.setAuthority)(connection, payer, // Payer of the transaction
        mintAddress, // Mint account
        payer, // Current authority
        spl_token_1.AuthorityType.MintTokens, // Authority type to change
        null // New authority (null = revoked)
        );
        console.log(`✅ Mint Authority Revoked! TX: ${txMint}`);
        console.log("\n🎉 The $PAB token is now officially non-mintable and non-freezable.");
        console.log("This proves to investors that the token supply is permanently hard-capped at 1 Billion and accounts cannot be frozen.");
    }
    catch (err) {
        console.error("❌ Failed to revoke authority. Note: If it says 'invalid account data', the authorities may already be revoked.");
        console.error(err);
    }
}
main().catch(console.error);
//# sourceMappingURL=revoke-authorities.js.map