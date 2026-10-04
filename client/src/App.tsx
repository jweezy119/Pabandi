import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
// ─── Route-level code splitting ─────────────────────────────────────────────
//
// Every page used to be imported eagerly: 221 static imports meant the whole product
// shipped as ONE 3.76 MB bundle (0.93 MB gzipped) that a phone had to download before
// anything rendered. On a mid-range device over 3G that is roughly twenty seconds of blank
// screen, and it is the single largest thing making the site feel slow on mobile.
//
// So pages load on demand. `lazy()` splits at the route, and the <Suspense> boundary in
// AnimatedAppRoutes holds the frame while a chunk arrives.
//
// The 9 non-page imports above stay eager on purpose: providers, the auth store, the API
// client and the layout shell are needed by almost every route, so splitting them would
// add a waterfall without saving anything.
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const BusinessPage = lazy(() => import('./pages/BusinessPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const LedgerInvoiceNewPage = lazy(() => import('./pages/ledger/LedgerInvoiceNewPage'));
const LedgerExpenseNewPage = lazy(() => import('./pages/ledger/LedgerExpenseNewPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage })));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'));
const OAuthConsentPage = lazy(() => import('./pages/OAuthConsentPage'));
const PlaceholderPage = lazy(() => import('./pages/PlaceholderPage'));
const ReservationsPage = lazy(() => import('./pages/ReservationsPage'));
const NewReservationPage = lazy(() => import('./pages/NewReservationPage'));
const CheckoutSessionPage = lazy(() => import('./pages/CheckoutSessionPage').then((m) => ({ default: m.CheckoutSessionPage })));
const PersonalDashboardPage = lazy(() => import('./pages/me/PersonalDashboardPage'));
const PersonalPassportPage = lazy(() => import('./pages/me/PersonalPassportPage'));
const PersonalBookingsPage = lazy(() => import('./pages/me/PersonalBookingsPage'));
const PersonalRewardsPage = lazy(() => import('./pages/me/PersonalRewardsPage'));
const PersonalWalletPage = lazy(() => import('./pages/me/PersonalWalletPage'));
const PayInvoicePage = lazy(() => import('./pages/PayInvoicePage'));
const CheckoutSuccessPage = lazy(() => import('./pages/CheckoutSuccessPage'));
const CheckoutCancelPage = lazy(() => import('./pages/CheckoutCancelPage'));
const BookingPage = lazy(() => import('./pages/BookingPage'));
const BookingExperience = lazy(() => import('./pages/BookingExperience'));
const NightlifePage = lazy(() => import('./pages/NightlifePage'));
const PromoterOS = lazy(() => import('./pages/PromoterOS'));
const AgentControlPanel = lazy(() => import('./pages/AgentControlPanel'));
const AgentMarketplacePage = lazy(() => import('./pages/AgentMarketplacePage'));
const AgentProfilePage = lazy(() => import('./pages/AgentProfilePage'));
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage'));
const TapPayPage = lazy(() => import('./pages/TapPayPage'));
const UniversalCheckoutPage = lazy(() => import('./pages/UniversalCheckoutPage'));
const DemoCheckoutPage = lazy(() => import('./pages/DemoCheckoutPage').then((m) => ({ default: m.DemoCheckoutPage })));
const LegacyBusinessProfilePage = lazy(() => import('./pages/BusinessProfilePage'));
const BusinessCrmPage = lazy(() => import('./pages/BusinessCrmPage'));
const BusinessJoinPage = lazy(() => import('./pages/BusinessJoinPage'));
const PostBusinessPage = lazy(() => import('./pages/PostBusinessPage'));
const BusinessActivationPage = lazy(() => import('./pages/BusinessActivationPage'));
const BusinessModelPage = lazy(() => import('./pages/BusinessModelPage'));
const TechnologyPage = lazy(() => import('./pages/TechnologyPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const BusinessSettingsPage = lazy(() => import('./pages/BusinessSettingsPage'));
const LegacyNotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const ProfilesPage = lazy(() => import('./pages/ProfilesPage'));
const ProfileDetailPage = lazy(() => import('./pages/ProfileDetailPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const ReferAndEarnPage = lazy(() => import('./pages/ReferAndEarnPage').then((m) => ({ default: m.ReferAndEarnPage })));
const VerifierSandboxPage = lazy(() => import('./pages/VerifierSandboxPage').then((m) => ({ default: m.VerifierSandboxPage })));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })));
const AdminSetupPage = lazy(() => import('./pages/AdminSetupPage').then((m) => ({ default: m.AdminSetupPage })));
const DietaryPassportPage = lazy(() => import('./pages/DietaryPassportPage'));
const DeveloperPortalPage = lazy(() => import('./pages/DeveloperPortalPage'));
const PartnerDirectoryPage = lazy(() => import('./pages/PartnerDirectoryPage'));
const GrantsPage = lazy(() => import('./pages/GrantsPage'));
const TrustPulsePage = lazy(() => import('./pages/TrustPulsePage').then((m) => ({ default: m.TrustPulsePage })));
const CommunityJuryPage = lazy(() => import('./pages/CommunityJuryPage').then((m) => ({ default: m.CommunityJuryPage })));
const WaitlistPage = lazy(() => import('./pages/WaitlistPage').then((m) => ({ default: m.WaitlistPage })));
const ReferralLandingPage = lazy(() => import('./pages/ReferralLandingPage').then((m) => ({ default: m.ReferralLandingPage })));
const MarketplacePartnerPage = lazy(() => import('./pages/MarketplacePartnerPage'));
const SalePage = lazy(() => import('./pages/SalePage'));
const CRMPage = lazy(() => import('./pages/CRMPage'));
const SalesCRMPage = lazy(() => import('./pages/SalesCRMPage'));
const TenantWorkflowPage = lazy(() => import('./pages/TenantWorkflowPage').then((m) => ({ default: m.TenantWorkflowPage })));
const AIAssistantPage = lazy(() => import('./pages/AIAssistantPage').then((m) => ({ default: m.AIAssistantPage })));
const AITenantRiskPage = lazy(() => import('./pages/AITenantRiskPage').then((m) => ({ default: m.AITenantRiskPage })));
const AILeaseAnomalyPage = lazy(() => import('./pages/AILeaseAnomalyPage').then((m) => ({ default: m.AILeaseAnomalyPage })));
const AIRentOptimizerPage = lazy(() => import('./pages/AIRentOptimizerPage').then((m) => ({ default: m.AIRentOptimizerPage })));
const PaymentTestPage = lazy(() => import('./pages/PaymentTestPage'));
const PropertyDetailPage = lazy(() => import('./pages/PropertyDetailPage'));
const PublicPropertiesPage = lazy(() => import('./pages/PublicPropertiesPage'));
const TenantPortalPage = lazy(() => import('./pages/TenantPortalPage'));
const TenantDashboardPage = lazy(() => import('./pages/TenantDashboardPage'));
const TenantPortalDashboard = lazy(() => import('./pages/TenantPortalDashboard'));
const RentPayment = lazy(() => import('./pages/RentPayment'));
const MaintenanceRequest = lazy(() => import('./pages/MaintenanceRequest'));
const LeaseView = lazy(() => import('./pages/LeaseView'));
const OnboardingWizard = lazy(() => import('./pages/onboarding/OnboardingWizard'));
const CustomerBookingPage = lazy(() => import('./pages/booking/CustomerBookingPage'));
const BusinessDashboard = lazy(() => import('./pages/dashboard/BusinessDashboard'));
const PaymentHistory = lazy(() => import('./pages/PaymentHistory'));
const EnhancedDashboardPage = lazy(() => import('./pages/EnhancedDashboardPage'));
const DisputeCenterPage = lazy(() => import('./pages/DisputeCenterPage'));
const MaintenancePage = lazy(() => import('./pages/MaintenancePage'));
const ApplicationsPage = lazy(() => import('./pages/ApplicationsPage'));
const SafeMeetPage = lazy(() => import('./pages/SafeMeetPage'));
const EscrowPage = lazy(() => import('./pages/EscrowPage'));
const DocumentsPage = lazy(() => import('./pages/DocumentsPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const LeaseGeneratorPage = lazy(() => import('./pages/LeaseGeneratorPage'));
const RentRollPage = lazy(() => import('./pages/RentRollPage'));
const TrustPassportPage = lazy(() => import('./pages/TrustPassportPage'));
const RewardsPage = lazy(() => import('./pages/RewardsPage'));
const ListingDetailPage = lazy(() => import('./pages/ListingDetailPage'));
const CalculatorPage = lazy(() => import('./pages/CalculatorPage'));
const SmartSearchPage = lazy(() => import('./pages/SmartSearchPage'));
const AiChatPage = lazy(() => import('./pages/AiChatPage'));
const AiPropertyAnalyzerPage = lazy(() => import('./pages/AiPropertyAnalyzerPage'));
const MarketIntelligencePage = lazy(() => import('./pages/MarketIntelligencePage'));
const PortfolioAnalyzerPage = lazy(() => import('./pages/PortfolioAnalyzerPage'));
const AdvancedPropertyIntelligencePage = lazy(() => import('./pages/AdvancedPropertyIntelligencePage'));
const TokenomicsPage = lazy(() => import('./pages/TokenomicsPage'));
const WalletPage = lazy(() => import('./pages/WalletPage'));
const OnRampPage = lazy(() => import('./pages/OnRampPage'));
const OffRampPage = lazy(() => import('./pages/OffRampPage'));
const TokenFlowPage = lazy(() => import('./pages/TokenFlowPage'));
const EscrowDetailPage = lazy(() => import('./pages/EscrowDetailPage'));
const MarketplacePage = lazy(() => import('./pages/MarketplacePage'));
const BrowseHotelsPage = lazy(() => import('./pages/BrowseHotelsPage'));
const BuilderDashboard = lazy(() => import('./pages/realestate/BuilderDashboard'));
const BuilderProjectPage = lazy(() => import('./pages/realestate/BuilderProjectPage'));
const BuyerPortal = lazy(() => import('./pages/realestate/BuyerPortal'));
const CODMarketplace = lazy(() => import('./pages/cod/CODMarketplace'));
const CreateEscrow = lazy(() => import('./pages/cod/CreateEscrow'));
const EscrowDetail = lazy(() => import('./pages/cod/EscrowDetail'));
const DemoWalkthroughPage = lazy(() => import('./pages/DemoWalkthroughPage'));
const Web3Page = lazy(() => import('./pages/Web3Page'));
const LiquidityTerminalPage = lazy(() => import('./pages/LiquidityTerminalPage'));
const HospitalityPage = lazy(() => import('./pages/HospitalityPage'));
const RealEstateScreeningPage = lazy(() => import('./pages/RealEstateScreeningPage'));
const AirdropPage = lazy(() => import('./pages/AirdropPage'));
const UsdyPage = lazy(() => import('./pages/UsdyPage'));
const SolanaEscrowPage = lazy(() => import('./pages/SolanaEscrowPage'));
const CityLandingPage = lazy(() => import('./pages/CityLandingPage'));
const LiveSellCustomerPage = lazy(() => import('./pages/LiveSellCustomerPage'));
const LiveSellingPage = lazy(() => import('./pages/LiveSellingPage'));
const FreelancePage = lazy(() => import('./pages/FreelancePage'));
const BackgroundCheckPage = lazy(() => import('./pages/BackgroundCheckPage'));
const AgentPassportPage = lazy(() => import('./pages/AgentPassportPage'));
const RevenuePage = lazy(() => import('./pages/RevenuePage'));
const BackgroundCheckReportPage = lazy(() => import('./pages/BackgroundCheckReportPage'));
const PromoPage = lazy(() => import('./pages/PromoPage'));
const PromotionsPage = lazy(() => import('./pages/PromotionsPage'));
const FiatPaymentPage = lazy(() => import('./pages/FiatPaymentPage'));
const PpdWizardPage = lazy(() => import('./pages/PpdWizardPage'));
const PassportDirectoryPage = lazy(() => import('./pages/PassportDirectoryPage'));
const CashOutPage = lazy(() => import('./pages/CashOutPage'));
const PayrollPage = lazy(() => import('./pages/PayrollPage'));
const ArbitrationPage = lazy(() => import('./pages/ArbitrationPage'));
const OutreachCRMPage = lazy(() => import('./pages/OutreachCRMPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const DarazScannerPage = lazy(() => import('./pages/DarazScannerPage'));
const FreelanceStorefrontPage = lazy(() => import('./pages/FreelanceStorefrontPage'));
const MudarabahPoolsPage = lazy(() => import('./pages/MudarabahPoolsPage').then((m) => ({ default: m.MudarabahPoolsPage })));
const ServiceBusinessDashboard = lazy(() => import('./pages/crm/ServiceBusinessDashboard'));
const BusinessWorkspaceShell = lazy(() => import('./pages/business-os/BusinessWorkspaceShell'));
const ProfitDashboardPage = lazy(() => import('./pages/ProfitDashboardPage'));
const ShariaTransparencyPage = lazy(() => import('./pages/ShariaTransparencyPage').then((m) => ({ default: m.ShariaTransparencyPage })));
const PublicCustomerProfilePage = lazy(() => import('./pages/PublicCustomerProfilePage').then((m) => ({ default: m.PublicCustomerProfilePage })));
const PublicPassportPage = lazy(() => import('./pages/PublicPassportPage').then((m) => ({ default: m.PublicPassportPage })));
const TrustProfilePage = lazy(() => import('./pages/public/TrustProfilePage').then((m) => ({ default: m.TrustProfilePage })));
const PassportDashboardPage = lazy(() => import('./pages/PassportDashboardPage').then((m) => ({ default: m.PassportDashboardPage })));
const EconomyDashboardPage = lazy(() => import('./pages/EconomyDashboardPage'));
const BusinessAnalyticsPage = lazy(() => import('./pages/BusinessAnalyticsPage'));
const PluginManagerPage = lazy(() => import('./pages/PluginManagerPage').then((m) => ({ default: m.PluginManagerPage })));
const ActiveJobsPage = lazy(() => import('./pages/ActiveJobsPage'));
const JobWorkspacePage = lazy(() => import('./pages/JobWorkspacePage'));
const PartnerDashboardPage = lazy(() => import('./pages/PartnerDashboardPage'));
const JobDetailsPage = lazy(() => import('./pages/JobDetailsPage'));
const PropertyOSPage = lazy(() => import('./pages/property/PropertyOSPage'));
const PropertyTenantsPage = lazy(() => import('./pages/property/PropertyTenantsPage'));
const PropertyTenantDetailPage = lazy(() => import('./pages/property/PropertyTenantDetailPage'));
const PropertyLeasesPage = lazy(() => import('./pages/property/PropertyLeasesPage'));
const PropertyMaintenancePage = lazy(() => import('./pages/property/PropertyMaintenancePage'));
const PropertyFinancialsPage = lazy(() => import('./pages/property/PropertyFinancialsPage'));
const FreightOSPage = lazy(() => import('./pages/freight/FreightOSPage'));
const FreightPostLoadPage = lazy(() => import('./pages/freight/FreightPostLoadPage'));
const FreightMyLoadsPage = lazy(() => import('./pages/freight/FreightMyLoadsPage'));
const FreightCarriersPage = lazy(() => import('./pages/freight/FreightCarriersPage'));
const FreightRateCalculatorPage = lazy(() => import('./pages/freight/FreightRateCalculatorPage'));
const BookingOSPage = lazy(() => import('./pages/booking/BookingOSPage'));
const BookingFlowPage = lazy(() => import('./pages/booking/BookingFlowPage'));
const ContactOSPage = lazy(() => import('./pages/contact/ContactOSPage'));
const ContactClientsPage = lazy(() => import('./pages/contact/ContactClientsPage'));
const ContactClientDetailPage = lazy(() => import('./pages/contact/ContactClientDetailPage'));
const ContactDealsPage = lazy(() => import('./pages/contact/ContactDealsPage'));
const ContactDealDetailPage = lazy(() => import('./pages/contact/ContactDealDetailPage'));
const ContactActivitiesPage = lazy(() => import('./pages/crm/ContactActivitiesPage').then((m) => ({ default: m.ContactActivitiesPage })));
const ContactTasksPage = lazy(() => import('./pages/crm/ContactTasksPage').then((m) => ({ default: m.ContactTasksPage })));
const ContactTeamPage = lazy(() => import('./pages/crm/ContactTeamPage').then((m) => ({ default: m.ContactTeamPage })));
const ContactTeamMemberPage = lazy(() => import('./pages/crm/ContactTeamMemberPage').then((m) => ({ default: m.ContactTeamMemberPage })));
const ContactAnalyticsPage = lazy(() => import('./pages/crm/ContactAnalyticsPage').then((m) => ({ default: m.ContactAnalyticsPage })));
const InviteAcceptPage = lazy(() => import('./pages/auth/InviteAcceptPage').then((m) => ({ default: m.InviteAcceptPage })));
const ModulesSettingsPage = lazy(() => import('./pages/crm/settings/ModulesSettingsPage'));
const SettingsHubPage = lazy(() => import('./pages/crm/settings/SettingsHubPage').then((m) => ({ default: m.SettingsHubPage })));
const BusinessProfilePage = lazy(() => import('./pages/crm/settings/BusinessProfilePage').then((m) => ({ default: m.BusinessProfilePage })));
const CustomFieldsPage = lazy(() => import('./pages/crm/settings/CustomFieldsPage').then((m) => ({ default: m.CustomFieldsPage })));
const PipelineSettingsPage = lazy(() => import('./pages/crm/settings/PipelineSettingsPage').then((m) => ({ default: m.PipelineSettingsPage })));
const ServiceCatalogPage = lazy(() => import('./pages/crm/settings/ServiceCatalogPage').then((m) => ({ default: m.ServiceCatalogPage })));
const PaymentSettingsPage = lazy(() => import('./pages/crm/settings/PaymentSettingsPage').then((m) => ({ default: m.PaymentSettingsPage })));
const TrustSettingsPage = lazy(() => import('./pages/crm/settings/TrustSettingsPage').then((m) => ({ default: m.TrustSettingsPage })));
const NotificationsPage = lazy(() => import('./pages/crm/settings/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const ApiKeysPage = lazy(() => import('./pages/crm/settings/ApiKeysPage').then((m) => ({ default: m.ApiKeysPage })));
const WebhooksPage = lazy(() => import('./pages/crm/settings/WebhooksPage').then((m) => ({ default: m.WebhooksPage })));
const SetupWizardPage = lazy(() => import('./pages/contact/SetupWizardPage'));
const CapitalOSPage = lazy(() => import('./pages/ledger/LedgerOSPage'));
const LedgerInvoicesPage = lazy(() => import('./pages/ledger/LedgerInvoicesPage'));
const InvoicesPage = lazy(() => import('./pages/crm/InvoicesPage'));
const ContactInvoiceDetailPage = lazy(() => import('./pages/crm/ContactInvoiceDetailPage'));
const ContactMoneyFlowPage = lazy(() => import('./pages/contact/ContactMoneyFlowPage'));
const LedgerExpensesPage = lazy(() => import('./pages/ledger/LedgerExpensesPage'));
const LedgerAccountsPage = lazy(() => import('./pages/ledger/LedgerAccountsPage'));
const LedgerReportsPage = lazy(() => import('./pages/ledger/LedgerReportsPage'));
const ProtocolDashboardPage = lazy(() => import('./pages/ProtocolDashboardPage'));
const ProfileEditorPage = lazy(() => import('./pages/me/ProfileEditorPage'));
const PublicProfilePage = lazy(() => import('./pages/public/PublicProfilePage'));
const FluidBookingPage = lazy(() => import('./pages/booking/FluidBookingPage'));
const BusinessVerificationPage = lazy(() => import('./pages/crm/BusinessVerificationPage'));
const QuickPostPage = lazy(() => import('./pages/crm/QuickPostPage'));
const ValuesPreferencesPage = lazy(() => import('./pages/me/ValuesPreferencesPage'));
const AgentDashboardPage = lazy(() => import('./pages/me/AgentDashboardPage'));
const SupportHomePage = lazy(() => import('./pages/support/SupportHomePage'));
const SupportTicketsPage = lazy(() => import('./pages/support/SupportTicketsPage'));
const SupportTicketDetailPage = lazy(() => import('./pages/support/SupportTicketDetailPage'));
const SupportKbPage = lazy(() => import('./pages/support/SupportKbPage'));
const SupportKbArticlePage = lazy(() => import('./pages/support/SupportKbArticlePage'));
// These four are components rather than pages, but they are rendered on ONE route each
// and they drag in the wallet, Solana, QR and map libraries — around 100 KB gzipped that
// a CRM user never needs. They were the largest thing still in the first load after route
// splitting, so they are deferred too.
const TrustStakingPortal = lazy(() => import('./components/TrustStaking'));
const StakingInterface = lazy(() => import('./components/StakingInterface'));
const EscrowInterface = lazy(() => import('./components/EscrowInterface'));
const AgentInterface = lazy(() => import('./components/AgentInterface'));
const SupportAdminPage = lazy(() => import('./pages/support/SupportAdminPage'));
import { AnimatePresence } from 'framer-motion';
import { useBusinessSettings } from './hooks/useBusinessSettings';

function FeatureGate({ feature, children }: { feature: string; children: React.ReactNode }) {
  const { settings } = useBusinessSettings();
  const enabled = settings.enabledFeatures?.contact ?? [];
  if (!enabled.includes(feature)) {
    return <Navigate to="/contact" replace />;
  }
  return <>{children}</>;
}

import { AppShell } from './components/AppShell';
import { BusinessGuard, PersonalGuard } from './components/RouteGuards';
// import SitaraApp from './sitara/SitaraApp';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import './pages/LandingPage.css';

// import SettingsPage from './pages/SettingsPage';
// import VenueSearchPage from './pages/VenueSearchPage';
// import VenueDetailPage from './pages/VenueDetailPage';
// import BookingCheckoutPage from './pages/BookingCheckoutPage';
// import MyBookingsPage from './pages/MyBookingsPage';
// import RaastConfirmPage from './pages/RaastConfirmPage';
// import PromoterDashboardPage from './pages/PromoterDashboardPage';
// import GuestListPage from './pages/GuestListPage';
// import ShariaCompliancePage from './pages/ShariaCompliancePage';
import { LanguageProvider } from './context/LanguageContext';
import { HelmetProvider } from 'react-helmet-async';
import { useEffect } from 'react';



// PropertyOS
// FreightOS
// BookingOS
// Contact OS
import { ContactJobsPage } from "./pages/crm/ContactJobsPage";
import { ContactJobDetailPage } from "./pages/crm/ContactJobDetailPage";
// CapitalOS

// Support

function AppShellLayout() {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function AnimatedAppRoutes() {
  const { isAuthenticated, user, fetchWalletData } = useAuthStore();
  const location = useLocation();

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

  const AuthRequiredProfilesPage = () => {
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return <ProfilesPage />;
  };

  const AuthRequiredProfileDetailPage = () => {
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return <ProfileDetailPage />;
  };

  return (
    // Routes load on demand, so something has to hold the frame while a chunk arrives.
    //
    // Placed INSIDE AnimatePresence so the fallback participates in the same transition
    // as the page it replaces — outside it, every navigation would flash the exit
    // animation and then hold on a blank frame.
    //
    // The fallback is deliberately near-empty and fills the viewport: a spinner in a
    // centred box on a white page reads as a broken app on mobile, where the visible
    // area is small and the content below it would otherwise jump when it arrives.
    <AnimatePresence mode="wait">
      <Suspense
        fallback={
          <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--clay)]" />
          </div>
        }
      >
      <Routes location={location} key={location.pathname}>
        <Route element={<AppShellLayout />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="wallet" element={<WalletPage />} />
          <Route path="business" element={<BusinessPage />} />
          {/* PropertyOS (formerly AbodeOS) - Property Management */}
          <Route path="property" element={<PropertyOSPage />} />
          <Route path="property/tenants" element={<PropertyTenantsPage />} />
          <Route path="property/tenants/:id" element={<PropertyTenantDetailPage />} />
          <Route path="property/leases" element={<PropertyLeasesPage />} />
          <Route path="property/maintenance" element={<PropertyMaintenancePage />} />
          <Route path="property/financials" element={<PropertyFinancialsPage />} />

          {/* FreightOS (formerly SafOS) - Freight & Logistics */}
          <Route path="freight" element={<FreightOSPage />} />
          <Route path="freight/post-load" element={<FreightPostLoadPage />} />
          <Route path="freight/my-loads" element={<FreightMyLoadsPage />} />
          <Route path="freight/carriers" element={<FreightCarriersPage />} />
          <Route path="freight/rates" element={<FreightRateCalculatorPage />} />

          {/* BookingOS (formerly Sitara) - Booking & Discovery */}
          <Route path="booking" element={<BookingOSPage />} />
          <Route path="booking/flow" element={<BookingFlowPage />} />
          <Route path="pay/:invoiceId" element={<PayInvoicePage />} />

           {/* Contact OS - CRM & Sales */}
           <Route path="contact" element={<BusinessGuard><ContactOSPage /></BusinessGuard>} />
           <Route path="contact/clients" element={<BusinessGuard><FeatureGate feature="clients"><ContactClientsPage /></FeatureGate></BusinessGuard>} />
           <Route path="contact/clients/:id" element={<BusinessGuard><FeatureGate feature="clients"><ContactClientDetailPage /></FeatureGate></BusinessGuard>} />
           <Route path="contact/jobs" element={<BusinessGuard><FeatureGate feature="jobs"><ContactJobsPage businessId={user?.businessId || 'default'} /></FeatureGate></BusinessGuard>} />
           <Route path="contact/jobs/:id" element={<BusinessGuard><FeatureGate feature="jobs"><ContactJobDetailPage /></FeatureGate></BusinessGuard>} />
           <Route path="contact/deals" element={<BusinessGuard><FeatureGate feature="deals"><ContactDealsPage /></FeatureGate></BusinessGuard>} />
           <Route path="contact/deals/:id" element={<BusinessGuard><FeatureGate feature="deals"><ContactDealDetailPage /></FeatureGate></BusinessGuard>} />
           <Route path="contact/activities" element={<BusinessGuard><FeatureGate feature="activities"><ContactActivitiesPage /></FeatureGate></BusinessGuard>} />
           <Route path="contact/tasks" element={<BusinessGuard><FeatureGate feature="tasks"><ContactTasksPage /></FeatureGate></BusinessGuard>} />
           <Route path="contact/team" element={<BusinessGuard><FeatureGate feature="team"><ContactTeamPage /></FeatureGate></BusinessGuard>} />
           <Route path="contact/team/:id" element={<BusinessGuard><FeatureGate feature="team"><ContactTeamMemberPage /></FeatureGate></BusinessGuard>} />
           <Route path="contact/reports" element={<BusinessGuard><ContactAnalyticsPage /></BusinessGuard>} />
           <Route path="invite/accept" element={<InviteAcceptPage />} />
           <Route path="contact/invoices" element={<BusinessGuard><FeatureGate feature="invoices"><InvoicesPage /></FeatureGate></BusinessGuard>} />
           <Route path="contact/invoices/:id" element={<BusinessGuard><FeatureGate feature="invoices"><ContactInvoiceDetailPage /></FeatureGate></BusinessGuard>} />
          <Route path="contact/money-flow" element={<BusinessGuard><FeatureGate feature="invoices"><ContactMoneyFlowPage /></FeatureGate></BusinessGuard>} />
           <Route path="contact/settings" element={<BusinessGuard><SettingsHubPage /></BusinessGuard>} />
           <Route path="contact/settings/profile" element={<BusinessGuard><BusinessProfilePage /></BusinessGuard>} />
           <Route path="contact/settings/modules" element={<BusinessGuard><ModulesSettingsPage /></BusinessGuard>} />
           <Route path="contact/settings/custom-fields" element={<BusinessGuard><CustomFieldsPage /></BusinessGuard>} />
           <Route path="contact/settings/pipeline" element={<BusinessGuard><PipelineSettingsPage /></BusinessGuard>} />
           <Route path="contact/settings/services" element={<BusinessGuard><ServiceCatalogPage /></BusinessGuard>} />
           <Route path="contact/settings/payment" element={<BusinessGuard><PaymentSettingsPage /></BusinessGuard>} />
           <Route path="contact/settings/trust" element={<BusinessGuard><TrustSettingsPage /></BusinessGuard>} />
          <Route path="contact/settings/notifications" element={<NotificationsPage />} />
          <Route path="contact/settings/api-keys" element={<ApiKeysPage />} />
          <Route path="contact/settings/webhooks" element={<WebhooksPage />} />
          {/* Was unguarded, so a personal-mode user could reach it by typing the URL
              while every other ContactOS route showed the mode gate. It enrolls a
              business, so it belongs behind the same guard. Only ContactOSPage links
              here, and that is already guarded, so nothing that worked before stops. */}
          <Route path="contact/setup" element={<BusinessGuard><SetupWizardPage /></BusinessGuard>} />

          {/* CapitalOS - Finance & Accounting */}
          <Route path="capital" element={<CapitalOSPage />} />
          <Route path="capital/invoices" element={<LedgerInvoicesPage />} />
          {/* The two create CTAs on the finance pages pointed here; without
              these routes the primary action on each page blanked the app. */}
          <Route path="capital/invoices/new" element={<LedgerInvoiceNewPage />} />
          <Route path="capital/expenses/new" element={<LedgerExpenseNewPage />} />
          <Route path="capital/expenses" element={<LedgerExpensesPage />} />
          <Route path="capital/accounts" element={<LedgerAccountsPage />} />
          <Route path="capital/reports" element={<LedgerReportsPage />} />
        </Route>

        {/* Redirects from old routes */}
        <Route path="abode/*" element={<Navigate to="/property" replace />} />
          <Route path="haq/*" element={<Navigate to="/property" replace />} />
          <Route path="saf/*" element={<Navigate to="/freight" replace />} />
          <Route path="sitara/*" element={<Navigate to="/booking" replace />} />
          <Route path="pipeline/*" element={<Navigate to="/contact" replace />} />
          <Route path="discovery" element={<Navigate to="/booking" replace />} />
          <Route path="/ledger/*" element={<Navigate to="/capital" replace />} />

          {/* Other standalone pages (Builder, Buyer, COD, Protocol) */}
          <Route path="builder" element={<BuilderDashboard />} />
          <Route path="builder/projects/:id" element={<BuilderProjectPage />} />
          <Route path="buyer" element={<BuyerPortal />} />
          <Route path="cod" element={<CODMarketplace />} />
          <Route path="cod/create" element={<CreateEscrow />} />
          <Route path="cod/:id" element={<EscrowDetail />} />
          <Route path="protocol" element={<ProtocolDashboardPage />} />
          <Route path="protocol/staking" element={<StakingInterface />} />
          <Route path="protocol/escrow" element={<EscrowInterface />} />
          <Route path="protocol/agents" element={<AgentInterface />} />

          {/* Landing page - standalone, no chrome */}
          <Route path="/" element={<LandingPage />} />

          {/* ALL other routes inside Layout */}
          <Route element={<Layout />}>
            <Route path="home-old" element={<HomePage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="sharia-transparency" element={<ShariaTransparencyPage />} />
            <Route path="mudarabah" element={<MudarabahPoolsPage />} />
            <Route path="profit" element={<ProfitDashboardPage />} />
            <Route path="marketplace/live-selling" element={<PlaceholderPage />} />
            <Route path="marketplace/freelancers" element={<PlaceholderPage />} />
            <Route path="marketplace/gigs" element={<PlaceholderPage />} />
            <Route path="marketplace/hospitality" element={<PlaceholderPage />} />
            <Route path="trust/passports" element={<PlaceholderPage />} />
            <Route path="trust/deposits" element={<PlaceholderPage />} />
            <Route path="trust/escrow" element={<PlaceholderPage />} />
            <Route path="wallet/cashout" element={<PlaceholderPage />} />
            <Route path="blog" element={<PlaceholderPage />} />
            <Route path="privacy" element={<PlaceholderPage />} />
            <Route path="terms" element={<PlaceholderPage />} />

            <Route path="auth/callback" element={<AuthCallbackPage />} />
            <Route path="login" element={<AuthPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="signup" element={<RegisterPage />} />
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
            <Route path="trust/:passportId" element={<TrustProfilePage />} />
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
            <Route path="support" element={<SupportHomePage />} />
            <Route path="support/tickets" element={<SupportTicketsPage />} />
            <Route path="support/tickets/:id" element={<SupportTicketDetailPage />} />
            <Route path="support/kb" element={<SupportKbPage />} />
            <Route path="support/kb/:slug" element={<SupportKbArticlePage />} />
            <Route path="support/admin" element={<SupportAdminPage />} />
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
            <Route path="business/:id" element={<LegacyBusinessProfilePage />} />
            <Route path="business/:id/book" element={<BookingPage />} />
            <Route path="business/activate/:id" element={<BusinessActivationPage />} />
            <Route path="business/crm" element={isAuthenticated ? <BusinessCrmPage /> : <Navigate to="/login" />} />
            <Route path="crm" element={<BusinessGuard>{isAuthenticated ? <ServiceBusinessDashboard /> : <Navigate to="/login" />}</BusinessGuard>} />
            <Route path="post-business" element={<PostBusinessPage />} />
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
            <Route path="b/:slug" element={<CustomerBookingPage />} />
            <Route path="onboarding" element={<OnboardingWizard />} />
            <Route path="dashboard" element={<BusinessDashboard />} />
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
            <Route path="contact-us" element={<ContactPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password/:token" element={<ResetPasswordPage />} />
            <Route path="developer" element={<DeveloperPortalPage />} />
            <Route path="developers" element={<Navigate to="/developer" replace />} />
            <Route path="partners" element={<PartnerDirectoryPage />} />
            <Route path="grants" element={<GrantsPage />} />
            <Route path="promo" element={<PromoPage />} />
            <Route path="promotions" element={<PromotionsPage />} />
            <Route path="daraz-scanner" element={<DarazScannerPage />} />
            <Route path="u/:username" element={<PublicProfilePage />} />
            <Route path="book/:businessSlug" element={<FluidBookingPage />} />
            <Route path="user/:id" element={<PublicCustomerProfilePage />} />
            <Route path="verify-email" element={<VerifyEmailPage />} />
            <Route path="passport/dietary" element={<DietaryPassportPage />} />
            <Route path="demo" element={<DemoWalkthroughPage />} />
            <Route path="notifications" element={<LegacyNotificationsPage />} />
            <Route path="try" element={<Navigate to="/demo" replace />} />
            <Route path="oauth/authorize" element={<OAuthConsentPage />} />
            <Route path="outreach" element={isAuthenticated && user?.role === 'ADMIN' ? <OutreachCRMPage /> : <Navigate to="/login" />} />
            <Route path="partners/dashboard" element={<PartnerDashboardPage />} />
            <Route path="partners/marketplace" element={<MarketplacePartnerPage />} />
            <Route path="sale/:id" element={<SalePage />} />
            <Route path="waitlist" element={<WaitlistPage />} />
            <Route path="r/:code" element={<ReferralLandingPage />} />
            <Route path="city/:slug" element={<CityLandingPage />} />
            <Route path="admin" element={isAuthenticated && user?.role === 'ADMIN' ? <AdminDashboardPage /> : <Navigate to="/admin/setup" />} />
            <Route path="admin/setup" element={<AdminSetupPage />} />
            <Route path="me" element={<PersonalGuard><PersonalDashboardPage /></PersonalGuard>} />
            <Route path="me/passport" element={<PersonalGuard><PersonalPassportPage /></PersonalGuard>} />
            <Route path="me/bookings" element={<PersonalGuard><PersonalBookingsPage /></PersonalGuard>} />
            <Route path="me/rewards" element={<PersonalGuard><PersonalRewardsPage /></PersonalGuard>} />
            <Route path="me/wallet" element={<PersonalGuard><PersonalWalletPage /></PersonalGuard>} />
            <Route path="me/profile" element={<PersonalGuard><ProfileEditorPage /></PersonalGuard>} />
            <Route path="me/verification" element={<PersonalGuard><BusinessVerificationPage /></PersonalGuard>} />
            <Route path="me/quick-post" element={<PersonalGuard><QuickPostPage /></PersonalGuard>} />
            <Route path="me/values" element={<PersonalGuard><ValuesPreferencesPage /></PersonalGuard>} />
            <Route path="me/agent" element={<PersonalGuard><AgentDashboardPage /></PersonalGuard>} />
          </Route>

        {/* Catch-all. Must stay last: React Router matches in declaration order,
            so anything above it keeps priority. Without this, an unmatched path
            renders a blank page — and a blank page has no visible way back, so
            a bad link strands the user on browser Back. */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
    </AnimatePresence>
  );
}

function App() {
  return (
    <HelmetProvider>
      <LanguageProvider>
        <AnimatedAppRoutes />
      </LanguageProvider>
    </HelmetProvider>
  );
}

export default App;
