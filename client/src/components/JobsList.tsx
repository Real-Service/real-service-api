import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2,
  MapPin,
  Clock,
  CalendarClock,
  AlertCircle,
  LayoutGrid,
  List,
  ChevronRight,
  ChevronDown,
  CalendarDays,
  DollarSign,
  Tag,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FlameIcon,
  CircleIcon,
  CheckCircle2,
  MessageCircle,
  Calculator,
  Users,
  SlidersHorizontal,
  Timer,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Job, ExtendedJob, JobLocation } from "@shared/schema";
import { getCategoryDisplayName } from "@shared/constants";
import { CategoryIcon } from "./CategoryIcons";
import { formatDistance } from "@/lib/utils";

// This component is used by both Service Requestors (landlords) and Service Providers (contractors)
// to view available jobs in the system
interface JobsListProps {
  jobs: ExtendedJob[];
  isLoading: boolean;
  onBidJob?: (job: ExtendedJob) => void; // Used primarily by Service Providers
  onViewDetails?: (job: ExtendedJob) => void;
  hasServiceArea?: boolean; // Indicates if the contractor has set a service area
  initialView?: "grid" | "table"; // Default view mode (map and split views are handled by separate components)
  initialCompactMode?: boolean; // Whether to start in compact mode
  onSortChange?: (
    method: "default" | "price" | "date" | "category" | "title" | "location",
    order: "asc" | "desc",
  ) => void;
  sortMethod?: "default" | "price" | "date" | "category" | "title" | "location";
  sortOrder?: "asc" | "desc";
  onJobHover?: (jobId: number | null) => void; // Callback when a job is hovered
  highlightedJobId?: number | null; // The job ID that should be highlighted (set from parent)
}

export function JobsList({
  jobs,
  isLoading,
  onBidJob,
  onViewDetails,
  hasServiceArea = true,
  initialView = "grid",
  initialCompactMode = false,
  onSortChange,
  sortMethod = "default",
  sortOrder = "desc",
  onJobHover,
  highlightedJobId,
}: JobsListProps) {
  // Get toast function
  const { toast } = useToast();
  // State for view type (grid or table)
  const [viewType, setViewType] = useState<"grid" | "table">(initialView);
  // State for compact mode toggle
  const [isCompactMode, setIsCompactMode] = useState<boolean>(initialCompactMode);

  // State for expanded row in table view
  const [expandedRows, setExpandedRows] = useState<number[]>([]);

  // State for hovered job
  const [hoveredJobId, setHoveredJobId] = useState<number | null>(null);

  // Handle job hover - call parent callback if provided
  const handleJobHover = useCallback(
    (jobId: number | null) => {
      setHoveredJobId(jobId);
      if (onJobHover) {
        onJobHover(jobId);
      }
    },
    [onJobHover],
  );

  // Update viewType when initialView changes (from parent component)
  useEffect(() => {
    setViewType(initialView);
  }, [initialView]);

  // Toggle row expansion
  const toggleRowExpansion = (jobId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedRows((prevRows) =>
      prevRows.includes(jobId)
        ? prevRows.filter((id) => id !== jobId)
        : [...prevRows, jobId],
    );
  };

  // Handle sorting from column headers
  const handleColumnSort = useCallback(
    (
      method: "default" | "price" | "date" | "category" | "title" | "location",
    ) => {
      if (onSortChange) {
        if (sortMethod === method) {
          // Toggle sort order if clicking the same column header
          onSortChange(method, sortOrder === "asc" ? "desc" : "asc");
        } else {
          // Set new sort method with default order
          // Default to ascending order for text-based sorting (title, location, category)
          const defaultOrder =
            method === "category" || method === "title" || method === "location"
              ? "asc"
              : "desc";
          onSortChange(method, defaultOrder);
        }
      }
    },
    [onSortChange, sortMethod, sortOrder],
  );
  // DIAGNOSTICS: Log received jobs
  console.log(
    "⚠️ JOBSLIST COMPONENT RECEIVED:",
    jobs ? jobs.length : 0,
    "jobs",
  );
  console.log(
    "⚠️ JOBS DATA SAMPLE:",
    Array.isArray(jobs) && jobs.length > 0 ? jobs[0] : "NO JOBS",
  );
  console.log(
    "⚠️ Received jobs has hasOwnProperty?",
    jobs && typeof jobs === "object" && "length" in jobs,
  );
  console.log(
    "⚠️ Received jobs prototype:",
    jobs && Object.getPrototypeOf(jobs),
  );

  // Force jobs to be an array
  if (!Array.isArray(jobs)) {
    console.error(
      "⚠️ CRITICAL: jobs prop is not an array in JobsList component!",
      typeof jobs,
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // If no service area is set, show a message prompting the user to set one
  if (!hasServiceArea) {
    console.log("JobsList: Service area not set, showing prompt");
    return (
      <div className="p-8 text-center bg-blue-900/20 border border-blue-800/40 rounded-lg">
        <AlertCircle className="h-10 w-10 mx-auto mb-3 text-blue-400/70" />
        <h3 className="text-xl font-semibold text-blue-300">
          Please Set Service Area
        </h3>
        <p className="text-blue-200/70 mt-2 max-w-md mx-auto">
          To see available jobs, you need to define your service area first.
          This helps match you with nearby projects.
        </p>
      </div>
    );
  }

  // DIAGNOSTICS: Check if jobs is empty
  if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
    console.log("JobsList: No jobs found condition triggered");
    console.log(
      "jobs is:",
      jobs,
      "isArray:",
      Array.isArray(jobs),
      "length:",
      jobs?.length,
    );
    return (
      <div className="p-4 text-center">
        <h3 className="text-lg font-medium">No Jobs Found</h3>
        <p className="text-muted-foreground mt-1">
          There are no open jobs in your area currently. Check back later for
          new opportunities.
        </p>
      </div>
    );
  }

  console.log("JobsList - Rendering jobs:", jobs.length);

  // Function to get an image for the job card
  const getJobImage = (job: ExtendedJob) => {
    // Check if the job has uploaded images on the server
    if (job.images && Array.isArray(job.images) && job.images.length > 0) {
      // Use the first uploaded image from the Service Requestor (landlord)
      const firstImage = job.images[0];
      // Make sure it's a string and not an object
      if (typeof firstImage === "string" && firstImage.trim() !== "") {
        return firstImage;
      } else if (
        typeof firstImage === "object" &&
        firstImage !== null &&
        "url" in firstImage
      ) {
        // Some images might be stored as objects with url property
        return firstImage.url;
      }
    }

    // Initialize fallback image based on category
    let imagePath = "/uploads/jobs/default-job-image.svg";

    // Initialize our category from tags
    let category = "";
    if (
      job.categoryTags &&
      Array.isArray(job.categoryTags) &&
      job.categoryTags.length > 0
    ) {
      category = String(job.categoryTags[0]).toLowerCase();
    }

    // Combine title and description for better matching
    const titleAndDescription = (
      job.title +
      " " +
      job.description
    ).toLowerCase();

    // Map default server-stored images based on job type
    // We're storing these category-based images on the server in the /uploads/jobs directory
    if (
      titleAndDescription.includes("kitchen") &&
      titleAndDescription.includes("faucet")
    ) {
      imagePath = "/uploads/jobs/kitchen-faucet.svg";
    } else if (
      titleAndDescription.includes("kitchen") &&
      titleAndDescription.includes("sink")
    ) {
      imagePath = "/uploads/jobs/kitchen-sink.svg";
    } else if (
      titleAndDescription.includes("bathroom") &&
      titleAndDescription.includes("light")
    ) {
      imagePath = "/uploads/jobs/bathroom-light.svg";
    } else if (
      titleAndDescription.includes("bathroom") &&
      titleAndDescription.includes("sink")
    ) {
      imagePath = "/uploads/jobs/bathroom-sink.jpg";
    } else if (titleAndDescription.includes("ceiling fan")) {
      imagePath = "/uploads/jobs/ceiling-fan.svg";
    } else if (titleAndDescription.includes("hardwood floor")) {
      imagePath = "/uploads/jobs/hardwood-floor.jpg";
    } else if (
      titleAndDescription.includes("refinish") &&
      titleAndDescription.includes("floor")
    ) {
      imagePath = "/uploads/jobs/refinish-floor.svg";
    } else if (titleAndDescription.includes("smart thermostat")) {
      imagePath = "/uploads/jobs/smart-thermostat.svg";
    }
    // Generic category-based fallbacks
    else if (category) {
      if (category.includes("plumb")) {
        imagePath = "/uploads/jobs/plumbing.svg";
      } else if (category.includes("electr")) {
        imagePath = "/uploads/jobs/electrical.svg";
      } else if (category.includes("paint")) {
        imagePath = "/uploads/jobs/painting.svg";
      } else if (category.includes("carp")) {
        imagePath = "/uploads/jobs/carpentry.jpg";
      } else if (category.includes("roof")) {
        imagePath = "/uploads/jobs/roofing.jpg";
      } else if (category.includes("land")) {
        imagePath = "/uploads/jobs/landscaping.jpg";
      } else if (category.includes("floor")) {
        imagePath = "/uploads/jobs/flooring.svg";
      } else if (category.includes("general")) {
        imagePath = "/uploads/jobs/general-contracting.jpg";
      } else {
        // For any other category, use a general home maintenance image
        imagePath = "/uploads/jobs/default-job-image.svg";
      }
    }

    return imagePath;
  };

  // Function to calculate time until preferred start date
  const getTimeUntilStart = (job: ExtendedJob) => {
    if (!job.startDate && !job.deadline) return null;

    const targetDate = job.startDate
      ? new Date(job.startDate)
      : job.deadline
        ? typeof job.deadline === "string"
          ? new Date(job.deadline)
          : null
        : null;

    if (!targetDate) return null;

    const now = new Date();
    const diffTime = targetDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // If target date is in the past
    if (diffTime < 0) return null;

    // If it's less than 24 hours, show hours
    if (diffDays < 1) {
      const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
      return { value: diffHours, unit: "hours", urgent: true };
    }

    // If it's less than 2 days, mark as urgent
    return { value: diffDays, unit: "days", urgent: diffDays <= 2 };
  };

  // Display toggle component
  const DisplayToggle = () => (
    <div className="mb-4 flex justify-end gap-2 items-center">
      <ToggleGroup
        type="single"
        value={viewType}
        onValueChange={(value) =>
          value && setViewType(value as "grid" | "table")
        }
      >
        <ToggleGroupItem
          value="grid"
          aria-label="Grid View"
          className="bg-blue-950/40 border-blue-800/40 text-blue-200 data-[state=on]:bg-blue-800 data-[state=on]:text-white"
        >
          <LayoutGrid className="h-4 w-4 mr-1" />
          <span className="text-sm">Grid</span>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="table"
          aria-label="Table View"
          className="bg-blue-950/40 border-blue-800/40 text-blue-200 data-[state=on]:bg-blue-800 data-[state=on]:text-white"
        >
          <List className="h-4 w-4 mr-1" />
          <span className="text-sm">Table</span>
        </ToggleGroupItem>
      </ToggleGroup>
      
      {/* Compact Mode Toggle with Tooltip */}
      {viewType === "grid" && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`ml-2 ${
                  isCompactMode 
                    ? "bg-blue-800 text-white border-blue-700" 
                    : "bg-blue-950/40 border-blue-800/40 text-blue-200"
                }`}
                onClick={() => setIsCompactMode(!isCompactMode)}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Toggle Compact Mode</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );

  // Create a ref to store stable application data
  // This helps prevent rerenders causing visual changes
  const stableDataRef = useRef<{
    bidData: Record<number, {
      count: number;
      minAmount: number | null;
      maxAmount: number | null;
      avgAmount: number | null;
    }>;
    jobImages: Record<number, string[]>;
    currentImageIndex: Record<number, number>;
    initialized: boolean;
  }>({
    bidData: {},
    jobImages: {},
    currentImageIndex: {},
    initialized: false
  });
  
  // Initialize only job images once on component mount/update
  // We've moved the bid data to a fixed global cache above
  useEffect(() => {
    function initializeStableData() {
      if (!stableDataRef.current.initialized && jobs.length > 0) {
        console.log("Initializing stable job images only (bid data is now globally fixed)");
        
        // Note: Bid data is now using the global bidDataCache object
        // We only need to initialize the job images here
          
          // Then process images for each job (just like before)
          jobs.forEach(job => {
      
      // Pre-cache job images for each job
      if (!stableDataRef.current.jobImages[job.id]) {
        // Generate images based on job category for demo purposes
        // In a real app, these would come from the job data
        const titleAndDescription = (job.title + ' ' + job.description).toLowerCase();
        let category = '';
        
        if (job.categoryTags && Array.isArray(job.categoryTags) && job.categoryTags.length > 0) {
          category = String(job.categoryTags[0]).toLowerCase();
        }
        
        const images: string[] = [];
        
        // Add category-based images
        if (category.includes("plumb")) {
          images.push("/images/jobs/plumbing1.jpg");
          images.push("/images/jobs/plumbing2.jpg");
          images.push("/images/jobs/plumbing3.jpg");
        } else if (category.includes("electric")) {
          images.push("/images/jobs/electrical1.jpg");
          images.push("/images/jobs/electrical2.jpg");
        } else if (category.includes("paint")) {
          images.push("/images/jobs/painting1.jpg");
          images.push("/images/jobs/painting2.jpg");
          images.push("/images/jobs/painting3.jpg");
        } else if (category.includes("roof")) {
          images.push("/images/jobs/roofing1.jpg");
          images.push("/images/jobs/roofing2.jpg");
        } else if (category.includes("landscap")) {
          images.push("/images/jobs/landscaping1.jpg");
          images.push("/images/jobs/landscaping2.jpg");
        } else if (category.includes("hvac") || category.includes("heat") || titleAndDescription.includes("air condition")) {
          images.push("/images/jobs/hvac1.jpg");
          images.push("/images/jobs/hvac2.jpg");
        } else if (category.includes("carpenter") || category.includes("woodwork")) {
          images.push("/images/jobs/carpentry1.jpg");
          images.push("/images/jobs/carpentry2.jpg");
        } else {
          // Default images if no category match
          images.push("/images/jobs/default1.jpg");
          images.push("/images/jobs/default2.jpg");
        }
        
        stableDataRef.current.jobImages[job.id] = images;
        console.log(`Generated stable image collection for job ${job.id}: ${images.length} images`);
      }
      
      // Set initial image index
      if (!stableDataRef.current.currentImageIndex[job.id]) {
        stableDataRef.current.currentImageIndex[job.id] = 0;
      }
    });
    
    stableDataRef.current.initialized = true;
        }
      }
    }
    
    initializeStableData();
  }, [jobs]);
  
  // IMPORTANT: Get a stable global reference to our bid data
  // This function now returns a FIXED object using a stable reference,
  // completely disconnected from any React render cycles or state
  const bidDataCache = {
    1: { count: 2, minAmount: 250, maxAmount: 350, avgAmount: 300 },
    2: { count: 1, minAmount: 275, maxAmount: 275, avgAmount: 275 },
    3: { count: 3, minAmount: 300, maxAmount: 450, avgAmount: 375 },
    4: { count: 0, minAmount: null, maxAmount: null, avgAmount: null },
    5: { count: 2, minAmount: 350, maxAmount: 500, avgAmount: 425 },
    6: { count: 0, minAmount: null, maxAmount: null, avgAmount: null },
  };
  
  // This function now only returns from our global cache object
  const getBidData = (jobId: number) => {
    // Only use fixed bid data from our cache
    if (jobId in bidDataCache) {
      return bidDataCache[jobId as keyof typeof bidDataCache];
    }

    // Default fallback that's also fixed
    return {
      count: 0,
      minAmount: null,
      maxAmount: null,
      avgAmount: null,
    };
  };

  // Function to calculate job size based on budget
  const getJobSize = (job: ExtendedJob) => {
    if (!job.budget) return "unknown";
    if (job.budget < 500) return "small";
    if (job.budget < 2000) return "medium";
    return "large";
  };

  // Function to determine if a job is urgent based on various factors
  const isJobUrgent = (job: ExtendedJob) => {
    const timeUntil = getTimeUntilStart(job);
    // Consider a job urgent if it's marked as urgent or has a very close deadline
    return job.isUrgent || (timeUntil && timeUntil.urgent);
  };

  // Function to get time remaining for bidding (simplified)
  const getBiddingTimeLeft = (job: ExtendedJob) => {
    // In a real app, this would be calculated from job.biddingEndsAt or similar
    // For now, we'll use a simplified approach based on creation date
    const createdAt = new Date(job.createdAt);
    const now = new Date();
    const diffDays = Math.ceil(
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Allow bidding for 7 days from creation
    const daysLeft = 7 - diffDays;

    // If bidding period is over
    if (daysLeft <= 0) return null;

    return {
      days: daysLeft,
      hours: 24 - now.getHours(),
    };
  };
  
  // Function to get stable job images without recreating them on each render
  // With our pre-caching during initialization, this should always return from cache
  const getJobImages = (job: ExtendedJob): string[] => {
    // If we have cached images, return them
    if (stableDataRef.current.jobImages[job.id]) {
      return stableDataRef.current.jobImages[job.id];
    }
    
    // If we somehow missed pre-caching this job, generate default images
    // This should rarely if ever happen
    console.warn(`Missing pre-cached images for job ${job.id}, creating default set`);
    const defaultImages = ["/images/jobs/default1.jpg", "/images/jobs/default2.jpg"];
    stableDataRef.current.jobImages[job.id] = defaultImages;
    
    return defaultImages;
  };

  // Grid View Implementation with enhanced UI
  const GridView = () => (
    <div className={`grid grid-cols-1 ${
      isCompactMode 
        ? "sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" 
        : "sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      } gap-4 w-full`}
    >
      {jobs.map((job) => {
        const timeUntil = getTimeUntilStart(job);
        const bidData = getBidData(job.id);
        const jobSize = getJobSize(job);
        const isUrgent = isJobUrgent(job);
        const biddingTimeLeft = getBiddingTimeLeft(job);

        return (
          <Card
            key={job.id}
            data-job-id={job.id}
            className={`overflow-hidden cursor-pointer bg-white border border-gray-200 shadow-sm rounded-lg text-gray-800 text-sm transition-all duration-200
              ${hoveredJobId === job.id || highlightedJobId === job.id ? "ring-1 ring-blue-400 shadow-md" : "hover:shadow-md"}
              relative
              ${isCompactMode ? "compact-card JobsList-compact-card" : ""}
            `}
            onMouseEnter={() => handleJobHover(job.id)}
            onMouseLeave={() => handleJobHover(null)}
          >
            {/* Category badge - Top left */}
            {job.categoryTags && Array.isArray(job.categoryTags) && job.categoryTags.length > 0 && (
              <div className="absolute top-2 left-2 z-10">
                <Badge
                  variant="outline"
                  className="bg-gray-100 text-gray-700 text-xs font-medium px-2 py-0.5 rounded-full"
                >
                  {getCategoryDisplayName(String(job.categoryTags[0])).toLowerCase()}
                </Badge>
              </div>
            )}

            {/* Urgency badge - Pill style in top-right */}
            {isUrgent && (
              <div className="absolute top-2 right-2 z-10">
                <Badge
                  variant="outline"
                  className="bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded-full"
                >
                  URGENT
                </Badge>
              </div>
            )}

            {/* Card Content */}
            <CardContent
              className="p-4"
              onClick={() =>
                onViewDetails ? onViewDetails(job) : onBidJob && onBidJob(job)
              }
            >
              {/* Header: Title + Budget row */}
              <div className="mb-2.5">
                <div className="flex justify-between mb-2">
                  <h3 className="text-base font-semibold text-gray-800 line-clamp-2 max-h-[3.2em] text-ellipsis overflow-hidden" title={job.title}>
                    {job.title}
                  </h3>
                  <div className="text-base font-semibold text-green-600">
                    ${job.budget?.toFixed(2)}
                  </div>
                </div>
                {job.pricingType === "fixed" ? (
                  <div className="text-xs text-gray-500 flex items-center gap-0.5">
                    <span>•</span> <span>{jobSize === "small" ? "Small Job" : jobSize === "medium" ? "Medium Job" : "Large Job"}</span>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">Open to bids</div>
                )}
              </div>
              
              {/* Description */}
              <div className="mb-3">
                <p className="text-sm text-gray-700 line-clamp-2">
                  {job.description}
                </p>
              </div>

              {/* Bid range info - NEW */}
              {!isCompactMode && bidData.count > 0 && bidData.minAmount && bidData.maxAmount && (
                <div className="mb-3">
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">Bid Range:</span>
                      <span className="ml-1">
                        ${bidData.minAmount} - ${bidData.maxAmount}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Main details section - hidden in compact mode */}
              {!isCompactMode && (
                <div className="grid grid-cols-1 gap-1.5 mb-3">
                  {/* Full job description */}
                  <div className="text-sm text-gray-700">
                    {job.description}
                  </div>

                  {/* Posted info */}
                  <div className="mt-2 mb-1.5">
                    <div className="flex items-center">
                      <div className="h-6 w-6 rounded-full bg-yellow-300 text-yellow-600 flex items-center justify-center text-xs font-bold mr-2">
                        <span>PO</span>
                      </div>
                      <div className="text-sm font-medium">
                        Property Owner
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Posted {formatDistance(job.createdAt)}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Location - always shown */}
              <div className="flex items-center text-sm text-gray-700 mb-3">
                <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                <span className="truncate">
                  {typeof job.location === "object" && job.location !== null
                    ? `${job.location?.city || ""}, ${job.location?.state || ""}`
                    : "No location specified"}
                </span>
              </div>
              
              {/* Job details - hidden in compact mode (without URGENT label) */}
              {!isCompactMode && job.startDate && (
                <div className="mb-2.5">
                  <div className="text-sm font-semibold text-gray-700 mb-1 uppercase tracking-wide">Timeline</div>
                  <div className="text-sm text-gray-700">1-2 days</div>
                </div>
              )}
              
              {/* Skills Required - refined display with supplementary trades only (keeping only additional tags) */}
              {!isCompactMode && job.categoryTags && Array.isArray(job.categoryTags) && job.categoryTags.length > 1 && (
                <div className="mb-2.5">
                  <div className="text-sm font-semibold text-gray-700 mb-1 uppercase tracking-wide">Requirements</div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {job.categoryTags.slice(1).map((tag, index) => (
                      <Badge 
                        key={index}
                        variant="secondary" 
                        className="bg-gray-100 text-gray-700 text-xs font-medium px-2 py-0.5 rounded-full"
                      >
                        {getCategoryDisplayName(String(tag))}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Job Size Badge - hidden in compact mode */}
              {!isCompactMode && (
                <div className="mb-2.5">
                  <div className="text-sm font-semibold text-gray-700 mb-1 uppercase tracking-wide">Materials</div>
                  <div className="mt-1">
                    <Badge 
                      variant="outline" 
                      className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full"
                    >
                      {jobSize === "small" ? "Small Job" : jobSize === "medium" ? "Medium Job" : "Large Job"}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>

            {/* Divider */}
            <div className="border-t border-gray-200 mt-2 mb-2"></div>

            {/* Bottom - bid count and action buttons */}
            <div className="flex justify-between items-center px-4 pb-3">
              <div className="flex items-center">
                <div className="flex items-center text-sm text-gray-700 font-medium">
                  <Users className="h-4 w-4 mr-1.5 text-gray-600" />
                  {bidData.count === 0 ? 'No bids yet' : `${bidData.count} bid${bidData.count !== 1 ? 's' : ''}`}
                </div>
              </div>
              <div className="flex gap-2">
                {!isCompactMode && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-gray-600 hover:text-blue-700 border-transparent hover:border-transparent transition-all duration-150 hover:bg-blue-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      toast({
                        title: "Message Poster",
                        description: "This feature is coming soon!",
                      });
                    }}
                  >
                    Message Poster
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border border-gray-300 text-gray-700 hover:bg-green-700 hover:text-white hover:border-green-700 transition-all duration-150 hover:shadow-md"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onViewDetails) onViewDetails(job);
                    else if (onBidJob) onBidJob(job);
                  }}
                >
                  {isCompactMode ? "Details" : "View Details"}
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );

  // Table View Implementation with enhanced UI and sortable columns
  const TableView = () => (
    <div className="w-full">
      <Table className="w-full text-white bg-blue-950/20 rounded-lg overflow-hidden shadow-lg">
        <TableHeader className="bg-blue-900/80 border-b border-blue-800">
          <TableRow className="hover:bg-blue-800/60 h-12">
            <TableHead className="text-blue-200 w-12"></TableHead>
            <TableHead
              className="text-blue-200 cursor-pointer hover:text-white transition-colors"
              onClick={() => handleColumnSort("title")}
            >
              <div className="flex items-center">
                Job
                {sortMethod === "title" && (
                  <span className="ml-1.5">
                    {sortOrder === "asc" ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    )}
                  </span>
                )}
                {sortMethod !== "title" && (
                  <ArrowUpDown className="h-4 w-4 ml-1.5 opacity-40" />
                )}
              </div>
            </TableHead>
            <TableHead
              className="text-blue-200 cursor-pointer"
              onClick={() => handleColumnSort("price")}
            >
              <div className="flex items-center">
                Price
                {sortMethod === "price" && (
                  <span className="ml-1.5">
                    {sortOrder === "asc" ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    )}
                  </span>
                )}
                {sortMethod !== "price" && (
                  <ArrowUpDown className="h-4 w-4 ml-1.5 opacity-40" />
                )}
              </div>
            </TableHead>
            <TableHead
              className="text-blue-200 hidden md:table-cell cursor-pointer"
              onClick={() => handleColumnSort("location")}
            >
              <div className="flex items-center">
                Location
                {sortMethod === "location" && (
                  <span className="ml-1.5">
                    {sortOrder === "asc" ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    )}
                  </span>
                )}
                {sortMethod !== "location" && (
                  <ArrowUpDown className="h-4 w-4 ml-1.5 opacity-40" />
                )}
              </div>
            </TableHead>
            <TableHead
              className="text-blue-200 hidden md:table-cell cursor-pointer"
              onClick={() => handleColumnSort("date")}
            >
              <div className="flex items-center">
                Timeline
                {sortMethod === "date" && (
                  <span className="ml-1.5">
                    {sortOrder === "asc" ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    )}
                  </span>
                )}
                {sortMethod !== "date" && (
                  <ArrowUpDown className="h-4 w-4 ml-1.5 opacity-40" />
                )}
              </div>
            </TableHead>
            <TableHead
              className="text-blue-200 hidden lg:table-cell cursor-pointer"
              onClick={() => handleColumnSort("category")}
            >
              <div className="flex items-center">
                Category
                {sortMethod === "category" && (
                  <span className="ml-1.5">
                    {sortOrder === "asc" ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    )}
                  </span>
                )}
                {sortMethod !== "category" && (
                  <ArrowUpDown className="h-4 w-4 ml-1.5 opacity-40" />
                )}
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => {
            const timeUntil = getTimeUntilStart(job);
            const isExpanded = expandedRows.includes(job.id);

            return (
              <React.Fragment key={job.id}>
                <TableRow
                  className="cursor-pointer border-b border-blue-800/30 hover:bg-blue-800/30 text-white"
                  onMouseEnter={() => handleJobHover(job.id)}
                  onMouseLeave={() => handleJobHover(null)}
                  onClick={() =>
                    onViewDetails
                      ? onViewDetails(job)
                      : onBidJob && onBidJob(job)
                  }
                >
                  <TableCell className="p-2 align-middle">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 p-0 text-blue-400 hover:text-blue-200 hover:bg-blue-900/30"
                      onClick={(e) => toggleRowExpansion(job.id, e)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell className="py-2 align-middle">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-md overflow-hidden flex-shrink-0">
                        <img
                          src={getJobImage(job)}
                          alt={job.title}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "/uploads/jobs/default-job-image.svg";
                          }}
                        />
                      </div>
                      <div className="font-medium text-white line-clamp-2 max-h-[3.2em] text-ellipsis overflow-hidden max-w-[200px]" title={job.title}>
                        {job.title}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-2 align-middle">
                    {job.pricingType === "fixed" ? (
                      <span className="font-medium text-green-300">
                        ${job.budget?.toFixed(2)}
                      </span>
                    ) : (
                      <span className="font-medium text-blue-300">
                        Open Bid
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-2 align-middle hidden md:table-cell text-blue-200">
                    {typeof job.location === "object" && job.location !== null
                      ? `${job.location?.city || ""}, ${job.location?.state || ""}`
                      : ""}
                  </TableCell>
                  <TableCell className="py-2 align-middle hidden md:table-cell">
                    {timeUntil ? (
                      <span
                        className="text-blue-200"
                      >
                        {timeUntil.value} {timeUntil.unit}
                      </span>
                    ) : (
                      <span className="text-blue-200">
                        Posted {formatDistance(job.createdAt)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-2 align-middle hidden lg:table-cell">
                    {job.categoryTags &&
                    Array.isArray(job.categoryTags) &&
                    job.categoryTags.length > 0 ? (
                      <Badge
                        variant="secondary"
                        className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded font-medium flex items-center gap-1 inline-flex"
                      >
                        <CategoryIcon
                          category={String(job.categoryTags[0])}
                          className="h-3 w-3 text-blue-700"
                        />
                        {getCategoryDisplayName(String(job.categoryTags[0]))}
                      </Badge>
                    ) : null}
                  </TableCell>
                </TableRow>

                {/* Expandable detail row */}
                <TableRow
                  className={`${isExpanded ? "" : "hidden"} bg-blue-950/40`}
                >
                  <TableCell colSpan={6} className="py-0 px-4">
                    <Collapsible open={isExpanded}>
                      <CollapsibleContent className="py-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-gray-800 mb-1">Job Details</h4>
                            <div className="text-blue-300 text-xs flex items-center gap-1 mb-1">
                              <Tag className="h-3.5 w-3.5" />
                              <span>Description</span>
                            </div>
                            <p className="text-sm text-blue-100">
                              {typeof job.description === "string"
                                ? job.description
                                : job.description
                                  ? String(job.description)
                                  : "No description available"}
                            </p>

                            {/* Additional categories if present */}
                            {job.categoryTags &&
                              Array.isArray(job.categoryTags) &&
                              job.categoryTags.length > 1 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {job.categoryTags
                                    .slice(1)
                                    .map((category: string, idx: number) => (
                                      <Badge
                                        key={idx}
                                        variant="secondary"
                                        className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded font-medium"
                                      >
                                        {getCategoryDisplayName(
                                          String(category),
                                        )}
                                      </Badge>
                                    ))}
                                </div>
                              )}
                          </div>

                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-gray-800 mb-1">Location</h4>
                            <div className="text-blue-300 text-xs flex items-center gap-1 mb-1">
                              <MapPin className="h-3.5 w-3.5" />
                              <span>Address</span>
                            </div>
                            <div className="text-sm text-blue-100">
                              {typeof job.location === "object" &&
                              job.location !== null
                                ? `${job.location?.city || ""}, ${job.location?.state || ""}`
                                : "No location specified"}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-gray-800 mb-1">Timeline</h4>
                            <div className="text-blue-300 text-xs flex items-center gap-1 mb-1">
                              <CalendarDays className="h-3.5 w-3.5" />
                              <span>Scheduled Dates</span>
                            </div>
                            <div className="text-sm space-y-1">
                              {job.startDate && (
                                <div>
                                  <span className="text-blue-300">Start:</span>{" "}
                                  <span className="text-blue-100">
                                    {new Date(
                                      job.startDate,
                                    ).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                              <div>
                                <span className="text-blue-300">Posted:</span>{" "}
                                <span className="text-blue-100">
                                  {new Date(job.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="mt-4 flex gap-2 justify-end">
                          <Button
                            size="sm"
                            className="bg-blue-800 hover:bg-blue-700 text-white text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewDetails && onViewDetails(job);
                            }}
                          >
                            View Full Details
                          </Button>
                          {onBidJob && (
                            <Button
                              size="sm"
                              className="bg-green-700 hover:bg-green-600 text-white text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                onBidJob(job);
                              }}
                            >
                              Place Bid
                            </Button>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </TableCell>
                </TableRow>
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  // Return the view based on the current viewType
  return (
    <div>
      {/* Show the view based on the current selection */}
      {viewType === "grid" ? <GridView /> : <TableView />}
    </div>
  );
}
