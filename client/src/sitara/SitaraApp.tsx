// Sitara OS — Main App Shell
// Mounted at /sitara/* in the main app. All inner routes are relative
// so the whole sub-app moves cleanly if the mount point changes.
import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useSitaraStore } from './store/sitaraStore';
import { sitaraApi } from './api/sitaraApi';
import { calculateTier } from './utils/starPower';
import ConsumerLayout from './apps/consumer/ConsumerLayout';
import OperatorLayout from './apps/operator/OperatorLayout';
import TenantLayout from './apps/tenant/TenantLayout';

// Consumer Pages
import DiscoveryPage from './pages/DiscoveryPage';
import BookingFlowPage from './pages/BookingFlowPage';
import CheckInPage from './pages/CheckInPage';
import ReviewPage from './pages/ReviewPage';
import StarCardPage from './pages/StarCardPage';
import MyBookingsPage from './pages/MyBookingsPage';
import PromosInboxPage from './pages/PromosInboxPage';
import PromoterDashboardPage from './pages/PromoterDashboardPage';

// Operator Pages
import OperatorDashboard from './pages/OperatorDashboard';
import BusinessStarCardPage from './pages/BusinessStarCardPage';
import OperatorReservationsPage from './pages/OperatorReservationsPage';
import OperatorReviewsPage from './pages/OperatorReviewsPage';
import UnitsPage from './pages/UnitsPage';
import TenantsPage from './pages/TenantsPage';
import LeasesPage from './pages/LeasesPage';
import PromosPage from './pages/PromosPage';
import StarFinderPage from './pages/StarFinderPage';

// Tenant Pages
import TenantDashboard from './pages/TenantDashboard';
import TenantLeasePage from './pages/TenantLeasePage';
import TenantPaymentsPage from './pages/TenantPaymentsPage';
import TenantMaintenancePage from './pages/TenantMaintenancePage';
import CustomersPage from './pages/CustomersPage';

/**
 * Single sign-in: mirror the main Pabandi session into the Sitara store so
 * every Sitara page (Star Card, bookings, promos, promoter) just works
 * after one login. Demo (signed-out) state is left untouched.
 */
function useLinkedSession() {
  const { user: authUser, isAuthenticated } = useAuthStore();
  const { user, setUser } = useSitaraStore();

  useEffect(() => {
    if (!isAuthenticated || !authUser) return;
    if (user?.id === authUser.id) return; // already linked
    let cancelled = false;
    (async () => {
      let starPower = 0;
      let tier: string | null = null;
      let checkIns = 0;
      try {
        const p = await sitaraApi.getStarPower(authUser.id);
        starPower = p.totalPoints;
        tier = p.tier;
        checkIns = p.starCard?.verifiedCheckIns ?? p.reviews?.length ?? 0;
      } catch {
        // New user with no Star Power yet — defaults stand.
      }
      if (cancelled) return;
      setUser({
        id: authUser.id,
        email: authUser.email,
        name: `${authUser.firstName} ${authUser.lastName}`.trim() || authUser.email,
        role: user?.role || 'consumer',
        starPower,
        starTier: ((tier as any) || calculateTier(starPower)) as 'tara' | 'sitara-e-noor' | 'sitara-e-roshan' | 'sitara-e-darakshan' | 'sitara-e-izzat',
        verifiedCheckIns: checkIns,
        reliabilityScore: authUser.reliabilityScore ?? user?.reliabilityScore ?? 100,
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authUser?.id]);
}

export default function SitaraApp() {
  useLinkedSession();
  return (
    <div className="sitara">
    <Routes>
      {/* Consumer App — /sitara, /sitara/book/:id, ... */}
      <Route element={<ConsumerLayout />}>
        <Route index element={<DiscoveryPage />} />
        <Route path="book/:businessId" element={<BookingFlowPage />} />
        <Route path="checkin/:bookingId" element={<CheckInPage />} />
        <Route path="review/:bookingId" element={<ReviewPage />} />
        <Route path="star-card" element={<StarCardPage />} />
        <Route path="my-bookings" element={<MyBookingsPage />} />
        <Route path="promos" element={<PromosInboxPage />} />
        <Route path="promoter" element={<PromoterDashboardPage />} />
      </Route>

      {/* Operator App — /sitara/operator/... */}
      <Route path="operator" element={<OperatorLayout />}>
        <Route index element={<OperatorDashboard />} />
        <Route path="stars" element={<BusinessStarCardPage />} />
        <Route path="reservations" element={<OperatorReservationsPage />} />
        <Route path="reviews" element={<OperatorReviewsPage />} />
        <Route path="units" element={<UnitsPage />} />
        <Route path="tenants" element={<TenantsPage />} />
        <Route path="leases" element={<LeasesPage />} />
        <Route path="promos" element={<PromosPage />} />
        <Route path="star-finder" element={<StarFinderPage />} />
        <Route path="customers" element={<CustomersPage />} />
      </Route>

      {/* Tenant Portal — /sitara/tenant/... */}
      <Route path="tenant" element={<TenantLayout />}>
        <Route index element={<TenantDashboard />} />
        <Route path="lease" element={<TenantLeasePage />} />
        <Route path="payments" element={<TenantPaymentsPage />} />
        <Route path="maintenance" element={<TenantMaintenancePage />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/sitara" replace />} />
    </Routes>
    </div>
  );
}
