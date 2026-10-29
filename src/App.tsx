import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { supabase } from './lib/supabase';
import { useAuthStore } from './stores/auth';
import Toast from './components/shared/Toast';
import MaintenanceBanner from './components/shared/MaintenanceBanner';
import OfflineBanner from './components/shared/OfflineBanner';
import ProtectedRoute from './components/shared/ProtectedRoute';
import ErrorBoundary from './components/shared/ErrorBoundary';

// ── Eagerly loaded: auth flow + public pages ──────────────────────────────────
import Landing from './pages/Landing';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import Join from './pages/auth/Join';
import RoleSelect from './pages/auth/RoleSelect';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import Terms from './pages/legal/Terms';
import Privacy from './pages/legal/Privacy';
import Accessibility from './pages/Accessibility';
import FAQ from './pages/FAQ';
import Contact from './pages/Contact';
import RoleLanding from './pages/RoleLanding';
import { BlogIndex, BlogPost } from './pages/blog/Blog';

// ── Eagerly loaded: role shells (always needed when authenticated) ─────────────
import LandlordLayout from './pages/landlord/_layout/LandlordLayout';
import TenantLayout from './pages/tenant/_layout/TenantLayout';
import HandymanLayout from './pages/handyman/_layout/HandymanLayout';

// ── Lazy: landlord pages ──────────────────────────────────────────────────────
const LandlordDashboard = lazy(() => import('./pages/landlord/Dashboard'));
const PropertiesList    = lazy(() => import('./pages/landlord/Properties').then(m => ({ default: m.PropertiesList })));
const PropertyNew       = lazy(() => import('./pages/landlord/Properties').then(m => ({ default: m.PropertyNew })));
const PropertyDetail    = lazy(() => import('./pages/landlord/Properties').then(m => ({ default: m.PropertyDetail })));
const PropertyEdit      = lazy(() => import('./pages/landlord/Properties').then(m => ({ default: m.PropertyEdit })));
const Tenants           = lazy(() => import('./pages/landlord/Tenants'));
const MaintenanceList   = lazy(() => import('./pages/landlord/Maintenance').then(m => ({ default: m.MaintenanceList })));
const MaintenanceDetail = lazy(() => import('./pages/landlord/Maintenance').then(m => ({ default: m.MaintenanceDetail })));
const LandlordRent      = lazy(() => import('./pages/landlord/Rent'));
const MessagesInbox     = lazy(() => import('./pages/landlord/Messages').then(m => ({ default: m.MessagesInbox })));
const MessageThread     = lazy(() => import('./pages/landlord/Messages').then(m => ({ default: m.MessageThread })));
const HandymanThread    = lazy(() => import('./pages/landlord/Messages').then(m => ({ default: m.HandymanThread })));
const Invite            = lazy(() => import('./pages/landlord/Invite'));
const InspectionsList   = lazy(() => import('./pages/landlord/Inspections').then(m => ({ default: m.InspectionsList })));
const InspectionNew     = lazy(() => import('./pages/landlord/Inspections').then(m => ({ default: m.InspectionNew })));
const ExpensesList      = lazy(() => import('./pages/landlord/Expenses').then(m => ({ default: m.ExpensesList })));
const ExpenseNew        = lazy(() => import('./pages/landlord/Expenses').then(m => ({ default: m.ExpenseNew })));
const Documents         = lazy(() => import('./pages/landlord/Documents'));
const Handymen          = lazy(() => import('./pages/landlord/Handymen'));
const LandlordAccount   = lazy(() => import('./pages/landlord/Account').then(m => ({ default: m.Account })));
const LandlordEditProfile = lazy(() => import('./pages/landlord/Account').then(m => ({ default: m.EditProfile })));
const Billing           = lazy(() => import('./pages/landlord/Account').then(m => ({ default: m.Billing })));
const Notifications     = lazy(() => import('./pages/landlord/Notifications'));

// ── Lazy: tenant pages ────────────────────────────────────────────────────────
const TenantDashboard   = lazy(() => import('./pages/tenant/Dashboard'));
const RepairsList       = lazy(() => import('./pages/tenant/Repairs').then(m => ({ default: m.RepairsList })));
const RepairNew         = lazy(() => import('./pages/tenant/Repairs').then(m => ({ default: m.RepairNew })));
const RepairDetail      = lazy(() => import('./pages/tenant/Repairs').then(m => ({ default: m.RepairDetail })));
const TenantRent        = lazy(() => import('./pages/tenant/Rent'));
const ApplicationStatus_ = lazy(() => import('./pages/tenant/Application').then(m => ({ default: m.ApplicationStatus_ })));
const ApplicationFill   = lazy(() => import('./pages/tenant/Application').then(m => ({ default: m.ApplicationFill })));
const TenantMessages    = lazy(() => import('./pages/tenant/TenantMessages'));
const Deposit           = lazy(() => import('./pages/tenant/Deposit'));
const TenantDocuments   = lazy(() => import('./pages/tenant/TenantDocuments'));
const TenantAccount     = lazy(() => import('./pages/tenant/Account'));
const Screening         = lazy(() => import('./pages/tenant/Screening'));

// ── Lazy: handyman pages ──────────────────────────────────────────────────────
const HandymanDashboard = lazy(() => import('./pages/handyman/Dashboard'));
const Jobs              = lazy(() => import('./pages/handyman/Jobs'));
const HandymanProfile   = lazy(() => import('./pages/handyman/Profile'));
const HandymanMessages  = lazy(() => import('./pages/handyman/HandymanMessages'));
const HandymanAccount   = lazy(() => import('./pages/handyman/Account'));

// ── Suspense fallback ─────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-700 rounded-full animate-spin" />
    </div>
  );
}

function NotFound() {
  // SPA rewrites serve every unknown URL with HTTP 200, so search engines see a
  // "soft 404". A client-set noindex keeps junk URLs out of the index.
  useEffect(() => {
    const tag = document.createElement('meta');
    tag.name = 'robots';
    tag.content = 'noindex';
    document.head.appendChild(tag);
    return () => { document.head.removeChild(tag); };
  }, []);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 text-center">
      <p className="text-7xl font-bold text-gray-200 mb-4 select-none">404</p>
      <h1 className="text-xl font-semibold text-gray-800 mb-2">Page not found</h1>
      <p className="text-sm text-gray-500 mb-8">The page you're looking for doesn't exist or has been moved.</p>
      <Link to="/" className="px-6 py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 transition">
        Back to home
      </Link>
    </div>
  );
}

// Captures a ?ref=CODE from any landing URL and, once the visitor is signed in,
// links them to the referrer via the redeem_referral RPC (idempotent server-side).
// Stored in localStorage so it survives the email-confirmation round trip.
function ReferralCapture() {
  const { supabaseUser } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    const ref = new URLSearchParams(location.search).get('ref');
    if (ref) localStorage.setItem('hhh_ref', ref.trim().toUpperCase());
  }, [location.search]);

  useEffect(() => {
    if (!supabaseUser) return;
    const code = localStorage.getItem('hhh_ref');
    if (!code) return;
    supabase.rpc('redeem_referral', { p_code: code }).then(() => localStorage.removeItem('hhh_ref'));
  }, [supabaseUser]);

  return null;
}

// Sends a Google Analytics page_view on every client-side route change, since the
// gtag snippet in index.html only fires once on the initial page load.
function AnalyticsTracker() {
  const location = useLocation();
  useEffect(() => {
    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    if (typeof w.gtag === 'function') {
      w.gtag('event', 'page_view', {
        page_path: location.pathname + location.search,
        page_location: window.location.href,
        page_title: document.title,
      });
    }
  }, [location.pathname, location.search]);
  return null;
}

export default function App() {
  const { setSession, isLoading } = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AnalyticsTracker />
      <ReferralCapture />
      <MaintenanceBanner />
      <OfflineBanner />
      <Toast />
      {isLoading ? (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Loading...</p>
          </div>
        </div>
      ) : (
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* ── Public ── */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/role-select" element={<RoleSelect />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/join/:token" element={<Join />} />
            <Route path="/legal/terms" element={<Terms />} />
            <Route path="/legal/privacy" element={<Privacy />} />
            <Route path="/accessibility" element={<Accessibility />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/for-landlords" element={<RoleLanding roleKey="landlord" />} />
            <Route path="/for-tenants" element={<RoleLanding roleKey="tenant" />} />
            <Route path="/for-handymen" element={<RoleLanding roleKey="handyman" />} />
            <Route path="/blog" element={<BlogIndex />} />
            <Route path="/blog/:slug" element={<BlogPost />} />

            {/* ── Landlord portal ── */}
            <Route
              path="/landlord"
              element={
                <ProtectedRoute requiredRole="landlord">
                  <LandlordLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<ErrorBoundary><LandlordDashboard /></ErrorBoundary>} />
              <Route path="properties" element={<ErrorBoundary><PropertiesList /></ErrorBoundary>} />
              <Route path="properties/new" element={<ErrorBoundary><PropertyNew /></ErrorBoundary>} />
              <Route path="properties/:id" element={<ErrorBoundary><PropertyDetail /></ErrorBoundary>} />
              <Route path="properties/:id/edit" element={<ErrorBoundary><PropertyEdit /></ErrorBoundary>} />
              <Route path="tenants" element={<ErrorBoundary><Tenants /></ErrorBoundary>} />
              <Route path="maintenance" element={<ErrorBoundary><MaintenanceList /></ErrorBoundary>} />
              <Route path="maintenance/:id" element={<ErrorBoundary><MaintenanceDetail /></ErrorBoundary>} />
              <Route path="rent" element={<ErrorBoundary><LandlordRent /></ErrorBoundary>} />
              <Route path="messages" element={<ErrorBoundary><MessagesInbox /></ErrorBoundary>} />
              <Route path="messages/handyman/:handymanId" element={<ErrorBoundary><HandymanThread /></ErrorBoundary>} />
              <Route path="messages/:tenancyId" element={<ErrorBoundary><MessageThread /></ErrorBoundary>} />
              <Route path="invite" element={<ErrorBoundary><Invite /></ErrorBoundary>} />
              <Route path="inspections" element={<ErrorBoundary><InspectionsList /></ErrorBoundary>} />
              <Route path="inspections/new" element={<ErrorBoundary><InspectionNew /></ErrorBoundary>} />
              <Route path="expenses" element={<ErrorBoundary><ExpensesList /></ErrorBoundary>} />
              <Route path="expenses/new" element={<ErrorBoundary><ExpenseNew /></ErrorBoundary>} />
              <Route path="documents" element={<ErrorBoundary><Documents /></ErrorBoundary>} />
              <Route path="handymen" element={<ErrorBoundary><Handymen /></ErrorBoundary>} />
              <Route path="account" element={<ErrorBoundary><LandlordAccount /></ErrorBoundary>} />
              <Route path="account/edit" element={<ErrorBoundary><LandlordEditProfile /></ErrorBoundary>} />
              <Route path="account/billing" element={<ErrorBoundary><Billing /></ErrorBoundary>} />
              <Route path="account/notifications" element={<ErrorBoundary><Notifications /></ErrorBoundary>} />
            </Route>

            {/* ── Tenant portal ── */}
            <Route
              path="/tenant"
              element={
                <ProtectedRoute requiredRole="tenant">
                  <TenantLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<ErrorBoundary><TenantDashboard /></ErrorBoundary>} />
              <Route path="repairs" element={<ErrorBoundary><RepairsList /></ErrorBoundary>} />
              <Route path="repairs/new" element={<ErrorBoundary><RepairNew /></ErrorBoundary>} />
              <Route path="repairs/:id" element={<ErrorBoundary><RepairDetail /></ErrorBoundary>} />
              <Route path="rent" element={<ErrorBoundary><TenantRent /></ErrorBoundary>} />
              <Route path="application" element={<ErrorBoundary><ApplicationStatus_ /></ErrorBoundary>} />
              <Route path="application/fill" element={<ErrorBoundary><ApplicationFill /></ErrorBoundary>} />
              <Route path="screening" element={<ErrorBoundary><Screening /></ErrorBoundary>} />
              <Route path="messages" element={<ErrorBoundary><TenantMessages /></ErrorBoundary>} />
              <Route path="deposit" element={<ErrorBoundary><Deposit /></ErrorBoundary>} />
              <Route path="documents" element={<ErrorBoundary><TenantDocuments /></ErrorBoundary>} />
              <Route path="account" element={<ErrorBoundary><TenantAccount /></ErrorBoundary>} />
            </Route>

            {/* ── Handyman portal ── */}
            <Route
              path="/handyman"
              element={
                <ProtectedRoute requiredRole="handyman">
                  <HandymanLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<ErrorBoundary><HandymanDashboard /></ErrorBoundary>} />
              <Route path="jobs" element={<ErrorBoundary><Jobs /></ErrorBoundary>} />
              <Route path="profile" element={<ErrorBoundary><HandymanProfile /></ErrorBoundary>} />
              <Route path="messages" element={<ErrorBoundary><HandymanMessages /></ErrorBoundary>} />
              <Route path="account" element={<ErrorBoundary><HandymanAccount /></ErrorBoundary>} />
            </Route>

            {/* ── Fallback ── */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      )}
    </BrowserRouter>
    </QueryClientProvider>
  );
}
