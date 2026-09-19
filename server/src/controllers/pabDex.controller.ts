/**
 * pabDex.controller.ts — PabDex API Controller
 */
import { Request, Response, NextFunction } from 'express';
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { createAssociatedTokenAccountInstruction, createTransferInstruction, getAssociatedTokenAddress } from '@solana/spl-token';
import bs58 from 'bs58';
import { pabToken } from '../services/pabToken.service';
import { buyPAB, sellPAB, getPoolInfo, getFees } from '../services/raydiumPool.service';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDC_DECIMALS = 6;

function getKeypair(): Keypair {
  const privateKeyBase58 = process.env.PLATFORM_PRIVATE_KEY || '';
  const secretKey = bs58.decode(privateKeyBase58);
  return Keypair.fromSecretKey(secretKey);
}

export const createToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pabToken.createToken();
    res.json({ success: true, data: { mintAddress: result.mint, signature: result.txHash, totalSupply: 1000000000, decimals: 9 } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getTokenInfo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: { platformAddress: pabToken.getPlatformAddress(), totalSupply: 1000000000, decimals: 9 } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const createPool = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await getPoolInfo() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getPoolInfoEndpoint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await getPoolInfo() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const executeSwap = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { direction, amount, wallet } = req.body;
    if (!wallet) return res.status(400).json({ success: false, error: 'Agent wallet required' });
    
    const result = direction === 'buy' 
      ? await buyPAB(wallet, amount)
      : await sellPAB(wallet, amount);
    
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const fundAgent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { wallet, amount } = req.body;
    if (!wallet || !amount) return res.status(400).json({ success: false, error: 'Wallet and amount required' });
    
    const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed');
    const owner = getKeypair();
    const usdcMint = new PublicKey(USDC_MINT);
    
    const platformUsdcAta = await getAssociatedTokenAddress(usdcMint, owner.publicKey);
    const agentUsdcAta = await getAssociatedTokenAddress(usdcMint, new PublicKey(wallet));
    
    const tx = new Transaction();
    
    try { await connection.getAccountInfo(agentUsdcAta); } catch {
      tx.add(createAssociatedTokenAccountInstruction(owner.publicKey, agentUsdcAta, new PublicKey(wallet), usdcMint));
    }
    
    const usdcRaw = Math.floor(amount * Math.pow(10, USDC_DECIMALS));
    tx.add(createTransferInstruction(platformUsdcAta, agentUsdcAta, owner.publicKey, BigInt(usdcRaw)));
    
    const { blockhash } = await connection.getRecentBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = owner.publicKey;
    tx.sign(owner);
    
    const txHash = await sendAndConfirmTransaction(connection, tx, [owner]);
    
    res.json({ success: true, txHash, amount });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const collectFees = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: getFees() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: { pool: await getPoolInfo(), fees: getFees() } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const createAgent = async (req: Request, res: Response, next: NextFunction) => {
  res.json({ success: false, error: 'Not implemented' });
};

export const startAgent = async (req: Request, res: Response, next: NextFunction) => {
  res.json({ success: false, error: 'Not implemented' });
};

export const pauseAgent = async (req: Request, res: Response, next: NextFunction) => {
  res.json({ success: false, error: 'Not implemented' });
};

export const stopAgent = async (req: Request, res: Response, next: NextFunction) => {
  res.json({ success: false, error: 'Not implemented' });
};

export const getAgents = async (req: Request, res: Response, next: NextFunction) => {
  res.json({ success: true, data: [] });
};

export const getAgent = async (req: Request, res: Response, next: NextFunction) => {
  res.json({ success: true, data: null });
};

export const executeTrade = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { direction, amount } = req.body;
    const agentId = req.params.id;
    
    const { prisma } = await import('../utils/database');
    const agent = await prisma.agentProfile.findUnique({ where: { id: agentId } });
    if (!agent) return res.status(404).json({ success: false, error: 'Agent not found' });
    
    const result = direction === 'buy' 
      ? await buyPAB(agent.walletAddress, amount)
      : await sellPAB(agent.walletAddress, amount);
    
    res.json({ success: result.success, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const addLiquidity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pabAmount, usdcAmount } = req.body;
    res.json({ success: true, data: { pabAdded: pabAmount, usdcAdded: usdcAmount } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const startAllAgents = async (req: Request, res: Response, next: NextFunction) => {
  res.json({ success: false, error: 'Not implemented' });
};
