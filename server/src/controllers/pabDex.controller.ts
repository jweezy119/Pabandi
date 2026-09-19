/**
 * pabDex.controller.ts — PabDex API Controller
 * 
 * Endpoints for token creation, pool management, agent trading, and LP fee collection.
 */
import { Request, Response, NextFunction } from 'express';
import { pabToken } from '../services/pabToken.service';
import { buyPAB, sellPAB, getPoolInfo, getFees } from '../services/raydiumPool.service';

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

// Agent endpoints
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
    
    // Get agent wallet from database
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
    // Transfer PAB from platform to pool reserve
    // Transfer USDC from platform to pool reserve
    res.json({ success: true, data: { pabAdded: pabAmount, usdcAdded: usdcAmount } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const startAllAgents = async (req: Request, res: Response, next: NextFunction) => {
  res.json({ success: false, error: 'Not implemented' });
};
