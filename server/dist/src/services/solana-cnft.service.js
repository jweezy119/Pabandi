"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.solanaCnftService = exports.SolanaCnftService = void 0;
const umi_bundle_defaults_1 = require("@metaplex-foundation/umi-bundle-defaults");
const umi_1 = require("@metaplex-foundation/umi");
const mpl_bubblegum_1 = require("@metaplex-foundation/mpl-bubblegum");
const logger_1 = require("../utils/logger");
const bs58_1 = __importDefault(require("bs58"));
class SolanaCnftService {
    constructor() {
        try {
            // We connect to a public RPC for Mainnet or Devnet
            const rpcEndpoint = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
            this.umi = (0, umi_bundle_defaults_1.createUmi)(rpcEndpoint);
            if (process.env.SOLANA_PRIVATE_KEY) {
                const secretKey = bs58_1.default.decode(process.env.SOLANA_PRIVATE_KEY);
                const umiKeypair = this.umi.eddsa.createKeypairFromSecretKey(secretKey);
                const umiSigner = (0, umi_1.createSignerFromKeypair)(this.umi, umiKeypair);
                this.umi.use((0, umi_1.signerIdentity)(umiSigner));
            }
            // Predefined Merkle Tree Address for Pabandi cNFTs
            const treeEnv = process.env.MERKLE_TREE_ADDRESS || 'Tree111111111111111111111111111111111111111';
            this.treeAddress = (0, umi_1.publicKey)(treeEnv);
        }
        catch (e) {
            logger_1.logger.error(`[Solana cNFT] Initialization failed: ${e.message}`);
        }
    }
    /**
     * Mint a Compressed NFT (cNFT) for Proof of Visit
     */
    async mintProofOfVisitCnft(customerWallet, businessName, businessId) {
        try {
            if (!this.umi || !process.env.SOLANA_PRIVATE_KEY) {
                logger_1.logger.warn('[Solana cNFT] Cannot mint: Missing Umi instance or SOLANA_PRIVATE_KEY.');
                return null;
            }
            const leafOwner = (0, umi_1.publicKey)(customerWallet);
            // We assemble the cNFT Metadata (off-chain JSON URI would usually be uploaded here)
            const metadataUri = `https://pabandi.com/api/v1/metadata/pov/${businessId}`;
            const name = `Proof of Visit: ${businessName}`;
            logger_1.logger.info(`[Solana cNFT] Assembling cNFT Mint Instruction for ${customerWallet} at ${businessName}...`);
            const builder = (0, mpl_bubblegum_1.mintV1)(this.umi, {
                leafOwner,
                merkleTree: this.treeAddress,
                metadata: {
                    name: name.substring(0, 32), // max 32 chars
                    symbol: 'POV',
                    uri: metadataUri,
                    sellerFeeBasisPoints: 0,
                    collection: { key: this.treeAddress, verified: false }, // optional: Collection NFT address
                    creators: [
                        { address: this.umi.identity.publicKey, verified: true, share: 100 }
                    ],
                },
            });
            // Instead of builder.sendAndConfirm(this.umi) which costs real SOL, 
            // we will simulate the transaction or just log the compiled message for MVP safety.
            // let tx = await builder.sendAndConfirm(this.umi);
            // const txHash = bs58.encode(tx.signature);
            // Simulation log
            const txHash = `mock_tx_${Date.now()}`;
            logger_1.logger.info(`[Solana cNFT] SIMULATED Mint Tx: ${txHash}`);
            return { txHash };
        }
        catch (e) {
            logger_1.logger.error(`[Solana cNFT] Failed to mint cNFT: ${e.message}`);
            return null;
        }
    }
}
exports.SolanaCnftService = SolanaCnftService;
exports.solanaCnftService = new SolanaCnftService();
//# sourceMappingURL=solana-cnft.service.js.map