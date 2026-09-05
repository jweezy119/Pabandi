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
import NightlifeTokenomics from './pages/NightlifeTokenomics';
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
import ProfilePage from './pages/ProfilePage';
import { WalletPage } from './pages/WalletPage';
import { ReferAndEarnPage } from './pages/ReferAndEarnPage';
import { VerifierSandboxPage } from './pages/VerifierSandboxPage';
import DietaryPassportPage from './pages/DietaryPassportPage';
import DeveloperPortalPage from './pages/DeveloperPortalPage';
import TrustPage from './pages/TrustPage';
import { TrustPulsePage } from './pages/TrustPulsePage';
import { CommunityJuryPage } from './pages/CommunityJuryPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import { WaitlistPage } from './pages/WaitlistPage';
import { ReferralLandingPage } from './pages/ReferralLandingPage';
import MarketplacePartnerPage from './pages/MarketplacePartnerPage';
import SalePage from './pages/SalePage';
import PropertyManagerPage from './pages/CRMPage';
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
import UnifiedDashboardPage from './pages/UnifiedDashboardPage';
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
import { PublicSEO } from './components/PublicSEO';
import { useEffect } from 'react';

function App() {
  const { isAuthenticated, user, fetchWalletData } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      fetchWalletData();
    }
  }, [isAuthenticated, fetchWalletData]);

  // Validate the persisted token on mount: if it's expired, clear auth so a stale
  // session can never trap the user (or silently 401 every request).
  useEffect(() => {
    const { token, logout } = useAuthStore.getState();
    if (!token) return;
    try {
      const exp = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))?.exp;
      if (exp && Date.now() >= exp * 1000) logout();
    } catch {
      /* malformed token — leave as-is; API will reject and the user can re-login */
    }
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
          <Route path="/waitlist" element={<PublicSEO seo={{ title: 'Pabandi Waitlist', description: 'Join the Pabandi waitlist for early access to trusted bookings, escrow deposits, $PAB rewards, and local discovery.' }}><WaitlistPage /></PublicSEO>} />
          {/* Public referral invite landing — validates ?code and funnels to signup */}
          <Route path="/r/:code" element={<PublicSEO seo={{ title: 'Join Pabandi with an invite', description: 'Join Pabandi through a friend’s invite — escrow-backed bookings, court & KYC screening, and $PAB rewards.' }}><ReferralLandingPage /></PublicSEO>} />
          {/* Marketplace partner pitch + self-serve enrollment */}
          <Route path="/partners/marketplace" element={<PublicSEO seo={{ title: 'Pabandi for Marketplaces — Secure every local sale', description: 'Add Pabandi escrow + identity verification to Facebook Marketplace, OfferUp, Craigslist and more. One-line iframe. You earn on every secured sale.' }}><MarketplacePartnerPage /></PublicSEO>} />
          {/* Chrome-free embeddable widget for marketplaces (iframe on listings) */}
                    {/* Standalone seller sale page (status + secure link + release) */}
          <Route path="/sale/:id" element={<PublicSEO seo={{ title: 'Your Pabandi-secured sale', description: 'Track your Pabandi-secured local sale, share the buyer link, and release escrow after a safe in-person exchange.' }}><SalePage /></PublicSEO>} />
          {/* Property Manager CRM dashboard */}
          <Route path="/property-manager" element={<PropertyManagerPage />} />
          {/* Tenant Workflow with CourtListener Screening */}
          <Route path="/tenant-workflow" element={<TenantWorkflowPage />} />
          {/* AI Assistant for Property Management */}
          <Route path="/ai/assistant" element={<AIAssistantPage />} />
          {/* Property detail page */}
          <Route path="/property/:id" element={<PropertyDetailPage />} />
          {/* White-label tenant portal */}
          <Route path="/p/:slug" element={<PublicSEO seo={{ title: 'Available rentals', description: 'Browse available rental listings secured by Pabandi — escrow-backed deposits and $PAB rewards.' }}><TenantPortalPage /></PublicSEO>} />
          {/* Tenant application tracker (authenticated) */}
          <Route path="/tenant" element={<TenantDashboardPage />} />
          {/* Documents */}
          <Route path="/documents" element={<DocumentsPage />} />
          {/* Marketplace - Buy, Sell, Rent, Hire */}
          <Route path="/marketplace" element={<PublicSEO seo={{ title: 'Pabandi Marketplace', description: 'Buy, sell, rent, and hire — all protected by escrow and background checks.' }}><MarketplacePage /></PublicSEO>} />
          <Route path="/listing/:id" element={<ListingDetailPage />} />
          <Route path="/escrow/:id" element={<EscrowDetailPage />} />
          {/* Token & Wallet */}
          <Route path="/tokenomics" element={<TokenomicsPage />} />
          <Route path="/wallet" element={<WalletConnectPage />} />
          <Route path="/onramp" element={<OnRampPage />} />
          <Route path="/offramp" element={<OffRampPage />} />
          <Route path="/token" element={<TokenFlowPage />} />
          {/* AI Tools */}
          <Route path="/dashboard" element={<UnifiedDashboardPage />} />
                              <Route path="/settings" element={<SettingsPage />} />
          <Route path="/search" element={<SmartSearchPage />} />
                    <Route path="/calculator" element={<CalculatorPage />} />
          <Route path="/ai/chat" element={<AiChatPage />} />
          <Route path="/ai/analyze" element={<AiPropertyAnalyzerPage />} />
          <Route path="/ai/intelligence" element={<AdvancedPropertyIntelligencePage />} />
          <Route path="/ai/market" element={<MarketIntelligencePage />} />
          <Route path="/ai/portfolio" element={<PortfolioAnalyzerPage />} />
          <Route path="/ai/tenant-risk" element={<AITenantRiskPage />} />
          <Route path="/ai/lease-anomaly" element={<AILeaseAnomalyPage />} />
          <Route path="/ai/rent-optimizer" element={<AIRentOptimizerPage />} />
          {/* AI Real Estate */}
          {/* Trust Passport */}
          <Route path="/passport" element={<PublicSEO seo={{ title: 'Trust Passport — Pabandi', description: 'Your portable reputation across all Pabandi services.' }}><TrustPassportPage /></PublicSEO>} />
          {/* Rewards */}

          {/* Rent Roll */}
          <Route path="/rent-roll" element={<PublicSEO seo={{ title: 'Rent Roll — Pabandi', description: 'Track income, expenses, and NOI across all your properties.' }}><RentRollPage /></PublicSEO>} />
          {/* Lease Generator */}
          <Route path="/leases" element={<PublicSEO seo={{ title: 'Lease Agreements — Pabandi', description: 'Create and manage lease agreements.' }}><LeaseGeneratorPage /></PublicSEO>} />
          {/* Email verification */}
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          {/* Escrow & Disputes */}
          <Route path="/escrow" element={<PublicSEO seo={{ title: 'Pabandi Escrow — Secured Transactions', description: 'Create escrow transactions, protect your trades, and resolve disputes fairly.' }}><EscrowPage /></PublicSEO>} />
          {/* Maintenance */}
          <Route path="/maintenance" element={<MaintenancePage />} />
          {/* Applications */}
          <Route path="/applications" element={<ApplicationsPage />} />
          {/* Dispute Center */}
          <Route path="/disputes" element={<PublicSEO seo={{ title: 'Dispute Center — Fair Resolution', description: 'File disputes, submit evidence, and let the community jury decide.' }}><DisputeCenterPage /></PublicSEO>} />
          {/* SafeMeet */}
          <Route path="/safemeet" element={<PublicSEO seo={{ title: 'SafeMeet — Secure Exchange Locations', description: 'Schedule meetups at verified safe locations for in-person exchanges.' }}><SafeMeetPage /></PublicSEO>} />
          {/* Browse Hotels - links to Booking.com */}
          <Route path="/hotels" element={<PublicSEO seo={{ title: 'Browse Hotels — Pabandi', description: 'Search hotels on Booking.com with real prices and instant booking.' }}><BrowseHotelsPage /></PublicSEO>} />
          {/* Demo walkthrough */}
          <Route path="/demo" element={<PublicSEO seo={{ title: 'Pabandi Demo — See it in action', description: 'A guided walkthrough of Pabandi trust experience — property management to safe local sales.' }}><DemoWalkthroughPage /></PublicSEO>} />
          {/* Redirect /try to /demo for backwards compatibility */}
          <Route path="/try" element={<Navigate to="/demo" replace />} />
          <Route path="/airdrop" element={<PublicSEO seo={{ title: 'Pabandi Airdrop', description: 'Check your eligibility for the Pabandi airdrop. Review wallet status, $PAB rewards, and trust-score requirements.' }}><AirdropPage /></PublicSEO>} />
          <Route path="/usdy" element={<PublicSEO seo={{ title: 'Pabandi × Ondo USDY — Tokenized T-Bill Yield on Rent', description: 'Pabandi brings Ondo Finance USDY (tokenized US Treasuries) to the global rental economy. Pre-register your portfolio for USDY rent yield.' }}><UsdyPage /></PublicSEO>} />
          <Route path="/city/:slug" element={<CityLandingPage />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<PublicSEO seo={{ title: 'Pabandi | Commitment, Secured.', description: 'Find trusted local hospitality, live sellers, freelancers, and gig workers near you. Book with escrow-backed deposits and earn $PAB rewards on Pabandi.' }}><HomePage /></PublicSEO>} />
            <Route path="search" element={<SearchPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="sharia-compliance" element={<ShariaCompliancePage />} />

            {/* OAuth callback — backend redirects here with ?token=...; we consume it and log in */}
            <Route path="auth/callback" element={<AuthCallbackPage />} />

            {/* Unified auth page for both login & register.
                We do NOT auto-redirect when isAuthenticated: a persisted (possibly stale/expired)
                token must never trap the user away from the login form. Token validity is checked
                on app mount (see below), and a successful login navigates to the dashboard itself. */}
            <Route
              path="login"
              element={<AuthPage />}
            />
            <Route
              path="register"
              element={<RegisterPage />}
            />
            <Route path="/onboarding" element={<OnboardingPage />} />

            <Route path="/wallet" element={<WalletConnectPage />} />
                        <Route path="/lp-terminal" element={<LiquidityTerminalPage />} />

            <Route path="/waitlist" element={<WaitlistPage />} />
                        
            <Route path="/u/:slug" element={<PublicCustomerProfilePage />} />
            <Route path="business/:id" element={<BusinessProfilePage />} />
            <Route path="checkout/:sessionId" element={<CheckoutSessionPage />} />
            <Route path="checkout-success" element={<CheckoutSuccessPage />} />
            <Route path="checkout-cancel" element={<CheckoutCancelPage />} />
            <Route path="user/:id" element={<PublicCustomerProfilePage />} />
            <Route path="b/:slug" element={<ShortLinkBookingPage />} />
            <Route path="business/:id/book" element={<BookingPage />} />
            <Route path="book" element={<BookingExperience />} />
            <Route path="book/:id" element={<BookingExperience />} />
            <Route path="booking" element={<BookingOS />} />
            <Route path="nightlife" element={<NightlifePage />} />
            <Route path="promoter" element={<PromoterOS />} />
            <Route path="auth/callback" element={<AuthCallbackPage />} />
            <Route path="oauth/authorize" element={<OAuthConsentPage />} />
            <Route path="s/:sellerId" element={<UniversalCheckoutPage />} />
            <Route path="t/pay/:sellerId" element={<TapPayPage />} />
            <Route path="demo-checkout" element={<DemoCheckoutPage />} />
            {/* Business partner landing page — public */}
            <Route path="business/join" element={<PublicSEO seo={{ title: 'Join Pabandi | Free Business Registration', description: 'Register your hospitality, live-selling, freelance, or local service business on Pabandi. Free onboarding, escrow-backed bookings, and $PAB rewards.' }}><BusinessJoinPage /></PublicSEO>} />
            <Route path="jobs/:id" element={<JobDetailsPage />} />
            <Route path="join" element={<PublicSEO seo={{ title: 'Join Pabandi | Free Business Registration', description: 'Register your hospitality, live-selling, freelance, or local service business on Pabandi. Free onboarding, escrow-backed bookings, and $PAB rewards.' }}><BusinessJoinPage /></PublicSEO>} />
            <Route path="business/join-claim" element={<PublicSEO seo={{ title: 'Claim Business | Pabandi', description: 'Claim your unclaimed Pabandi business profile with Web3 escrow, AI no-show protection, and Solana $PAB rewards.' }}><BusinessJoinPage /></PublicSEO>} />
            <Route path="business/activate/:id" element={<PublicSEO seo={{ title: 'Business Setup | Pabandi', description: 'Claim your listing, connect checkout, and become booking-ready on Pabandi.' }}><BusinessActivationPage /></PublicSEO>} />
            <Route path="/dashboard/jobs" element={<ActiveJobsPage />} />
            <Route path="/workspace/:id" element={<JobWorkspacePage />} />
            <Route path="partners/dashboard" element={<PartnerDashboardPage />} />
            <Route path="pricing" element={<PublicSEO seo={{ title: 'Pabandi Pricing | Hospitality & Live Selling Plans', description: 'Explore Pabandi pricing for hospitality properties, live sellers, and freelancers. Free starter plans, escrow-backed deposits, and $PAB rewards.' }}><BusinessModelPage /></PublicSEO>} />
            <Route path="business-model" element={<PublicSEO seo={{ title: 'Pabandi Business Model | Escrow Commissions & Rewards', description: 'Understand Pabandi revenue, escrow commissions, $PAB tokenomics, and trust incentives for sellers, buyers, and hosts.' }}><BusinessModelPage /></PublicSEO>} />
            <Route path="technology" element={<TechnologyPage />} />
            <Route path="web3" element={<Web3Page />} />
            <Route path="hospitality" element={<HospitalityPage />} />
            <Route path="real-estate/screening/:reservationId" element={<RealEstateScreeningPage />} />
            <Route path="live-sell" element={<LiveSellCustomerPage />} />
            <Route path="live-selling" element={<LiveSellingPage />} />
            <Route path="freelance" element={<FreelancePage />} />
            <Route path="storefront" element={<FreelanceStorefrontPage />} />
            <Route path="daraz-scanner" element={<DarazScannerPage />} />
            <Route path="background-check" element={<BackgroundCheckPage />} />
            <Route path="background-check/:id" element={<BackgroundCheckReportPage />} />
            <Route path="promo" element={<PromoPage />} />
            <Route path="promotions" element={<PromotionsPage />} />
            <Route path="freight" element={<PublicSEO seo={{ title: "Freight & Logistics — Pabandi", description: "Ship goods with trusted carriers. Escrow-protected payments." }}><FreightPage /></PublicSEO>} />
            <Route path="rewards" element={<PublicSEO seo={{ title: '$PAB Rewards — Pabandi', description: 'Earn, spend, and stake $PAB tokens.' }}><RewardsPage /></PublicSEO>} />
            <Route path="protected-deposit" element={<PpdWizardPage />} />
            <Route path="trust/:handle" element={<TrustPassportPage />} />
            <Route path="trust" element={<PassportDirectoryPage />} />
            <Route path="agent-passport" element={<AgentPassportPage />} />
            <Route path="agent-panel" element={<AgentControlPanel />} />
            <Route path="nightlife-tokenomics" element={<NightlifeTokenomics />} />
            <Route path="revenue" element={<RevenuePage />} />
            <Route path="cashout" element={<CashOutPage />} />
            <Route path="payroll" element={<PayrollPage />} />
            <Route path="arbitration" element={<ArbitrationPage />} />
            <Route path="profiles" element={<AuthRequiredProfilesPage />} />
            <Route path="profiles/category/:category" element={<AuthRequiredProfilesPage />} />
            <Route path="profiles/:id" element={<AuthRequiredProfileDetailPage />} />
            <Route path="economy" element={<EconomyDashboardPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password/:token" element={<ResetPasswordPage />} />
            {/* B2B Intelligence API developer portal — public */}
            <Route path="developer" element={<PublicSEO seo={{ title: 'Pabandi Developer Portal | Local Business API', description: 'Explore the Pabandi developer API for local business data, escrow hooks, live-selling integrations, and trust-score endpoints.' }}><DeveloperPortalPage /></PublicSEO>} />
            {/* Social & Professional Trust Layer — public */}
            <Route path="trust" element={<PublicSEO seo={{ title: 'Pabandi Trust & Passport', description: 'Build your Pabandi Passport with trust scores, social verification, and portable credibility across the informal economy.' }}><TrustPage /></PublicSEO>} />
            <Route path="trust/pulse" element={<TrustPulsePage />} />
            <Route path="trust/jury" element={<CommunityJuryPage />} />
            {/* Privacy Policy */}
            <Route path="privacy" element={<PrivacyPolicyPage />} />
            {/* Terms of Service */}
            <Route path="terms" element={<TermsOfServicePage />} />

            {/* Shopify Embedded App Route */}
            
            <Route
              path="dashboard"
              element={<DashboardPage />}
            />
            <Route
              path="business/register"
              element={isAuthenticated ? <BusinessActivationPage /> : <Navigate to="/login" />}
            />
            <Route
              path="business/crm"
              element={isAuthenticated ? <BusinessCrmPage /> : <Navigate to="/login" />}
            />
            <Route
              path="outreach"
              element={isAuthenticated && user?.role === 'ADMIN' ? <OutreachCRMPage /> : <Navigate to="/login" />}
            />
            <Route
              path="business/settings"
              element={isAuthenticated ? <BusinessSettingsPage /> : <Navigate to="/login" />}
            />
            <Route
              path="business/analytics"
              element={isAuthenticated ? <BusinessAnalyticsPage /> : <Navigate to="/login" />}
            />
            <Route
              path="business/plugins"
              element={isAuthenticated ? <PluginManagerPage /> : <Navigate to="/login" />}
            />
            <Route
              path="reservations"
              element={isAuthenticated ? <ReservationsPage /> : <Navigate to="/login" />}
            />
            <Route
              path="reservations/new"
              element={isAuthenticated ? <NewReservationPage /> : <Navigate to="/login" />}
            />
            <Route
              path="wallet"
              element={isAuthenticated ? <WalletConnectPage /> : <Navigate to="/login" />}
            />
            <Route
              path="profile"
              element={isAuthenticated ? <ProfilePage /> : <Navigate to="/login" />}
            />
            <Route
              path="/wallet"
              element={isAuthenticated ? <WalletPage /> : <Navigate to="/login" />}
            />
            <Route
              path="/refer"
              element={isAuthenticated ? <ReferAndEarnPage /> : <Navigate to="/login" />}
            />
            <Route
              path="/verifier"
              element={isAuthenticated ? <VerifierSandboxPage /> : <Navigate to="/login" />}
            />
            <Route
              path="passport"
              element={isAuthenticated ? <DietaryPassportPage /> : <Navigate to="/login" />}
            />
            <Route
              path="passport/dashboard"
              element={isAuthenticated ? <PassportDashboardPage /> : <Navigate to="/login" />}
            />
            <Route path="passport/:sellerId" element={<PublicPassportPage />} />
          </Route>

          {/* Standalone embeddable badge (chrome-free, for iframe embeds) */}
                  </Routes>
      </LanguageProvider>
    </HelmetProvider>
  );
}

export default App;
