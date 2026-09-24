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
    get apiKey() {
        return process.env.COURTLISTENER_API_KEY || '';
    }
    /**
     * Advanced search with all CourtListener API parameters.
     * Supports: court ID, jurisdiction, nature of suit, cause of action,
     * date ranges, docket number, party name, attorney name, etc.
     */
    async search(params) {
        const cacheKey = JSON.stringify(params);
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CourtListenerService.CACHE_TTL_MS) {
            logger_1.logger.info(`[CourtListener] Cache hit: ${params.q}`);
            return cached.data;
        }
        try {
            const headers = { 'Accept': 'application/json' };
            if (this.apiKey)
                headers['Authorization'] = `Token ${this.apiKey}`;
            const queryParams = {
                q: params.q,
                type: params.type || 'd', // Default to dockets
                ...(params.court && { court: params.court }),
                ...(params.jurisdiction && { jurisdiction: params.jurisdiction }),
                ...(params.nature_of_suit && { nature_of_suit: params.nature_of_suit }),
                ...(params.cause && { cause: params.cause }),
                ...(params.docket_number && { docket_number: params.docket_number }),
                ...(params.date_filed_after && { date_filed_after: params.date_filed_after }),
                ...(params.date_filed_before && { date_filed_before: params.date_filed_before }),
                ...(params.date_terminated_after && { date_terminated_after: params.date_terminated_after }),
                ...(params.date_terminated_before && { date_terminated_before: params.date_terminated_before }),
                ...(params.party_name && { party_name: params.party_name }),
                ...(params.attorney_name && { attorney_name: params.attorney_name }),
                ...(params.page && { page: params.page }),
                ...(params.page_size && { page_size: params.page_size }),
                ...(params.order_by && { order_by: params.order_by }),
                ...(params.status && { status: params.status }),
                ...(params.demand && { demand: params.demand }),
                ...(params.jury_demand && { jury_demand: params.jury_demand }),
            };
            const response = await axios_1.default.get('https://www.courtlistener.com/api/rest/v4/search/', {
                params: queryParams,
                headers,
                timeout: 15000,
            });
            const data = response.data;
            const results = {
                count: data.count || 0,
                totalPages: Math.ceil((data.count || 0) / (params.page_size || 25)),
                results: (data.results || []).slice(0, params.page_size || 25).map((r) => ({
                    id: r.docket_id || r.id,
                    caseName: r.caseName || r.case_name || 'Unknown',
                    docketNumber: r.docketNumber || 'Unknown',
                    court: r.court || 'Unknown',
                    courtType: this.inferCourtType(r.court || '', r.suitNature || r.cause || '', r.chapter),
                    dateFiled: r.dateFiled || 'Unknown',
                    dateTerminated: r.dateTerminated,
                    natureOfSuit: r.suitNature || r.cause || 'Unknown',
                    status: r.dateTerminated ? 'Terminated' : 'Active',
                    jurisdiction: params.jurisdiction || undefined,
                    cause: r.cause,
                    chapter: r.chapter,
                    party: r.party || [],
                    attorney: r.attorney || [],
                })),
            };
            this.cache.set(cacheKey, { timestamp: Date.now(), data: results });
            return results;
        }
        catch (error) {
            logger_1.logger.error(`[CourtListener] search error: ${error.message}`);
            if (error.response?.status === 429) {
                logger_1.logger.warn('[CourtListener] Rate limit exceeded');
            }
            return { count: 0, totalPages: 0, results: [] };
        }
    }
    /**
     * Infer the type of case based on court name, nature of suit, and cause.
     */
    inferCourtType(court, natureOfSuit, chapter) {
        const criminalIndicators = /criminal|felony|misdemeanor|assault|theft|robbery|murder|drug|dui|weapon|fraud|sexual|violent|prosecution|penal code|state v\.|people v\.|u\.s\. v\.|united states v\./i;
        const civilIndicators = /civil|eviction|unlawful|detainer|landlord|tenant|rent|foreclos|housing|contract|personal injury|tort|negligence|discrimination/i;
        const bankruptcyIndicators = /bankruptcy|chapter 7|chapter 11|chapter 13|insolvency/i;
        const familyIndicators = /family|divorce|custody|child support|alimony|domestic relations|juvenile/i;
        if (criminalIndicators.test(natureOfSuit) || criminalIndicators.test(court))
            return 'CRIMINAL';
        if (civilIndicators.test(natureOfSuit) || civilIndicators.test(court))
            return 'CIVIL';
        if (chapter || bankruptcyIndicators.test(natureOfSuit))
            return 'BANKRUPTCY';
        if (familyIndicators.test(natureOfSuit))
            return 'FAMILY';
        return 'OTHER';
    }
    /**
     * Generate common name variations for better matching.
     * Handles: nicknames, middle initials, spelling variations, etc.
     */
    generateNameVariations(name) {
        const trimmed = name.trim();
        const parts = trimmed.split(/\s+/).filter(Boolean);
        if (parts.length === 0)
            return [trimmed];
        if (parts.length === 1)
            return [trimmed];
        const firstName = parts[0];
        const lastName = parts[parts.length - 1];
        const middleParts = parts.slice(1, -1);
        const variations = [trimmed];
        if (middleParts.length > 0) {
            variations.push(`${firstName} ${lastName}`);
            const middleInitial = middleParts[0][0];
            variations.push(`${firstName} ${middleInitial} ${lastName}`);
            variations.push(`${firstName} ${middleInitial}. ${lastName}`);
        }
        const spellingVariations = {
            'hussain': ['hussain', 'hussein', 'husein'],
            'hussein': ['hussein', 'hussain', 'husein'],
            'mohammed': ['mohammed', 'muhammad', 'mohamed'],
            'muhammad': ['muhammad', 'mohammed', 'mohamed'],
            'ahmed': ['ahmed', 'ahmad'],
            'ahmad': ['ahmad', 'ahmed'],
            'hassan': ['hassan', 'hasan'],
            'syed': ['syed', 'sayed', 'sayyed'],
            'sayed': ['sayed', 'syed', 'sayyed'],
            'javed': ['javed', 'jawed'],
            'rashid': ['rashid', 'rasheed'],
            'akhtar': ['akhtar', 'akhter'],
            'riaz': ['riaz', 'riyaz'],
            'naveed': ['naveed', 'naved', 'navid'],
            'waqar': ['waqar', 'waqarr'],
            'tariq': ['tariq', 'tareq', 'tarik'],
            'faisal': ['faisal', 'faysal'],
            'bilal': ['bilal', 'bilaal'],
            'umar': ['umar', 'omer'],
            'usman': ['usman', 'osman'],
            'iqbal': ['iqbal', 'iqbaal'],
        };
        const firstNameLower = firstName.toLowerCase();
        const lastNameLower = lastName.toLowerCase();
        const firstNameSpellings = spellingVariations[firstNameLower] || [firstNameLower];
        const lastNameSpellings = spellingVariations[lastNameLower] || [lastNameLower];
        for (const fn of firstNameSpellings) {
            for (const ln of lastNameSpellings) {
                const variant = `${fn} ${ln}`;
                if (!variations.includes(variant))
                    variations.push(variant);
            }
        }
        return variations;
    }
    /**
     * Comprehensive court check — criminal + civil + eviction.
     * Returns a unified risk verdict the trust engine can penalize on.
     */
    async comprehensiveCheck(name, options) {
        // Try the exact name first, then common variations
        const nameVariations = this.generateNameVariations(name);
        let allCases = [];
        let totalCount = 0;
        for (const nameVariant of nameVariations) {
            const searchResult = await this.search({
                q: `"${nameVariant}"`,
                jurisdiction: options?.state,
                court: options?.court,
                date_filed_after: options?.dateFiledAfter,
                date_filed_before: options?.dateFiledBefore,
                docket_number: options?.docketNumber,
                page_size: 50,
                order_by: 'score',
            });
            totalCount += searchResult.count;
            allCases = allCases.concat(searchResult.results);
            // If we found results with this variation, no need to try others
            if (searchResult.results.length > 0)
                break;
        }
        // Deduplicate by docket_id
        const seen = new Set();
        allCases = allCases.filter(c => {
            if (seen.has(c.id))
                return false;
            seen.add(c.id);
            return true;
        });
        // Categorize cases
        const criminalCases = allCases.filter(c => c.courtType === 'CRIMINAL');
        const civilCases = allCases.filter(c => c.courtType === 'CIVIL');
        const evictionCases = civilCases.filter(c => /evict|unlawful detainer|landlord|tenant|rent|foreclos/i.test(c.natureOfSuit + c.caseName));
        // Bankruptcy
        const bankruptcyCases = allCases.filter(c => c.courtType === 'BANKRUPTCY');
        const violentCrime = criminalCases.some(c => /assault|battery|murder|manslaughter|robbery|kidnap|sexual|weapon|violent|homicide|rape/i.test(c.natureOfSuit + c.caseName));
        const financialCrime = criminalCases.some(c => /fraud|embezzlement|theft|larceny|forgery|counterfeit|money laundering|tax evasion|wire fraud|securities fraud/i.test(c.natureOfSuit + c.caseName));
        const drugOffense = criminalCases.some(c => /drug|narcotic|marijuana|cocaine|methamphetamine|controlled substance|possession with intent/i.test(c.natureOfSuit + c.caseName));
        const sexOffense = criminalCases.some(c => /sexual abuse|rape|molestation|indecent exposure|pornography|sex offender/i.test(c.natureOfSuit + c.caseName));
        const dui = criminalCases.some(c => /dui|dwi|driving under the influence|intoxicated|impaired driving/i.test(c.natureOfSuit + c.caseName));
        const felonyCount = criminalCases.filter(c => /felony|class [a-e]|first degree|second degree|indictment/i.test(c.natureOfSuit + c.caseName)).length;
        // Recency (within last 3 years)
        const now = new Date().getFullYear();
        const recentCriminal = criminalCases.some(c => {
            const yr = parseInt((c.dateFiled || '').slice(0, 4), 10);
            return !Number.isNaN(yr) && now - yr <= 3;
        });
        const recentEviction = evictionCases.some(c => {
            const yr = parseInt((c.dateFiled || '').slice(0, 4), 10);
            return !Number.isNaN(yr) && now - yr <= 3;
        });
        // Risk factors
        const riskFactors = [];
        if (violentCrime)
            riskFactors.push('Violent criminal history');
        if (financialCrime)
            riskFactors.push('Financial crime (fraud/theft)');
        if (drugOffense)
            riskFactors.push('Drug-related offense');
        if (sexOffense)
            riskFactors.push('Sex offense');
        if (dui)
            riskFactors.push('DUI/DWI conviction');
        if (felonyCount > 0)
            riskFactors.push(`${felonyCount} felony charge(s)`);
        if (recentCriminal)
            riskFactors.push('Recent criminal activity (within 3 years)');
        if (recentEviction)
            riskFactors.push('Recent eviction (within 3 years)');
        if (evictionCases.length > 2)
            riskFactors.push(`${evictionCases.length} total evictions`);
        if (criminalCases.length > 3)
            riskFactors.push(`Extensive criminal record (${criminalCases.length} cases)`);
        if (bankruptcyCases.length > 0)
            riskFactors.push(`${bankruptcyCases.length} bankruptcy filing(s)`);
        // Risk band
        let riskBand = 'LOW';
        if (violentCrime || sexOffense || financialCrime || (felonyCount > 0 && recentCriminal)) {
            riskBand = 'HIGH';
        }
        else if (criminalCases.length > 0 || evictionCases.length > 1 || recentEviction) {
            riskBand = 'MEDIUM';
        }
        return {
            criminalFound: criminalCases.length > 0,
            criminalCount: criminalCases.length,
            recentCriminal,
            felonyCount,
            violentCrime,
            financialCrime,
            drugOffense,
            sexOffense,
            dui,
            evictionFound: evictionCases.length > 0,
            evictionCount: evictionCases.length,
            recentEviction,
            civilCases: civilCases.length,
            bankruptcyFound: bankruptcyCases.length > 0,
            bankruptcyCount: bankruptcyCases.length,
            totalCases: allCases.length,
            riskBand,
            riskFactors,
            cases: allCases,
        };
    }
    /**
     * Legacy: Targeted eviction / housing-litigation lookup (kept for backward compat).
     */
    async lookupEvictions(name, state) {
        const res = await this.search({
            q: `"${name}"`,
            jurisdiction: state,
            page_size: 25,
        });
        const EVICT_RE = /evict|unlawful detainer|landlord|tenant|rent|foreclos|housing/i;
        const evictionCases = res.results.filter((r) => EVICT_RE.test(r.natureOfSuit || '') || EVICT_RE.test(r.caseName || ''));
        const recentEviction = evictionCases.some((r) => {
            const yr = parseInt((r.dateFiled || '').slice(0, 4), 10);
            return !Number.isNaN(yr) && new Date().getFullYear() - yr <= 3;
        });
        return {
            found: evictionCases.length > 0,
            count: evictionCases.length,
            recentEviction,
            cases: evictionCases,
        };
    }
}
exports.CourtListenerService = CourtListenerService;
CourtListenerService.CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
exports.courtListenerService = new CourtListenerService();
//# sourceMappingURL=courtListener.service.js.map