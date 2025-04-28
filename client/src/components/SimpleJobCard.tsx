import React from "react";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";

interface SimpleJobCardProps {
  job: {
    id: number;
    title: string;
    description: string;
    pricingType: string;
    budget: number | string | null;
    location?: {
      city?: string;
      state?: string;
    };
    isUrgent?: boolean;
    categoryTags?: string[];
  };
  onBid: (job: any) => void;
}

export const SimpleJobCard: React.FC<SimpleJobCardProps> = ({ job, onBid }) => {
  return (
    <div className="border-8 border-blue-600 rounded-lg p-4 mb-6 bg-white shadow-xl relative">
      {/* Top right corner ID badge */}
      <div className="absolute top-0 right-0 bg-blue-600 text-white px-3 py-1 font-bold">
        JOB #{job.id}
      </div>

      {/* Urgent tag if needed */}
      {job.isUrgent && (
        <div className="absolute top-0 left-0 bg-red-600 text-white px-3 py-1 font-bold -translate-x-2 -translate-y-2 rounded-md">
          URGENT
        </div>
      )}

      {/* Job title */}
      <h3 className="text-2xl font-bold text-blue-900 mt-6 mb-2">{job.title}</h3>

      {/* Tags section */}
      <div className="flex flex-wrap gap-2 mb-4 mt-4">
        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-sm font-medium">
          {job.pricingType === "fixed" ? "Fixed Price" : "Open Bid"}
        </span>
        
        {job.categoryTags && job.categoryTags.length > 0 && (
          <span className="bg-green-100 text-green-800 px-2 py-1 rounded-md text-sm font-medium">
            {job.categoryTags[0]}
          </span>
        )}
      </div>

      {/* Description */}
      <div className="bg-gray-50 p-3 rounded-md mb-4 text-gray-800">
        <p>{job.description}</p>
      </div>

      {/* Location if available */}
      {job.location && (job.location.city || job.location.state) && (
        <div className="flex items-center text-gray-600 mb-4">
          <MapPin className="h-4 w-4 mr-1" />
          <span>
            {job.location.city || ""} 
            {job.location.city && job.location.state ? ", " : ""}
            {job.location.state || ""}
          </span>
        </div>
      )}

      {/* Footer with budget and action button */}
      <div className="flex justify-between items-center mt-4">
        <div>
          {job.budget ? (
            <p className="font-bold text-lg">Budget: ${typeof job.budget === 'number' 
              ? job.budget.toFixed(2) 
              : parseFloat(job.budget || '0').toFixed(2)}</p>
          ) : (
            <p className="text-gray-600">Open for bidding</p>
          )}
        </div>
        
        <Button 
          onClick={() => onBid(job)}
          className="bg-blue-600 text-white font-bold hover:bg-blue-700"
        >
          Place Bid
        </Button>
      </div>
    </div>
  );
};