"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.backgroundCheckService = exports.BackgroundCheckService = void 0;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const ai_nlp_service_1 = require("./ai.nlp.service");
const compliance_1 = require("../config/compliance");
/**
 * BackgroundCheckService — trust screening for Pabandi counterparties.
 *
 * Design (customer obsession / frugality / invent & simplify):
 *  - PRIMARY signal = FIRST-PARTY Pabandi history (reservations, reviews, disputes,
 *    fraud flags). It is our own data: free, real, and the most predictive of whether
 *    someone is safe to escrow with. No external API, no scraping.
 *  - SECONDARY = real, free external verifications (GitHub, RDAP domain age, OFAC
 *    sanctions, HIBP breach, Companies House, on-chain wallet age).
 *  - FRUGAL: OFAC SDN list cached 24h (no 12MB re-download per check); GitHub & RDAP
 *    cached with TTL. GDELT name-search removed — name-in-news ≠ scammer and produced
 *    false positives (gimmicky).
 *  - Deterministic composite from real module scores (no flaky AI fallback). AI is an
 *    OPTIONAL enrichment only when configured.
 *  - Output writes back to the subject's TrustPassport so the check feeds the product.
 */
// ── Caches (frugality) ──────────────────────────────────────────────────
let ofacCache = null;
const OFAC_TTL = 24 * 3600 * 1000;
const ttlCache = new Map();
function cached(key, ttlMs) {
    const c = ttlCache.get(key);
    if (c && Date.now() - c.at < ttlMs)
        return c.v;
    return undefined;
}
function setCache(key, v) {
    ttlCache.set(key, { v, at: Date.now() });
}
const HIBP_API_KEY = process.env.HIBP_API_KEY;
const COMPANIES_HOUSE_KEY = process.env.COMPANIES_HOUSE_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
// ── First-party Pabandi history (PRIMARY, real, free) ──────────────────
async function checkPabandiHistory(ref, wallet) {
    const res = { source: 'PABANDI_HISTORY', riskScore: 0, signals: [] };
    if (!ref && !wallet)
        return res;
    try {
        const where = {};
        if (ref)
            where.OR = [{ businessId: ref }, { customerId: ref }];
        else if (wallet)
            where.business = { walletAddress: wallet };
        const reservations = await database_1.prisma.reservation.findMany({
            where,
            select: { status: true, noShowProbability: true, rewardEarned: true, dispute: { select: { outcome: true } } },
        });
        const total = reservations.length;
        const completed = reservations.filter((r) => r.status === 'COMPLETED').length;
        const noShows = reservations.filter((r) => r.status === 'NO_SHOW').length;
        const noShowRate = total ? noShows / total : 0;
        const reviews = ref
            ? await database_1.prisma.pabandiReview.findMany({ where: { businessId: ref }, select: { rating: true } })
            : [];
        const avgRating = reviews.length
            ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
            : 0;
        const disputes = reservations.filter((r) => r.dispute).length;
        const upheld = reservations.filter((r) => r.dispute?.outcome === 'UPHELD').length;
        const dismissed = reservations.filter((r) => r.dispute?.outcome === 'DISMISSED').length;
        res.raw = {
            total, completed, noShows, noShowRate: +noShowRate.toFixed(2),
            avgRating: +avgRating.toFixed(2), reviews: reviews.length, disputes, upheld, dismissed,
        };
        if (total === 0) {
            res.signals.push('No Pabandi booking history yet (new or off-platform)');
            res.riskScore += 10; // unknown, not penalized hard
        }
        else {
            res.signals.push(`${completed} completed booking(s), ${noShows} no-show(s) (${Math.round(noShowRate * 100)}%)`);
            if (noShowRate > 0.2) {
                res.riskScore += 35;
                res.signals.push('⚠ High no-show rate');
            }
            if (reviews.length)
                res.signals.push(`Avg rating ${avgRating.toFixed(1)} from ${reviews.length} review(s)`);
            else
                res.signals.push('No reviews yet');
            if (upheld > 0) {
                res.riskScore += 50;
                res.signals.push(`⛔ ${upheld} upheld dispute(s)`);
            }
            else if (disputes)
                res.signals.push(`${disputes} dispute(s), none upheld`);
        }
    }
    catch (e) {
        res.error = e.message;
        res.riskScore = 5;
    }
    return res;
}
// ── Real source fetchers (secondary) ───────────────────────────────────
async function checkGithub(username) {
    const res = { source: 'GITHUB', riskScore: 0, signals: [] };
    if (!username)
        return res;
    const cacheKey = `gh:${username}`;
    const hit = cached(cacheKey, 6 * 3600 * 1000);
    if (hit) {
        res.riskScore = hit.riskScore;
        res.signals = hit.signals;
        res.raw = hit.raw;
        return res;
    }
    try {
        const headers = { 'User-Agent': 'pabandi-bgcheck', Accept: 'application/vnd.github+json' };
        if (GITHUB_TOKEN)
            headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
        const r = await fetch(`https://api.github.com/users/${username}`, { headers });
        if (!r.ok) {
            res.riskScore = 20;
            res.signals.push('GitHub profile not found or private');
            setCache(cacheKey, res);
            return res;
        }
        const d = await r.json();
        const ageDays = (Date.now() - new Date(d.created_at).getTime()) / 86400000;
        const followers = d.followers || 0;
        const repos = d.public_repos || 0;
        res.raw = { followers, repos, ageDays: Math.floor(ageDays) };
        if (ageDays < 180)
            res.riskScore += 25;
        if (followers < 3 && repos < 3)
            res.riskScore += 20;
        if (repos >= 5 && followers >= 5)
            res.riskScore = Math.max(0, res.riskScore - 15);
        res.signals.push(`GitHub: ${repos} repos, ${followers} followers, ${Math.floor(ageDays)}d old`);
    }
    catch (e) {
        res.error = e.message;
        res.riskScore = 10;
    }
    setCache(cacheKey, res);
    return res;
}
async function checkDomain(domain) {
    const res = { source: 'DOMAIN_RDAP', riskScore: 0, signals: [] };
    if (!domain)
        return res;
    const cacheKey = `rdap:${domain}`;
    const hit = cached(cacheKey, 24 * 3600 * 1000);
    if (hit) {
        res.riskScore = hit.riskScore;
        res.signals = hit.signals;
        res.raw = hit.raw;
        return res;
    }
    try {
        const clean = domain.replace(/^https?:\/\//, '').split('/')[0];
        const r = await fetch(`https://rdap.verisign.com/com/v1/domain/${clean}`);
        if (!r.ok) {
            res.riskScore = 20;
            res.signals.push('Domain RDAP lookup failed');
            setCache(cacheKey, res);
            return res;
        }
        const d = await r.json();
        const registered = (d.events || []).find((e) => e.eventAction === 'registration')?.eventDate;
        const ageDays = registered ? (Date.now() - new Date(registered).getTime()) / 86400000 : 0;
        res.raw = { ageDays: Math.floor(ageDays), registrar: d.entities?.[0]?.vcardArray };
        if (ageDays < 90) {
            res.riskScore += 35;
            res.signals.push(`Domain only ${Math.floor(ageDays)}d old — high risk`);
        }
        else
            res.signals.push(`Domain ${Math.floor(ageDays)}d old`);
    }
    catch (e) {
        res.error = e.message;
        res.riskScore = 10;
    }
    setCache(cacheKey, res);
    return res;
}
async function checkBreach(email) {
    const res = { source: 'HIBP', riskScore: 0, signals: [] };
    if (!email)
        return res;
    if (!HIBP_API_KEY) {
        res.signals.push('HIBP not configured (set HIBP_API_KEY)');
        return res;
    }
    try {
        const r = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}`, {
            headers: { 'hibp-api-key': HIBP_API_KEY, 'User-Agent': 'pabandi-bgcheck' },
        });
        if (r.status === 404) {
            res.signals.push('No known breaches for email');
            return res;
        }
        if (r.ok) {
            const breaches = await r.json();
            res.raw = { breachCount: breaches.length, names: breaches.map((b) => b.Name) };
            res.riskScore = Math.min(70, breaches.length * 12);
            res.signals.push(`⚠ Email in ${breaches.length} breach(es)`);
        }
    }
    catch (e) {
        res.error = e.message;
    }
    return res;
}
async function checkSanctions(name, wallet) {
    const res = { source: 'OFAC_SDN', riskScore: 0, signals: [] };
    if (!name && !wallet)
        return res;
    try {
        const now = Date.now();
        if (!ofacCache || now - ofacCache.at > OFAC_TTL) {
            const r = await fetch('https://www.treasury.gov/ofac/downloads/sdn.csv', { signal: AbortSignal.timeout(12000) });
            if (!r.ok) {
                res.signals.push('OFAC list fetch failed');
                return res;
            }
            ofacCache = { lines: (await r.text()).toLowerCase().split('\n'), at: now };
        }
        const lines = ofacCache.lines;
        const hit = name ? lines.some((l) => l.includes(name.toLowerCase())) : false;
        res.raw = { listSizeLines: lines.length, hit };
        if (hit) {
            res.riskScore = 100;
            res.signals.push('⛔ MATCH on OFAC sanctions list');
        }
        else
            res.signals.push('Not found on OFAC SDN list');
    }
    catch (e) {
        res.error = e.message;
        res.signals.push('OFAC check unavailable');
    }
    return res;
}
async function checkCompanyRegistry(companyName) {
    const res = { source: 'COMPANIES_HOUSE', riskScore: 0, signals: [] };
    if (!companyName)
        return res;
    if (!COMPANIES_HOUSE_KEY) {
        res.signals.push('Companies House not configured (set COMPANIES_HOUSE_KEY)');
        return res;
    }
    try {
        const r = await fetch(`https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(companyName)}`, { headers: { Authorization: 'Basic ' + Buffer.from(COMPANIES_HOUSE_KEY + ':').toString('base64') } });
        if (!r.ok) {
            res.signals.push('Company registry lookup failed');
            return res;
        }
        const d = await r.json();
        const items = d.items || [];
        res.raw = { matches: items.length };
        if (items.length === 0) {
            res.riskScore += 15;
            res.signals.push('No registered company found');
        }
        else {
            const dissolved = items.filter((i) => i.company_status === 'dissolved').length;
            if (dissolved > 0) {
                res.riskScore += 30;
                res.signals.push(`⚠ ${dissolved} dissolved entity(s) linked`);
            }
            else
                res.signals.push(`Registered: ${items[0].title}`);
        }
    }
    catch (e) {
        res.error = e.message;
    }
    return res;
}
// Real On-Chain Wallet Analytics via Solana public RPC (no API key required)
async function checkWalletAnalytics(walletAddress) {
    const res = { source: 'WALLET_ANALYTICS', riskScore: 0, signals: [] };
    if (!walletAddress)
        return res;
    try {
        const { Connection, PublicKey } = await Promise.resolve().then(() => __importStar(require('@solana/web3.js')));
        const conn = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
        const pubkey = new PublicKey(walletAddress);
        const sigs = await conn.getSignaturesForAddress(pubkey, { limit: 1000 });
        const txCount = sigs.length;
        let ageDays = 0;
        if (txCount > 0) {
            const oldest = sigs[sigs.length - 1];
            const firstTs = (oldest.blockTime || 0) * 1000;
            ageDays = firstTs ? Math.floor((Date.now() - firstTs) / 86400000) : 0;
        }
        res.raw = { walletAddress, txCount, ageDays };
        if (txCount === 0) {
            res.riskScore += 30;
            res.signals.push('No on-chain transaction history found');
        }
        else {
            if (ageDays < 30) {
                res.riskScore += 40;
                res.signals.push(`⚠ Wallet is very new (${ageDays}d old)`);
            }
            else
                res.signals.push(`Wallet age: ${ageDays} days`);
            if (txCount < 5) {
                res.riskScore += 20;
                res.signals.push(`⚠ Low transaction volume (${txCount} txs)`);
            }
            else
                res.signals.push(`Active transaction history (${txCount} txs)`);
        }
    }
    catch (e) {
        res.error = e.message;
        res.signals.push('Wallet analytics unavailable (invalid address or RPC error)');
    }
    return res;
}
// Gig Economy History — no free, license-compliant public API exists for
// Upwork/Fiverr/FieldNation history, so we do NOT fabricate profiles. We
// report the absence of an automated source honestly instead of inventing data.
async function checkGigHistory(name) {
    const res = { source: 'GIG_ECONOMY', riskScore: 0, signals: [] };
    if (!name)
        return res;
    res.signals.push('No public gig-platform API available for automated verification');
    return res;
}
// Lightweight OSINT composition (reuses existing threat engine if available)
async function runOsintFusion(req) {
    const res = { source: 'OSINT_FUSION', riskScore: 0, signals: [] };
    try {
        const { threatFusionEngine } = await Promise.resolve().then(() => __importStar(require('./osint/threatFusion.engine')));
        const verdict = await threatFusionEngine.analyzeFull(req.subjectId || req.subjectName, {
            username: req.subjectGithub || req.subjectName,
            domain: req.subjectWebsite,
            walletAddress: req.subjectWallet,
        });
        res.riskScore = Math.round((verdict.plausibilityOfThreat || 0) * 100);
        res.raw = verdict;
        res.signals.push(`Threat fusion belief: ${res.riskScore}%`);
    }
    catch (e) {
        res.error = e.message;
    }
    return res;
}
// ── Deterministic composite (no flaky AI fallback) ─────────────────────
const WEIGHTS = {
    PABANDI_HISTORY: 0.30,
    OFAC_SDN: 0.22,
    GITHUB: 0.10,
    HIBP: 0.10,
    DOMAIN_RDAP: 0.08,
    COMPANIES_HOUSE: 0.08,
    WALLET_ANALYTICS: 0.07,
    OSINT_FUSION: 0.05,
    GIG_ECONOMY: 0.0,
};
function compositeScore(modules) {
    let wsum = 0;
    let score = 0;
    for (const m of modules) {
        const w = WEIGHTS[m.source] ?? 0.02;
        if (m.error || w === 0)
            continue;
        score += m.riskScore * w;
        wsum += w;
    }
    return wsum ? Math.round(score / wsum) : 50;
}
function bandFor(score) {
    if (score >= 80)
        return 'E';
    if (score >= 60)
        return 'D';
    if (score >= 40)
        return 'C';
    if (score >= 20)
        return 'B';
    return 'A';
}
function recommendFor(score) {
    if (score >= 70)
        return 'REJECT';
    if (score >= 40)
        return 'REVIEW';
    return 'PASS';
}
// ── Public API ─────────────────────────────────────────────────────────
class BackgroundCheckService {
    async createCheck(req) {
        // PECA / PDPA-ready: in REGULATED mode, explicit consent is required before
        // running identity / OSINT / wallet screening. Fail closed (no consent = no check).
        if ((0, compliance_1.isRegulated)() && !req.consent) {
            throw new Error('Consent required to run a background check (PECA/PDPA).');
        }
        const check = await database_1.prisma.backgroundCheck.create({
            data: {
                subjectType: req.subjectType,
                subjectId: req.subjectId,
                subjectName: req.subjectName,
                subjectEmail: req.subjectEmail,
                subjectPhone: req.subjectPhone,
                subjectWallet: req.subjectWallet,
                subjectGithub: req.subjectGithub,
                subjectWebsite: req.subjectWebsite,
                subjectCompany: req.subjectCompany,
                requestedBy: req.requestedBy,
                trigger: req.trigger || 'MANUAL',
                webhookUrl: req.webhookUrl,
                status: 'PENDING',
            },
        });
        this.runCheck(check.id).catch((e) => logger_1.logger.error(`[BGCheck] run failed ${check.id}: ${e.message}`));
        return check.id;
    }
    async runCheck(checkId) {
        const check = await database_1.prisma.backgroundCheck.findUnique({ where: { id: checkId } });
        if (!check)
            return;
        await database_1.prisma.backgroundCheck.update({ where: { id: checkId }, data: { status: 'RUNNING' } });
        const req = {
            subjectType: check.subjectType,
            subjectName: check.subjectName,
            subjectId: check.subjectId || undefined,
            subjectEmail: check.subjectEmail || undefined,
            subjectPhone: check.subjectPhone || undefined,
            subjectWallet: check.subjectWallet || undefined,
            subjectGithub: check.subjectGithub || undefined,
            subjectWebsite: check.subjectWebsite || undefined,
            subjectCompany: check.subjectCompany || undefined,
        };
        const modules = await Promise.all([
            checkPabandiHistory(check.subjectId || undefined, check.subjectWallet || undefined),
            checkGithub(req.subjectGithub || ''),
            checkDomain(req.subjectWebsite || ''),
            checkBreach(req.subjectEmail || ''),
            checkSanctions(req.subjectName, req.subjectWallet || undefined),
            checkCompanyRegistry(req.subjectCompany || ''),
            runOsintFusion(req),
            checkWalletAnalytics(req.subjectWallet),
            checkGigHistory(req.subjectName),
        ]);
        const bySource = {};
        for (const m of modules)
            bySource[m.source] = m;
        let finalScore = compositeScore(modules);
        // Optional AI enrichment (does NOT override the deterministic score)
        let aiRationale = 'Composite from real module signals (deterministic).';
        try {
            const prompt = `You are the AI Underwriter for Pabandi Escrow. Given these real background-check module results, write a concise plain-English rationale (2-3 sentences) for the trust decision. Output ONLY a raw JSON object: {"rationale": "string"}.`;
            const rawAiResp = await ai_nlp_service_1.aiNlpService.generateCopy(prompt, {
                subjectName: req.subjectName,
                subjectType: check.subjectType,
                modules: bySource,
            });
            const jsonStr = rawAiResp.replace(/^```json\n?/, '').replace(/```$/, '').trim();
            const parsed = JSON.parse(jsonStr);
            if (parsed.rationale)
                aiRationale = parsed.rationale;
        }
        catch {
            // AI optional — deterministic score stands
        }
        // Hard safety override
        const sanctionsHit = modules.find((m) => m.source === 'OFAC_SDN' && m.riskScore >= 100);
        if (sanctionsHit) {
            finalScore = 100;
            aiRationale = 'CRITICAL: Subject matches OFAC Sanctions list. Automatic rejection.';
        }
        const band = bandFor(finalScore);
        const rec = recommendFor(finalScore);
        await database_1.prisma.backgroundCheck.update({
            where: { id: checkId },
            data: {
                status: 'COMPLETE',
                riskScore: finalScore,
                riskBand: band,
                recommendation: rec,
                summary: aiRationale,
                githubResult: bySource.GITHUB,
                domainResult: bySource.DOMAIN_RDAP,
                breachResult: bySource.HIBP,
                sanctionsResult: bySource.OFAC_SDN,
                registryResult: bySource.COMPANIES_HOUSE,
                osintResult: bySource.OSINT_FUSION,
                walletResult: bySource.WALLET_ANALYTICS,
                gigHistoryResult: bySource.GIG_ECONOMY,
                pabandiHistoryResult: bySource.PABANDI_HISTORY,
                aiRationale,
                identityConfidence: 100 - finalScore,
                competenceConfidence: 100 - finalScore,
                integrityConfidence: 100 - finalScore,
                temporalAlignment: 100 - finalScore,
                completedAt: new Date(),
            },
        });
        // Write back to TrustPassport so the check feeds the product
        try {
            const ref = check.subjectId || check.subjectWallet;
            if (ref) {
                const tp = await database_1.prisma.trustPassport.findFirst({
                    where: { OR: [{ providerRef: ref }, { walletAddress: check.subjectWallet || '' }] },
                });
                if (tp) {
                    await database_1.prisma.trustPassport.update({
                        where: { id: tp.id },
                        data: { riskScore: finalScore, riskBand: band, lastCheckedAt: new Date() },
                    });
                }
            }
        }
        catch (e) {
            logger_1.logger.error(`[BGCheck] trustpassport writeback failed: ${e.message}`);
        }
        logger_1.logger.info(`[BGCheck] ${check.subjectType} ${check.subjectName} → score ${finalScore} band ${band} → ${rec}`);
    }
    async getCheck(checkId) {
        return database_1.prisma.backgroundCheck.findUnique({ where: { id: checkId } });
    }
    async listChecks(filter) {
        return database_1.prisma.backgroundCheck.findMany({
            where: filter,
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
    }
    /**
     * Recurring re-screening — call from a scheduler to refresh high-value subjects.
     */
    async recheckDue() {
        const due = await database_1.prisma.backgroundCheck.findMany({
            where: { status: 'COMPLETE', updatedAt: { lt: new Date(Date.now() - 30 * 86400000) } },
            take: 50,
        });
        for (const c of due) {
            this.runCheck(c.id).catch((e) => logger_1.logger.error(`[BGCheck] recheck failed ${c.id}: ${e.message}`));
        }
        return due.length;
    }
    /**
     * Batch screening — used by funnel to vet many freelancers/property managers at once.
     */
    async batchScreen(requests) {
        const ids = [];
        for (const r of requests) {
            ids.push(await this.createCheck(r));
        }
        return ids;
    }
}
exports.BackgroundCheckService = BackgroundCheckService;
exports.backgroundCheckService = new BackgroundCheckService();
//# sourceMappingURL=backgroundCheck.service.js.map