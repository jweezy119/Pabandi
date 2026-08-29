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
const umi_bundle_defaults_1 = require("@metaplex-foundation/umi-bundle-defaults");
const umi_1 = require("@metaplex-foundation/umi");
const mpl_token_metadata_1 = require("@metaplex-foundation/mpl-token-metadata");
const bs58_1 = __importDefault(require("bs58"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
dotenv.config({ path: ".env.contracts" }); // Load the mint address
async function main() {
    console.log("🔒 Starting Token Metadata Immutability Process...");
    const privateKey = process.env.SOLANA_PRIVATE_KEY;
    if (!privateKey) {
        console.error("⚠️ No SOLANA_PRIVATE_KEY found in .env.");
        return;
    }
    const mintAddressRaw = process.env.SOLANA_PAB_MINT_ADDRESS;
    if (!mintAddressRaw) {
        console.error("⚠️ No SOLANA_PAB_MINT_ADDRESS found in .env.contracts.");
        return;
    }
    const umi = (0, umi_bundle_defaults_1.createUmi)("https://api.mainnet-beta.solana.com");
    // Set up the Umi identity
    const umiKeypair = umi.eddsa.createKeypairFromSecretKey(bs58_1.default.decode(privateKey));
    umi.use((0, umi_1.keypairIdentity)(umiKeypair));
    const mint = (0, umi_1.publicKey)(mintAddressRaw);
    console.log(`🪙 Target Mint: ${mint}`);
    console.log(`👛 Authority Key: ${umiKeypair.publicKey}`);
    try {
        console.log("\n🔒 Making Token Metadata Immutable (isMutable: false)...");
        // Revoke the update authority by setting isMutable to false
        const tx = await (0, mpl_token_metadata_1.updateV1)(umi, {
            mint,
            authority: umi.identity,
            isMutable: false,
        }).sendAndConfirm(umi);
        console.log(`✅ Token Metadata is now PERMANENTLY Immutable!`);
        console.log(`TX Signature: ${bs58_1.default.encode(tx.signature)}`);
        console.log("\n🎉 The token name, symbol, and URI can no longer be changed by anyone.");
    }
    catch (err) {
        console.error("❌ Failed to make token metadata immutable.");
        console.error(err);
    }
}
main().catch(console.error);
//# sourceMappingURL=make-immutable.js.map