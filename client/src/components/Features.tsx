import { 
  Search, 
  Wallet, 
  MessageSquare, 
  Image, 
  Star, 
  MapPin 
} from "lucide-react";

const features = [
  {
    icon: <Search className="text-blue-300 text-xl" />,
    title: "Job Matching System",
    description: "Our smart algorithm matches landlords with qualified contractors based on job requirements, location, and expertise."
  },
  {
    icon: <Wallet className="text-blue-300 text-xl" />,
    title: "Secure Payments",
    description: "Funds are held in escrow until work is completed and approved, protecting both landlords and contractors."
  },
  {
    icon: <MessageSquare className="text-blue-300 text-xl" />,
    title: "Built-in Messaging",
    description: "Communicate directly with landlords or contractors within the platform, keeping all project discussions organized."
  },
  {
    icon: <Image className="text-blue-300 text-xl" />,
    title: "Photo Documentation",
    description: "Capture before and after photos of repairs to verify completed work and maintain quality standards."
  },
  {
    icon: <Star className="text-blue-300 text-xl" />,
    title: "Rating System",
    description: "Build trust through our two-way review system where both landlords and contractors rate each other after job completion."
  },
  {
    icon: <MapPin className="text-blue-300 text-xl" />,
    title: "Location-Based Matching",
    description: "Find contractors in your area or discover jobs nearby with our location-based filtering system."
  }
];

export default function Features() {
  return (
    <div id="features-section" className="py-16 bg-[#040f2d]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-white">Powerful Features</h2>
          <p className="mt-4 max-w-2xl text-xl text-blue-300 mx-auto">
            Everything you need to simplify property maintenance and repairs.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="bg-blue-900/40 rounded-lg p-6 border border-blue-800 shadow-md"
              style={{ pointerEvents: 'none', cursor: 'default' }}
            >
              <div className="p-0">
                <div className="w-12 h-12 rounded-full bg-blue-900/60 flex items-center justify-center mb-4 border border-blue-700">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-medium text-white">{feature.title}</h3>
                <p className="mt-2 text-blue-200">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
