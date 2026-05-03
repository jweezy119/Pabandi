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
import WalletDashboard from './pages/WalletDashboard';
import AdminPanel from './pages/AdminPanel';
import BusinessJoinPage from './pages/BusinessJoinPage';
import BusinessSettingsPage from './pages/BusinessSettingsPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

function App() {
  const { isAuthenticated, user } = useAuthStore();

  // Smart dashboard: route to correct page based on role
  const DashboardPage = () => {
    if (!isAuthenticated) return <Navigate to="/login" />;
    if (user?.role === 'ADMIN') return <AdminPanel />;
    if (user?.role === 'BUSINESS_OWNER') return <BusinessDashboard />;
    return <BusinessDashboard />; // fallback (CustomerDashboard coming soon)
  };

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />

        {/* Unified auth page for both login & register */}
        <Route
          path="login"
          element={isAuthenticated ? <Navigate to="/dashboard" /> : <AuthPage />}
        />
        <Route
          path="register"
          element={isAuthenticated ? <Navigate to="/dashboard" /> : <AuthPage />}
        />

        <Route path="business/:id/book" element={<BookingPage />} />
        <Route path="auth/callback" element={<AuthCallbackPage />} />
        {/* Business partner landing page — public */}
        <Route path="join" element={<BusinessJoinPage />} />
        <Route path="business/join" element={<BusinessJoinPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password/:token" element={<ResetPasswordPage />} />

        <Route
          path="dashboard"
          element={<DashboardPage />}
        />
        <Route
          path="business/register"
          element={isAuthenticated ? <BusinessRegister /> : <Navigate to="/login" />}
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
      </Route>
    </Routes>
  );
}

export default App;
