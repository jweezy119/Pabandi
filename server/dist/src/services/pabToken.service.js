"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pabToken = exports.PabTokenService = void 0;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const bs58_1 = __importDefault(require("bs58"));
const database_1 = require("../utils/database");
class PabTokenService {
    constructor() {
        const url = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
        this.connection = new web3_js_1.Connection(url, 'confirmed');
        const privateKeyBase58 = process.env.PLATFORM_PRIVATE_KEY || '';
        const secretKey = bs58_1.default.decode(privateKeyBase58);
        this.platformKeypair = web3_js_1.Keypair.fromSecretKey(secretKey);
    }
    async createToken() {
        const mintAuthority = this.platformKeypair.publicKey;
        const decimals = 9;
        const mintKeypair = web3_js_1.Keypair.generate();
        const mintRent = await this.connection.getMinimumBalanceForRentExemption(spl_token_1.MINT_SIZE);
        const platformAta = await (0, spl_token_1.getAssociatedTokenAddress)(mintKeypair.publicKey, mintAuthority);
        const transaction = new web3_js_1.Transaction();
        // 1. Create mint account
        transaction.add(web3_js_1.SystemProgram.createAccount({
            fromPubkey: mintAuthority,
            newAccountPubkey: mintKeypair.publicKey,
            lamports: mintRent,
            space: spl_token_1.MINT_SIZE,
            programId: spl_token_1.TOKEN_PROGRAM_ID,
        }));
        // 2. Initialize mint
        transaction.add((0, spl_token_1.createInitializeMintInstruction)(mintKeypair.publicKey, decimals, mintAuthority, null, spl_token_1.TOKEN_PROGRAM_ID));
        // 3. Create ATA
        transaction.add((0, spl_token_1.createAssociatedTokenAccountInstruction)(mintAuthority, platformAta, mintAuthority, mintKeypair.publicKey));
        // 4. Mint 1B tokens
        const mintAmount = 1000000000 * Math.pow(10, decimals);
        transaction.add((0, spl_token_1.createMintToInstruction)(mintKeypair.publicKey, platformAta, mintAuthority, mintAmount, [], spl_token_1.TOKEN_PROGRAM_ID));
        const { blockhash } = await this.connection.getRecentBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = mintAuthority;
        transaction.sign(this.platformKeypair, mintKeypair);
        const txHash = await this.connection.sendRawTransaction(transaction.serialize());
        await this.connection.confirmTransaction(txHash, 'confirmed');
        await database_1.prisma.systemConfig.upsert({
            where: { key: 'pabMint' },
            create: { key: 'pabMint', value: mintKeypair.publicKey.toBase58(), description: 'PAB token mint address' },
            update: { value: mintKeypair.publicKey.toBase58() },
        });
        return { mint: mintKeypair.publicKey.toBase58(), txHash };
    }
    getPlatformAddress() {
        return this.platformKeypair.publicKey.toBase58();
    }
}
exports.PabTokenService = PabTokenService;
exports.pabToken = new PabTokenService();
//# sourceMappingURL=pabToken.service.js.map