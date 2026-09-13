import axios from 'axios';
import CourtListenerClient from './courtlistener';

/**
 * Smart Legal Research Service for mortgage decision support
 * Provides intuitive, context-aware legal research for mortgage applications
 */
class LegalResearchService {
  private courtListener: CourtListenerClient;

  constructor() {
    this.courtListener = new CourtListenerClient();
  }

  /**
   * Search legal opinions related to mortgages with smart filters
   * @param query - Search query (e.g., "mortgage interest rates", "foreclosure laws")
   * @param cluster - Optional court cluster filter (default: "United States District Courts")
   * @param jurisdiction - Optional jurisdiction filter (e.g., "Texas", "California")
   * @returns Array of relevant legal opinions with relevance scores
   */
  async searchLegalOpinions(
    query: string,
    cluster: string = 'United States District Courts',
    jurisdiction: string = null
  ): Promise<Array<any>> {
    const results = await this.courtListener.search(query);
    
    // Filter by jurisdiction if specified
    if (jurisdiction) {
      const filtered = results.filter(
        op => op.jurisdiction?.toLowerCase().includes(jurisdiction.toLowerCase()) ||
               op.title?.toLowerCase().includes(jurisdiction.toLowerCase())
      );
      return filtered;
    }
    
    // Sort by relevance (most relevant first)
    return results.sort((a, b) => 
      a.score || b.score ? b.score - a.score : 0
    );
  }

  /**
   * Get docket information for a specific mortgage case
   * @param caseId - Case identifier
   * @param cluster - Optional court cluster filter
   * @returns Docket entries with key details
   */
  async getCaseDocket(caseId: string, cluster: string = 'United States District Courts') {
    const results = await this.courtListener.getDockets(cluster, caseId);
    return results;
  }

  /**
   * Find legal precedents related to mortgage lending
   * @param keyword - Keyword for legal research
   * @returns Relevant case law with similarity scores
   */
  async findPrecedents(keyword: string): Promise<Array<any>> {
    const results = await this.courtListener.findPrecedents(keyword);
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

  /**
   * Analyze a mortgage application for legal risks
   * @param applicationId - Mortgage application ID
   * @returns Risk assessment with legal considerations
   */
  async analyzeMortgageApplication(applicationId: string): Promise<Map<string, any>> {
    // In a real implementation, this would integrate with the CRM service
    // to get application details and perform legal analysis
    
    const application = await this.courtListener.getJudges(applicationId);
    
    // Placeholder for legal risk analysis
    const risks = new Map();
    
    // Example: Check for common legal issues in mortgage applications
    if (application?.loanAmount > 500000) {
      risks.set('High Loan Amount', { severity: 'high', description: 'Large loans may have stricter regulatory requirements' });
    }
    
    if (application?.termMonths > 30) {
      risks.set('Long Term Loan', { severity: 'medium', description: 'Long-term loans may involve different legal considerations' });
    }
    
    return risks;
  }
}

export default LegalResearchService;