import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import { AnimatePresence, motion } from 'framer-motion';
import Splash from '@/components/bear/Splash';
import PwaInstallPrompt from '@/components/bear/PwaInstallPrompt';
import OfflineBanner from '@/components/bear/OfflineBanner';
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
const AdminOperations = lazy(() => import('@/pages/admin/AdminOperations'));
const AdminPricing = lazy(() => import('@/pages/admin/AdminPricing'));
import SecurityPrivacy from '@/pages/shared/SecurityPrivacy';
import HelpSupport from '@/pages/shared/HelpSupport';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const isLoading = isLoadingPublicSettings || isLoadingAuth;

  if (!isLoading && authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') { navigateToLogin(); return null; }
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
                <Route path="activity" element={<PassengerActivity />} />
                <Route path="benefits" element={<PassengerBenefits />} />
                <Route path="profile" element={<PassengerProfile />} />
              </Route>
              <Route path="/driver" element={<DriverShell />}>
                <Route index element={<DriverConducir />} />
                <Route path="activity" element={<DriverActivity />} />
                <Route path="earnings" element={<DriverEarnings />} />
                <Route path="profile" element={<DriverProfile />} />
              </Route>
              <Route path="/onboarding" element={<DriverOnboarding />} />
              <Route path="/security-privacy" element={<SecurityPrivacy />} />
              <Route path="/help-support" element={<HelpSupport />} />
              <Route path="/admin" element={<AdminShell />}>
                <Route index element={<AdminDashboard />} />
                <Route path="drivers" element={<AdminDrivers />} />
                <Route path="pricing" element={<AdminPricing />} />
                <Route path="operations" element={<AdminOperations />} />
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
          <OfflineBanner />
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App