import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
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
import DriverOnboarding from '@/pages/driver/DriverOnboarding';
import AdminShell from '@/pages/admin/AdminShell';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminDrivers from '@/pages/admin/AdminDrivers';
import AdminPricing from '@/pages/admin/AdminPricing';
import SecurityPrivacy from '@/pages/shared/SecurityPrivacy';
import HelpSupport from '@/pages/shared/HelpSupport';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-secondary border-t-accent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
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
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
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