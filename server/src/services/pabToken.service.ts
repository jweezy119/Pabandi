import { Connection, Keypair, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { createInitializeMintInstruction, createAssociatedTokenAccountInstruction, createMintToInstruction, TOKEN_PROGRAM_ID, getAssociatedTokenAddress, MINT_SIZE } from '@solana/spl-token';
import bs58 from 'bs58';
import { prisma } from '../utils/database';

export class PabTokenService {
  private connection: Connection;
  private platformKeypair: Keypair;

  constructor() {
    const url = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    this.connection = new Connection(url, 'confirmed');
    
    const privateKeyBase58 = process.env.PLATFORM_PRIVATE_KEY || '';
    const secretKey = bs58.decode(privateKeyBase58);
    this.platformKeypair = Keypair.fromSecretKey(secretKey);
  }

  async createToken(): Promise<{ mint: string; txHash: string }> {
    const mintAuthority = this.platformKeypair.publicKey;
    const decimals = 9;

    const mintKeypair = Keypair.generate();
    const mintRent = await this.connection.getMinimumBalanceForRentExemption(MINT_SIZE);
    const platformAta = await getAssociatedTokenAddress(mintKeypair.publicKey, mintAuthority);

    const transaction = new Transaction();

    // 1. Create mint account
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: mintAuthority,
        newAccountPubkey: mintKeypair.publicKey,
        lamports: mintRent,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      })
    );

    // 2. Initialize mint
    transaction.add(
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        decimals,
        mintAuthority,
        null,
        TOKEN_PROGRAM_ID
      )
    );

    // 3. Create ATA
    transaction.add(
      createAssociatedTokenAccountInstruction(
        mintAuthority,
        platformAta,
        mintAuthority,
        mintKeypair.publicKey
      )
    );

    // 4. Mint 1B tokens
    const mintAmount = 1_000_000_000 * Math.pow(10, decimals);
    transaction.add(
      createMintToInstruction(
        mintKeypair.publicKey,
        platformAta,
        mintAuthority,
        mintAmount,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    const { blockhash } = await this.connection.getRecentBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = mintAuthority;
    transaction.sign(this.platformKeypair, mintKeypair);

    const txHash = await this.connection.sendRawTransaction(transaction.serialize());
    await this.connection.confirmTransaction(txHash, 'confirmed');

    await prisma.systemConfig.upsert({
      where: { key: 'pabMint' },
      create: { key: 'pabMint', value: mintKeypair.publicKey.toBase58(), description: 'PAB token mint address' },
      update: { value: mintKeypair.publicKey.toBase58() },
    });

    return { mint: mintKeypair.publicKey.toBase58(), txHash };
  }

  getPlatformAddress(): string {
    return this.platformKeypair.publicKey.toBase58();
  }
}

export const pabToken = new PabTokenService();
