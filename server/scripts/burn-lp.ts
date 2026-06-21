import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, burn } from "@solana/spl-token";
import bs58 from "bs58";
import dotenv from "dotenv";

dotenv.config();

const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

async function main() {
  const targetMintAddress = process.argv[2];
  
  if (!targetMintAddress) {
    console.error("❌ Error: You must provide the LP Token Mint Address.");
    console.error("Example: npm run burn:lp <MINT_ADDRESS>");
    return;
  }

  console.log(`🔥 Preparing to burn tokens for Mint: ${targetMintAddress}`);

  let payer: Keypair;
  if (process.env.SOLANA_PRIVATE_KEY) {
    payer = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_PRIVATE_KEY));
  } else {
    console.error("⚠️ No SOLANA_PRIVATE_KEY found in .env.");
    return;
  }

  const mintPubKey = new PublicKey(targetMintAddress);

  try {
    // Get the Associated Token Account (ATA) for this mint
    const ata = await getAssociatedTokenAddress(mintPubKey, payer.publicKey);
    
    // Check balance
    const tokenAccountInfo = await connection.getTokenAccountBalance(ata);
    const balance = tokenAccountInfo.value.uiAmount;
    const amountRaw = tokenAccountInfo.value.amount;

    if (!balance || balance <= 0) {
        console.error("❌ Error: You have a 0 balance for this token. Nothing to burn.");
        return;
    }

    console.log(`💰 Found balance: ${balance} LP Tokens in account ${ata.toBase58()}`);
    console.log("🚀 Executing permanent burn transaction...");

    // Burn 100% of the tokens in the account
    const tx = await burn(
        connection,
        payer,          // Payer
        ata,            // Account to burn from
        mintPubKey,     // Mint of the token
        payer,          // Authority of the account
        BigInt(amountRaw) // Amount to burn (raw format)
    );

    console.log(`\n✅ SUCCESS! LP Tokens permanently burned.`);
    console.log(`Transaction Hash: ${tx}`);
    console.log(`You can verify the burn on Solscan or Raydium.`);

  } catch (err: any) {
    console.error("\n❌ Burn transaction failed.");
    console.error(err);
  }
}

main().catch(console.error);
