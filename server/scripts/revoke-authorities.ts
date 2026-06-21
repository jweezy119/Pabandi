import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { setAuthority, AuthorityType } from "@solana/spl-token";
import bs58 from "bs58";
import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.contracts" }); // Load the mint address

const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

async function main() {
  console.log("🔒 Starting Solana Authority Revocation Process...");

  let payer: Keypair;
  if (process.env.SOLANA_PRIVATE_KEY) {
    payer = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_PRIVATE_KEY));
  } else {
    console.error("⚠️ No SOLANA_PRIVATE_KEY found in .env.");
    return;
  }

  const mintAddressRaw = process.env.SOLANA_PAB_MINT_ADDRESS;
  if (!mintAddressRaw) {
    console.error("⚠️ No SOLANA_PAB_MINT_ADDRESS found in .env.contracts.");
    return;
  }

  const mintAddress = new PublicKey(mintAddressRaw);
  console.log(`🪙 Target Mint: ${mintAddress.toBase58()}`);
  console.log(`👛 Authority Key: ${payer.publicKey.toBase58()}`);

  try {
    // 1. Revoke Freeze Authority
    console.log("\n🥶 Revoking Freeze Authority...");
    const txFreeze = await setAuthority(
      connection,
      payer,              // Payer of the transaction
      mintAddress,        // Mint account
      payer,              // Current authority
      AuthorityType.FreezeAccount, // Authority type to change
      null                // New authority (null = revoked)
    );
    console.log(`✅ Freeze Authority Revoked! TX: ${txFreeze}`);

    // 2. Revoke Mint Authority
    console.log("\n🖨️  Revoking Mint Authority...");
    const txMint = await setAuthority(
      connection,
      payer,              // Payer of the transaction
      mintAddress,        // Mint account
      payer,              // Current authority
      AuthorityType.MintTokens, // Authority type to change
      null                // New authority (null = revoked)
    );
    console.log(`✅ Mint Authority Revoked! TX: ${txMint}`);

    console.log("\n🎉 The $PAB token is now officially non-mintable and non-freezable.");
    console.log("This proves to investors that the token supply is permanently hard-capped at 1 Billion and accounts cannot be frozen.");
    
  } catch (err: any) {
    console.error("❌ Failed to revoke authority. Note: If it says 'invalid account data', the authorities may already be revoked.");
    console.error(err);
  }
}

main().catch(console.error);
