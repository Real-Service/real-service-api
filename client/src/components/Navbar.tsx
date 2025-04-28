import { Button } from "@/components/ui/button";
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { Menu, LogOut } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";

interface NavbarProps {
  openWaitlistModal: () => void;
}

export default function Navbar({ openWaitlistModal }: NavbarProps) {
  const [, navigate] = useLocation();
  let auth: {
    user: { id: number; userType: string } | null;
    logout?: () => Promise<void>;
  } | null = null;
  
  try {
    auth = useAuth();
  } catch (err) {
    console.log("Auth context not available in Navbar");
  }

  const handleLoginClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/auth?tab=login');;
  };

  const handleSignUpClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/auth?tab=register');
  };

  const handleDashboardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (auth?.user?.userType === 'landlord') {
      navigate('/landlord/dashboard');
    } else if (auth?.user?.userType === 'contractor') {
      navigate('/contractor/dashboard');
    }
  };

  const handleLogoutClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (auth?.logout) {
      try {
        // Auth context will handle the redirection
        await auth.logout();
      } catch (err) {
        console.error('Logout failed:', err);
        // Redirect anyway on error
        window.location.href = '/';
      }
    } else {
      // Fallback direct logout if auth context not available
      try {
        await fetch('/api/logout', {
          method: 'POST',
          credentials: 'include'
        });
        sessionStorage.clear();
        localStorage.clear();
        // Always redirect to homepage
        window.location.href = '/';
      } catch (err) {
        console.error('Logout failed:', err);
        // Redirect anyway on error
        window.location.href = '/';
      }
    }
  };

  return (
    <nav className="bg-blue-950/90 backdrop-blur-sm sticky top-0 z-50 border-b border-blue-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/">
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-blue-400 mr-2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                  </svg>
                  <span className="text-blue-300 font-bold text-xl cursor-pointer">Real Service</span>
                </div>
              </Link>
            </div>
          </div>
          
          <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
            <a href="#features" className="border-transparent text-blue-300 hover:text-blue-200 hover:border-blue-400 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200">
              Features
            </a>
            <a href="#join" className="border-transparent text-blue-300 hover:text-blue-200 hover:border-blue-400 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200">
              Join Us
            </a>
            <a href="#pricing" className="border-transparent text-blue-300 hover:text-blue-200 hover:border-blue-400 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200">
              Pricing
            </a>
          </div>
          
          <div className="flex items-center">
            {auth?.user ? (
              // User is logged in - show dashboard and logout buttons
              <>
                <Button 
                  onClick={handleDashboardClick}
                  className="mr-3 bg-blue-700 hover:bg-blue-600 text-white shadow-sm"
                >
                  Dashboard
                </Button>
                <Button 
                  variant="ghost"
                  onClick={handleLogoutClick}
                  className="text-blue-300 hover:text-blue-200 hover:bg-blue-900/50"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </>
            ) : (
              // User is not logged in - show login and signup buttons
              <>
                <Button 
                  variant="ghost" 
                  className="mr-3 text-blue-300 hover:text-blue-200 hover:bg-blue-900/50"
                  onClick={handleLoginClick}
                >
                  Login
                </Button>
                <Button 
                  onClick={handleSignUpClick}
                  className="bg-blue-700 hover:bg-blue-600 text-white shadow-sm"
                >
                  Sign Up
                </Button>
              </>
            )}
          </div>
          
          {/* Mobile menu button */}
          <div className="sm:hidden flex items-center">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-blue-300 hover:text-blue-200 hover:bg-blue-900/50">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="border-l border-blue-900 bg-blue-950 text-white">
                <div className="flex flex-col space-y-4 mt-10">
                  <div className="flex items-center mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-blue-400 mr-2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                      <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                    <span className="text-blue-300 font-bold text-lg">Real Service</span>
                  </div>
                  
                  <a href="#features" className="text-blue-300 hover:text-blue-200 hover:bg-blue-900/50 px-3 py-2 rounded-md text-base font-medium transition-colors duration-200">
                    Features
                  </a>
                  <a href="#join" className="text-blue-300 hover:text-blue-200 hover:bg-blue-900/50 px-3 py-2 rounded-md text-base font-medium transition-colors duration-200">
                    Join Us
                  </a>
                  <a href="#pricing" className="text-blue-300 hover:text-blue-200 hover:bg-blue-900/50 px-3 py-2 rounded-md text-base font-medium transition-colors duration-200">
                    Pricing
                  </a>
                  <div className="pt-4 mt-4 border-t border-blue-800">
                    {auth?.user ? (
                      // User is logged in - show dashboard and logout buttons
                      <>
                        <Button 
                          onClick={handleDashboardClick}
                          className="w-full justify-center mb-3 bg-blue-700 hover:bg-blue-600 text-white shadow-sm"
                        >
                          Dashboard
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={handleLogoutClick}
                          className="w-full justify-center border-blue-700 text-blue-300 hover:bg-blue-900/50"
                        >
                          <LogOut className="h-4 w-4 mr-2" />
                          Logout
                        </Button>
                      </>
                    ) : (
                      // User is not logged in - show login and signup buttons
                      <>
                        <Button 
                          variant="outline" 
                          className="w-full justify-center mb-3 border-blue-700 text-blue-300 hover:bg-blue-900/50"
                          onClick={handleLoginClick}
                        >
                          Login
                        </Button>
                        <Button 
                          onClick={handleSignUpClick}
                          className="w-full justify-center bg-blue-700 hover:bg-blue-600 text-white shadow-sm"
                        >
                          Sign Up
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
