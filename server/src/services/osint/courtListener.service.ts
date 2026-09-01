import axios from 'axios';
import { logger } from '../../utils/logger';

export interface CourtListenerCase {
  id: number;
  caseName: string;
  docketNumber: string;
  court: string;
  courtType?: string; // CRIMINAL, CIVIL, BANKRUPTCY, etc.
  dateFiled: string;
  natureOfSuit: string;
  status: string;
  jurisdiction?: string;
}

export interface CourtListenerSearchResult {
  count: number;
  totalPages: number;
  results: CourtListenerCase[];
}

export interface CourtCheckResult {
  // Criminal
  criminalFound: boolean;
  criminalCount: number;
  recentCriminal: boolean;
  felonyCount: number;
  violentCrime: boolean;
  financialCrime: boolean;
  // Civil / Eviction
  evictionFound: boolean;
  evictionCount: number;
  recentEviction: boolean;
  civilCases: number;
  // Combined
  totalCases: number;
  riskBand: 'LOW' | 'MEDIUM' | 'HIGH';
  riskFactors: string[];
  cases: CourtListenerCase[];
}

export class CourtListenerService {
  private static CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
  private cache = new Map<string, { timestamp: number; data: any }>();

  private get apiKey() {
    return process.env.COURTLISTENER_API_KEY || '';
  }

  /**
   * Search all docket types (criminal, civil, bankruptcy) by name.
   * Uses CourtListener's /search/ endpoint with type='d' for dockets.
   */
  public async searchAllDockets(
    name: string,
    state?: string,
    page = 1,
    perPage = 25
  ): Promise<CourtListenerSearchResult> {
    const queryStr = `"${name}"`;
    const cacheKey = `all_${queryStr}_${state || 'ALL'}_${page}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CourtListenerService.CACHE_TTL_MS) {
      logger.info(`[CourtListener] Cache hit: ${cacheKey}`);
      return cached.data;
    }

    try {
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (this.apiKey) headers['Authorization'] = `Token ${this.apiKey}`;

      const response = await axios.get('https://www.courtlistener.com/api/rest/v3/search/', {
        params: {
          q: queryStr,
          type: 'd', // Dockets
          jurisdiction: state,
          page,
          page_size: perPage,
        },
        headers,
        timeout: 15000,
      });

      const data = response.data;
      const results: CourtListenerSearchResult = {
        count: data.count || 0,
        totalPages: Math.ceil((data.count || 0) / perPage),
        results: (data.results || []).slice(0, perPage).map((r: any) => ({
          id: r.id,
          caseName: r.caseName || r.name || 'Unknown',
          docketNumber: r.docketNumber || 'Unknown',
          court: r.court || 'Unknown',
          courtType: this.inferCourtType(r.court || '', r.nature_of_suit || ''),
          dateFiled: r.dateFiled || 'Unknown',
          natureOfSuit: r.nature_of_suit || 'Unknown',
          status: r.status || 'Unknown',
          jurisdiction: state || undefined,
        })),
      };

      this.cache.set(cacheKey, { timestamp: Date.now(), data: results });
      return results;
    } catch (error: any) {
      logger.error(`[CourtListener] searchAllDockets error: ${error.message}`);
      if (error.response?.status === 429) {
        logger.warn('[CourtListener] Rate limit exceeded');
      }
      return { count: 0, totalPages: 0, results: [] };
    }
  }

  /**
   * Infer the type of case based on court name and nature of suit.
   */
  private inferCourtType(court: string, natureOfSuit: string): string {
    const criminalIndicators = /criminal|felony|misdemeanor|assault|theft|robbery|murder|drug|dui|weapon|fraud|sexual|violent/i;
    const civilIndicators = /civil|eviction|unlawful|detainer|landlord|tenant|rent|foreclos|housing|contract|personal injury|tort/i;
    const bankruptcyIndicators = /bankruptcy|chapter 7|chapter 11|chapter 13/i;

    if (criminalIndicators.test(natureOfSuit) || criminalIndicators.test(court)) return 'CRIMINAL';
    if (civilIndicators.test(natureOfSuit) || civilIndicators.test(court)) return 'CIVIL';
    if (bankruptcyIndicators.test(natureOfSuit)) return 'BANKRUPTCY';
    return 'OTHER';
  }

  /**
   * Comprehensive court check — criminal + civil/eviction.
   * Returns a unified risk verdict the trust engine can penalize on.
   */
  public async comprehensiveCheck(name: string, state?: string): Promise<CourtCheckResult> {
    const searchResult = await this.searchAllDockets(name, state, 1, 50);
    const allCases = searchResult.results;

    // Categorize cases
    const criminalCases = allCases.filter(c => c.courtType === 'CRIMINAL');
    const civilCases = allCases.filter(c => c.courtType === 'CIVIL');
    const evictionCases = civilCases.filter(c =>
      /evict|unlawful detainer|landlord|tenant|rent|foreclos/i.test(c.natureOfSuit + c.caseName)
    );

    // Criminal risk signals
    const violentCrime = criminalCases.some(c =>
      /assault|battery|murder|manslaughter|robbery|kidnap|sexual|weapon|violent/i.test(c.natureOfSuit + c.caseName)
    );
    const financialCrime = criminalCases.some(c =>
      /fraud|embezzlement|theft|larceny|forgery|counterfeit|money laundering|tax evasion/i.test(c.natureOfSuit + c.caseName)
    );
    const felonyCount = criminalCases.filter(c =>
      /felony|class [a-e]|first degree|second degree/i.test(c.natureOfSuit + c.caseName)
    ).length;

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
    const riskFactors: string[] = [];
    if (violentCrime) riskFactors.push('Violent criminal history');
    if (financialCrime) riskFactors.push('Financial crime (fraud/theft)');
    if (felonyCount > 0) riskFactors.push(`${felonyCount} felony charge(s)`);
    if (recentCriminal) riskFactors.push('Recent criminal activity (within 3 years)');
    if (recentEviction) riskFactors.push('Recent eviction (within 3 years)');
    if (evictionCases.length > 2) riskFactors.push(`${evictionCases.length} total evictions`);
    if (criminalCases.length > 3) riskFactors.push(`Extensive criminal record (${criminalCases.length} cases)`);

    // Risk band
    let riskBand: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (violentCrime || financialCrime || (felonyCount > 0 && recentCriminal)) {
      riskBand = 'HIGH';
    } else if (criminalCases.length > 0 || evictionCases.length > 1 || recentEviction) {
      riskBand = 'MEDIUM';
    }

    return {
      criminalFound: criminalCases.length > 0,
      criminalCount: criminalCases.length,
      recentCriminal,
      felonyCount,
      violentCrime,
      financialCrime,
      evictionFound: evictionCases.length > 0,
      evictionCount: evictionCases.length,
      recentEviction,
      civilCases: civilCases.length,
      totalCases: allCases.length,
      riskBand,
      riskFactors,
      cases: allCases,
    };
  }

  /**
   * Legacy: Targeted eviction / housing-litigation lookup (kept for backward compat).
   */
  public async lookupEvictions(
    name: string,
    state?: string
  ): Promise<{ found: boolean; count: number; recentEviction: boolean; cases: CourtListenerCase[] }> {
    const res = await this.searchAllDockets(name, state, 1, 25);
    const EVICT_RE = /evict|unlawful detainer|landlord|tenant|rent|foreclos|housing/i;
    const evictionCases = res.results.filter(
      (r) => EVICT_RE.test(r.natureOfSuit || '') || EVICT_RE.test(r.caseName || '')
    );
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

export const courtListenerService = new CourtListenerService();
