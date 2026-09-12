// Sitara CRM - Advanced Mortgage Module
// Handles mortgage applications, underwriting, and loan servicing linked to Pabandi identity

import { StarPowerProfile, Business } from '../types/index';

// ── Core Mortgage Entities ──────────────────────────────────────────────────────

export interface MortgageApplication {
  id: string;
  businessId: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  loanAmount: number;
  interestRate: number;
  termMonths: number;
  downPaymentPercent: number;
  propertyAddress: string;
  propertyType: string;
  creditScore: number;
  employmentStatus: string;
  debtToIncomeRatio: number;
  applicationDate: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Underwriting' | 'Closed';
  notes?: string;
  
  // Property Management Fields (for business owners who also own properties)
  propertyOwnership?: {
    isOwner: boolean;
    ownedProperties: string[];
    primaryPropertyId?: string;
  };
  
  // NFT Review Verification Fields
  nftReview?: {
    isVerified: boolean;
    reviewId?: string;
    reviewScore?: number;
    verifiedBy?: string;
    nftAssetId?: string;
  };
  
  // Additional Backend Verification Variables
  businessVerification?: {
    isVerifiedBusiness: boolean;
    complianceScore?: number;
    riskLevel?: 'low' | 'medium' | 'high';
    auditTimestamp?: string;
  };
}

export interface MortgageProduct {
  id: string;
  name: string;
  type: 'FixedRate' | 'VariableRate' | 'Hybrid' | 'CashFlow' | 'Refinance';
  interestRateRange: number;
  minimumLoanAmount: number;
  maximumLoanAmount: number;
  eligibilityCriteria: string[];
}

export interface MortgageUnderwritingResult {
  applicationId: string;
  decision: 'Approved' | 'Rejected' | 'Conditional';
  conditions: string[];
  estimatedMonthlyPayment: number;
  closingTimelineDays: number;
}

export interface MortgageLoanOffer {
  id: string;
  applicationId: string;
  productId: string;
  approvedAmount: number;
  interestRate: number;
  termMonths: number;
  monthlyPayment: number;
  points: number;
  terms: string;
}

export interface MortgageServicingPlan {
  id: string;
  loanId: string;
  paymentSchedule: string;
  insuranceRequirements: string[];
  escrowDetails: {
    principalProtection: string;
    homeownersInsurance: string;
    floodInsurance?: string;
  };
}

// ── CRM Service ──────────────────────────────────────────────────────────────────

export class MortgageCRMService {
  constructor(
    private sitaraApi: any,
    private pabandiUser: any
  ) {}

  /**
   * Create a new mortgage application linked to a Pabandi user
   * Supports business owners who also own properties
   */
  async createApplication(
    data: Omit<MortgageApplication, 'id' | 'status'> & {
      businessId: string;
      applicantName: string;
      applicantEmail: string;
      applicantPhone: string;
      loanAmount: number;
      interestRate: number;
      termMonths: number;
      downPaymentPercent: number;
      propertyAddress: string;
      propertyType: string;
      creditScore: number;
      employmentStatus: string;
      debtToIncomeRatio: number;
      propertyOwnership?: {
        isOwner: boolean;
        ownedProperties: string[];
        primaryPropertyId?: string;
      };
      nftReview?: {
        isVerified: boolean;
        reviewId?: string;
        reviewScore?: number;
        verifiedBy?: string;
        nftAssetId?: string;
      };
      businessVerification?: {
        isVerifiedBusiness: boolean;
        complianceScore?: number;
        riskLevel?: 'low' | 'medium' | 'high';
        auditTimestamp?: string;
      };
    }
  ): Promise<MortgageApplication> {
    const app: MortgageApplication = {
      id: `mortgage-${Date.now()}`,
      ...data,
      status: 'Pending',
      applicationDate: new Date().toISOString(),
    };

    const result = await this.sitaraApi.createReview({
      businessId: data.businessId,
      reservationId: app.id,
      rating: 0,
      text: `New mortgage application submitted by ${data.applicantName}`,
    });

    this._updateInternalRecord(app);
    return result;
  }

  /**
   * Submit a mortgage application to the Sitara backend
   * Supports business owners who also own properties
   */
  async submitApplication(
    data: Omit<MortgageApplication, 'id' | 'status'> & {
      businessId: string;
      applicantName: string;
      applicantEmail: string;
      applicantPhone: string;
      loanAmount: number;
      interestRate: number;
      termMonths: number;
      downPaymentPercent: number;
      propertyAddress: string;
      propertyType: string;
      creditScore: number;
      employmentStatus: string;
      debtToIncomeRatio: number;
      propertyOwnership?: {
        isOwner: boolean;
        ownedProperties: string[];
        primaryPropertyId?: string;
      };
      nftReview?: {
        isVerified: boolean;
        reviewId?: string;
        reviewScore?: number;
        verifiedBy?: string;
        nftAssetId?: string;
      };
      businessVerification?: {
        isVerifiedBusiness: boolean;
        complianceScore?: number;
        riskLevel?: 'low' | 'medium' | 'high';
        auditTimestamp?: string;
      };
    }
  ): Promise<MortgageApplication> {
    const app: MortgageApplication = {
      id: `mortgage-${Date.now()}`,
      ...data,
      status: 'Submitted',
      applicationDate: new Date().toISOString(),
    };

    const result = await this.sitaraApi.createReview({
      businessId: data.businessId,
      reservationId: app.id,
      rating: 0,
      text: `Mortgage application submitted by ${data.applicantName}`,
    });

    this._updateInternalRecord(app);
    return result;
  }

  /**
   * Get mortgage application details
   */
  async getApplication(id: string): Promise<MortgageApplication | null> {
    const result = await this.sitaraApi.getReview(`/reviews/mortgage/${id}`);
    return result?.data?.data || null;
  }

  /**
   * Get all mortgage applications for a business
   */
  async getApplicationsByBusiness(businessId: string): Promise<MortgageApplication[]> {
    const result = await this.sitaraApi.getReview(`/reviews/mortgage/business/${businessId}`);
    return result?.data?.data || [];
  }

  /**
   * Get mortgage underwriting results
   */
  async getUnderwritingResults(businessId: string): Promise<MortgageUnderwritingResult[]> {
    const result = await this.sitaraApi.getReview(`/reviews/mortgage/underwriting/business/${businessId}`);
    return result?.data?.data || [];
  }

  /**
   * Generate a loan offer based on application
   */
  async generateLoanOffer(
    applicationId: string,
    productId: string,
    loanAmount: number,
    interestRate: number,
    termMonths: number
  ): Promise<MortgageLoanOffer> {
    const offer: MortgageLoanOffer = {
      id: `offer-${Date.now()}`,
      applicationId,
      productId,
      approvedAmount: loanAmount,
      interestRate,
      termMonths,
      monthlyPayment: Math.round((loanAmount * interestRate / 100) / termMonths * 100) / 100,
      points: 0,
      terms: `Fixed-rate mortgage for ${termMonths} months at ${interestRate}%`,
    };

    const result = await this.sitaraApi.createReview({
      businessId: applicationId,
      reservationId: offer.id,
      rating: 0,
      text: `Generated loan offer for ${applicationId}`,
    });

    this._updateInternalRecord(offer);
    return result;
  }

  /**
   * View servicing plans for a loan
   */
  async getServicingPlan(loanId: string): Promise<MortgageServicingPlan | null> {
    const result = await this.sitaraApi.getReview(`/reservations/servicing/${loanId}`);
    return result?.data?.data || null;
  }

  /**
   * Update mortgage application status
   */
  async updateStatus(
    applicationId: string,
    status: MortgageApplication['status']
  ): Promise<MortgageApplication> {
    const result = await this.sitaraApi.updateReview(
      `/reviews/mortgage/${applicationId}`,
      { status }
    );
    this._updateInternalRecord(result?.data?.data || {});
    return result;
  }

  /**
   * Get property ownership details for business owners
   */
  async getPropertyOwnership(businessId: string): Promise<PropertyOwnershipInfo> {
    const result = await this.sitaraApi.getReview(`/property-owners/business/${businessId}`);
    return result?.data?.data || null;
  }

  /**
   * Get NFT review verification status
   */
  async getNFTReviewStatus(businessId: string): Promise<NFTReviewStatus> {
    const result = await this.sitaraApi.getReview(`/nfts/reviews/business/${businessId}`);
    return result?.data?.data || null;
  }

  /**
   * Get business verification status
   */
  async getBusinessVerification(businessId: string): Promise<BusinessVerificationInfo> {
    const result = await this.sitaraApi.getReview(`/businesses/verification/business/${businessId}`);
    return result?.data?.data || null;
  }

  /**
   * Create a new promoter profile (simplified onboarding)
   */
  async createPromoterProfile(data: PromoterProfile) {
    const result = await this.sitaraApi.createReview({
      businessId: data.businessId,
      promotionType: data.promotionType,
      revenueEstimate: data.revenueEstimate,
      onboardingLevel: 'basic', // Simplified onboarding
      referralBonus: 0,
    });
    this._updateInternalRecord(result?.data?.data || {});
    return result;
  }

  private _updateInternalRecord(mortgage: MortgageApplication) {
    // Store in local cache for offline use
    // In a real app, this would sync with Pabandi backend
  }
}

export default MortgageCRMService;