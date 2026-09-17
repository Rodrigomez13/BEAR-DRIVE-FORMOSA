import { lazy, Suspense, useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import { AnimatePresence, motion } from 'framer-motion';
import Splash from '@/components/bear/Splash';
import PwaInstallPrompt from '@/components/bear/PwaInstallPrompt';
// Auth pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
// App pages
import ModeRouter from '@/pages/ModeRouter';
import PassengerShell from '@/pages/passenger/PassengerShell';
import PassengerViajar from '@/pages/passenger/PassengerViajar';
import PassengerActivity from '@/pages/passenger/PassengerActivity';
import PassengerBenefits from '@/pages/passenger/PassengerBenefits';
import PassengerProfile from '@/pages/passenger/PassengerProfile';
import DriverShell from '@/pages/driver/DriverShell';
import DriverConducir from '@/pages/driver/DriverConducir';
import DriverActivity from '@/pages/driver/DriverActivity';
import DriverEarnings from '@/pages/driver/DriverEarnings';
import DriverProfile from '@/pages/driver/DriverProfile';
const DriverOnboarding = lazy(() => import('@/pages/driver/DriverOnboarding'));
const AdminShell = lazy(() => import('@/pages/admin/AdminShell'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminDrivers = lazy(() => import('@/pages/admin/AdminDrivers'));
const AdminPricing = lazy(() => import('@/pages/admin/AdminPricing'));
import SecurityPrivacy from '@/pages/shared/SecurityPrivacy';
import HelpSupport from '@/pages/shared/HelpSupport';
import Wallet from '@/pages/shared/Wallet';
import PaymentMethods from '@/pages/shared/PaymentMethods';
import AccountSettings from '@/pages/shared/AccountSettings';

import AccountHome from '@/pages/shared/AccountHome';

function LegacyRedirect({ to }) {
  const { search, hash } = useLocation();
  const target = to === '/driver/account' && new URLSearchParams(search).has('payments') ? '/driver/earnings' : to;
  return <Navigate replace to={`${target}${search}${hash}`} />;
}

function LegacyAccountRedirect({ page }) {
  const { user } = useAuth();
  const base = sessionStorage.getItem('bear_active_surface') === '/driver' || (!sessionStorage.getItem('bear_active_surface') && user?.last_active_mode === 'driver') ? '/driver' : '/passenger';
  const suffix = page === 'wallet' ? (base === '/driver' ? '/earnings' : '/wallet') : page === 'payment-methods' ? (base === '/driver' ? '/earnings' : '/wallet/payment-methods') : `/account/${page}`;
  return <LegacyRedirect to={base + suffix} />;
}

function AccountPage({ children }) {
  return <div className="h-full overflow-y-auto">{children}</div>;
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();
  const [minSplashDone, setMinSplashDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinSplashDone(true);
    }, 1600);
    return () => clearTimeout(timer);
  }, []);

  const isLoading = isLoadingPublicSettings || isLoadingAuth || !minSplashDone;

  if (!isLoading && authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') return <Navigate to="/login" replace />;
  }

  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div key="splash" exit={{ opacity: 0, scale: 1.03 }} transition={{ duration: 0.4, ease: "easeInOut" }}>
          <Splash />
        </motion.div>
      ) : (
        <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, ease: "easeInOut" }}>
          <Suspense fallback={<Splash />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
              <Route path="/" element={<ModeRouter />} />
              <Route path="/passenger" element={<PassengerShell />}>
                <Route index element={<PassengerViajar />} />
                <Route path="rides" element={<PassengerActivity />} />
                <Route path="activity" element={<LegacyRedirect to="/passenger/rides" />} />
                <Route path="benefits" element={<LegacyRedirect to="/passenger/wallet/benefits" />} />
                <Route path="wallet" element={<Wallet />} />
                <Route path="wallet/benefits" element={<PassengerBenefits />} />
                <Route path="wallet/payment-methods" element={<AccountPage><PaymentMethods /></AccountPage>} />
                <Route path="profile" element={<LegacyRedirect to="/passenger/account" />} />
                <Route path="account" element={<AccountHome />} />
                <Route path="account/personal" element={<PassengerProfile />} />
                <Route path="account/preferences" element={<AccountPage><AccountSettings /></AccountPage>} />
                <Route path="account/security" element={<AccountPage><SecurityPrivacy /></AccountPage>} />
                <Route path="account/help" element={<AccountPage><HelpSupport /></AccountPage>} />
              </Route>
              <Route path="/driver" element={<DriverShell />}>
                <Route index element={<DriverConducir />} />
                <Route path="rides" element={<DriverActivity />} />
                <Route path="activity" element={<LegacyRedirect to="/driver/rides" />} />
                <Route path="earnings" element={<DriverEarnings />} />
                <Route path="account/documents" element={<DriverProfile />} />
                <Route path="profile" element={<LegacyRedirect to="/driver/account" />} />
                <Route path="account" element={<AccountHome />} />
                <Route path="account/personal" element={<PassengerProfile />} />
                <Route path="account/preferences" element={<AccountPage><AccountSettings /></AccountPage>} />
                <Route path="account/security" element={<AccountPage><SecurityPrivacy /></AccountPage>} />
                <Route path="account/help" element={<AccountPage><HelpSupport /></AccountPage>} />
              </Route>
              <Route path="/onboarding" element={<DriverOnboarding />} />
              <Route path="/security-privacy" element={<LegacyAccountRedirect page="security" />} />
              <Route path="/help-support" element={<LegacyAccountRedirect page="help" />} />
              <Route path="/wallet" element={<LegacyAccountRedirect page="wallet" />} />
              <Route path="/payment-methods" element={<LegacyAccountRedirect page="payment-methods" />} />
              <Route path="/settings" element={<LegacyAccountRedirect page="preferences" />} />
              <Route path="/admin" element={<AdminShell />}>
                <Route index element={<AdminDashboard />} />
                <Route path="drivers" element={<AdminDrivers />} />
                <Route path="pricing" element={<AdminPricing />} />
              </Route>
            </Route>
            <Route path="*" element={<PageNotFound />} />
          </Routes>
          </Suspense>
          <PwaInstallPrompt />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App