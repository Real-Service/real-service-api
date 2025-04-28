import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import UserTypes from "@/components/UserTypes";
import Features from "@/components/Features";
import DashboardPreviews from "@/components/DashboardPreviews";
import Pricing from "@/components/Pricing";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";
import WaitlistModal from "@/components/WaitlistModal";
import { useState } from "react";

export default function LandingPage() {
  const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false);

  const openWaitlistModal = () => {
    setIsWaitlistModalOpen(true);
  };

  const closeWaitlistModal = () => {
    setIsWaitlistModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#040f2d] text-white">
      <div className="relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 left-0 -translate-x-1/2 translate-y-[-30%] w-[500px] h-[500px] rounded-full bg-blue-800/10 blur-3xl pointer-events-none" aria-hidden="true"></div>
        <div className="absolute top-1/2 right-0 translate-x-1/2 translate-y-[-30%] w-[800px] h-[800px] rounded-full bg-blue-700/10 blur-3xl pointer-events-none" aria-hidden="true"></div>
        
        {/* Main content */}
        <div className="relative z-10">
          <Navbar openWaitlistModal={openWaitlistModal} />
          <Hero openWaitlistModal={openWaitlistModal} />
          <UserTypes />
          <Features />
          <DashboardPreviews />
          <Pricing />
          <CTA openWaitlistModal={openWaitlistModal} />
          <Footer />
          <WaitlistModal 
            isOpen={isWaitlistModalOpen} 
            onClose={closeWaitlistModal} 
          />
        </div>
      </div>
    </div>
  );
}
