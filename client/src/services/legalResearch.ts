import axios from 'axios';
import CourtListenerClient from './courtlistener';

/**
 * Legal Research Service for mortgage decision support
 * Integrates CourtListener API to provide legal context for mortgage decisions
 */
class LegalResearchService {
  private courtListener: CourtListenerClient;

  constructor() {
    this.courtListener = new CourtListenerClient();
  }

  /**
   * Search legal opinions related to mortgages
   * @param query - Search query (e.g., "mortgage interest rates", "mortgage foreclosure laws")
   * @param cluster - Court cluster (e.g., "United States District Courts")
   * @returns Array of relevant legal opinions
   */
  async searchLegalOpinions(query: string, cluster: string = 'United States District Courts') {
    const results = await this.courtListener.search(query);
    return results;
  }

  /**
   * Get docket information for a specific case
   * @param caseId - Case identifier
   * @param cluster - Court cluster
   * @returns Docket entries
   */
  async getCaseDocket(caseId: string, cluster: string = 'United States District Courts') {
    const results = await this.courtListener.getDockets(cluster, caseId);
    return results;
  }

  /**
   * Get judicial information for a court
   * @param court - Court name
   * @returns Judicial information
   */
  async getJudicialInformation(court: string) {
    const results = await this.courtListener.getJudges(court);
    return results;
  }

  /**
   * Find legal precedents related to mortgage lending
   * @param keyword - Keyword for legal research
   * @returns Relevant case law
   */
  async findPrecedents(keyword: string) {
    const results = await this.courtListener.search(keyword);
    return results;
  }

  /**
   * Get legal alerts for mortgage-related topics
   * @param topic - Topic of interest (e.g., "mortgage", "foreclosure", "loan modification")
   * @returns Recent legal developments
   */
  async getLegalAlerts(topic: string) {
    const results = await this.courtListener.search(topics: topic);
    return results;
  }
}

export default LegalResearchService;