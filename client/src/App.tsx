import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import AuthPage from './pages/AuthPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import BusinessDashboard from './pages/BusinessDashboard';
import BusinessRegister from './pages/BusinessRegister';
import ReservationsPage from './pages/ReservationsPage';
import NewReservationPage from './pages/NewReservationPage';
import { CheckoutSessionPage } from './pages/CheckoutSessionPage';
import CheckoutSuccessPage from './pages/CheckoutSuccessPage';
import CheckoutCancelPage from './pages/CheckoutCancelPage';
import BookingPage from './pages/BookingPage';
import ShortLinkBookingPage from './pages/ShortLinkBookingPage';
import TapPayPage from './pages/TapPayPage';
import UniversalCheckoutPage from './pages/UniversalCheckoutPage';
import { DemoCheckoutPage } from './pages/DemoCheckoutPage';
import BusinessProfilePage from './pages/BusinessProfilePage';
import BusinessCrmPage from './pages/BusinessCrmPage';
import WalletDashboard from './pages/WalletDashboard';
import AdminPanel from './pages/AdminPanel';
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
import { VerifierSandboxPage } from './pages/VerifierSandboxPage';
import DietaryPassportPage from './pages/DietaryPassportPage';
import DeveloperPortalPage from './pages/DeveloperPortalPage';
import TrustPage from './pages/TrustPage';
import { TrustPulsePage } from './pages/TrustPulsePage';
import { CommunityJuryPage } from './pages/CommunityJuryPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import { WaitlistPage } from './pages/WaitlistPage';
import Web3Page from './pages/Web3Page';
import LiquidityTerminalPage from './pages/LiquidityTerminalPage';
import HospitalityPage from './pages/HospitalityPage';
import AirdropPage from './pages/AirdropPage';
import CityLandingPage from './pages/CityLandingPage';
import LiveSellCustomerPage from './pages/LiveSellCustomerPage';
import LiveSellingPage from './pages/LiveSellingPage';
import FreelancePage from './pages/FreelancePage';
import BackgroundCheckPage from './pages/BackgroundCheckPage';
import BackgroundCheckReportPage from './pages/BackgroundCheckReportPage';
import PpdWizardPage from './pages/PpdWizardPage';
import TrustPassportPage from './pages/TrustPassportPage';
import PassportDirectoryPage from './pages/PassportDirectoryPage';
import CashOutPage from './pages/CashOutPage';
import TrustBadgeEmbed from './pages/TrustBadgeEmbed';
import OutreachCRMPage from './pages/OutreachCRMPage';
import SearchPage from './pages/SearchPage';
import AboutPage from './pages/AboutPage';
import ShariaCompliancePage from './pages/ShariaCompliancePage';
import { PublicCustomerProfilePage } from './pages/PublicCustomerProfilePage';
import { PublicPassportPage } from './pages/PublicPassportPage';
import { PassportDashboardPage } from './pages/PassportDashboardPage';
import BusinessAnalyticsPage from './pages/BusinessAnalyticsPage';
import { PluginManagerPage } from './pages/PluginManagerPage';
import ShopifyAppBridge from './pages/ShopifyAppBridge';
import LoanDashboard from './pages/LoanDashboard';
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

  const DashboardPage = () => {
    if (!isAuthenticated) return <Navigate to="/login" />;
    if (user?.role === 'ADMIN') return <AdminPanel />;
    if (user?.role === 'BUSINESS_OWNER') return <BusinessDashboard />;
    if (user?.role === 'FREELANCER') return <Navigate to="/freelance" replace />;
    return <Navigate to="/freelance" replace />; // Default for customers for now
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
          <Route path="/airdrop" element={<PublicSEO seo={{ title: 'Pabandi Airdrop', description: 'Check your eligibility for the Pabandi airdrop. Review wallet status, $PAB rewards, and trust-score requirements.' }}><AirdropPage /></PublicSEO>} />
          <Route path="/city/:slug" element={<CityLandingPage />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<PublicSEO seo={{ title: 'Pabandi | Commitment, Secured.', description: 'Find trusted local hospitality, live sellers, freelancers, and gig workers near you. Book with escrow-backed deposits and earn $PAB rewards on Pabandi.' }}><HomePage /></PublicSEO>} />
            <Route path="search" element={<SearchPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="sharia-compliance" element={<ShariaCompliancePage />} />

            {/* Unified auth page for both login & register */}
            <Route
              path="login"
              element={isAuthenticated ? <Navigate to="/dashboard" /> : <AuthPage />}
            />
            <Route
              path="register"
              element={isAuthenticated ? <Navigate to="/dashboard" /> : <AuthPage />}
            />

            <Route path="/wallet" element={<WalletDashboard />} />
            <Route path="/loans" element={<LoanDashboard />} />
            <Route path="/lp-terminal" element={<LiquidityTerminalPage />} />
            <Route path="/social-graph" element={<div className="p-8">Social Graph Content Here</div>} />

            <Route path="/waitlist" element={<WaitlistPage />} />
            <Route path="/shopify-app" element={<ShopifyAppBridge />} />
            
            <Route path="/u/:slug" element={<PublicCustomerProfilePage />} />
            <Route path="business/:id" element={<BusinessProfilePage />} />
            <Route path="checkout/:sessionId" element={<CheckoutSessionPage />} />
            <Route path="checkout-success" element={<CheckoutSuccessPage />} />
            <Route path="checkout-cancel" element={<CheckoutCancelPage />} />
            <Route path="user/:id" element={<PublicCustomerProfilePage />} />
            <Route path="b/:slug" element={<ShortLinkBookingPage />} />
            <Route path="business/:id/book" element={<BookingPage />} />
            <Route path="auth/callback" element={<AuthCallbackPage />} />
            <Route path="s/:sellerId" element={<UniversalCheckoutPage />} />
            <Route path="t/pay/:sellerId" element={<TapPayPage />} />
            <Route path="demo-checkout" element={<DemoCheckoutPage />} />
            {/* Business partner landing page — public */}
            <Route path="business/join" element={<PublicSEO seo={{ title: 'Join Pabandi | Free Business Registration', description: 'Register your hospitality, live-selling, freelance, or local service business on Pabandi. Free onboarding, escrow-backed bookings, and $PAB rewards.' }}><BusinessJoinPage /></PublicSEO>} />
            <Route path="jobs/:id" element={<JobDetailsPage />} />
            <Route path="join" element={<PublicSEO seo={{ title: 'Join Pabandi | Free Business Registration', description: 'Register your hospitality, live-selling, freelance, or local service business on Pabandi. Free onboarding, escrow-backed bookings, and $PAB rewards.' }}><BusinessJoinPage /></PublicSEO>} />
            <Route path="business/join-claim" element={<PublicSEO seo={{ title: 'Claim Business | Pabandi', description: 'Claim your unclaimed Pabandi business profile with Web3 escrow, AI no-show protection, and Solana $PAB rewards.' }}><BusinessJoinPage /></PublicSEO>} />
            <Route path="business/activate/:id" element={<PublicSEO seo={{ title: 'Business Setup | Pabandi', description: 'Claim your listing, connect checkout, and become booking-ready on Pabandi.' }}><BusinessActivationPage /></PublicSEO>} />
            <Route path="partners/dashboard" element={<PartnerDashboardPage />} />
            <Route path="pricing" element={<PublicSEO seo={{ title: 'Pabandi Pricing | Hospitality & Live Selling Plans', description: 'Explore Pabandi pricing for hospitality properties, live sellers, and freelancers. Free starter plans, escrow-backed deposits, and $PAB rewards.' }}><BusinessModelPage /></PublicSEO>} />
            <Route path="business-model" element={<PublicSEO seo={{ title: 'Pabandi Business Model | Escrow Commissions & Rewards', description: 'Understand Pabandi revenue, escrow commissions, $PAB tokenomics, and trust incentives for sellers, buyers, and hosts.' }}><BusinessModelPage /></PublicSEO>} />
            <Route path="technology" element={<TechnologyPage />} />
            <Route path="web3" element={<Web3Page />} />
            <Route path="hospitality" element={<HospitalityPage />} />
            <Route path="live-sell" element={<LiveSellCustomerPage />} />
            <Route path="live-selling" element={<LiveSellingPage />} />
            <Route path="freelance" element={<FreelancePage />} />
            <Route path="background-check" element={<BackgroundCheckPage />} />
            <Route path="background-check/:id" element={<BackgroundCheckReportPage />} />
            <Route path="protected-deposit" element={<PpdWizardPage />} />
            <Route path="trust/:handle" element={<TrustPassportPage />} />
            <Route path="trust" element={<PassportDirectoryPage />} />
            <Route path="cashout" element={<CashOutPage />} />
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
            <Route path="shopify/app" element={<ShopifyAppBridge />} />

            <Route
              path="dashboard"
              element={<DashboardPage />}
            />
            <Route
              path="business/register"
              element={isAuthenticated ? <BusinessRegister /> : <Navigate to="/login" />}
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
              element={isAuthenticated ? <WalletDashboard /> : <Navigate to="/login" />}
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
          <Route path="/badge/:handle" element={<TrustBadgeEmbed />} />
        </Routes>
      </LanguageProvider>
    </HelmetProvider>
  );
}

export default App;
