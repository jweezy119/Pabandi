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
const mpl_token_metadata_1 = require("@metaplex-foundation/mpl-token-metadata");
const umi_1 = require("@metaplex-foundation/umi");
const bs58_1 = __importDefault(require("bs58"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
async function main() {
    console.log("🚀 Initializing Token Metadata Configuration...");
    if (!process.env.SOLANA_PRIVATE_KEY) {
        throw new Error("Missing SOLANA_PRIVATE_KEY in .env");
    }
    // The official PAB Token Mint Address deployed earlier
    const mintAddressBase58 = "Cc2nwBNc8Zo5e6QwmtV3JQfEi2gTfEYNrDGgxPmGaZLZ";
    // Use Mainnet
    const umi = (0, umi_bundle_defaults_1.createUmi)("https://api.mainnet-beta.solana.com").use((0, mpl_token_metadata_1.mplTokenMetadata)());
    // Load wallet
    const secretKey = bs58_1.default.decode(process.env.SOLANA_PRIVATE_KEY);
    const keypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
    umi.use((0, umi_1.keypairIdentity)(keypair));
    console.log(`✅ Loaded Wallet: ${keypair.publicKey}`);
    console.log(`📄 Setting metadata for Mint: ${mintAddressBase58}`);
    const mintAddress = (0, umi_1.publicKey)(mintAddressBase58);
    // Send transaction to Metaplex
    const tx = (0, mpl_token_metadata_1.createMetadataAccountV3)(umi, {
        mint: mintAddress,
        mintAuthority: umi.identity,
        payer: umi.identity,
        updateAuthority: umi.identity.publicKey,
        data: {
            name: "Pabandi Reliability Token",
            symbol: "PAB",
            uri: "https://pabandi-42c5b.web.app/pab-metadata.json",
            sellerFeeBasisPoints: 0,
            creators: null,
            collection: null,
            uses: null,
        },
        isMutable: true,
        collectionDetails: null,
    });
    console.log("📡 Sending transaction to Solana Mainnet...");
    const result = await tx.sendAndConfirm(umi);
    console.log("🎉 Metadata successfully attached!");
    console.log(`Transaction Signature: https://explorer.solana.com/tx/${bs58_1.default.encode(result.signature)}`);
}
main().catch(console.error);
//# sourceMappingURL=set-token-metadata.js.map