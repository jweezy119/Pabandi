/**
 * pabDex.controller.ts — PabDex API Controller
 * 
 * Endpoints for token creation, pool management, agent trading, and LP fee collection.
 */
import { Request, Response, NextFunction } from 'express';
import { pabToken } from '../services/pabToken.service';
import { raydiumPoolService } from '../services/raydiumPool.service';
import { agentTraderService } from '../services/agentTrader.service';

/**
 * POST /api/v1/pab-dex/token/create
 * Create the $PAB token with 1B supply
 */
export const createToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pabToken.createToken();
    res.json({
      success: true,
      data: {
        mintAddress: result.mint,
        signature: result.txHash,
        totalSupply: 1_000_000_000,
        decimals: 9,
      },
    });
  } catch (err: any) {
    next(err);
  }
};

/**
 * GET /api/v1/pab-dex/token/info
 * Get PAB token info
 */
export const getTokenInfo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const platformAddress = pabToken.getPlatformAddress();
    res.json({
      success: true,
      data: {
        platformAddress,
        totalSupply: 1_000_000_000,
        decimals: 9,
      },
    });
  } catch (err: any) {
    next(err);
  }
};

/**
 * POST /api/v1/pab-dex/pool/create
 * Create the PAB/USDC pool with initial liquidity
 */
export const createPool = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await raydiumPoolService.createPabUsdcPool();
    if (result.success) {
      res.json({
        success: true,
        data: {
          poolAddress: result.poolAddress,
          txSignature: result.txSignature,
          initialLiquidity: {
            pab: 10_000,
            usdc: 1,
          },
          price: 0.01,
        },
      });
    } else {
      res.status(400).json({ success: false, error: result.error, poolAddress: result.poolAddress });
    }
  } catch (err: any) {
    next(err);
  }
};

/**
 * GET /api/v1/pab-dex/pool/info
 * Get pool info (reserves, price, volume, fees)
 */
export const getPoolInfo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const poolInfo = await raydiumPoolService.getPoolInfo();
    res.json({ success: true, data: poolInfo });
  } catch (err: any) {
    next(err);
  }
};

/**
 * POST /api/v1/pab-dex/pool/liquidity/add
 * Add liquidity to the pool
 */
export const addLiquidity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pabAmount, usdcAmount } = req.body;
    const result = await raydiumPoolService.addLiquidity({
      pabAmount: Number(pabAmount) || 0,
      usdcAmount: Number(usdcAmount) || 0,
    });

    if (result.success) {
      res.json({
        success: true,
        data: {
          lpTokens: result.lpTokens,
          txSignature: result.txSignature,
        },
      });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (err: any) {
    next(err);
  }
};

/**
 * POST /api/v1/pab-dex/pool/fees/collect
 * Collect LP fees and auto-compound
 */
export const collectFees = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await raydiumPoolService.collectAndCompoundFees();
    if (result.success) {
      res.json({
        success: true,
        data: {
          feesUsdc: result.feesUsdc,
          feesPab: result.feesPab,
          platformFeeUsdc: result.platformFeeUsdc,
          txSignature: result.txSignature,
        },
      });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (err: any) {
    next(err);
  }
};

/**
 * POST /api/v1/pab-dex/swap
 * Execute a swap (buy or sell PAB)
 */
export const executeSwap = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { direction, amount, slippage } = req.body;
    const result = await raydiumPoolService.executeSwap({
      direction,
      amount: Number(amount),
      slippage: Number(slippage) || 1,
    });

    if (result.success) {
      res.json({
        success: true,
        data: {
          inputAmount: result.inputAmount,
          outputAmount: result.outputAmount,
          priceImpact: result.priceImpact,
          txSignature: result.txSignature,
        },
      });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (err: any) {
    next(err);
  }
};

/**
 * POST /api/v1/pab-dex/agents/create
 * Create a new trading agent
 */
export const createAgent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, name, tradeIntervalMs, maxTradeAmountUsdc, minTradeAmountUsdc } = req.body;
    const config = agentTraderService.createAgent({
      id,
      name,
      tradeIntervalMs: Number(tradeIntervalMs),
      maxTradeAmountUsdc: Number(maxTradeAmountUsdc),
      minTradeAmountUsdc: Number(minTradeAmountUsdc),
    });
    res.json({ success: true, data: config });
  } catch (err: any) {
    next(err);
  }
};

/**
 * POST /api/v1/pab-dex/agents/:id/start
 * Start a trading agent
 */
export const startAgent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const success = await agentTraderService.startAgent(id);
    res.json({ success, data: { agentId: id, status: 'running' } });
  } catch (err: any) {
    next(err);
  }
};

/**
 * POST /api/v1/pab-dex/agents/:id/pause
 * Pause a trading agent
 */
export const pauseAgent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const success = agentTraderService.pauseAgent(id);
    res.json({ success, data: { agentId: id, status: 'paused' } });
  } catch (err: any) {
    next(err);
  }
};

/**
 * POST /api/v1/pab-dex/agents/:id/stop
 * Stop a trading agent
 */
export const stopAgent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const success = agentTraderService.stopAgent(id);
    res.json({ success, data: { agentId: id, status: 'stopped' } });
  } catch (err: any) {
    next(err);
  }
};

/**
 * GET /api/v1/pab-dex/agents
 * Get all agent states
 */
export const getAgents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agents = agentTraderService.getAllAgentStates();
    res.json({ success: true, data: agents });
  } catch (err: any) {
    next(err);
  }
};

/**
 * GET /api/v1/pab-dex/agents/:id
 * Get single agent state
 */
export const getAgent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const agent = agentTraderService.getAgentState(id);
    if (agent) {
      res.json({ success: true, data: agent });
    } else {
      res.status(404).json({ success: false, error: 'Agent not found' });
    }
  } catch (err: any) {
    next(err);
  }
};

/**
 * POST /api/v1/pab-dex/agents/:id/trade
 * Execute a single trade for an agent
 */
export const executeTrade = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await agentTraderService.executeTrade(id);
    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (err: any) {
    next(err);
  }
};

/**
 * GET /api/v1/pab-dex/stats
 * Get overall DEX stats
 */
export const getStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agentStats = agentTraderService.getTotalStats();
    const poolInfo = await raydiumPoolService.getPoolInfo();

    res.json({
      success: true,
      data: {
        pool: poolInfo,
        agents: agentStats,
        platformRevenue: {
          totalUsdc: agentStats.totalPlatformRevenue,
          feeRate: '10%',
        },
      },
    });
  } catch (err: any) {
    next(err);
  }
};

/**
 * POST /api/v1/pab-dex/agents/start-all
 * Start all default agents
 */
export const startAllAgents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    agentTraderService.startDefaultAgents();
    res.json({ success: true, data: { message: 'Default agents started' } });
  } catch (err: any) {
    next(err);
  }
};
