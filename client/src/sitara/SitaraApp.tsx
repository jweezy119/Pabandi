// Sitara OS — Main App Shell
// Mounted at /sitara/* in the main app. All inner routes are relative
// so the whole sub-app moves cleanly if the mount point changes.
import { Routes, Route, Navigate } from 'react-router-dom';
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

export default function SitaraApp() {
  return (
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
  );
}
