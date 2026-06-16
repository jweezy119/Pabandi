import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
} from '@solana/web3.js';
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';
import bs58 from 'bs58';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Load or create a keypair for the "Treasury" / Mint Authority
const WALLET_PATH = path.join(__dirname, '..', 'treasury-wallet.json');

function getWallet(): Keypair {
  if (process.env.SOLANA_PRIVATE_KEY) {
    const secret = bs58.decode(process.env.SOLANA_PRIVATE_KEY);
    console.log('Using Treasury Wallet from SOLANA_PRIVATE_KEY in .env');
    return Keypair.fromSecretKey(secret);
  }

  if (fs.existsSync(WALLET_PATH)) {
    const secret = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf-8'));
    console.log('Using Treasury Wallet from treasury-wallet.json');
    return Keypair.fromSecretKey(new Uint8Array(secret));
  } else {
    const newWallet = Keypair.generate();
    fs.writeFileSync(WALLET_PATH, JSON.stringify(Array.from(newWallet.secretKey)));
    console.log('Created new Treasury Wallet at', WALLET_PATH);
    return newWallet;
  }
}

async function main() {
  console.log('Connecting to Solana Devnet...');
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

  const treasuryWallet = getWallet();
  console.log('Treasury Wallet Public Key:', treasuryWallet.publicKey.toBase58());

  // Check balance
  let balance = await connection.getBalance(treasuryWallet.publicKey);
  console.log('Wallet Balance:', balance / LAMPORTS_PER_SOL, 'SOL');

  if (balance < 0.05 * LAMPORTS_PER_SOL) {
    console.log('Requesting airdrop...');
    try {
      const airdropSignature = await connection.requestAirdrop(
        treasuryWallet.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(airdropSignature);
      balance = await connection.getBalance(treasuryWallet.publicKey);
      console.log('New Wallet Balance:', balance / LAMPORTS_PER_SOL, 'SOL');
    } catch (e) {
      console.log('Airdrop failed. You may need to manually fund this address on devnet:', treasuryWallet.publicKey.toBase58());
      return;
    }
  }

  console.log('Creating PAB Token Mint...');
  // Create a new token mint with 9 decimals
  const mint = await createMint(
    connection,
    treasuryWallet,
    treasuryWallet.publicKey,
    null,
    9 // 9 decimals is standard
  );
  console.log('Token Mint Address:', mint.toBase58());

  // Get or create the treasury's associated token account
  console.log('Setting up Associated Token Account...');
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    treasuryWallet,
    mint,
    treasuryWallet.publicKey
  );
  console.log('Token Account Address:', tokenAccount.address.toBase58());

  // Mint 10,000,000 PAB tokens to the treasury
  const amountToMint = 10_000_000 * Math.pow(10, 9);
  console.log('Minting initial supply (10,000,000 PAB)...');
  await mintTo(
    connection,
    treasuryWallet,
    mint,
    tokenAccount.address,
    treasuryWallet.publicKey,
    amountToMint
  );

  console.log('Minting complete!');
  console.log('--------------------------------------------------');
  console.log('Mint Address:', mint.toBase58());
  console.log('Please save the Mint Address for use in the app.');
}

main().catch(console.error);
