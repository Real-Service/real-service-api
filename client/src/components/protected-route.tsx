import { Route, Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";

interface ProtectedRouteProps {
  path: string;
  component: React.ComponentType;
  userType?: "landlord" | "contractor"; // "landlord" = Service Requestor, "contractor" = Service Provider
}

export function ProtectedRoute({ path, component: Component, userType }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const [isChecking, setIsChecking] = useState(true);
  
  // Use useAuth hook to check authentication more reliably
  useEffect(() => {
    // If auth data loading is complete, update checking state
    if (!isLoading) {
      setIsChecking(false);
    }
  }, [isLoading]);

  // Create a route that renders the appropriate content
  return (
    <Route path={path}>
      {() => {
        if (isChecking || isLoading) {
          // Show loading spinner while checking authentication
          return (
            <div className="flex items-center justify-center min-h-screen">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          );
        }

        // If not authenticated, redirect to login page
        if (!user) {
          console.log("Not authenticated, redirecting to /auth");
          return <Redirect to="/auth" />;
        }

        // If user type is specified and doesn't match, redirect to the appropriate dashboard
        if (userType && user.userType !== userType) {
          console.log(`User type mismatch. Expected: ${userType}, Got: ${user.userType}`);
          if (user.userType === "landlord") {
            // Redirect to Service Requestor dashboard
            return <Redirect to="/landlord/dashboard" />;
          } else if (user.userType === "contractor") {
            // Redirect to Service Provider dashboard
            return <Redirect to="/contractor/dashboard" />;
          }
          // If userType is neither landlord nor contractor (shouldn't happen), go to root
          return <Redirect to="/" />;
        }

        // If authenticated and user type matches (or no specific type required), render the protected component
        console.log(`Rendering protected component for ${path}`);
        return <Component />;
      }}
    </Route>
  );
}