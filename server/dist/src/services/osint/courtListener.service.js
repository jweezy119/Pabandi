"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.courtListenerService = exports.CourtListenerService = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../../utils/logger");
class CourtListenerService {
    constructor() {
        this.cache = new Map();
    }
    // Use official API key if available, otherwise anonymous requests (which have stricter limits)
    get apiKey() {
        return process.env.COURTLISTENER_API_KEY || '';
    }
    /**
     * Search for civil litigation involving a specific name (Landlord or Tenant)
     * We filter heavily by exact name and potentially jurisdiction to reduce false positives.
     */
    async searchCivilLitigation(name, state, requireExactMatch = true) {
        const queryStr = requireExactMatch ? `"${name}"` : name;
        // Construct search query targeting dockets/opinions
        // q=name AND (nature_of_suit:eviction OR nature_of_suit:housing ...)
        const q = `${queryStr}`;
        const cacheKey = `${q}_${state || 'ALL'}`;
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < CourtListenerService.CACHE_TTL_MS)) {
            logger_1.logger.info(`[CourtListener] Cache hit for query: ${cacheKey}`);
            return cached.data;
        }
        try {
            logger_1.logger.info(`[CourtListener] Querying API for: ${cacheKey}`);
            const headers = {
                'Accept': 'application/json'
            };
            if (this.apiKey) {
                headers['Authorization'] = `Token ${this.apiKey}`;
            }
            // We use the /search/ endpoint
            const response = await axios_1.default.get('https://www.courtlistener.com/api/rest/v3/search/', {
                params: {
                    q,
                    // Limit to civil cases / real property if possible
                    // CourtListener allows filtering by court or nature_of_suit
                    type: 'd', // Dockets
                    jurisdiction: state // e.g. 'cal' for California courts
                },
                headers,
                timeout: 10000
            });
            const data = response.data;
            // Parse results
            const parsedResults = {
                count: data.count || 0,
                results: (data.results || []).slice(0, 10).map((r) => ({
                    id: r.id,
                    caseName: r.caseName || r.name || 'Unknown',
                    docketNumber: r.docketNumber || 'Unknown',
                    court: r.court || 'Unknown',
                    dateFiled: r.dateFiled || 'Unknown',
                    natureOfSuit: r.nature_of_suit || 'Unknown',
                    status: r.status || 'Unknown'
                }))
            };
            // Save to cache
            this.cache.set(cacheKey, { timestamp: Date.now(), data: parsedResults });
            return parsedResults;
        }
        catch (error) {
            logger_1.logger.error(`[CourtListener] API Error: ${error.message}`);
            if (error.response?.status === 429) {
                logger_1.logger.warn(`[CourtListener] Rate limit exceeded. Falling back to empty result.`);
            }
            return { count: 0, results: [] };
        }
    }
}
exports.CourtListenerService = CourtListenerService;
CourtListenerService.CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
exports.courtListenerService = new CourtListenerService();
//# sourceMappingURL=courtListener.service.js.map