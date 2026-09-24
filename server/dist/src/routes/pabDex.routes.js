"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pabDex_controller_1 = require("../controllers/pabDex.controller");
const router = (0, express_1.Router)();
// Token endpoints
router.post('/token/create', pabDex_controller_1.createToken);
router.get('/token/info', pabDex_controller_1.getTokenInfo);
// Pool endpoints
router.post('/pool/create', pabDex_controller_1.createPool);
router.get('/pool/info', pabDex_controller_1.getPoolInfoEndpoint);
router.post('/pool/liquidity/add', pabDex_controller_1.addLiquidity);
router.post('/pool/fees/collect', pabDex_controller_1.collectFees);
// Swap endpoint
router.post('/swap', pabDex_controller_1.executeSwap);
router.post('/agents/fund', pabDex_controller_1.fundAgent);
// Agent endpoints
router.post('/agents/create', pabDex_controller_1.createAgent);
router.post('/agents/start-all', pabDex_controller_1.startAllAgents);
router.get('/agents', pabDex_controller_1.getAgents);
router.get('/agents/:id', pabDex_controller_1.getAgent);
router.post('/agents/:id/start', pabDex_controller_1.startAgent);
router.post('/agents/:id/pause', pabDex_controller_1.pauseAgent);
router.post('/agents/:id/stop', pabDex_controller_1.stopAgent);
router.post('/agents/:id/trade', pabDex_controller_1.executeTrade);
// Stats
router.get('/stats', pabDex_controller_1.getStats);
exports.default = router;
//# sourceMappingURL=pabDex.routes.js.map