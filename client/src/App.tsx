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
import BookingPage from './pages/BookingPage';
import ShortLinkBookingPage from './pages/ShortLinkBookingPage';
import BusinessProfilePage from './pages/BusinessProfilePage';
import BusinessCrmPage from './pages/BusinessCrmPage';
import WalletDashboard from './pages/WalletDashboard';
import AdminPanel from './pages/AdminPanel';
import BusinessJoinPage from './pages/BusinessJoinPage';
import BusinessModelPage from './pages/BusinessModelPage';
import TechnologyPage from './pages/TechnologyPage';
import ContactPage from './pages/ContactPage';
import BusinessSettingsPage from './pages/BusinessSettingsPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ProfilePage from './pages/ProfilePage';
import DeveloperPortalPage from './pages/DeveloperPortalPage';
import TrustPage from './pages/TrustPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import { WaitlistPage } from './pages/WaitlistPage';
import Web3Page from './pages/Web3Page';
import HospitalityPage from './pages/HospitalityPage';
import AirdropPage from './pages/AirdropPage';
import CityLandingPage from './pages/CityLandingPage';
import OutreachCRMPage from './pages/OutreachCRMPage';
import SearchPage from './pages/SearchPage';
import AboutPage from './pages/AboutPage';
import { LanguageProvider } from './context/LanguageContext';

function App() {
  const { isAuthenticated, user } = useAuthStore();

  // Smart dashboard: route to correct page based on role
  const DashboardPage = () => {
    if (!isAuthenticated) return <Navigate to="/login" />;
    if (user?.role === 'ADMIN') return <AdminPanel />;
    if (user?.role === 'BUSINESS_OWNER') return <BusinessDashboard />;
    return <Navigate to="/wallet" replace />;
  };

  return (
    <LanguageProvider>
      <Routes>
        <Route path="/waitlist" element={<WaitlistPage />} />
        <Route path="/airdrop" element={<AirdropPage />} />
        <Route path="/karachi" element={<CityLandingPage />} />
        <Route path="/lahore" element={<CityLandingPage />} />
        <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="about" element={<AboutPage />} />

        {/* Unified auth page for both login & register */}
        <Route
          path="login"
          element={isAuthenticated ? <Navigate to="/dashboard" /> : <AuthPage />}
        />
        <Route
          path="register"
          element={isAuthenticated ? <Navigate to="/dashboard" /> : <AuthPage />}
        />

        <Route path="business/:id" element={<BusinessProfilePage />} />
        <Route path="business/:id/book" element={<BookingPage />} />
        <Route path="b/:slug" element={<ShortLinkBookingPage />} />
        <Route path="auth/callback" element={<AuthCallbackPage />} />
        {/* Business partner landing page — public */}
        <Route path="join" element={<BusinessJoinPage />} />
        <Route path="business/join" element={<BusinessJoinPage />} />
        <Route path="pricing" element={<BusinessModelPage />} />
        <Route path="business-model" element={<BusinessModelPage />} />
        <Route path="technology" element={<TechnologyPage />} />
        <Route path="web3" element={<Web3Page />} />
        <Route path="hospitality" element={<HospitalityPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password/:token" element={<ResetPasswordPage />} />
        {/* B2B Intelligence API developer portal — public */}
        <Route path="developer" element={<DeveloperPortalPage />} />
        {/* Social & Professional Trust Layer — public */}
        <Route path="trust" element={<TrustPage />} />
        {/* Privacy Policy */}
        <Route path="privacy" element={<PrivacyPolicyPage />} />
        {/* Terms of Service */}
        <Route path="terms" element={<TermsOfServicePage />} />

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
        </Route>
      </Routes>
    </LanguageProvider>
  );
}

export default App;
