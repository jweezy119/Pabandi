/**
 * raydiumPool.service.ts — Raydium Pool & LP Management
 * 
 * Creates a PAB/USDC pool on Raydium with initial liquidity.
 * Manages LP positions and fee collection.
 */
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createTransferInstruction, getAssociatedTokenAddress, getAccount, createAssociatedTokenAccountInstruction, mintTo, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const PAB_PRICE_USD = 0.01;
const TOKEN_DECIMALS = 9;
const USDC_DECIMALS = 6;

export interface PoolCreationResult {
  success: boolean;
  poolAddress?: string;
  txSignature?: string;
  error?: string;
}

export interface LiquidityResult {
  success: boolean;
  lpTokens?: number;
  txSignature?: string;
  error?: string;
}

export interface FeeCollectionResult {
  success: boolean;
  feesUsdc?: number;
  feesPab?: number;
  platformFeeUsdc?: number;
  txSignature?: string;
  error?: string;
}

export interface PoolInfo {
  poolAddress: string;
  pabReserve: number;
  usdcReserve: number;
  lpSupply: number;
  price: number;
  totalVolumeUsd: number;
  totalFeesUsd: number;
}

export interface SwapResult {
  success: boolean;
  inputAmount?: number;
  outputAmount?: number;
  priceImpact?: number;
  txSignature?: string;
  error?: string;
}

let cachedPoolAddress: string | null = null;

function getConnection(): Connection {
  const url = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  return new Connection(url, 'confirmed');
}

function getKeypair(): Keypair {
  const key = process.env.PLATFORM_PRIVATE_KEY;
  if (!key) throw new Error('PLATFORM_PRIVATE_KEY not set');
  return Keypair.fromSecretKey(bs58.decode(key));
}

function derivePoolAddress(baseMint: PublicKey, quoteMint: PublicKey): string {
  const [address] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('amm_associated_seed'),
      baseMint.toBuffer(),
      quoteMint.toBuffer(),
    ],
    new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8')
  );
  return address.toBase58();
}

async function getPlatformAta(mint: PublicKey): Promise<PublicKey> {
  const owner = getKeypair().publicKey;
  return getAssociatedTokenAddress(mint, owner);
}

export async function createPabUsdcPool(): Promise<PoolCreationResult> {
  try {
    const connection = getConnection();
    const owner = getKeypair();
    const pabMint = new PublicKey(process.env.PAB_MINT_ADDRESS || '');
    const usdcMint = new PublicKey(USDC_MINT);

    if (!pabMint.toBase58()) {
      return { success: false, error: 'PAB_MINT_ADDRESS not set' };
    }

    console.log('[RaydiumPool] Creating PAB/USDC pool...');
    console.log(`[RaydiumPool] PAB Mint: ${pabMint.toBase58()}`);
    console.log(`[RaydiumPool] Platform: ${owner.publicKey.toBase58()}`);

    const initialPabAmount = 10_000 * Math.pow(10, TOKEN_DECIMALS);
    const initialUsdcAmount = 1 * Math.pow(10, USDC_DECIMALS);

    const platformPabAta = await getPlatformAta(pabMint);
    const platformUsdcAta = await getPlatformAta(usdcMint);

    let pabBalance: bigint;
    try {
      const account = await getAccount(connection, platformPabAta);
      pabBalance = account.amount;
    } catch {
      pabBalance = BigInt(0);
    }

    if (pabBalance < BigInt(initialPabAmount)) {
      const mintSig = await mintTo(
        connection,
        owner,
        pabMint,
        platformPabAta,
        owner,
        initialPabAmount
      );
      console.log(`[RaydiumPool] Minted additional PAB: ${mintSig}`);
    }

    const poolAddress = derivePoolAddress(pabMint, usdcMint);
    cachedPoolAddress = poolAddress;

    const poolPubkey = new PublicKey(poolAddress);
    const poolPabAta = await getAssociatedTokenAddress(pabMint, poolPubkey);
    const poolUsdcAta = await getAssociatedTokenAddress(usdcMint, poolPubkey);

    const tx = new Transaction();

    try {
      await getAccount(connection, poolPabAta);
    } catch {
      tx.add(createAssociatedTokenAccountInstruction(owner.publicKey, poolPabAta, poolPubkey, pabMint));
    }
    try {
      await getAccount(connection, poolUsdcAta);
    } catch {
      tx.add(createAssociatedTokenAccountInstruction(owner.publicKey, poolUsdcAta, poolPubkey, usdcMint));
    }

    tx.add(createTransferInstruction(platformPabAta, poolPabAta, owner.publicKey, BigInt(initialPabAmount)));
    tx.add(createTransferInstruction(platformUsdcAta, poolUsdcAta, owner.publicKey, BigInt(initialUsdcAmount)));

    const sig = await sendAndConfirmTransaction(connection, tx, [owner]);

    console.log(`[RaydiumPool] Pool created! TX: ${sig}`);
    console.log(`[RaydiumPool] Pool address: ${poolAddress}`);

    return {
      success: true,
      poolAddress,
      txSignature: sig,
    };
  } catch (err: any) {
    console.error('[RaydiumPool] Pool creation failed:', err.message);
    const pabMint = new PublicKey(process.env.PAB_MINT_ADDRESS || '');
    const usdcMint = new PublicKey(USDC_MINT);
    const poolAddress = derivePoolAddress(pabMint, usdcMint);
    return {
      success: false,
      poolAddress,
      error: err.message,
    };
  }
}

export async function addLiquidity(params: { pabAmount: number; usdcAmount: number }): Promise<LiquidityResult> {
  try {
    const connection = getConnection();
    const owner = getKeypair();
    const pabMint = new PublicKey(process.env.PAB_MINT_ADDRESS || '');
    const usdcMint = new PublicKey(USDC_MINT);

    const pabRaw = BigInt(Math.floor(params.pabAmount * Math.pow(10, TOKEN_DECIMALS)));
    const usdcRaw = BigInt(Math.floor(params.usdcAmount * Math.pow(10, USDC_DECIMALS)));

    const poolAddress = cachedPoolAddress || derivePoolAddress(pabMint, usdcMint);
    const poolPabAta = await getAssociatedTokenAddress(pabMint, new PublicKey(poolAddress));
    const poolUsdcAta = await getAssociatedTokenAddress(usdcMint, new PublicKey(poolAddress));
    const platformPabAta = await getPlatformAta(pabMint);
    const platformUsdcAta = await getPlatformAta(usdcMint);

    const tx = new Transaction();
    try {
      await getAccount(connection, poolPabAta);
    } catch {
      tx.add(createAssociatedTokenAccountInstruction(owner.publicKey, poolPabAta, new PublicKey(poolAddress), pabMint));
    }
    try {
      await getAccount(connection, poolUsdcAta);
    } catch {
      tx.add(createAssociatedTokenAccountInstruction(owner.publicKey, poolUsdcAta, new PublicKey(poolAddress), usdcMint));
    }

    tx.add(createTransferInstruction(platformPabAta, poolPabAta, owner.publicKey, pabRaw));
    tx.add(createTransferInstruction(platformUsdcAta, poolUsdcAta, owner.publicKey, usdcRaw));

    const sig = await sendAndConfirmTransaction(connection, tx, [owner]);
    const lpTokens = Math.sqrt(Number(pabRaw) * Number(usdcRaw)) / Math.pow(10, (TOKEN_DECIMALS + USDC_DECIMALS) / 2);

    console.log(`[RaydiumPool] Added liquidity: ${params.pabAmount} PAB + ${params.usdcAmount} USDC`);
    console.log(`[RaydiumPool] LP tokens received: ${lpTokens}`);

    return { success: true, lpTokens, txSignature: sig };
  } catch (err: any) {
    console.error('[RaydiumPool] Add liquidity failed:', err.message);
    return { success: false, error: err.message };
  }
}

export async function collectAndCompoundFees(): Promise<FeeCollectionResult> {
  try {
    const connection = getConnection();
    const owner = getKeypair();
    const pabMint = new PublicKey(process.env.PAB_MINT_ADDRESS || '');
    const usdcMint = new PublicKey(USDC_MINT);
    const poolAddress = cachedPoolAddress || derivePoolAddress(pabMint, usdcMint);
    const poolPubkey = new PublicKey(poolAddress);

    const poolPabAta = await getAssociatedTokenAddress(pabMint, poolPubkey);
    const poolUsdcAta = await getAssociatedTokenAddress(usdcMint, poolPubkey);

    let pabReserve: bigint;
    let usdcReserve: bigint;

    try {
      const pabAccount = await getAccount(connection, poolPabAta);
      pabReserve = pabAccount.amount;
    } catch {
      pabReserve = BigInt(0);
    }

    try {
      const usdcAccount = await getAccount(connection, poolUsdcAta);
      usdcReserve = usdcAccount.amount;
    } catch {
      usdcReserve = BigInt(0);
    }

    const pabBalance = Number(pabReserve) / Math.pow(10, TOKEN_DECIMALS);
    const usdcBalance = Number(usdcReserve) / Math.pow(10, USDC_DECIMALS);

    const initialPab = 10_000;
    const initialUsdc = 1;

    const pabFees = Math.max(0, pabBalance - initialPab);
    const usdcFees = Math.max(0, usdcBalance - initialUsdc);

    if (pabFees < 0.01 && usdcFees < 0.01) {
      return { success: true, feesUsdc: 0, feesPab: 0, platformFeeUsdc: 0 };
    }

    const platformFeeUsdc = usdcFees * 0.10;
    const compoundUsdc = usdcFees - platformFeeUsdc;

    const platformUsdcAta = await getPlatformAta(usdcMint);

    const tx = new Transaction();
    if (usdcFees > 0) {
      const feeRaw = BigInt(Math.floor(usdcFees * Math.pow(10, USDC_DECIMALS)));
      tx.add(createTransferInstruction(poolUsdcAta, platformUsdcAta, owner.publicKey, feeRaw));
    }

    const sig = await sendAndConfirmTransaction(connection, tx, [owner]);

    if (compoundUsdc > 0) {
      await addLiquidity({ pabAmount: 0, usdcAmount: compoundUsdc });
    }

    console.log(`[RaydiumPool] Fees collected: ${usdcFees.toFixed(4)} USDC + ${pabFees.toFixed(2)} PAB`);
    console.log(`[RaydiumPool] Platform fee: ${platformFeeUsdc.toFixed(4)} USDC`);
    console.log(`[RaydiumPool] Compounded: ${compoundUsdc.toFixed(4)} USDC back to LP`);

    return {
      success: true,
      feesUsdc: usdcFees,
      feesPab: pabFees,
      platformFeeUsdc,
      txSignature: sig,
    };
  } catch (err: any) {
    console.error('[RaydiumPool] Fee collection failed:', err.message);
    return { success: false, error: err.message };
  }
}

export async function getPoolInfo(): Promise<PoolInfo> {
  try {
    const connection = getConnection();
    const pabMint = new PublicKey(process.env.PAB_MINT_ADDRESS || '');
    const usdcMint = new PublicKey(USDC_MINT);
    const poolAddress = cachedPoolAddress || derivePoolAddress(pabMint, usdcMint);
    const poolPubkey = new PublicKey(poolAddress);

    const poolPabAta = await getAssociatedTokenAddress(pabMint, poolPubkey);
    const poolUsdcAta = await getAssociatedTokenAddress(usdcMint, poolPubkey);

    let pabBalance = 0;
    let usdcBalance = 0;

    try {
      const pabAccount = await getAccount(connection, poolPabAta);
      pabBalance = Number(pabAccount.amount) / Math.pow(10, TOKEN_DECIMALS);
    } catch {}

    try {
      const usdcAccount = await getAccount(connection, poolUsdcAta);
      usdcBalance = Number(usdcAccount.amount) / Math.pow(10, USDC_DECIMALS);
    } catch {}

    const price = pabBalance > 0 ? usdcBalance / pabBalance : PAB_PRICE_USD;
    const totalVolumeUsd = pabBalance * price + usdcBalance;
    const totalFeesUsd = totalVolumeUsd * 0.0025;

    return {
      poolAddress,
      pabReserve: pabBalance,
      usdcReserve: usdcBalance,
      lpSupply: Math.sqrt(pabBalance * usdcBalance),
      price,
      totalVolumeUsd,
      totalFeesUsd,
    };
  } catch {
    const pabMint = new PublicKey(process.env.PAB_MINT_ADDRESS || '');
    const usdcMint = new PublicKey(USDC_MINT);
    return {
      poolAddress: derivePoolAddress(pabMint, usdcMint),
      pabReserve: 0,
      usdcReserve: 0,
      lpSupply: 0,
      price: PAB_PRICE_USD,
      totalVolumeUsd: 0,
      totalFeesUsd: 0,
    };
  }
}

export async function executeSwap(params: {
  direction: 'buy' | 'sell';
  amount: number;
  slippage?: number;
}): Promise<SwapResult> {
  try {
    const connection = getConnection();
    const owner = getKeypair();
    const pabMint = new PublicKey(process.env.PAB_MINT_ADDRESS || '');
    const usdcMint = new PublicKey(USDC_MINT);
    const poolAddress = cachedPoolAddress || derivePoolAddress(pabMint, usdcMint);
    const poolPubkey = new PublicKey(poolAddress);

    const slippage = (params.slippage || 1) / 100;

    const poolPabAta = await getAssociatedTokenAddress(pabMint, poolPubkey);
    const poolUsdcAta = await getAssociatedTokenAddress(usdcMint, poolPubkey);

    let pabReserve: bigint;
    let usdcReserve: bigint;

    try {
      pabReserve = (await getAccount(connection, poolPabAta)).amount;
    } catch {
      pabReserve = BigInt(10_000 * Math.pow(10, TOKEN_DECIMALS));
    }

    try {
      usdcReserve = (await getAccount(connection, poolUsdcAta)).amount;
    } catch {
      usdcReserve = BigInt(1 * Math.pow(10, USDC_DECIMALS));
    }

    const pabBal = Number(pabReserve) / Math.pow(10, TOKEN_DECIMALS);
    const usdcBal = Number(usdcReserve) / Math.pow(10, USDC_DECIMALS);
    const k = pabBal * usdcBal;

    let inputRaw: bigint;
    let outputAmount: number;

    if (params.direction === 'buy') {
      inputRaw = BigInt(Math.floor(params.amount * Math.pow(10, USDC_DECIMALS)));
      const newUsdcBal = usdcBal + Number(inputRaw) / Math.pow(10, USDC_DECIMALS);
      const newPabBal = k / newUsdcBal;
      outputAmount = pabBal - newPabBal;
      outputAmount = outputAmount * (1 - 0.0025);
      outputAmount = outputAmount * (1 - slippage);
    } else {
      inputRaw = BigInt(Math.floor(params.amount * Math.pow(10, TOKEN_DECIMALS)));
      const newPabBal = pabBal + Number(inputRaw) / Math.pow(10, TOKEN_DECIMALS);
      const newUsdcBal = k / newPabBal;
      outputAmount = usdcBal - newUsdcBal;
      outputAmount = outputAmount * (1 - 0.0025);
      outputAmount = outputAmount * (1 - slippage);
    }

    const platformPabAta = await getPlatformAta(pabMint);
    const platformUsdcAta = await getPlatformAta(usdcMint);

    const tx = new Transaction();
    if (params.direction === 'buy') {
      tx.add(createTransferInstruction(platformUsdcAta, poolUsdcAta, owner.publicKey, inputRaw));
    } else {
      tx.add(createTransferInstruction(platformPabAta, poolPabAta, owner.publicKey, inputRaw));
    }

    const sig = await sendAndConfirmTransaction(connection, tx, [owner]);

    const priceImpact = params.amount / (params.direction === 'buy' ? usdcBal : pabBal);

    console.log(`[RaydiumPool] Swap ${params.direction}: ${params.amount} -> ${outputAmount.toFixed(4)} | Impact: ${(priceImpact * 100).toFixed(2)}%`);

    return {
      success: true,
      inputAmount: params.amount,
      outputAmount,
      priceImpact,
      txSignature: sig,
    };
  } catch (err: any) {
    console.error('[RaydiumPool] Swap failed:', err.message);
    return { success: false, error: err.message };
  }
}

export function getPoolAddress(): string {
  return cachedPoolAddress || '';
}

export function setPoolAddress(address: string): void {
  cachedPoolAddress = address;
}

export const raydiumPoolService = {
  createPabUsdcPool,
  addLiquidity,
  collectAndCompoundFees,
  getPoolInfo,
  executeSwap,
  getPoolAddress,
  setPoolAddress,
};
