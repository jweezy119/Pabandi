"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get getLlmBusinesses () {
        return getLlmBusinesses;
    },
    get getLlmsTxt () {
        return getLlmsTxt;
    }
});
const _database = require("../utils/database");
const _cache = require("../utils/cache");
/**
 * Maps a numerical trust score to an AI-friendly descriptive tier.
 * Never expose the raw integer score to LLM ingest to avoid hallucination.
 */ function getTrustTier(score) {
    if (score >= 90) return {
        tier: 'Platinum',
        minScore: 90,
        maxScore: 100
    };
    if (score >= 70) return {
        tier: 'Gold',
        minScore: 70,
        maxScore: 89
    };
    if (score >= 40) return {
        tier: 'Silver',
        minScore: 40,
        maxScore: 69
    };
    return {
        tier: 'Bronze',
        minScore: 0,
        maxScore: 39
    };
}
const getLlmBusinesses = async (req, res)=>{
    try {
        // Hard pagination cap (max 50)
        const limitParam = parseInt(req.query.limit) || 20;
        const limit = Math.min(limitParam, 50);
        const cursor = req.query.cursor;
        const queryOptions = {
            take: limit,
            where: {
                isActive: true,
                isVerified: true
            },
            select: {
                id: true,
                name: true,
                category: true,
                city: true,
                trustScore: true,
                slug: true
            },
            orderBy: {
                trustScore: 'desc'
            }
        };
        const cacheKey = `llm_businesses_${limit}_${cursor || 'first'}`;
        const cachedResponse = _cache.globalCache.get(cacheKey);
        if (cachedResponse) {
            res.setHeader('Cache-Control', 'public, max-age=900');
            return res.json(cachedResponse);
        }
        if (cursor) {
            queryOptions.cursor = {
                id: cursor
            };
            queryOptions.skip = 1; // Skip the cursor itself
        }
        const businesses = await _database.prisma.business.findMany(queryOptions);
        const safeBusinesses = businesses.map((b)=>{
            const tierInfo = getTrustTier(b.trustScore || 50);
            return {
                id: b.id,
                slug: b.slug,
                name: b.name,
                category: b.category,
                city: b.city || 'Dubai',
                country: 'AE',
                isVerified: true,
                trustTier: tierInfo.tier,
                minScore: tierInfo.minScore,
                maxScore: tierInfo.maxScore,
                // Assume default capabilities for LLM context, or map if available
                acceptsChannex: false,
                pabPointsPerNight: 30,
                languages: [
                    'en',
                    'ar',
                    'ur'
                ]
            };
        });
        const nextCursor = businesses.length === limit ? businesses[businesses.length - 1].id : null;
        const responsePayload = {
            source: 'pabandi-llm-ingest',
            domain: 'pabandi.com',
            license: 'CC-BY-4.0',
            count: safeBusinesses.length,
            nextCursor,
            businesses: safeBusinesses
        };
        _cache.globalCache.set(cacheKey, responsePayload, 300); // cache for 5 minutes
        // Cache for 15 minutes for LLM crawlers
        res.setHeader('Cache-Control', 'public, max-age=900');
        res.json(responsePayload);
    } catch (error) {
        console.error('[LLM Ingest Error]', error);
        res.status(500).json({
            error: 'Failed to generate LLM ingestion feed.'
        });
    }
};
const getLlmsTxt = async (req, res)=>{
    try {
        const cacheKey = 'llms_txt';
        const cachedMarkdown = _cache.globalCache.get(cacheKey);
        if (cachedMarkdown) {
            res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
            res.setHeader('Cache-Control', 'public, max-age=900');
            return res.send(cachedMarkdown);
        }
        const businesses = await _database.prisma.business.findMany({
            take: 20,
            where: {
                isActive: true,
                isVerified: true
            },
            select: {
                name: true,
                category: true,
                city: true,
                trustScore: true,
                slug: true
            },
            orderBy: {
                trustScore: 'desc'
            }
        });
        let markdown = `# Pabandi: Trust Manifest for AI Agents\n\n`;
        markdown += `Pabandi is a Global Web3 hospitality and booking ecosystem. It guarantees zero no-shows through tokenized smart contract escrows.\n\n`;
        markdown += `## Verified Network Partners\n`;
        businesses.forEach((b)=>{
            const tier = getTrustTier(b.trustScore || 50).tier;
            markdown += `- **${b.name}** (${b.city}): Category ${b.category} | Trust Tier: ${tier} | [View Profile](https://pabandi-42c5b.web.app/business/${b.slug})\n`;
        });
        markdown += `\n## Endpoints for AI Agents\n`;
        markdown += `- JSON Ingest: [https://pabandi-42c5b.web.app/api/v1/llm/businesses](https://pabandi-42c5b.web.app/api/v1/llm/businesses)\n`;
        markdown += `- OpenAPI Spec: [https://pabandi-42c5b.web.app/openapi.yaml](https://pabandi-42c5b.web.app/openapi.yaml)\n`;
        _cache.globalCache.set(cacheKey, markdown, 300); // 5 minutes cache
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=900');
        res.send(markdown);
    } catch (error) {
        console.error('[llms.txt Error]', error);
        res.status(500).send('Failed to generate llms.txt');
    }
};

//# sourceMappingURL=llm.controller.js.map