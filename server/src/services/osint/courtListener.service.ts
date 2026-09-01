import axios from 'axios';
import { logger } from '../../utils/logger';

export interface CourtListenerCase {
  id: number;
  caseName: string;
  docketNumber: string;
  court: string;
  courtType?: string;
  dateFiled: string;
  dateTerminated?: string;
  natureOfSuit: string;
  status: string;
  jurisdiction?: string;
  cause?: string;
  juryDemand?: string;
  demand?: string;
}

export interface CourtListenerSearchResult {
  count: number;
  totalPages: number;
  results: CourtListenerCase[];
}

export interface CourtCheckResult {
  criminalFound: boolean;
  criminalCount: number;
  recentCriminal: boolean;
  felonyCount: number;
  violentCrime: boolean;
  financialCrime: boolean;
  drugOffense: boolean;
  sexOffense: boolean;
  dui: boolean;
  evictionFound: boolean;
  evictionCount: number;
  recentEviction: boolean;
  civilCases: number;
  totalCases: number;
  riskBand: 'LOW' | 'MEDIUM' | 'HIGH';
  riskFactors: string[];
  cases: CourtListenerCase[];
}

export interface CourtListenerSearchParams {
  // Basic search
  q: string;                          // Query string (name, keywords)
  name?: string;                      // Party name
  // Jurisdiction & court
  court?: string;                     // Court ID (e.g., 'ill' for Illinois Supreme Court)
  jurisdiction?: string;              // State abbreviation (e.g., 'ill', 'cal', 'ny')
  // Case type
  type?: string;                      // 'd' = dockets, 'o' = opinions, 'p' = people, 'a' = audio
  nature_of_suit?: string;            // Nature of suit code (e.g., '190' for contract, '362' for personal injury)
  cause?: string;                     // Cause of action (e.g., 'civil rights', 'negligence')
  // Docket filters
  docket_number?: string;             // Specific docket number
  date_filed_after?: string;          // YYYY-MM-DD
  date_filed_before?: string;         // YYYY-MM-DD
  date_terminated_after?: string;     // YYYY-MM-DD
  date_terminated_before?: string;    // YYYY-MM-DD
  // Party info
  party_name?: string;                // Filter by party name
  attorney_name?: string;             // Filter by attorney name
  // Pagination
  page?: number;
  page_size?: number;
  // Sorting
  order_by?: string;                  // 'score' (relevance), 'dateFiled', 'dateArgued'
  // Status
  status?: string;                    // Case status filter
  // Financial
  demand?: string;                    // Damages demand amount
  jury_demand?: string;               // Jury demand type
  // Bankruptcy
  bankruptcy_information?: boolean;
}

export class CourtListenerService {
  private static CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
  private cache = new Map<string, { timestamp: number; data: any }>();

  private get apiKey() {
    return process.env.COURTLISTENER_API_KEY || '';
  }

  /**
   * Advanced search with all CourtListener API parameters.
   * Supports: court ID, jurisdiction, nature of suit, cause of action,
   * date ranges, docket number, party name, attorney name, etc.
   */
  public async search(params: CourtListenerSearchParams): Promise<CourtListenerSearchResult> {
    const cacheKey = JSON.stringify(params);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CourtListenerService.CACHE_TTL_MS) {
      logger.info(`[CourtListener] Cache hit: ${params.q}`);
      return cached.data;
    }

    try {
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (this.apiKey) headers['Authorization'] = `Token ${this.apiKey}`;

      const queryParams: Record<string, any> = {
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

      const response = await axios.get('https://www.courtlistener.com/api/rest/v3/search/', {
        params: queryParams,
        headers,
        timeout: 15000,
      });

      const data = response.data;
      const results: CourtListenerSearchResult = {
        count: data.count || 0,
        totalPages: Math.ceil((data.count || 0) / (params.page_size || 25)),
        results: (data.results || []).slice(0, params.page_size || 25).map((r: any) => ({
          id: r.id,
          caseName: r.caseName || r.name || 'Unknown',
          docketNumber: r.docketNumber || 'Unknown',
          court: r.court || 'Unknown',
          courtType: this.inferCourtType(r.court || '', r.nature_of_suit || ''),
          dateFiled: r.dateFiled || 'Unknown',
          dateTerminated: r.dateTerminated,
          natureOfSuit: r.nature_of_suit || 'Unknown',
          status: r.status || 'Unknown',
          jurisdiction: params.jurisdiction || undefined,
          cause: r.cause,
          juryDemand: r.jury_demand,
          demand: r.demand,
        })),
      };

      this.cache.set(cacheKey, { timestamp: Date.now(), data: results });
      return results;
    } catch (error: any) {
      logger.error(`[CourtListener] search error: ${error.message}`);
      if (error.response?.status === 429) {
        logger.warn('[CourtListener] Rate limit exceeded');
      }
      return { count: 0, totalPages: 0, results: [] };
    }
  }

  /**
   * Infer the type of case based on court name, nature of suit, and cause.
   */
  private inferCourtType(court: string, natureOfSuit: string): string {
    const criminalIndicators = /criminal|felony|misdemeanor|assault|theft|robbery|murder|drug|dui|weapon|fraud|sexual|violent|prosecution|penal code|state v\.|people v\.|u\.s\. v\.|united states v\./i;
    const civilIndicators = /civil|eviction|unlawful|detainer|landlord|tenant|rent|foreclos|housing|contract|personal injury|tort|negligence|discrimination/i;
    const bankruptcyIndicators = /bankruptcy|chapter 7|chapter 11|chapter 13|insolvency/i;
    const familyIndicators = /family|divorce|custody|child support|alimony|domestic relations|juvenile/i;

    if (criminalIndicators.test(natureOfSuit) || criminalIndicators.test(court)) return 'CRIMINAL';
    if (civilIndicators.test(natureOfSuit) || civilIndicators.test(court)) return 'CIVIL';
    if (bankruptcyIndicators.test(natureOfSuit)) return 'BANKRUPTCY';
    if (familyIndicators.test(natureOfSuit)) return 'FAMILY';
    return 'OTHER';
  }

  /**
   * Comprehensive court check — criminal + civil + eviction.
   * Returns a unified risk verdict the trust engine can penalize on.
   */
  public async comprehensiveCheck(
    name: string,
    options?: {
      state?: string;
      court?: string;
      dateFiledAfter?: string;
      dateFiledBefore?: string;
      docketNumber?: string;
    }
  ): Promise<CourtCheckResult> {
    const searchResult = await this.search({
      q: `"${name}"`,
      jurisdiction: options?.state,
      court: options?.court,
      date_filed_after: options?.dateFiledAfter,
      date_filed_before: options?.dateFiledBefore,
      docket_number: options?.docketNumber,
      page_size: 50,
      order_by: 'score',
    });
    const allCases = searchResult.results;

    // Categorize cases
    const criminalCases = allCases.filter(c => c.courtType === 'CRIMINAL');
    const civilCases = allCases.filter(c => c.courtType === 'CIVIL');
    const evictionCases = civilCases.filter(c =>
      /evict|unlawful detainer|landlord|tenant|rent|foreclos/i.test(c.natureOfSuit + c.caseName)
    );

    // Criminal risk signals
    const violentCrime = criminalCases.some(c =>
      /assault|battery|murder|manslaughter|robbery|kidnap|sexual|weapon|violent|homicide|rape/i.test(c.natureOfSuit + c.caseName)
    );
    const financialCrime = criminalCases.some(c =>
      /fraud|embezzlement|theft|larceny|forgery|counterfeit|money laundering|tax evasion|wire fraud|securities fraud/i.test(c.natureOfSuit + c.caseName)
    );
    const drugOffense = criminalCases.some(c =>
      /drug|narcotic|marijuana|cocaine|methamphetamine|controlled substance|possession with intent/i.test(c.natureOfSuit + c.caseName)
    );
    const sexOffense = criminalCases.some(c =>
      /sexual abuse|rape|molestation|indecent exposure|pornography|sex offender/i.test(c.natureOfSuit + c.caseName)
    );
    const dui = criminalCases.some(c =>
      /dui|dwi|driving under the influence|intoxicated|impaired driving/i.test(c.natureOfSuit + c.caseName)
    );
    const felonyCount = criminalCases.filter(c =>
      /felony|class [a-e]|first degree|second degree|indictment/i.test(c.natureOfSuit + c.caseName)
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
    if (drugOffense) riskFactors.push('Drug-related offense');
    if (sexOffense) riskFactors.push('Sex offense');
    if (dui) riskFactors.push('DUI/DWI conviction');
    if (felonyCount > 0) riskFactors.push(`${felonyCount} felony charge(s)`);
    if (recentCriminal) riskFactors.push('Recent criminal activity (within 3 years)');
    if (recentEviction) riskFactors.push('Recent eviction (within 3 years)');
    if (evictionCases.length > 2) riskFactors.push(`${evictionCases.length} total evictions`);
    if (criminalCases.length > 3) riskFactors.push(`Extensive criminal record (${criminalCases.length} cases)`);

    // Risk band
    let riskBand: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (violentCrime || sexOffense || financialCrime || (felonyCount > 0 && recentCriminal)) {
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
      drugOffense,
      sexOffense,
      dui,
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
    const res = await this.search({
      q: `"${name}"`,
      jurisdiction: state,
      page_size: 25,
    });
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
