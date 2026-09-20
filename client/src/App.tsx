import { Routes, Route, Navigate } from 'react-router-dom';
import SitaraApp from './sitara/SitaraApp';
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
import NightlifePage from './pages/NightlifePage';
import PromoterOS from './pages/PromoterOS';
import AgentControlPanel from './pages/AgentControlPanel';
import AgentMarketplacePage from './pages/AgentMarketplacePage';
import AgentProfilePage from './pages/AgentProfilePage';
import ProjectDetailPage from './pages/ProjectDetailPage';
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
import NotificationsPage from './pages/NotificationsPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ProfilesPage from './pages/ProfilesPage';
import ProfileDetailPage from './pages/ProfileDetailPage';
import ProfilePage from './pages/ProfilePage';
import { ReferAndEarnPage } from './pages/ReferAndEarnPage';
import { VerifierSandboxPage } from './pages/VerifierSandboxPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminSetupPage } from './pages/AdminSetupPage';
import DietaryPassportPage from './pages/DietaryPassportPage';
import DeveloperPortalPage from './pages/DeveloperPortalPage';
import { TrustPulsePage } from './pages/TrustPulsePage';
import { CommunityJuryPage } from './pages/CommunityJuryPage';
import { WaitlistPage } from './pages/WaitlistPage';
import { ReferralLandingPage } from './pages/ReferralLandingPage';
import MarketplacePartnerPage from './pages/MarketplacePartnerPage';
import SalePage from './pages/SalePage';
import CRMPage from './pages/CRMPage';
import SalesCRMPage from './pages/SalesCRMPage';
import { TenantWorkflowPage } from './pages/TenantWorkflowPage';
import { AIAssistantPage } from './pages/AIAssistantPage';
import { AITenantRiskPage } from './pages/AITenantRiskPage';
import { AILeaseAnomalyPage } from './pages/AILeaseAnomalyPage';
import { AIRentOptimizerPage } from './pages/AIRentOptimizerPage';
import PaymentTestPage from './pages/PaymentTestPage';
import PropertyDetailPage from './pages/PropertyDetailPage';
import PublicPropertiesPage from './pages/PublicPropertiesPage';
import TenantPortalPage from './pages/TenantPortalPage';
import TenantDashboardPage from './pages/TenantDashboardPage';
import TenantPortalDashboard from './pages/TenantPortalDashboard';
import RentPayment from './pages/RentPayment';
import MaintenanceRequest from './pages/MaintenanceRequest';
import LeaseView from './pages/LeaseView';
import TrustStakingPortal from './components/TrustStaking';
import PaymentHistory from './pages/PaymentHistory';
import EnhancedDashboardPage from './pages/EnhancedDashboardPage';
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
import WalletPage from './pages/WalletPage';
import OnRampPage from './pages/OnRampPage';
import OffRampPage from './pages/OffRampPage';
import TokenFlowPage from './pages/TokenFlowPage';
import EscrowDetailPage from './pages/EscrowDetailPage';
import MarketplacePage from './pages/MarketplacePage';
import BrowseHotelsPage from './pages/BrowseHotelsPage';
import BuilderDashboard from './pages/realestate/BuilderDashboard';
import BuilderProjectPage from './pages/realestate/BuilderProjectPage';
import BuyerPortal from './pages/realestate/BuyerPortal';
import CODMarketplace from './pages/cod/CODMarketplace';
import CreateEscrow from './pages/cod/CreateEscrow';
import EscrowDetail from './pages/cod/EscrowDetail';
import DemoWalkthroughPage from './pages/DemoWalkthroughPage';
import Web3Page from './pages/Web3Page';
import LiquidityTerminalPage from './pages/LiquidityTerminalPage';
import HospitalityPage from './pages/HospitalityPage';
import RealEstateScreeningPage from './pages/RealEstateScreeningPage';
import AirdropPage from './pages/AirdropPage';
import UsdyPage from './pages/UsdyPage';
import SolanaEscrowPage from './pages/SolanaEscrowPage';
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
import FiatPaymentPage from './pages/FiatPaymentPage';
import VenueSearchPage from './pages/VenueSearchPage';
import VenueDetailPage from './pages/VenueDetailPage';
import BookingCheckoutPage from './pages/BookingCheckoutPage';
import MyBookingsPage from './pages/MyBookingsPage';
import RaastConfirmPage from './pages/RaastConfirmPage';
import PromoterDashboardPage from './pages/PromoterDashboardPage';
import GuestListPage from './pages/GuestListPage';
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
import { MudarabahPoolsPage } from './pages/MudarabahPoolsPage';
import { BusinessMudarabahPage } from './pages/BusinessMudarabahPage';
import ProfitDashboardPage from './pages/ProfitDashboardPage';
import { ShariaTransparencyPage } from './pages/ShariaTransparencyPage';
import { PublicCustomerProfilePage } from './pages/PublicCustomerProfilePage';
import { PublicPassportPage } from './pages/PublicPassportPage';
import { PassportDashboardPage } from './pages/PassportDashboardPage';
import EconomyDashboardPage from './pages/EconomyDashboardPage';
import BusinessAnalyticsPage from './pages/BusinessAnalyticsPage';
import { PluginManagerPage } from './pages/PluginManagerPage';
import ActiveJobsPage from './pages/ActiveJobsPage';
import JobWorkspacePage from './pages/JobWorkspacePage';
import PartnerDashboardPage from './pages/PartnerDashboardPage';
import JobDetailsPage from './pages/JobDetailsPage';
import { LanguageProvider } from './context/LanguageContext';
import { HelmetProvider } from 'react-helmet-async';
import { useEffect } from 'react';
import StakingInterface from './components/StakingInterface';
import EscrowInterface from './components/EscrowInterface';
import AgentInterface from './components/AgentInterface';
import SafOSPage from './pages/saf/SafOSPage';
import HaqOSPage from './pages/haq/HaqOSPage';
import HaqTenantsPage from './pages/haq/HaqTenantsPage';
import HaqTenantDetailPage from './pages/haq/HaqTenantDetailPage';
import HaqLeasesPage from './pages/haq/HaqLeasesPage';
import HaqMaintenancePage from './pages/haq/HaqMaintenancePage';
import HaqFinancialsPage from './pages/haq/HaqFinancialsPage';
import SafPostLoadPage from './pages/saf/SafPostLoadPage';
import SafMyLoadsPage from './pages/saf/SafMyLoadsPage';
import SafCarriersPage from './pages/saf/SafCarriersPage';
import SafRateCalculatorPage from './pages/saf/SafRateCalculatorPage';
import SitaraDiscoveryPage from './pages/sitara/SitaraDiscoveryPage';
import SitaraBookingPage from './pages/sitara/SitaraBookingPage';
import ProtocolDashboardPage from './pages/ProtocolDashboardPage';

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
    if (user?.role === 'BUSINESS_OWNER') return <Navigate to="/haq" replace />;
    if (user?.role === 'FREELANCER') return <Navigate to="/freelance" replace />;
    return <Navigate to="/haq" replace />;
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
          {/* OS Pages with their own DashboardLayout - OUTSIDE main Layout */}
          <Route path="saf" element={<SafOSPage />} />
          <Route path="saf/post-load" element={<SafPostLoadPage />} />
          <Route path="saf/my-loads" element={<SafMyLoadsPage />} />
          <Route path="saf/carriers" element={<SafCarriersPage />} />
          <Route path="saf/rates" element={<SafRateCalculatorPage />} />
          <Route path="haq" element={<HaqOSPage />} />
          <Route path="haq/tenants" element={<HaqTenantsPage />} />
          <Route path="haq/tenants/:id" element={<HaqTenantDetailPage />} />
          <Route path="haq/leases" element={<HaqLeasesPage />} />
          <Route path="haq/maintenance" element={<HaqMaintenancePage />} />
          <Route path="haq/financials" element={<HaqFinancialsPage />} />
          <Route path="builder" element={<BuilderDashboard />} />
          <Route path="builder/projects/:id" element={<BuilderProjectPage />} />
          <Route path="buyer" element={<BuyerPortal />} />
          <Route path="cod" element={<CODMarketplace />} />
          <Route path="cod/create" element={<CreateEscrow />} />
          <Route path="cod/:id" element={<EscrowDetail />} />
          <Route path="discovery" element={<SitaraDiscoveryPage />} />
          <Route path="booking" element={<SitaraBookingPage />} />
          <Route path="protocol" element={<ProtocolDashboardPage />} />
          <Route path="protocol/staking" element={<StakingInterface />} />
          <Route path="protocol/escrow" element={<EscrowInterface />} />
          <Route path="protocol/agents" element={<AgentInterface />} />

          {/* ALL other routes inside Layout */}
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="sharia-transparency" element={<ShariaTransparencyPage />} />
            <Route path="mudarabah" element={<MudarabahPoolsPage />} />
            <Route path="profit" element={<ProfitDashboardPage />} />

            <Route path="auth/callback" element={<AuthCallbackPage />} />
            <Route path="login" element={<AuthPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="onboarding" element={<OnboardingPage />} />
            <Route path="property-manager" element={<CRMPage />} />
            <Route path="sales-crm" element={<SalesCRMPage />} />
            <Route path="properties" element={<PublicPropertiesPage />} />
            <Route path="tenant-workflow" element={<TenantWorkflowPage />} />
            <Route path="ai/assistant" element={<AIAssistantPage />} />
            <Route path="property/:id" element={<PropertyDetailPage />} />
            <Route path="p/:slug" element={<TenantPortalPage />} />
            <Route path="tenant" element={<TenantDashboardPage />} />
            <Route path="tenant-portal" element={<TenantPortalDashboard />}>
              <Route path="pay-rent" element={<RentPayment />} />
              <Route path="maintenance" element={<MaintenanceRequest />} />
              <Route path="lease" element={<LeaseView />} />
              <Route path="staking" element={<TrustStakingPortal />} />
              <Route path="history" element={<PaymentHistory />} />
            </Route>
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="marketplace" element={<MarketplacePage />} />
            <Route path="listing/:id" element={<ListingDetailPage />} />
            <Route path="escrow" element={<EscrowPage />} />
            <Route path="escrow/:id" element={<EscrowDetailPage />} />
            <Route path="tokenomics" element={<TokenomicsPage />} />
            <Route path="my-wallet" element={<WalletPage />} />
            <Route path="onramp" element={<OnRampPage />} />
            <Route path="offramp" element={<OffRampPage />} />
            <Route path="token" element={<TokenFlowPage />} />
            <Route path="dashboard" element={<EnhancedDashboardPage />} />
            <Route path="profile" element={<ProfilePage />} />
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
            <Route path="reservations" element={<ReservationsPage />} />
            <Route path="reservations/new" element={<NewReservationPage />} />
            <Route path="nightlife" element={<NightlifePage />} />
            <Route path="promoter" element={<PromoterOS />} />
            <Route path="agent-dashboard" element={<AgentControlPanel />} />
            <Route path="agent-marketplace" element={<AgentMarketplacePage />} />
            <Route path="agent-marketplace/agents/:slug" element={<AgentProfilePage />} />
            <Route path="agent-marketplace/projects/:projectId" element={<ProjectDetailPage />} />
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
            <Route path="solana-escrow" element={<SolanaEscrowPage />} />
            <Route path="solana-escrow/:id" element={<SolanaEscrowPage />} />
            <Route path="airdrop" element={<AirdropPage />} />
            <Route path="payment-test" element={<PaymentTestPage />} />
            <Route path="fiat/:reference" element={<FiatPaymentPage />} />
            <Route path="fiat" element={<FiatPaymentPage />} />
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
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="try" element={<Navigate to="/demo" replace />} />
            <Route path="oauth/authorize" element={<OAuthConsentPage />} />
            <Route path="outreach" element={isAuthenticated && user?.role === 'ADMIN' ? <OutreachCRMPage /> : <Navigate to="/login" />} />
            <Route path="partners/dashboard" element={<PartnerDashboardPage />} />
            <Route path="partners/marketplace" element={<MarketplacePartnerPage />} />
            <Route path="sale/:id" element={<SalePage />} />
            <Route path="waitlist" element={<WaitlistPage />} />
            <Route path="r/:code" element={<ReferralLandingPage />} />
            <Route path="city/:slug" element={<CityLandingPage />} />
            <Route path="sitara/*" element={<SitaraApp />} />
            <Route path="admin" element={isAuthenticated && user?.role === 'ADMIN' ? <AdminDashboardPage /> : <Navigate to="/admin/setup" />} />
            <Route path="admin/setup" element={<AdminSetupPage />} />
          </Route>
        </Routes>
      </LanguageProvider>
    </HelmetProvider>
  );
}

export default App;
