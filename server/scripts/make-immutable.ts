import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { keypairIdentity, publicKey as umiPublicKey } from "@metaplex-foundation/umi";
import { updateV1 } from "@metaplex-foundation/mpl-token-metadata";
import bs58 from "bs58";
import * as dotenv from "dotenv";

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

  const umi = createUmi("https://api.mainnet-beta.solana.com");
  
  // Set up the Umi identity
  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(bs58.decode(privateKey));
  umi.use(keypairIdentity(umiKeypair));

  const mint = umiPublicKey(mintAddressRaw);
  console.log(`🪙 Target Mint: ${mint}`);
  console.log(`👛 Authority Key: ${umiKeypair.publicKey}`);

  try {
    console.log("\n🔒 Making Token Metadata Immutable (isMutable: false)...");
    
    // Revoke the update authority by setting isMutable to false
    const tx = await updateV1(umi, {
      mint,
      authority: umi.identity,
      isMutable: false,
    }).sendAndConfirm(umi);

    console.log(`✅ Token Metadata is now PERMANENTLY Immutable!`);
    console.log(`TX Signature: ${bs58.encode(tx.signature)}`);
    
    console.log("\n🎉 The token name, symbol, and URI can no longer be changed by anyone.");
  } catch (err: any) {
    console.error("❌ Failed to make token metadata immutable.");
    console.error(err);
  }
}

main().catch(console.error);
