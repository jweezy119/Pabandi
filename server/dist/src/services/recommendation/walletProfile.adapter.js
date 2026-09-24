"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports._internal = void 0;
exports.getWalletProfile = getWalletProfile;
const web3_js_1 = require("@solana/web3.js");
const KNOWN_LEND_PROGRAMS = new Set([
    'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD', // Kamino Lend
    'M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5CycNqfAs', //? placeholder; replaced at runtime via env
    'So1endDq2YkqhipRh3WGVQzWM7L4X7TPJfWhzA4g9K', // Solend
]);
const BPF_LOADER = new Set([
    'BPFLoader2111111111111111111111111111111111',
    'BPFLoader1111111111111111111111111111111111',
]);
function rpcUrl() {
    if (process.env.HELIUS_API_KEY) {
        return `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
    }
    return process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
}
function ageFromFirstSig(firstTs, now) {
    if (!firstTs)
        return 0;
    return Math.max(0, Math.floor((now - firstTs) / 86400000));
}
/**
 * Extract a WalletProfile from on-chain history.
 * Sampling cap keeps it cheap: we read up to `limit` signatures and inspect a window
 * of them for income/deFi/program signals. Recurring income + anchor deploys are the
 * highest-value signals for the recommendation engine.
 */
async function getWalletProfile(address, limit = 60) {
    const conn = new web3_js_1.Connection(rpcUrl(), 'confirmed');
    const now = Date.now();
    const base = {
        address,
        ageDays: 0,
        txCount: 0,
        recurringIncome: false,
        incomeStreams: 0,
        ltvPct: null,
        defiInteractions: 0,
        anchorDeploys: 0,
        failedTxRatio: 0,
        lastActiveDays: 999,
    };
    let pub;
    try {
        pub = new web3_js_1.PublicKey(address);
    }
    catch {
        return base;
    }
    // Wallet age from first signature (oldest in the window).
    const sigs = await conn.getSignaturesForAddress(pub, { limit }, 'confirmed');
    base.txCount = sigs.length;
    if (sigs.length === 0)
        return base;
    const oldest = sigs[sigs.length - 1]?.blockTime;
    base.ageDays = ageFromFirstSig(oldest ? oldest * 1000 : undefined, now);
    const newest = sigs[0]?.blockTime;
    base.lastActiveDays = newest ? Math.max(0, Math.floor((now - newest * 1000) / 86400000)) : base.lastActiveDays;
    // Count failed txs in the window (reliability gate).
    const failed = sigs.filter((s) => s.err).length;
    base.failedTxRatio = sigs.length ? failed / sigs.length : 0;
    // Income / DeFi / program signals from parsed transactions (sample a bounded window).
    const sample = sigs.slice(0, Math.min(20, sigs.length));
    const seenInbound = new Set();
    for (const s of sample) {
        if (!s.signature)
            continue;
        try {
            const tx = await conn.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 });
            if (!tx?.transaction?.message)
                continue;
            const ixs = tx.transaction.message.instructions;
            for (const ix of ixs) {
                const pid = ix?.programId?.toString?.() || '';
                // Anchor / BPF deploys
                if (BPF_LOADER.has(pid) || pid === 'Anchor111111111111111111111111111111') {
                    base.anchorDeploys += 1;
                }
                // DeFi / lend programs
                if (KNOWN_LEND_PROGRAMS.has(pid)) {
                    base.defiInteractions += 1;
                }
                // Recurring inbound: SPL transfer to this wallet from a stable counterparty
                const parsed = ix?.parsed;
                if (parsed?.type === 'transfer' && parsed?.info?.destination === address) {
                    const src = parsed.info.authority || parsed.info.source;
                    if (src)
                        seenInbound.add(src);
                }
            }
        }
        catch {
            // rate-limited or unparseable — skip this tx, don't fail the whole profile
            continue;
        }
    }
    base.incomeStreams = seenInbound.size;
    base.recurringIncome = seenInbound.size >= 2; // 2+ distinct recurring sources => "salary" snapshot
    return base;
}
exports._internal = { KNOWN_LEND_PROGRAMS, BPF_LOADER, rpcUrl };
//# sourceMappingURL=walletProfile.adapter.js.map