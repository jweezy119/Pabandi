import { LegalResearchService } from './legalResearch';
import { MortgageApplication } from './applications';

/**
 * Mortgage Decision Dashboard Service
 * Provides a unified dashboard for mortgage decision-making with legal insights
 */
class MortgageDecisionDashboardService {
  private legalResearchService: LegalResearchService;
  private applications: Map<string, MortgageApplication>;

  constructor() {
    this.legalResearchService = new LegalResearchService();
    this.applications = new Map();
  }

  /**
   * Initialize the dashboard with sample applications
   */
  init() {
    // Sample applications for demonstration
    this.applications.set('app-001', {
      id: 'app-001',
      applicant: 'John Doe',
      loanAmount: 350000,
      termMonths: 360,
      interestRate: 4.25,
      status: 'under_review',
      legalRiskScore: 3.2
    });

    this.applications.set('app-002', {
      id: 'app-002',
      applicant: 'Jane Smith',
      loanAmount: 450000,
      termMonths: 240,
      interestRate: 5.10,
      status: 'pending',
      legalRiskScore: 5.8
    });
  }

  /**
   * Get dashboard overview with key metrics
   * @returns Summary of mortgage applications and legal insights
   */
  async getDashboardOverview(): Promise<Object> {
    const apps = Array.from(this.applications.values());
    const highRiskCount = apps.filter(a => a.legalRiskScore >= 4).length;
    const approvedCount = apps.filter(a => a.status === 'approved').length;
    const underReviewCount = apps.filter(a => a.status === 'under_review').length;

    return {
      totalApplications: apps.length,
      highRiskApplications: highRiskCount,
      approvedApplications: approvedCount,
      underReviewApplications: underReviewCount,
      averageLegalRisk: apps.reduce((sum, app) => sum + app.legalRiskScore, 0) / apps.length,
      topRiskyApps: apps
        .sort((a, b) => b.legalRiskScore - a.legalRiskScore)
        .slice(0, 3)
    };
  }

  /**
   * Get legal recommendations for a specific application
   * @param applicationId - Application ID
   * @returns Detailed legal recommendations
   */
  async getLegalRecommendations(applicationId: string): Promise<Array<any>> {
    const app = this.applications.get(applicationId);
    if (!app) {
      throw new Error(`Application ${applicationId} not found`);
    }

    // Get legal risk analysis
    const analysis = await this.legalResearchService.analyzeMortgageApplication(applicationId);

    // Generate tailored recommendations
    const recommendations = [
      {
        id: 'risk_assessment',
        priority: analysis.size > 0 ? 'high' : 'low',
        findings: analysis.entries.map(([key, value]) => ({
          id: key,
          severity: value.severity,
          description: value.description
        }))
      },
      {
        id: 'compliance_check',
        priority: analysis.size > 0 ? 'medium' : 'low',
        findings: [
          analysis.hasOwnProperty('High Loan Amount') && analysis['High Loan Amount'].severity === 'high'
            ? { severity: 'high', description: 'Loan amount exceeds typical thresholds' }
            : null,
          analysis.hasOwnProperty('Long Term Loan') && analysis['Long Term Loan'].severity === 'medium'
            ? { severity: 'medium', description: 'Extended terms may require special compliance' }
            : null
        ]
      }
    ];

    return recommendations;
  }

  /**
   * Get legal research for a specific application
   * @param applicationId - Application ID
   * @returns Legal research results
   */
  async getLegalResearch(applicationId: string): Promise<Array<any>> {
    const app = this.applications.get(applicationId);
    if (!app) {
      throw new Error(`Application ${applicationId} not found`);
    }

    // Search for legal opinions related to the application
    const queries = [
      `mortgage ${app.loanAmount} rate`,
      `foreclosure ${app.termMonths}`,
      `loan modification ${app.applicant}`
    ];

    const results = [];
    for (const query of queries) {
      const findings = await this.legalResearchService.searchLegalOpinions(query, 'United States District Courts');
      results.push({ query, findings });
    }

    return results;
  }

  /**
   * Get case docket information for a mortgage application
   * @param applicationId - Application ID
   * @returns Docket entries
   */
  async getCaseDocket(applicationId: string): Promise<Array<any>> {
    const app = this.applications.get(applicationId);
    if (!app) {
      throw new Error(`Application ${applicationId} not found`);
    }

    const docket = await this.legalResearchService.getCaseDocket(app.id);
    return docket;
  }

  /**
   * Update application status
   * @param applicationId - Application ID
   * @param status - New status (e.g., 'approved', 'rejected', 'under_review')
   * @returns Updated application
   */
  async updateApplicationStatus(applicationId: string, status: string): Promise<MortgageApplication> {
    const app = this.applications.get(applicationId);
    if (!app) {
      throw new Error(`Application ${applicationId} not found`);
    }

    app.status = status;
    return app;
  }

  /**
   * Get all applications with legal risk scores
   * @returns Array of applications with risk assessments
   */
  async getAllWithRiskScores(): Promise<Array<any>> {
    return Array.from(this.applications.values()).map(app => ({
      ...app,
      legalRiskScore: app.legalRiskScore || 0
    }));
  }
}

export default MortgageDecisionDashboardService;