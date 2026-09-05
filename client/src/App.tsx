import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import AuthPage from './pages/AuthPage';
import { RegisterPage } from './pages/RegisterPage';
import { OnboardingPage } from './pages/OnboardingPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import OAuthConsentPage from './pages/OAuthConsentPage';
import ReservationsPage from './pages/ReservationsPage';
import NewReservationPage from './pages/NewReservationPage';
import { CheckoutSessionPage } from './pages/CheckoutSessionPage';
import CheckoutSuccessPage from './pages/CheckoutSuccessPage';
import CheckoutCancelPage from './pages/CheckoutCancelPage';
import BookingPage from './pages/BookingPage';
import BookingExperience from './pages/BookingExperience';
import BookingOS from './pages/BookingOS';
import NightlifePage from './pages/NightlifePage';
import PromoterOS from './pages/PromoterOS';
import AgentControlPanel from './pages/AgentControlPanel';
import ShortLinkBookingPage from './pages/ShortLinkBookingPage';
import TapPayPage from './pages/TapPayPage';
import UniversalCheckoutPage from './pages/UniversalCheckoutPage';
import { DemoCheckoutPage } from './pages/DemoCheckoutPage';
import BusinessProfilePage from './pages/BusinessProfilePage';
import BusinessCrmPage from './pages/BusinessCrmPage';
import BusinessJoinPage from './pages/BusinessJoinPage';
import BusinessActivationPage from './pages/BusinessActivationPage';
import BusinessModelPage from './pages/BusinessModelPage';
import TechnologyPage from './pages/TechnologyPage';
import ContactPage from './pages/ContactPage';
import BusinessSettingsPage from './pages/BusinessSettingsPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ProfilesPage from './pages/ProfilesPage';
import ProfileDetailPage from './pages/ProfileDetailPage';
import EconomyDashboardPage from './pages/EconomyDashboardPage';
import { ReferAndEarnPage } from './pages/ReferAndEarnPage';
import { VerifierSandboxPage } from './pages/VerifierSandboxPage';
import DietaryPassportPage from './pages/DietaryPassportPage';
import DeveloperPortalPage from './pages/DeveloperPortalPage';
import { TrustPulsePage } from './pages/TrustPulsePage';
import { CommunityJuryPage } from './pages/CommunityJuryPage';
import { WaitlistPage } from './pages/WaitlistPage';
import { ReferralLandingPage } from './pages/ReferralLandingPage';
import MarketplacePartnerPage from './pages/MarketplacePartnerPage';
import SalePage from './pages/SalePage';
import CRMPage from './pages/CRMPage';
import { TenantWorkflowPage } from './pages/TenantWorkflowPage';
import { AIAssistantPage } from './pages/AIAssistantPage';
import { AITenantRiskPage } from './pages/AITenantRiskPage';
import { AILeaseAnomalyPage } from './pages/AILeaseAnomalyPage';
import { AIRentOptimizerPage } from './pages/AIRentOptimizerPage';
import PropertyDetailPage from './pages/PropertyDetailPage';
import TenantPortalPage from './pages/TenantPortalPage';
import TenantDashboardPage from './pages/TenantDashboardPage';
import DisputeCenterPage from './pages/DisputeCenterPage';
import MaintenancePage from './pages/MaintenancePage';
import ApplicationsPage from './pages/ApplicationsPage';
import SafeMeetPage from './pages/SafeMeetPage';
import EscrowPage from './pages/EscrowPage';
import DocumentsPage from './pages/DocumentsPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import LeaseGeneratorPage from './pages/LeaseGeneratorPage';
import RentRollPage from './pages/RentRollPage';
import TrustPassportPage from './pages/TrustPassportPage';
import RewardsPage from './pages/RewardsPage';
import ListingDetailPage from './pages/ListingDetailPage';
import CalculatorPage from './pages/CalculatorPage';
import SmartSearchPage from './pages/SmartSearchPage';
import AiChatPage from './pages/AiChatPage';
import AiPropertyAnalyzerPage from './pages/AiPropertyAnalyzerPage';
import SettingsPage from './pages/SettingsPage';
import MarketIntelligencePage from './pages/MarketIntelligencePage';
import PortfolioAnalyzerPage from './pages/PortfolioAnalyzerPage';
import AdvancedPropertyIntelligencePage from './pages/AdvancedPropertyIntelligencePage';
import TokenomicsPage from './pages/TokenomicsPage';
import WalletConnectPage from './pages/WalletConnectPage';
import OnRampPage from './pages/OnRampPage';
import OffRampPage from './pages/OffRampPage';
import TokenFlowPage from './pages/TokenFlowPage';
import EscrowDetailPage from './pages/EscrowDetailPage';
import MarketplacePage from './pages/MarketplacePage';
import BrowseHotelsPage from './pages/BrowseHotelsPage';
import DemoWalkthroughPage from './pages/DemoWalkthroughPage';
import Web3Page from './pages/Web3Page';
import LiquidityTerminalPage from './pages/LiquidityTerminalPage';
import HospitalityPage from './pages/HospitalityPage';
import RealEstateScreeningPage from './pages/RealEstateScreeningPage';
import AirdropPage from './pages/AirdropPage';
import UsdyPage from './pages/UsdyPage';
import CityLandingPage from './pages/CityLandingPage';
import LiveSellCustomerPage from './pages/LiveSellCustomerPage';
import LiveSellingPage from './pages/LiveSellingPage';
import FreelancePage from './pages/FreelancePage';
import BackgroundCheckPage from './pages/BackgroundCheckPage';
import AgentPassportPage from './pages/AgentPassportPage';
import RevenuePage from './pages/RevenuePage';
import BackgroundCheckReportPage from './pages/BackgroundCheckReportPage';
import PromoPage from './pages/PromoPage';
import PromotionsPage from './pages/PromotionsPage';
import FreightPage from './pages/FreightPage';
import PpdWizardPage from './pages/PpdWizardPage';
import PassportDirectoryPage from './pages/PassportDirectoryPage';
import CashOutPage from './pages/CashOutPage';
import PayrollPage from './pages/PayrollPage';
import ArbitrationPage from './pages/ArbitrationPage';
import OutreachCRMPage from './pages/OutreachCRMPage';
import SearchPage from './pages/SearchPage';
import AboutPage from './pages/AboutPage';
import DarazScannerPage from './pages/DarazScannerPage';
import FreelanceStorefrontPage from './pages/FreelanceStorefrontPage';
import ShariaCompliancePage from './pages/ShariaCompliancePage';
import { PublicCustomerProfilePage } from './pages/PublicCustomerProfilePage';
import { PublicPassportPage } from './pages/PublicPassportPage';
import { PassportDashboardPage } from './pages/PassportDashboardPage';
import BusinessAnalyticsPage from './pages/BusinessAnalyticsPage';
import { PluginManagerPage } from './pages/PluginManagerPage';
import ActiveJobsPage from './pages/ActiveJobsPage';
import JobWorkspacePage from './pages/JobWorkspacePage';
import PartnerDashboardPage from './pages/PartnerDashboardPage';
import JobDetailsPage from './pages/JobDetailsPage';
import { LanguageProvider } from './context/LanguageContext';
import { HelmetProvider } from 'react-helmet-async';
import { useEffect } from 'react';

function App() {
  const { isAuthenticated, user, fetchWalletData } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      fetchWalletData();
    }
  }, [isAuthenticated, fetchWalletData]);

  useEffect(() => {
    const { token, logout } = useAuthStore.getState();
    if (!token) return;
    try {
      const exp = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))?.exp;
      if (exp && Date.now() >= exp * 1000) logout();
    } catch { /* malformed */ }
  }, []);

  const DashboardPage = () => {
    if (!isAuthenticated) return <Navigate to="/login" />;
    if (user?.role === 'ADMIN') return <Navigate to="/admin" replace />;
    if (user?.role === 'BUSINESS_OWNER') return <Navigate to="/property-manager" replace />;
    if (user?.role === 'FREELANCER') return <Navigate to="/freelance" replace />;
    return <Navigate to="/property-manager" replace />;
  };

  const AuthRequiredProfilesPage = () => {
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return <ProfilesPage />;
  };

  const AuthRequiredProfileDetailPage = () => {
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return <ProfileDetailPage />;
  };

  return (
    <HelmetProvider>
      <LanguageProvider>
        <Routes>
          {/* ALL routes inside Layout so every page gets header+footer */}
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="sharia-compliance" element={<ShariaCompliancePage />} />
            <Route path="auth/callback" element={<AuthCallbackPage />} />
            <Route path="login" element={<AuthPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="onboarding" element={<OnboardingPage />} />
            <Route path="property-manager" element={<CRMPage />} />
            <Route path="tenant-workflow" element={<TenantWorkflowPage />} />
            <Route path="ai/assistant" element={<AIAssistantPage />} />
            <Route path="property/:id" element={<PropertyDetailPage />} />
            <Route path="p/:slug" element={<TenantPortalPage />} />
            <Route path="tenant" element={<TenantDashboardPage />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="marketplace" element={<MarketplacePage />} />
            <Route path="listing/:id" element={<ListingDetailPage />} />
            <Route path="escrow" element={<EscrowPage />} />
            <Route path="escrow/:id" element={<EscrowDetailPage />} />
            <Route path="tokenomics" element={<TokenomicsPage />} />
            <Route path="wallet" element={<WalletConnectPage />} />
            <Route path="onramp" element={<OnRampPage />} />
            <Route path="offramp" element={<OffRampPage />} />
            <Route path="token" element={<TokenFlowPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="calculator" element={<CalculatorPage />} />
            <Route path="smart-search" element={<SmartSearchPage />} />
            <Route path="ai/chat" element={<AiChatPage />} />
            <Route path="ai/analyze" element={<AiPropertyAnalyzerPage />} />
            <Route path="ai/intelligence" element={<AdvancedPropertyIntelligencePage />} />
            <Route path="ai/market" element={<MarketIntelligencePage />} />
            <Route path="ai/portfolio" element={<PortfolioAnalyzerPage />} />
            <Route path="ai/tenant-risk" element={<AITenantRiskPage />} />
            <Route path="ai/lease-anomaly" element={<AILeaseAnomalyPage />} />
            <Route path="ai/rent-optimizer" element={<AIRentOptimizerPage />} />
            <Route path="passport" element={<TrustPassportPage />} />
            <Route path="passport/dashboard" element={<PassportDashboardPage />} />
            <Route path="passport/:sellerId" element={<PublicPassportPage />} />
            <Route path="trust/:handle" element={<TrustPassportPage />} />
            <Route path="trust" element={<PassportDirectoryPage />} />
            <Route path="trust/pulse" element={<TrustPulsePage />} />
            <Route path="trust/jury" element={<CommunityJuryPage />} />
            <Route path="agent-passport" element={<AgentPassportPage />} />
            <Route path="background-check" element={<BackgroundCheckPage />} />
            <Route path="background-check/:id" element={<BackgroundCheckReportPage />} />
            <Route path="protected-deposit" element={<PpdWizardPage />} />
            <Route path="arbitration" element={<ArbitrationPage />} />
            <Route path="safemeet" element={<SafeMeetPage />} />
            <Route path="disputes" element={<DisputeCenterPage />} />
            <Route path="cashout" element={<CashOutPage />} />
            <Route path="payroll" element={<PayrollPage />} />
            <Route path="economy" element={<EconomyDashboardPage />} />
            <Route path="revenue" element={<RevenuePage />} />
            <Route path="rewards" element={<RewardsPage />} />
            <Route path="refer" element={<ReferAndEarnPage />} />
            <Route path="verifier" element={<VerifierSandboxPage />} />
            <Route path="book" element={<BookingExperience />} />
            <Route path="book/:id" element={<BookingExperience />} />
            <Route path="booking" element={<BookingOS />} />
            <Route path="reservations" element={<ReservationsPage />} />
            <Route path="reservations/new" element={<NewReservationPage />} />
            <Route path="nightlife" element={<NightlifePage />} />
            <Route path="promoter" element={<PromoterOS />} />
            <Route path="agent-dashboard" element={<AgentControlPanel />} />
            <Route path="live-sell" element={<LiveSellCustomerPage />} />
            <Route path="live-selling" element={<LiveSellingPage />} />
            <Route path="freelance" element={<FreelancePage />} />
            <Route path="storefront" element={<FreelanceStorefrontPage />} />
            <Route path="gigs" element={<JobDetailsPage />} />
            <Route path="gigs/:id" element={<JobDetailsPage />} />
            <Route path="jobs/:id" element={<JobDetailsPage />} />
            <Route path="jobs" element={<ActiveJobsPage />} />
            <Route path="workspace/:id" element={<JobWorkspacePage />} />
            <Route path="hotels" element={<BrowseHotelsPage />} />
            <Route path="hospitality" element={<HospitalityPage />} />
            <Route path="real-estate/screening/:reservationId" element={<RealEstateScreeningPage />} />
            <Route path="freight" element={<FreightPage />} />
            <Route path="business/join" element={<BusinessJoinPage />} />
            <Route path="business/join-claim" element={<BusinessJoinPage />} />
            <Route path="business/register" element={isAuthenticated ? <BusinessActivationPage /> : <Navigate to="/login" />} />
            <Route path="business/:id" element={<BusinessProfilePage />} />
            <Route path="business/:id/book" element={<BookingPage />} />
            <Route path="business/activate/:id" element={<BusinessActivationPage />} />
            <Route path="business/crm" element={isAuthenticated ? <BusinessCrmPage /> : <Navigate to="/login" />} />
            <Route path="business/settings" element={isAuthenticated ? <BusinessSettingsPage /> : <Navigate to="/login" />} />
            <Route path="business/analytics" element={isAuthenticated ? <BusinessAnalyticsPage /> : <Navigate to="/login" />} />
            <Route path="business/plugins" element={isAuthenticated ? <PluginManagerPage /> : <Navigate to="/login" />} />
            <Route path="business-model" element={<BusinessModelPage />} />
            <Route path="join" element={<BusinessJoinPage />} />
            <Route path="pricing" element={<BusinessModelPage />} />
            <Route path="checkout/:sessionId" element={<CheckoutSessionPage />} />
            <Route path="checkout-success" element={<CheckoutSuccessPage />} />
            <Route path="checkout-cancel" element={<CheckoutCancelPage />} />
            <Route path="demo-checkout" element={<DemoCheckoutPage />} />
            <Route path="s/:sellerId" element={<UniversalCheckoutPage />} />
            <Route path="t/pay/:sellerId" element={<TapPayPage />} />
            <Route path="b/:slug" element={<ShortLinkBookingPage />} />
            <Route path="web3" element={<Web3Page />} />
            <Route path="lp-terminal" element={<LiquidityTerminalPage />} />
            <Route path="usdy" element={<UsdyPage />} />
            <Route path="airdrop" element={<AirdropPage />} />
            <Route path="rent-roll" element={<RentRollPage />} />
            <Route path="leases" element={<LeaseGeneratorPage />} />
            <Route path="maintenance" element={<MaintenancePage />} />
            <Route path="applications" element={<ApplicationsPage />} />
            <Route path="profiles" element={<AuthRequiredProfilesPage />} />
            <Route path="profiles/category/:category" element={<AuthRequiredProfilesPage />} />
            <Route path="profiles/:id" element={<AuthRequiredProfileDetailPage />} />
            <Route path="technology" element={<TechnologyPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password/:token" element={<ResetPasswordPage />} />
            <Route path="developer" element={<DeveloperPortalPage />} />
            <Route path="promo" element={<PromoPage />} />
            <Route path="promotions" element={<PromotionsPage />} />
            <Route path="daraz-scanner" element={<DarazScannerPage />} />
            <Route path="u/:slug" element={<PublicCustomerProfilePage />} />
            <Route path="user/:id" element={<PublicCustomerProfilePage />} />
            <Route path="verify-email" element={<VerifyEmailPage />} />
            <Route path="passport/dietary" element={<DietaryPassportPage />} />
            <Route path="demo" element={<DemoWalkthroughPage />} />
            <Route path="try" element={<Navigate to="/demo" replace />} />
            <Route path="oauth/authorize" element={<OAuthConsentPage />} />
            <Route path="outreach" element={isAuthenticated && user?.role === 'ADMIN' ? <OutreachCRMPage /> : <Navigate to="/login" />} />
            <Route path="partners/dashboard" element={<PartnerDashboardPage />} />
            <Route path="partners/marketplace" element={<MarketplacePartnerPage />} />
            <Route path="sale/:id" element={<SalePage />} />
            <Route path="waitlist" element={<WaitlistPage />} />
            <Route path="r/:code" element={<ReferralLandingPage />} />
            <Route path="city/:slug" element={<CityLandingPage />} />
          </Route>
        </Routes>
      </LanguageProvider>
    </HelmetProvider>
  );
}

export default App;
