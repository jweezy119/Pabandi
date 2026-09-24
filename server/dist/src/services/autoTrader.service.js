"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAutoTrader = startAutoTrader;
exports.stopAutoTrader = stopAutoTrader;
exports.getAutoTraderStats = getAutoTraderStats;
const database_1 = require("../utils/database");
const raydiumPool_service_1 = require("./raydiumPool.service");
const TRADE_INTERVAL_MS = 3000;
const MIN_TRADE_USDC = 0.05;
const MAX_TRADE_USDC = 0.50;
const MIN_PAB_SELL = 50;
const MAX_PAB_SELL = 500;
let running = false;
let interval = null;
let stats = { totalTrades: 0, totalVolume: 0, totalFees: 0, startTime: Date.now() };
async function startAutoTrader() {
    if (running)
        return;
    running = true;
    stats.startTime = Date.now();
    console.log('[AutoTrader] 🚀 Starting continuous trading...');
    interval = setInterval(async () => { await tick(); }, TRADE_INTERVAL_MS);
}
function stopAutoTrader() {
    if (interval)
        clearInterval(interval);
    running = false;
    console.log('[AutoTrader] ⏹ Stopped');
}
function getAutoTraderStats() {
    return { ...stats, running, uptimeMs: Date.now() - stats.startTime };
}
async function tick() {
    try {
        const agents = await database_1.prisma.agentProfile.findMany({ where: { isActive: true } });
        if (agents.length === 0)
            return;
        for (const agent of agents) {
            try {
                const usdcBal = agent.balanceUsdc ?? 0;
                const pabBal = agent.balancePab ?? 0;
                // Recycle: if low on USDC but has PAB → sell PAB
                if (usdcBal < MIN_TRADE_USDC && pabBal > MIN_PAB_SELL) {
                    const sellAmount = Math.min(pabBal * 0.5, MAX_PAB_SELL);
                    const r = await (0, raydiumPool_service_1.sellPAB)(agent.id, sellAmount);
                    if (r.success) {
                        stats.totalTrades++;
                        stats.totalVolume += sellAmount;
                        stats.totalFees += sellAmount * 0.0025;
                    }
                    continue;
                }
                // Recycle: if low on PAB but has USDC → buy PAB
                if (pabBal < MIN_PAB_SELL && usdcBal > MIN_TRADE_USDC) {
                    const buyAmount = Math.min(usdcBal * 0.3, MAX_TRADE_USDC);
                    const r = await (0, raydiumPool_service_1.buyPAB)(agent.id, buyAmount);
                    if (r.success) {
                        stats.totalTrades++;
                        stats.totalVolume += buyAmount;
                        stats.totalFees += buyAmount * 0.0025;
                    }
                    continue;
                }
                // Both balances healthy → random trade
                if (usdcBal > MIN_TRADE_USDC && pabBal > MIN_PAB_SELL) {
                    const direction = Math.random() > 0.5 ? 'buy' : 'sell';
                    if (direction === 'buy') {
                        const amt = Math.min(usdcBal * 0.2, MAX_TRADE_USDC);
                        const r = await (0, raydiumPool_service_1.buyPAB)(agent.id, amt);
                        if (r.success) {
                            stats.totalTrades++;
                            stats.totalVolume += amt;
                            stats.totalFees += amt * 0.0025;
                        }
                    }
                    else {
                        const amt = Math.min(pabBal * 0.2, MAX_PAB_SELL);
                        const r = await (0, raydiumPool_service_1.sellPAB)(agent.id, amt);
                        if (r.success) {
                            stats.totalTrades++;
                            stats.totalVolume += amt;
                            stats.totalFees += amt * 0.0025;
                        }
                    }
                }
            }
            catch (e) {
                // Skip agent errors silently
            }
        }
    }
    catch (e) {
        console.error('[AutoTrader] tick error:', e.message);
    }
}
//# sourceMappingURL=autoTrader.service.js.map