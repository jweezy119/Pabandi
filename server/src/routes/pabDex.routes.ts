import { Router } from 'express';
import {
  createToken,
  getTokenInfo,
  createPool,
  getPoolInfoEndpoint,
  addLiquidity,
  collectFees,
  executeSwap,
  fundAgent,
  createAgent,
  startAgent,
  pauseAgent,
  stopAgent,
  getAgents,
  getAgent,
  executeTrade,
  getStats,
  startAllAgents,
} from '../controllers/pabDex.controller';

const router = Router();

// Token endpoints
router.post('/token/create', createToken);
router.get('/token/info', getTokenInfo);

// Pool endpoints
router.post('/pool/create', createPool);
router.get('/pool/info', getPoolInfoEndpoint);
router.post('/pool/liquidity/add', addLiquidity);
router.post('/pool/fees/collect', collectFees);

// Swap endpoint
router.post('/swap', executeSwap);
router.post('/agents/fund', fundAgent);

// Agent endpoints
router.post('/agents/create', createAgent);
router.post('/agents/start-all', startAllAgents);
router.get('/agents', getAgents);
router.get('/agents/:id', getAgent);
router.post('/agents/:id/start', startAgent);
router.post('/agents/:id/pause', pauseAgent);
router.post('/agents/:id/stop', stopAgent);
router.post('/agents/:id/trade', executeTrade);

// Stats
router.get('/stats', getStats);

export default router;
