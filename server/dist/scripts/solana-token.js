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
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const bs58_1 = __importDefault(require("bs58"));
const dotenv = __importStar(require("dotenv"));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
// Load or create a keypair for the "Treasury" / Mint Authority
const WALLET_PATH = path.join(__dirname, '..', 'treasury-wallet.json');
function getWallet() {
    if (process.env.SOLANA_PRIVATE_KEY) {
        const secret = bs58_1.default.decode(process.env.SOLANA_PRIVATE_KEY);
        console.log('Using Treasury Wallet from SOLANA_PRIVATE_KEY in .env');
        return web3_js_1.Keypair.fromSecretKey(secret);
    }
    if (fs.existsSync(WALLET_PATH)) {
        const secret = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf-8'));
        console.log('Using Treasury Wallet from treasury-wallet.json');
        return web3_js_1.Keypair.fromSecretKey(new Uint8Array(secret));
    }
    else {
        const newWallet = web3_js_1.Keypair.generate();
        fs.writeFileSync(WALLET_PATH, JSON.stringify(Array.from(newWallet.secretKey)));
        console.log('Created new Treasury Wallet at', WALLET_PATH);
        return newWallet;
    }
}
async function main() {
    console.log('Connecting to Solana Devnet...');
    const connection = new web3_js_1.Connection((0, web3_js_1.clusterApiUrl)('devnet'), 'confirmed');
    const treasuryWallet = getWallet();
    console.log('Treasury Wallet Public Key:', treasuryWallet.publicKey.toBase58());
    // Check balance
    let balance = await connection.getBalance(treasuryWallet.publicKey);
    console.log('Wallet Balance:', balance / web3_js_1.LAMPORTS_PER_SOL, 'SOL');
    if (balance < 0.05 * web3_js_1.LAMPORTS_PER_SOL) {
        console.log('Requesting airdrop...');
        try {
            const airdropSignature = await connection.requestAirdrop(treasuryWallet.publicKey, 2 * web3_js_1.LAMPORTS_PER_SOL);
            await connection.confirmTransaction(airdropSignature);
            balance = await connection.getBalance(treasuryWallet.publicKey);
            console.log('New Wallet Balance:', balance / web3_js_1.LAMPORTS_PER_SOL, 'SOL');
        }
        catch (e) {
            console.log('Airdrop failed. You may need to manually fund this address on devnet:', treasuryWallet.publicKey.toBase58());
            return;
        }
    }
    console.log('Creating PAB Token Mint...');
    // Create a new token mint with 9 decimals
    const mint = await (0, spl_token_1.createMint)(connection, treasuryWallet, treasuryWallet.publicKey, null, 9 // 9 decimals is standard
    );
    console.log('Token Mint Address:', mint.toBase58());
    // Get or create the treasury's associated token account
    console.log('Setting up Associated Token Account...');
    const tokenAccount = await (0, spl_token_1.getOrCreateAssociatedTokenAccount)(connection, treasuryWallet, mint, treasuryWallet.publicKey);
    console.log('Token Account Address:', tokenAccount.address.toBase58());
    // Mint 10,000,000 PAB tokens to the treasury
    const amountToMint = 10000000 * Math.pow(10, 9);
    console.log('Minting initial supply (10,000,000 PAB)...');
    await (0, spl_token_1.mintTo)(connection, treasuryWallet, mint, tokenAccount.address, treasuryWallet.publicKey, amountToMint);
    console.log('Minting complete!');
    console.log('--------------------------------------------------');
    console.log('Mint Address:', mint.toBase58());
    console.log('Please save the Mint Address for use in the app.');
}
main().catch(console.error);
//# sourceMappingURL=solana-token.js.map