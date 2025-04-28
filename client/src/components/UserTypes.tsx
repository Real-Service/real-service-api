import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { CheckCircle, Home, Wrench } from "lucide-react";
import { useLocation } from "wouter";

export default function UserTypes() {
  const [, navigate] = useLocation();

  const navigateToAuth = (userType: string) => {
    // Create URL with search parameters to pre-select the user type
    const searchParams = new URLSearchParams();
    searchParams.append("type", userType);
    searchParams.append("tab", "register");
    
    // Navigate to auth page with the params
    navigate(`/auth?${searchParams.toString()}`);
  };

  return (
    <div className="bg-blue-950 py-12" id="join">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-white">Choose Your Path</h2>
          <p className="mt-4 max-w-2xl text-xl text-blue-300 mx-auto">
            Whether you're a property owner or a skilled contractor, Real Service has solutions designed for you.
          </p>
        </div>

        <div className="mt-10 grid gap-8 md:grid-cols-2 items-stretch">
          {/* Service Requestor Card */}
          <Card className="bg-blue-900/50 border border-blue-800 rounded-lg shadow-lg overflow-hidden flex flex-col h-full">
            <div className="bg-blue-600 h-2"></div>
            <CardContent className="px-6 py-8 flex-grow">
              <div className="flex items-center">
                <Home className="text-3xl text-blue-400" />
                <h3 className="ml-3 text-2xl font-bold text-white">For Service Requestors</h3>
              </div>
              <p className="mt-4 text-blue-200">
                Post jobs, find qualified contractors, and manage your property maintenance all in one place.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Post fixed-price or open-bid jobs",
                  "Review contractor profiles and ratings",
                  "Secure payment processing system",
                  "Before/after photo verification"
                ].map((item, index) => (
                  <li key={index} className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-blue-400 mt-1 flex-shrink-0" />
                    <span className="ml-3 text-blue-200">{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="px-6 pb-8 mt-auto">
              <Button 
                className="w-full bg-blue-700 hover:bg-blue-600 text-white border border-blue-600"
                onClick={() => navigateToAuth('landlord')}
              >
                Join as a Service Requestor
              </Button>
            </CardFooter>
          </Card>

          {/* Service Provider Card */}
          <Card className="bg-blue-900/50 border border-blue-800 rounded-lg shadow-lg overflow-hidden flex flex-col h-full">
            <div className="bg-blue-400 h-2"></div>
            <CardContent className="px-6 py-8 flex-grow">
              <div className="flex items-center">
                <Wrench className="text-3xl text-blue-400" />
                <h3 className="ml-3 text-2xl font-bold text-white">For Service Providers</h3>
              </div>
              <p className="mt-4 text-blue-200">
                Find jobs, bid on projects, and grow your business with a steady stream of reliable clients.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Browse available jobs in your area",
                  "Submit competitive bids or accept fixed-price jobs",
                  "Get paid promptly through secure system",
                  "Build your reputation with verified reviews"
                ].map((item, index) => (
                  <li key={index} className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-blue-400 mt-1 flex-shrink-0" />
                    <span className="ml-3 text-blue-200">{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="px-6 pb-8 mt-auto">
              <Button 
                className="w-full bg-blue-700 hover:bg-blue-600 text-white border border-blue-600"
                onClick={() => navigateToAuth('contractor')}
              >
                Join as a Service Provider
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
