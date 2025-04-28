import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Check, Home, Wrench, Star, Calendar, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Pricing() {
  return (
    <div id="pricing" className="py-16 bg-gradient-to-b from-[#040f2d] to-blue-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-white">Simple Subscription Pricing</h2>
          <p className="mt-4 max-w-2xl text-xl text-blue-300 mx-auto">
            One low monthly fee, unlimited access to the platform.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {/* Free Tier */}
          <Card className="bg-blue-950 rounded-lg border border-blue-700 shadow-sm overflow-hidden flex flex-col">
            <CardHeader className="bg-blue-900 py-5 border-b border-blue-700">
              <h3 className="text-xl font-bold text-white">Free</h3>
              <p className="text-sm text-blue-300 mt-1">For those just getting started</p>
            </CardHeader>
            <CardContent className="p-6 flex-grow">
              <div className="mt-2 flex items-baseline">
                <span className="text-4xl font-extrabold text-white">$0</span>
                <span className="ml-1 text-lg text-blue-300">/month</span>
              </div>
              <ul className="mt-6 space-y-4">
                {[
                  "Limited job browsing",
                  "Basic profile creation",
                  "View sample jobs",
                  "Community access",
                ].map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="h-5 w-5 text-emerald-500 mt-1 flex-shrink-0" />
                    <span className="ml-3 text-blue-200">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="p-6 bg-blue-900 border-t border-blue-700">
              <Button variant="outline" className="w-full border-blue-400 text-blue-300 hover:bg-blue-800">
                Sign Up Free
              </Button>
            </CardFooter>
          </Card>

          {/* Premium Tier - Featured */}
          <Card className="bg-blue-800 rounded-lg border-2 border-primary shadow-lg overflow-hidden flex flex-col relative transform lg:scale-105 z-10">
            <div className="absolute top-0 right-0">
              <Badge className="m-2 bg-primary text-white">MOST POPULAR</Badge>
            </div>
            <CardHeader className="bg-primary/30 py-5 border-b border-primary/60">
              <h3 className="text-xl font-bold text-white">Premium</h3>
              <p className="text-sm text-blue-200 mt-1">For professionals and property managers</p>
            </CardHeader>
            <CardContent className="p-6 flex-grow">
              <div className="mt-2 flex items-baseline">
                <span className="text-4xl font-extrabold text-white">$25</span>
                <span className="ml-1 text-lg text-blue-200">/month</span>
              </div>
              <ul className="mt-6 space-y-4">
                {[
                  "Unlimited job postings/bidding",
                  "Full property management suite",
                  "Secure payment processing",
                  "Verified contractors & landlords",
                  "Premium support & dispute resolution",
                  "Advanced rating system",
                  "Chat with photos and attachments",
                ].map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="h-5 w-5 text-green-400 mt-1 flex-shrink-0" />
                    <span className="ml-3 text-blue-100">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="p-6 bg-primary/30 border-t border-primary/60">
              <Button className="w-full bg-primary text-white hover:bg-primary/90">
                Subscribe Now
              </Button>
              <p className="text-xs text-center mt-3 text-blue-200">No commission fees. Cancel anytime.</p>
            </CardFooter>
          </Card>

          {/* Enterprise Tier */}
          <Card className="bg-blue-950 rounded-lg border border-blue-700 shadow-sm overflow-hidden flex flex-col">
            <CardHeader className="bg-blue-900 py-5 border-b border-blue-700">
              <h3 className="text-xl font-bold text-white">Enterprise</h3>
              <p className="text-sm text-blue-300 mt-1">For large property portfolios</p>
            </CardHeader>
            <CardContent className="p-6 flex-grow">
              <div className="mt-2 flex items-center justify-center">
                <span className="text-xl font-bold text-white py-2 px-4 bg-primary/30 rounded-full">Coming Soon</span>
              </div>
              <ul className="mt-6 space-y-4">
                {[
                  "Everything in Premium",
                  "Multiple user accounts",
                  "Advanced analytics & reporting",
                  "API access for integration",
                  "Dedicated account manager",
                  "Custom workflows",
                ].map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="h-5 w-5 text-emerald-500 mt-1 flex-shrink-0" />
                    <span className="ml-3 text-blue-200">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="p-6 bg-blue-900 border-t border-blue-700">
              <Button variant="outline" className="w-full border-blue-400 text-blue-300 hover:bg-blue-800" disabled>
                Notify Me
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        {/* Trust badges */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div className="flex flex-col items-center">
            <CreditCard className="h-8 w-8 text-blue-300 mb-2" />
            <h4 className="text-sm font-medium text-white">Secure Payments</h4>
          </div>
          <div className="flex flex-col items-center">
            <Calendar className="h-8 w-8 text-blue-300 mb-2" />
            <h4 className="text-sm font-medium text-white">Monthly Billing</h4>
          </div>
          <div className="flex flex-col items-center">
            <Star className="h-8 w-8 text-blue-300 mb-2" />
            <h4 className="text-sm font-medium text-white">5-Star Support</h4>
          </div>
          <div className="flex flex-col items-center">
            <Wrench className="h-8 w-8 text-blue-300 mb-2" />
            <h4 className="text-sm font-medium text-white">Canadian Focused</h4>
          </div>
        </div>
      </div>
    </div>
  );
}
