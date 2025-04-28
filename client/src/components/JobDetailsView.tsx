import { Job } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { DollarSign, MapPin, Calendar, Building } from "lucide-react";

interface JobDetailsViewProps {
  job: Job;
}

export function JobDetailsView({ job }: JobDetailsViewProps) {
  return (
    <div className="space-y-6 py-4">
      {/* Job Images */}
      {job.images && Array.isArray(job.images) && job.images.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-medium">Images</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {job.images.map((image, index) => (
              <div key={index} className="h-36 rounded-md overflow-hidden border">
                <img 
                  src={typeof image === 'string' ? image : '#'} 
                  alt={`Job image ${index + 1}`} 
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Job Description */}
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Description</h3>
        <p className="text-muted-foreground">{job.description ? String(job.description) : 'No description provided'}</p>
      </div>
      
      {/* Category */}
      {job.categoryTags && Array.isArray(job.categoryTags) && job.categoryTags.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-medium">Category</h3>
          <div className="flex flex-wrap gap-2">
            {job.categoryTags.map((category, index) => (
              <Badge key={index} variant="secondary" className="text-sm">
                {category}
              </Badge>
            ))}
          </div>
        </div>
      )}
      
      {/* Location */}
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Location</h3>
        {job.location && typeof job.location === 'object' && (
          <div className="bg-muted/30 p-3 rounded-md">
            {(job.location as any).address && <p>{String((job.location as any).address)}</p>}
            <p>
              {(job.location as any).city ? String((job.location as any).city) : 'City not specified'}
              {(job.location as any).state ? `, ${String((job.location as any).state)}` : ''}
              {(job.location as any).zip ? ` ${String((job.location as any).zip)}` : ''}
            </p>
          </div>
        )}
      </div>
      
      {/* Budget & Pricing */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <h3 className="text-lg font-medium">Pricing Type</h3>
          <div className="bg-muted/30 p-3 rounded-md">
            {job.pricingType === 'fixed' ? (
              <span className="flex items-center"><DollarSign className="h-4 w-4 mr-1" /> Fixed Price</span>
            ) : (
              <span className="flex items-center"><DollarSign className="h-4 w-4 mr-1" /> Open for Bids</span>
            )}
          </div>
        </div>
        
        {job.budget && (
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Budget</h3>
            <div className="bg-muted/30 p-3 rounded-md">
              <span className="font-semibold">${job.budget}</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Timeline */}
      {job.startDate && (
        <div className="space-y-2">
          <h3 className="text-lg font-medium">Timeline</h3>
          <div className="bg-muted/30 p-3 rounded-md">
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-2" />
              <span>Starts on {new Date(job.startDate).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Landlord Information */}
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Posted By</h3>
        <div className="bg-muted/30 p-3 rounded-md">
          <p>Landlord ID: {job.landlordId}</p>
          {/* If additional landlord info is available in the future, it can be displayed here */}
        </div>
      </div>
    </div>
  );
}