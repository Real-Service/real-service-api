import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface HeroProps {
  openWaitlistModal: () => void;
}

export default function Hero({ openWaitlistModal }: HeroProps) {
  const [, navigate] = useLocation();

  const handleLandlordClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.href = '/auth?tab=register&type=landlord';
  };

  const handleContractorClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.href = '/auth?tab=register&type=contractor';
  };

  return (
    <div className="overflow-hidden bg-gradient-to-b from-blue-950 to-[#040f2d]">
      <div className="max-w-7xl mx-auto py-12">
        <div className="relative z-10 pb-6 sm:pb-10 md:pb-12">
          <main className="mt-8 mx-auto max-w-3xl px-4 sm:mt-10 sm:px-6 md:mt-12">
            <div className="text-center">
              <span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-blue-500/20 text-blue-300 mb-4">
                Save time & money on property maintenance
              </span>
              <h1 className="text-4xl tracking-tight font-bold sm:text-5xl md:text-6xl text-white">
                <span className="block">Property maintenance</span>
                <span className="text-blue-400">simplified & affordable</span>
              </h1>
              <p className="mt-3 text-base text-blue-300 sm:mt-5 sm:text-lg sm:max-w-2xl sm:mx-auto md:mt-5 md:text-xl">
                Connect with verified professionals for hassle-free property care. Transparent pricing, secure payments, and 24/7 project tracking.
              </p>
              
              {/* Stats */}
              <div className="mt-8 grid grid-cols-3 gap-4 max-w-xl mx-auto">
                <div className="bg-blue-900/50 backdrop-blur-sm rounded-lg p-3 text-center shadow-sm border border-blue-800">
                  <p className="font-bold text-2xl text-blue-300">25%</p>
                  <p className="text-xs text-blue-400">Average savings</p>
                </div>
                <div className="bg-blue-900/50 backdrop-blur-sm rounded-lg p-3 text-center shadow-sm border border-blue-800">
                  <p className="font-bold text-2xl text-blue-300">48h</p>
                  <p className="text-xs text-blue-400">Average response time</p>
                </div>
                <div className="bg-blue-900/50 backdrop-blur-sm rounded-lg p-3 text-center shadow-sm border border-blue-800">
                  <p className="font-bold text-2xl text-blue-300">4.8/5</p>
                  <p className="text-xs text-blue-400">Customer rating</p>
                </div>
              </div>
              
              <div className="mt-8 flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
                <Button 
                  onClick={handleLandlordClick}
                  className="w-full sm:w-auto px-8 py-3 text-base font-medium rounded-md shadow-md shadow-blue-900/30 bg-blue-700 hover:bg-blue-600 text-white border border-blue-600"
                >
                  Get Started as Service Requestor
                </Button>
                <Button 
                  onClick={handleContractorClick}
                  variant="outline"
                  className="w-full sm:w-auto px-8 py-3 text-base font-medium rounded-md border border-blue-700 text-blue-300 bg-blue-900/40 hover:bg-blue-800"
                >
                  Join as Service Provider
                </Button>
              </div>
              <div className="mt-4 text-sm text-blue-400">
                Already have an account? <a href="/auth?tab=login" className="text-blue-300 hover:text-blue-200 hover:underline font-medium">Sign in</a>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
