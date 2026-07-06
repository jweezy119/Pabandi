import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { keypairIdentity, publicKey as umiPublicKey, createGenericFile } from "@metaplex-foundation/umi";
import { updateV1, fetchMetadataFromSeeds } from "@metaplex-foundation/mpl-token-metadata";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import * as fs from "fs";
import * as path from "path";
import bs58 from "bs58";
import * as dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.contracts" });

async function main() {
  console.log("🚀 Starting Token Metadata Update Process...");

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

  // Read the new logo image
  const imagePath = path.join(__dirname, "..", "assets", "logo.jpg");
  if (!fs.existsSync(imagePath)) {
    console.error(`⚠️ Logo image not found at ${imagePath}`);
    return;
  }

  const umi = createUmi("https://api.mainnet-beta.solana.com");
  
  // Set up the Umi identity and Irys uploader
  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(bs58.decode(privateKey));
  umi.use(keypairIdentity(umiKeypair));
  umi.use(irysUploader());

  const mint = umiPublicKey(mintAddressRaw);
  console.log(`🪙 Target Mint: ${mint}`);
  console.log(`👛 Authority Key: ${umiKeypair.publicKey}`);

  try {
    console.log("\n📸 Uploading new logo to Arweave (Irys)...");
    const imageBuffer = fs.readFileSync(imagePath);
    const genericFile = createGenericFile(imageBuffer, "logo.jpg", { contentType: "image/jpeg" });
    const [imageUri] = await umi.uploader.upload([genericFile]);
    console.log(`✅ Image uploaded to: ${imageUri}`);

    console.log("\n📝 Fetching current on-chain metadata...");
    const initialMetadata = await fetchMetadataFromSeeds(umi, { mint });

    console.log("\n📄 Uploading updated JSON metadata to Arweave (Irys)...");
    const jsonUri = await umi.uploader.uploadJson({
      name: initialMetadata.name,
      symbol: initialMetadata.symbol,
      description: "Pabandi Loyalty Token (PabPoints) - Community Rewards",
      image: imageUri,
    });
    console.log(`✅ JSON Metadata uploaded to: ${jsonUri}`);

    console.log("\n🔗 Updating Token Metadata on-chain...");
    const tx = await updateV1(umi, {
      mint,
      authority: umi.identity,
      data: {
        name: initialMetadata.name,
        symbol: initialMetadata.symbol,
        uri: jsonUri,
        sellerFeeBasisPoints: initialMetadata.sellerFeeBasisPoints,
        creators: initialMetadata.creators,
      },
    }).sendAndConfirm(umi);

    console.log(`✅ Token Metadata successfully updated!`);
    console.log(`TX Signature: ${bs58.encode(tx.signature)}`);
    console.log(`\n🎉 New Logo is now live. Run 'npm run make:immutable' when you are ready to permanently lock the token.`);
  } catch (err: any) {
    console.error("❌ Failed to update token metadata.");
    console.error(err);
  }
}

main().catch(console.error);
