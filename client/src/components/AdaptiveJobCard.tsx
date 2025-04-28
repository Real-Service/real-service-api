import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
// Define Job interface directly in the component for compatibility
interface Job {
  id: number;
  title: string;
  description: string;
  status: 'open' | 'draft' | 'in_progress' | 'completed' | 'cancelled';
  budget: number | string | null;
  startDate: string | null;
  deadline: string | null;
  createdAt: Date;
  updatedAt: Date;
  landlordId: number;
  contractorId: number | null;
  location: any;
  images: string[] | null;
  isUrgent: boolean;
  bidCount?: number;
  categoryTags: string[] | null;
  progress: number | null;
}
import { 
  MapPin, Clock, Calendar, Tag
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CategoryIcon } from "@/components/CategoryIcons";
import { Link } from "wouter";

// Date utility functions
const calculateDaysLeft = (targetDate: Date | string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to beginning of day
  
  const deadline = new Date(targetDate);
  deadline.setHours(0, 0, 0, 0); // Set to beginning of day
  
  const diffTime = deadline.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
};

interface AdaptiveJobCardProps {
  job: Job;
  onViewDetails: (job: Job) => void;
  onCreateQuote?: (job: Job) => void;
  onBidJob?: (job: Job) => void;
  getJobImage: (job: Job) => string;
  expanded?: boolean;
  toggleExpanded?: (e: React.MouseEvent) => void;
  getBidCount?: () => number;
  getClientName?: (landlordId: number) => string;
  myBids?: any[];
}

export const AdaptiveJobCard: React.FC<AdaptiveJobCardProps> = ({
  job,
  onViewDetails,
  onCreateQuote,
  onBidJob,
  getJobImage,
  expanded = true, // Default to expanded view (always show details)
  toggleExpanded,
  getBidCount,
  getClientName,
  myBids = []
}) => {
  const { toast } = useToast();

  // Helper functions
  const getFormattedLocation = () => {
    if (!job.location) return 'Location not specified';
    
    if (typeof job.location === 'object') {
      const location = job.location as any; // Use any to avoid typescript errors
      if (location.city && location.state) {
        return `${location.city}, ${location.state}`;
      }
    }
    
    return 'Location not specified';
  };

  const getStatusColor = () => {
    if (job.status === "completed") return "bg-green-600 text-white border-green-700 shadow-sm";
    if (job.status === "in_progress") return "bg-blue-600 text-white border-blue-700 shadow-sm";
    if (job.status === "open") return "bg-yellow-500 text-white border-yellow-600 shadow-sm";
    if (job.status === "cancelled") return "bg-red-500 text-white border-red-600 shadow-sm";
    return "bg-slate-500 text-white border-slate-600 shadow-sm";
  };
  
  const getStatusLabel = () => {
    if (job.status === "in_progress") return "In Progress";
    return job.status.charAt(0).toUpperCase() + job.status.slice(1);
  };

  const getJobSizeLabel = () => {
    if (!job.budget) return 'Open Bid';
    
    // Convert budget to number if it's a string
    const budgetNum = typeof job.budget === 'string' ? parseFloat(job.budget) : job.budget;
    
    if (budgetNum > 1000) return 'Large Job';
    if (budgetNum > 500) return 'Medium Job';
    return 'Small Job';
  };

  return (
    <Card 
      className="overflow-hidden h-full flex flex-col relative border border-slate-200 hover:border-primary/60 transition-all duration-200 hover:shadow-lg hover:translate-y-[-2px] cursor-pointer group"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onViewDetails && onViewDetails(job);
      }}
    >
      {/* Job Image Section */}
      <div className="relative h-48 w-full overflow-hidden">
        <img 
          src={getJobImage(job)} 
          alt={job.title} 
          className="w-full h-full object-cover transition-all duration-300 ease-in-out hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/uploads/jobs/default-job-image.svg";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
        
        {/* Removed photo count indicator per user request */}
        
        {/* Status badges */}
        <div className="absolute top-2 right-2 flex flex-col gap-1.5 items-end">
          <Badge className={`rounded-full px-3 ${getStatusColor()}`}>
            {getStatusLabel()}
          </Badge>
          
          {job.isUrgent && (
            <Badge variant="destructive" className="bg-red-600 text-white border-red-700 font-semibold shadow-sm rounded-full px-3">
              🔥 URGENT
            </Badge>
          )}
          
          {!job.isUrgent && !job.deadline && (
            <Badge className="bg-green-600 text-white border-green-700 shadow-sm rounded-full px-3">
              🟢 Flexible
            </Badge>
          )}
          
          {job.deadline && (
            <Badge className="bg-orange-500 text-white border-orange-600 shadow-sm rounded-full px-3">
              ⏳ {calculateDaysLeft(job.deadline)} days left
            </Badge>
          )}
        </div>
        
        {/* Price badge - Made more prominent with animation */}
        <div className="absolute bottom-2 left-2 flex items-center gap-2">
          <Badge variant="secondary" className="bg-primary text-white font-bold text-base px-4 py-1.5 shadow-lg group-hover:scale-105 transition-all duration-200">
            {job.budget 
              ? `$${typeof job.budget === 'number' 
                  ? job.budget.toFixed(2) 
                  : parseFloat(job.budget || '0').toFixed(2)}` 
              : 'Open Bid'}
          </Badge>
        </div>
        
        {/* Category icon */}
        <div className="absolute top-2 left-2">
          <div className="w-10 h-10 rounded-full bg-primary/80 flex items-center justify-center">
            <CategoryIcon category={
              Array.isArray(job.categoryTags) && job.categoryTags.length > 0 
                ? job.categoryTags[0] 
                : 'default'
            } />
          </div>
        </div>
      </div>
      
      {/* Content Section */}
      <div className="flex-grow flex flex-col">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-lg font-semibold min-h-[3.5rem] leading-tight">
            {job.title}
          </CardTitle>
          <CardDescription className="flex items-center mt-1">
            <MapPin className="h-3.5 w-3.5 mr-1 text-muted-foreground flex-shrink-0" />
            <span className="text-xs truncate">{getFormattedLocation()}</span>
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-4 pt-2 flex-grow">
          {/* Always visible base info */}
          <p className="text-sm mb-3 line-clamp-2">{job.description}</p>
          
          {/* Job posting date */}
          <div className="flex items-center text-xs text-muted-foreground mb-3">
            <Clock className="h-3.5 w-3.5 mr-1.5 text-primary/70" />
            <span>Posted: {new Date(job.createdAt).toLocaleDateString()}</span>
          </div>
          
          {/* Key details - simplified and concise */}
          <div className="border-t border-slate-100 pt-3 mt-2">
            <div className="flex flex-wrap gap-2">
              {job.deadline && (
                <Badge variant="outline" className="text-xs bg-orange-50 rounded-full px-3 shadow-sm border-orange-200">
                  <Calendar className="h-3 w-3 mr-1 text-orange-500" />
                  Due: {new Date(job.deadline).toLocaleDateString()}
                </Badge>
              )}
              
              <Badge variant="outline" className="text-xs bg-blue-50 rounded-full px-3 shadow-sm border-blue-200">
                <Tag className="h-3 w-3 mr-1 text-blue-500" />
                {Array.isArray(job.categoryTags) && job.categoryTags.length > 0
                  ? job.categoryTags[0]
                  : 'General'}
              </Badge>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-between p-4 pt-0 gap-2">
          {/* Interactive "Click for details" button */}
          <div className="w-full flex justify-end">
            <button 
              className="text-xs text-primary font-medium flex items-center gap-1 hover:underline focus:outline-none" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onViewDetails && onViewDetails(job);
              }}
            >
              <span>Click for details</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-0.5 transition-transform duration-200">
                <path d="M5 12h14"></path>
                <path d="m12 5 7 7-7 7"></path>
              </svg>
            </button>
          </div>
        </CardFooter>
      </div>
      
      {/* Hover overlay has been completely removed per user's request */}
    </Card>
  );
};

export default AdaptiveJobCard;