import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { createMint, createAssociatedTokenAccountInstruction, createTransferInstruction, TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import bs58 from 'bs58';
import crypto from 'crypto';
import { prisma } from '../utils/database';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

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
    const freezeAuthority = null;
    const decimals = 9;

    const mint = await createMint(
      this.connection,
      this.platformKeypair,
      mintAuthority,
      freezeAuthority,
      decimals
    );

    // Mint 1 billion tokens to platform wallet
    const platformAta = await getAssociatedTokenAddress(mint, mintAuthority);
    
    const transaction = new Transaction();
    
    // Create ATA if needed
    const ataInfo = await this.connection.getAccountInfo(platformAta);
    if (!ataInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          mintAuthority,
          platformAta,
          mintAuthority,
          mint
        )
      );
    }

    // Mint 1B tokens
    const mintAmount = 1_000_000_000 * Math.pow(10, decimals);
    transaction.add(
      createTransferInstruction(
        platformAta,
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
    transaction.sign(this.platformKeypair);

    const txHash = await this.connection.sendRawTransaction(transaction.serialize());
    await this.connection.confirmTransaction(txHash, 'confirmed');

    // Save to database
    await prisma.systemConfig.upsert({
      where: { key: 'pabMint' },
      create: { key: 'pabMint', value: mint.toBase58(), description: 'PAB token mint address' },
      update: { value: mint.toBase58() },
    });

    return { mint: mint.toBase58(), txHash };
  }

  async mintToAgent(agentWallet: string, amount: number): Promise<string> {
    const mintConfig = await prisma.systemConfig.findUnique({ where: { key: 'pabMint' } });
    if (!mintConfig) throw new Error('PAB token not created yet');

    const mint = new PublicKey(mintConfig.value);
    const agentAta = await getAssociatedTokenAddress(mint, new PublicKey(agentWallet));

    const transaction = new Transaction();

    // Create ATA if needed
    const ataInfo = await this.connection.getAccountInfo(agentAta);
    if (!ataInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          this.platformKeypair.publicKey,
          agentAta,
          new PublicKey(agentWallet),
          mint
        )
      );
    }

    // Transfer PAB to agent
    const platformAta = await getAssociatedTokenAddress(mint, this.platformKeypair.publicKey);
    const mintAmount = Math.round(amount * Math.pow(10, 9));
    
    transaction.add(
      createTransferInstruction(
        platformAta,
        agentAta,
        this.platformKeypair.publicKey,
        mintAmount,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    const { blockhash } = await this.connection.getRecentBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.platformKeypair.publicKey;
    transaction.sign(this.platformKeypair);

    const txHash = await this.connection.sendRawTransaction(transaction.serialize());
    await this.connection.confirmTransaction(txHash, 'confirmed');

    return txHash;
  }

  getPlatformAddress(): string {
    return this.platformKeypair.publicKey.toBase58();
  }
}

export const pabToken = new PabTokenService();
