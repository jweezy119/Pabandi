"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ondoSolanaService = exports.OndoSolanaService = void 0;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const bs58_1 = __importDefault(require("bs58"));
class OndoSolanaService {
    constructor() {
        // Standard Solana Mainnet Mints
        this.USDC_MINT = new web3_js_1.PublicKey(process.env.USDC_MINT_ADDRESS || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
        this.USDY_MINT = new web3_js_1.PublicKey(process.env.USDY_MINT_ADDRESS || 'A1KLoBrKBde8Ty9qtNQRGvYxXQGWAX3LTo7dE2VfB3uF');
        const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
        this.connection = new web3_js_1.Connection(rpcUrl, 'confirmed');
        const secretKeyStr = process.env.TREASURY_SECRET_KEY;
        if (secretKeyStr) {
            try {
                // Assume base58 format for Solana secret keys
                const secretKey = bs58_1.default.decode(secretKeyStr);
                this.treasuryKeypair = web3_js_1.Keypair.fromSecretKey(secretKey);
            }
            catch (e) {
                console.warn('Invalid TREASURY_SECRET_KEY provided to OndoSolanaService');
                this.treasuryKeypair = web3_js_1.Keypair.generate(); // Fallback for safe booting if misconfigured
            }
        }
        else {
            console.warn('No TREASURY_SECRET_KEY provided, generating a random one for dev...');
            this.treasuryKeypair = web3_js_1.Keypair.generate();
        }
    }
    /**
     * Fetches the Treasury's current USDY balance on Solana
     */
    async getUsdyBalance() {
        try {
            const ata = await (0, spl_token_1.getAssociatedTokenAddress)(this.USDY_MINT, this.treasuryKeypair.publicKey);
            const balanceInfo = await this.connection.getTokenAccountBalance(ata);
            return balanceInfo.value.uiAmount || 0;
        }
        catch (error) {
            console.error('Error fetching USDY balance:', error);
            return 0;
        }
    }
    /**
     * Swaps USDC for USDY using Jupiter Aggregator (V6 API)
     * @param amountUsdc Amount of USDC to swap (in USD, unscaled)
     * @returns txHash The Solana transaction hash, or null if failed/mocked
     */
    async swapUsdcForUsdy(amountUsdc) {
        try {
            // USDC has 6 decimals on Solana
            const amountInLamports = Math.floor(amountUsdc * 1000000);
            // 1. Fetch Quote from Jupiter
            const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${this.USDC_MINT.toBase58()}&outputMint=${this.USDY_MINT.toBase58()}&amount=${amountInLamports}&slippageBps=50`;
            const quoteResponse = await fetch(quoteUrl);
            const quoteData = await quoteResponse.json();
            if (!quoteData || quoteData.error) {
                throw new Error(`Jupiter Quote Failed: ${quoteData?.error || 'Unknown error'}`);
            }
            // 2. Get Swap Transaction from Jupiter
            const swapRes = await fetch('https://quote-api.jup.ag/v6/swap', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    quoteResponse: quoteData,
                    userPublicKey: this.treasuryKeypair.publicKey.toBase58(),
                    wrapAndUnwrapSol: true,
                })
            });
            const swapData = await swapRes.json();
            if (!swapData || !swapData.swapTransaction) {
                throw new Error('Failed to get swap transaction from Jupiter');
            }
            // 3. Deserialize and Sign the Transaction
            const swapTransactionBuf = Buffer.from(swapData.swapTransaction, 'base64');
            const transaction = web3_js_1.VersionedTransaction.deserialize(swapTransactionBuf);
            transaction.sign([this.treasuryKeypair]);
            // 4. Execute Transaction
            const latestBlockHash = await this.connection.getLatestBlockhash();
            const txid = await this.connection.sendRawTransaction(transaction.serialize(), {
                skipPreflight: false,
                maxRetries: 2
            });
            await this.connection.confirmTransaction({
                blockhash: latestBlockHash.blockhash,
                lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
                signature: txid
            }, 'confirmed');
            console.log(`Successfully swapped USDC for USDY. Tx: https://solscan.io/tx/${txid}`);
            return txid;
        }
        catch (error) {
            console.error('Error swapping USDC for USDY on Solana:', error);
            // For local development without funds, return a mock hash instead of throwing
            // if we want the rest of the flow to continue.
            if (process.env.NODE_ENV !== 'production') {
                console.warn('Returning mock transaction hash for development.');
                return `mock_tx_${Date.now()}`;
            }
            return null;
        }
    }
}
exports.OndoSolanaService = OndoSolanaService;
exports.ondoSolanaService = new OndoSolanaService();
//# sourceMappingURL=ondo-solana.service.js.map