export interface MortgageApplication {
  id: string;
  applicant: string;
  loanAmount: number;
  termMonths: number;
  interestRate: number;
  status: string;
  legalRiskScore?: number;
}

export interface LegalRiskAssessment {
  id: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface LegalRecommendation {
  id: string;
  priority: 'low' | 'medium' | 'high';
  findings: LegalRiskAssessment[];
}

export interface DocketEntry {
  caseId: string;
  date: string;
  action: string;
  status: string;
}

export interface DashboardMetrics {
  totalApplications: number;
  highRiskApplications: number;
  approvedApplications: number;
  underReviewApplications: number;
  averageLegalRisk: number;
  topRiskyApps: Array<{
    id: string;
    riskScore: number;
    description: string;
  }>;
}
