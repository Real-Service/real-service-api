import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface CTAProps {
  openWaitlistModal: () => void;
}

export default function CTA({ openWaitlistModal }: CTAProps) {
  const [, navigate] = useLocation();

  const handleGetStarted = () => {
    navigate('/auth?tab=register');
  };

  return (
    <div className="bg-primary">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:py-16 lg:px-8 lg:flex lg:items-center lg:justify-between">
        <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          <span className="block">Ready to simplify property maintenance?</span>
          <span className="block text-blue-200">Join Real Service today.</span>
        </h2>
        <div className="mt-8 flex lg:mt-0 lg:flex-shrink-0">
          <div className="inline-flex rounded-md shadow">
            <Button 
              onClick={handleGetStarted}
              className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-primary bg-white hover:bg-gray-50"
            >
              Get Started
            </Button>
          </div>
          <div className="ml-3 inline-flex rounded-md shadow">
            <Button 
              variant="outline"
              onClick={() => navigate('/auth?tab=login')}
              className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary/20 hover:bg-primary/30 border-white"
            >
              Sign In
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
