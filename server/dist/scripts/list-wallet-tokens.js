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
const connection = new web3_js_1.Connection("https://api.mainnet-beta.solana.com", "confirmed");
async function main() {
    console.log("🔍 Scanning wallet for tokens...");
    let payer;
    if (process.env.SOLANA_PRIVATE_KEY) {
        payer = web3_js_1.Keypair.fromSecretKey(bs58_1.default.decode(process.env.SOLANA_PRIVATE_KEY));
        console.log(`👛 Wallet: ${payer.publicKey.toBase58()}\n`);
    }
    else {
        console.error("⚠️ No SOLANA_PRIVATE_KEY found in .env.");
        return;
    }
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(payer.publicKey, { programId: spl_token_1.TOKEN_PROGRAM_ID });
    console.log("Found the following token accounts with a balance:\n");
    let count = 0;
    for (const account of tokenAccounts.value) {
        const parsedInfo = account.account.data.parsed.info;
        const mintAddress = parsedInfo.mint;
        const tokenBalance = parsedInfo.tokenAmount.uiAmount;
        const decimals = parsedInfo.tokenAmount.decimals;
        if (tokenBalance > 0) {
            count++;
            console.log(`Token ${count}:`);
            console.log(`  Mint Address: ${mintAddress}`);
            console.log(`  Balance:      ${tokenBalance}`);
            console.log(`  Decimals:     ${decimals}`);
            if (mintAddress === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v") {
                console.log(`  (This is USDC)`);
            }
            else if (mintAddress === process.env.SOLANA_PAB_MINT_ADDRESS) {
                console.log(`  (This is your $PAB Token)`);
            }
            else if (decimals > 0 && tokenBalance > 0) {
                console.log(`  ⭐️ (This is likely your Raydium LP Token!)`);
            }
            console.log("--------------------------------------------------");
        }
    }
    if (count === 0) {
        console.log("No tokens found with a balance greater than 0.");
    }
    else {
        console.log("\n✅ Copy the 'Mint Address' of your LP token to burn it.");
    }
}
main().catch(console.error);
//# sourceMappingURL=list-wallet-tokens.js.map