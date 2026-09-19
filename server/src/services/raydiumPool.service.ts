import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Liquidity, Token, TokenAmount, Percent } from '@raydium-io/raydium-sdk-v2';
import bs58 from 'bs58';
import crypto from 'crypto';
import { prisma } from '../utils/database';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export class RaydiumPoolService {
  private connection: Connection;
  private platformKeypair: Keypair;

  constructor() {
    const url = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    this.connection = new Connection(url, 'confirmed');
    
    const privateKeyBase58 = process.env.PLATFORM_PRIVATE_KEY || '';
    const secretKey = bs58.decode(privateKeyBase58);
    this.platformKeypair = Keypair.fromSecretKey(secretKey);
  }

  async createPool(pabMint: string): Promise<{ poolId: string; txHash: string }> {
    // Create a new PAB/USDC pool on Raydium
    const pabToken = new Token(new PublicKey(pabMint), 9, 'PAB', 'PAB');
    const usdcToken = new Token(new PublicKey(USDC_MINT), 6, 'USDC', 'USDC');

    // Create pool with initial liquidity
    const poolTx = await Liquidity.makeCreatePoolTransactionV4({
      connection: this.connection,
      programId: new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'),
      marketId: new PublicKey('9xQ72Dk4wWg43G3wH3r3r1NYHuzeLXfQM9H24wFSUt1Mp8'),
      baseToken: pabToken,
      quoteToken: usdcToken,
      baseAmount: new TokenAmount(pabToken, 1000000), // 1M PAB
      quoteAmount: new TokenAmount(usdcToken, 1000), // 1000 USDC
      startTime: Math.floor(Date.now() / 1000),
      owner: this.platformKeypair.publicKey,
      payer: this.platformKeypair.publicKey,
    });

    poolTx.transaction.sign(this.platformKeypair);
    const txHash = await this.connection.sendRawTransaction(poolTx.transaction.serialize());
    await this.connection.confirmTransaction(txHash, 'confirmed');

    // Save pool address
    await prisma.systemConfig.upsert({
      where: { key: 'raydiumPoolId' },
      create: { key: 'raydiumPoolId', value: poolTx.poolKeys.id.toString(), description: 'PAB/USDC pool address' },
      update: { value: poolTx.poolKeys.id.toString() },
    });

    return { poolId: poolTx.poolKeys.id.toString(), txHash };
  }

  async executeSwap(params: {
    poolId: string;
    inputMint: string;
    outputMint: string;
    amount: number;
    slippage: number;
  }): Promise<{ txHash: string; outputAmount: number }> {
    const poolKeys = {
      id: new PublicKey(params.poolId),
      baseMint: new PublicKey(params.inputMint),
      quoteMint: new PublicKey(params.outputMint),
    };

    // Calculate output amount (simplified - in production use pool state)
    const outputAmount = params.amount * 0.997; // 0.3% fee

    const swapTx = await Liquidity.makeSwapTransactionV4({
      connection: this.connection,
      poolKeys,
      userKeys: {
        tokenAccountIn: new PublicKey(params.inputMint),
        tokenAccountOut: new PublicKey(params.outputMint),
        owner: this.platformKeypair.publicKey,
      },
      amountIn: params.amount,
      amountOutMin: outputAmount * (1 - params.slippage),
      fixedSide: 'in',
    });

    swapTx.transaction.sign(this.platformKeypair);
    const txHash = await this.connection.sendRawTransaction(swapTx.transaction.serialize());
    await this.connection.confirmTransaction(txHash, 'confirmed');

    return { txHash, outputAmount };
  }
}

export const raydiumPool = new RaydiumPoolService();
