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

function App() {
  const { isAuthenticated } = useAuthStore();

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

        <Route
          path="dashboard"
          element={isAuthenticated ? <BusinessDashboard /> : <Navigate to="/login" />}
        />
        <Route
          path="business/register"
          element={isAuthenticated ? <BusinessRegister /> : <Navigate to="/login" />}
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
