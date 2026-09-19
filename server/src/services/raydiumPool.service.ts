/**
 * raydiumPool.service.ts — Backend-Managed AMM Pool
 * ==================================================
 * 
 * The pool is NOT a smart contract. It's a backend simulation where:
 * - Platform wallet holds all PAB and USDC
 * - Agents trade directly with the platform wallet
 * - Price determined by constant product formula
 * - 0.25% fee on every swap → real USDC retained by platform
 * - All transfers are REAL on-chain SPL token transfers
 */

import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { createAssociatedTokenAccountInstruction, createTransferInstruction, getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import bs58 from 'bs58';
import { prisma } from '../utils/database';

const TOKEN_DECIMALS = 9;
const USDC_DECIMALS = 6;
const SWAP_FEE_BPS = 25; // 0.25%

let _connection: Connection | null = null;
let _keypair: Keypair | null = null;

// Pool state (backend-managed)
let poolPabReserve = 10000 * Math.pow(10, TOKEN_DECIMALS); // 10,000 PAB
let poolUsdcReserve = 1 * Math.pow(10, USDC_DECIMALS); // 1 USDC
let poolK = poolPabReserve * poolUsdcReserve; // Constant product
let poolTotalFeesUsdc = 0;
let poolTotalVolumeUsd = 0;

function getConnection(): Connection {
  if (!_connection) {
    const url = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    _connection = new Connection(url, 'confirmed');
  }
  return _connection;
}

function getKeypair(): Keypair {
  if (!_keypair) {
    const privateKeyBase58 = process.env.PLATFORM_PRIVATE_KEY || '';
    const secretKey = bs58.decode(privateKeyBase58);
    _keypair = Keypair.fromSecretKey(secretKey);
  }
  return _keypair;
}

async function getPlatformAta(mint: PublicKey): Promise<PublicKey> {
  const owner = getKeypair().publicKey;
  return getAssociatedTokenAddress(mint, owner);
}

// ─── GET POOL INFO ──────────────────────────────────────
export async function getPoolInfo() {
  return {
    pabReserve: poolPabReserve / Math.pow(10, TOKEN_DECIMALS),
    usdcReserve: poolUsdcReserve / Math.pow(10, USDC_DECIMALS),
    price: poolUsdcReserve / poolPabReserve * Math.pow(10, TOKEN_DECIMALS - USDC_DECIMALS),
    totalFeesUsdc: poolTotalFeesUsdc / Math.pow(10, USDC_DECIMALS),
    totalVolumeUsd: poolTotalVolumeUsd / Math.pow(10, USDC_DECIMALS),
    k: poolK,
  };
}

// ─── BUY PAB (Agent sends USDC, receives PAB) ──────────
export async function buyPAB(agentWallet: string, usdcAmount: number): Promise<{ success: boolean; pabReceived?: number; txHash?: string; error?: string }> {
  try {
    const connection = getConnection();
    const owner = getKeypair();
    const pabMintStr = process.env.PAB_MINT_ADDRESS || '';
    if (!pabMintStr) return { success: false, error: 'PAB_MINT_ADDRESS not set' };

    const pabMint = new PublicKey(pabMintStr);
    const usdcMint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

    const usdcRawNum = Math.floor(usdcAmount * Math.pow(10, USDC_DECIMALS));
    const usdcAfterFee = usdcRawNum * (10000 - SWAP_FEE_BPS) / 10000;
    const pabOut = poolPabReserve - (poolK / (poolUsdcReserve + usdcAfterFee));
    
    if (pabOut <= 0 || pabOut >= poolPabReserve) {
      return { success: false, error: 'Insufficient liquidity' };
    }

    // Execute real on-chain transfers
    const agentPubkey = new PublicKey(agentWallet);
    const agentUsdcAta = await getAssociatedTokenAddress(usdcMint, agentPubkey);
    const agentPabAta = await getAssociatedTokenAddress(pabMint, agentPubkey);
    const platformUsdcAta = await getAssociatedTokenAddress(usdcMint, owner.publicKey);
    const platformPabAta = await getAssociatedTokenAddress(pabMint, owner.publicKey);

    const tx = new Transaction();

    // Create agent ATAs if needed
    try { await getAccount(connection, agentUsdcAta); } catch {
      tx.add(createAssociatedTokenAccountInstruction(owner.publicKey, agentUsdcAta, agentPubkey, usdcMint));
    }
    try { await getAccount(connection, agentPabAta); } catch {
      tx.add(createAssociatedTokenAccountInstruction(owner.publicKey, agentPabAta, agentPubkey, pabMint));
    }

    // Transfer USDC from agent to platform
    tx.add(createTransferInstruction(agentUsdcAta, platformUsdcAta, agentPubkey, BigInt(Math.floor(usdcRaw))));
    
    // Transfer PAB from platform to agent
    tx.add(createTransferInstruction(platformPabAta, agentPabAta, owner.publicKey, BigInt(Math.floor(pabOut))));

    const { blockhash } = await connection.getRecentBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = owner.publicKey;
    tx.sign(owner);

    const txHash = await sendAndConfirmTransaction(connection, tx, [owner]);

    // Update pool state
    poolPabReserve -= pabOut;
    poolUsdcReserve += usdcRawNum;
    poolK = poolPabReserve * poolUsdcReserve;
    
    const feeUsdc = usdcRawNum * SWAP_FEE_BPS / 10000;
    poolTotalFeesUsdc += feeUsdc;
    poolTotalVolumeUsd += usdcRawNum;

    return {
      success: true,
      pabReceived: Number(pabOut) / Math.pow(10, TOKEN_DECIMALS),
      txHash,
    };
  } catch (err: any) {
    console.error('[Pool] Buy PAB failed:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── SELL PAB (Agent sends PAB, receives USDC) ─────────
export async function sellPAB(agentWallet: string, pabAmount: number): Promise<{ success: boolean; usdcReceived?: number; txHash?: string; error?: string }> {
  try {
    const connection = getConnection();
    const owner = getKeypair();
    const pabMintStr = process.env.PAB_MINT_ADDRESS || '';
    if (!pabMintStr) return { success: false, error: 'PAB_MINT_ADDRESS not set' };

    const pabMint = new PublicKey(pabMintStr);
    const usdcMint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

    const pabRawNum = Math.floor(pabAmount * Math.pow(10, TOKEN_DECIMALS));
    const pabAfterFee = pabRawNum * (10000 - SWAP_FEE_BPS) / 10000;
    const usdcOut = poolUsdcReserve - (poolK / (poolPabReserve + pabAfterFee));
    
    if (usdcOut <= 0 || usdcOut >= poolUsdcReserve) {
      return { success: false, error: 'Insufficient liquidity' };
    }

    const agentPubkey = new PublicKey(agentWallet);
    const agentUsdcAta = await getAssociatedTokenAddress(usdcMint, agentPubkey);
    const agentPabAta = await getAssociatedTokenAddress(pabMint, agentPubkey);
    const platformUsdcAta = await getAssociatedTokenAddress(usdcMint, owner.publicKey);
    const platformPabAta = await getAssociatedTokenAddress(pabMint, owner.publicKey);

    const tx = new Transaction();

    try { await getAccount(connection, agentUsdcAta); } catch {
      tx.add(createAssociatedTokenAccountInstruction(owner.publicKey, agentUsdcAta, agentPubkey, usdcMint));
    }
    try { await getAccount(connection, agentPabAta); } catch {
      tx.add(createAssociatedTokenAccountInstruction(owner.publicKey, agentPabAta, agentPubkey, pabMint));
    }

    // Transfer PAB from agent to platform
    tx.add(createTransferInstruction(agentPabAta, platformPabAta, agentPubkey, BigInt(pabRawNum)));
    
    // Transfer USDC from platform to agent
    tx.add(createTransferInstruction(platformUsdcAta, agentUsdcAta, owner.publicKey, BigInt(Math.floor(usdcOut))));

    const { blockhash } = await connection.getRecentBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = owner.publicKey;
    tx.sign(owner);

    const txHash = await sendAndConfirmTransaction(connection, tx, [owner]);

    // Update pool state
    poolPabReserve += pabRawNum;
    poolUsdcReserve -= usdcOut;
    poolK = poolPabReserve * poolUsdcReserve;
    
    const feeUsdc = usdcOut * SWAP_FEE_BPS / (10000 - SWAP_FEE_BPS);
    poolTotalFeesUsdc += feeUsdc;
    poolTotalVolumeUsd += usdcOut;

    return {
      success: true,
      usdcReceived: usdcOut / Math.pow(10, USDC_DECIMALS),
      txHash,
    };
  } catch (err: any) {
    console.error('[Pool] Sell PAB failed:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── COLLECT FEES ──────────────────────────────────────
export function getFees(): { totalFeesUsdc: number; totalVolumeUsd: number } {
  return {
    totalFeesUsdc: poolTotalFeesUsdc / Math.pow(10, USDC_DECIMALS),
    totalVolumeUsd: poolTotalVolumeUsd / Math.pow(10, USDC_DECIMALS),
  };
}
