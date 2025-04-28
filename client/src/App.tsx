import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { ProtectedRoute } from "@/lib/protected-route";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/LandingPage";
import AuthPage from "@/pages/auth-page";
import ProductionLoginPage from "@/pages/production-login";
import LandlordDashboard from "@/pages/landlord-dashboard";
import ContractorDashboard from "@/pages/contractor-dashboard";
import AccountSettingsPage from "@/pages/account-settings";
import { useEffect } from "react";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider } from "@/hooks/use-auth";

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={LandingPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/production-login" component={ProductionLoginPage} />
      <Route path="/404" component={NotFound} />
      
      {/* Protected routes */}
      {/* Service Requestor (Landlord) Dashboard */}
      <ProtectedRoute path="/landlord/dashboard" component={LandlordDashboard} />
      {/* Service Provider (Contractor) Dashboard */}
      <ProtectedRoute path="/contractor/dashboard" component={ContractorDashboard} />
      <ProtectedRoute path="/contractor-dashboard/:tab" component={ContractorDashboard} />
      {/* Account Settings */}
      <ProtectedRoute path="/account/settings" component={AccountSettingsPage} />
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Initialize authentication from sessionStorage on first load
  // This ensures auth state persists across page reloads
  useEffect(() => {
    try {
      const storedUser = sessionStorage.getItem('auth_user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        if (userData && userData.id) {
          console.log('Initializing auth from sessionStorage:', userData.id);
          // Set in React Query cache for immediate access
          queryClient.setQueryData(['/api/user'], userData);
        }
      }
    } catch (error) {
      console.error('Error initializing auth from sessionStorage:', error);
    }
  }, []);

  return (
    <AuthProvider>
      <Router />
      <Toaster />
    </AuthProvider>
  );
}

export default App;
