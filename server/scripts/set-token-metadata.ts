import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { createMetadataAccountV3, mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { keypairIdentity, publicKey } from '@metaplex-foundation/umi';
import bs58 from 'bs58';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log("🚀 Initializing Token Metadata Configuration...");

  if (!process.env.SOLANA_PRIVATE_KEY) {
    throw new Error("Missing SOLANA_PRIVATE_KEY in .env");
  }
  
  // The official PAB Token Mint Address deployed earlier
  const mintAddressBase58 = "Cc2nwBNc8Zo5e6QwmtV3JQfEi2gTfEYNrDGgxPmGaZLZ";

  // Use Mainnet
  const umi = createUmi("https://api.mainnet-beta.solana.com").use(mplTokenMetadata());
  
  // Load wallet
  const secretKey = bs58.decode(process.env.SOLANA_PRIVATE_KEY);
  const keypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
  umi.use(keypairIdentity(keypair));

  console.log(`✅ Loaded Wallet: ${keypair.publicKey}`);
  console.log(`📄 Setting metadata for Mint: ${mintAddressBase58}`);

  const mintAddress = publicKey(mintAddressBase58);

  // Send transaction to Metaplex
  const tx = createMetadataAccountV3(umi, {
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
  console.log(`Transaction Signature: https://explorer.solana.com/tx/${bs58.encode(result.signature)}`);
}

main().catch(console.error);
