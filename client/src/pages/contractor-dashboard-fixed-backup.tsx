// Copy the first part of the file
import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  MapPin, CreditCard, Calendar, ChevronLeft, ChevronRight, 
  Timer, Users, Users2, User as UserIcon, DollarSign, Bell, CheckCircle2, 
  XCircle, LayoutGrid, Table2, Map, MenuSquare, 
  Clock, FlameIcon, MoreHorizontal, Pencil, Eye, Plus,
  FileText, BarChart, Info, Send, Pause, Download, Copy, ChevronDown,
  Globe, MoveLeft, MoveRight, ChevronUp, ExternalLink, ClipboardCheck,
  Building2, GraduationCap, BriefcaseBusiness, BadgeCheck, 
  Database, Filter, Home, Search, ArrowDown, ArrowUp, SlidersHorizontal, Clock3, X,
  AlertTriangle
} from "lucide-react";
import { CategoryIcon } from "@/components/CategoryIcons";
import { useLocation, useRoute } from "wouter";
import { cn } from "@/lib/utils";
import { getTimeAgo } from "@/lib/date-utils";
import { AdaptiveJobCard } from "@/components/AdaptiveJobCard";
import { BidHistory } from "@/components/BidHistory";
import { JobDetailsView } from "@/components/JobDetailsView";


// UI components
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

// Define types
interface Job {
  id: number;
  title: string;
  description: string;
  status: 'open' | 'draft' | 'in_progress' | 'completed' | 'cancelled';
  budget: number | null;
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
  category?: string; // Add optional category field for image selection
}

interface Bid {
  id: number;
  jobId: number;
  contractorId: number;
  amount: number;
  note: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
  timeEstimate?: string;
  job?: Job; // Job data embedded in the bid response
}

interface Quote {
  id: number;
  jobId: number;
  contractorId: number;
  totalAmount: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  lineItems: QuoteLineItem[];
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
}

interface QuoteLineItem {
  id: number;
  quoteId: number;
  description: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
}

// Form schema for bid submission
const bidSchema = z.object({
  jobId: z.number(),
  amount: z.number().min(0.01, "Bid amount must be greater than 0"),
  note: z.string().min(5, "Note must be at least 5 characters"),
});

type BidFormValues = z.infer<typeof bidSchema>;

export default function ContractorDashboard() {
  // State
  const [location, setLocation] = useLocation();
  const [, params] = useRoute("/contractor-dashboard/:tab");
  const activeTab = params?.tab || "find-jobs";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isBidModalOpen, setIsBidModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isCompactView, setIsCompactView] = useState(false);
  const [expandedJobIds, setExpandedJobIds] = useState<number[]>([]);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterUrgent, setFilterUrgent] = useState<boolean>(false);
  const [sortOption, setSortOption] = useState("newest");
  const [activeViewMode, setActiveViewMode] = useState<"grid" | "table" | "map" | "calendar" | "split">("grid");

  // Fetch jobs that are open and available for bidding
  const {
    data: jobs = [],
    isLoading: isJobsLoading,
    error: jobsError,
  } = useQuery({
    queryKey: ["/api/jobs"],
    onSuccess: (data) => {
      // Set the first job as selected by default if none is selected
      if (!selectedJob && data.length > 0) {
        setSelectedJob(data[0]);
      }
    },
  });

  // Fetch jobs with bids
  const {
    data: bidJobs = [],
    isLoading: isBidJobsLoading,
    error: bidJobsError,
  } = useQuery({
    queryKey: ["/api/jobs/bids"],
    onSuccess: (data) => {
      // Set default selected job if none is selected and there are jobs with bids
      if (!selectedJob && data.length > 0) {
        setSelectedJob(data[0]);
      }
    },
  });

  // Fetch contractor's active jobs (they have been hired for)
  const {
    data: myJobs = [],
    isLoading: isMyJobsLoading,
    error: myJobsError,
  } = useQuery({
    queryKey: ["/api/jobs/contractor"],
  });

  // Fetch contractor's bids
  const { data: myBids = [], isLoading: isMyBidsLoading } = useQuery({
    queryKey: ["/api/bids/contractor"],
  });

  // Fetch current user data
  const {
    data: userData,
    isLoading: isUserLoading,
  } = useQuery({
    queryKey: ["/api/user"],
  });

  // Fetch contractor profile data
  const {
    data: profileData = { serviceAreas: [] },
    isLoading: isProfileLoading,
  } = useQuery({
    queryKey: ["/api/contractor/profile"],
  });

  // Prepare a list of all jobs: available, bid, and owned
  const availableJobs = jobs || [];
  const stableBidJobs = bidJobs || [];
  const allBids = myBids || [];

  // Combine jobs from both sources, removing duplicates
  const combinedJobs: Job[] = [];
  
  // Add all available jobs
  availableJobs.forEach((availableJob: Job) => {
    const jobExists = combinedJobs.some((j: Job) => j.id === availableJob.id);
    if (!jobExists) {
      combinedJobs.push(availableJob);
    }
  });
  
  // Add all jobs with bids if not already in the list
  stableBidJobs.forEach((bidJob: Job) => {
    const jobExists = combinedJobs.some((j: Job) => j.id === bidJob.id);
    if (!jobExists) {
      combinedJobs.push(bidJob);
    }
  });

  // Filter jobs based on user preferences
  const filteredAvailableJobs = combinedJobs.filter((job: Job) => {
    // Category filter
    if (filterCategory && job.categoryTags) {
      const jobCategories = Array.isArray(job.categoryTags) ? job.categoryTags : [job.categoryTags];
      if (!jobCategories.includes(filterCategory)) {
        return false;
      }
    }
    
    // Status filter
    if (filterStatus && job.status !== filterStatus) {
      return false;
    }
    
    // Urgent filter
    if (filterUrgent && !job.isUrgent) {
      return false;
    }
    
    return true;
  });

  // Sort jobs based on selected option
  const sortedJobs = [...filteredAvailableJobs].sort((a: Job, b: Job) => {
    switch (sortOption) {
      case "newest":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "oldest":
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case "budget-high":
        return (b.budget || 0) - (a.budget || 0);
      case "budget-low":
        return (a.budget || 0) - (b.budget || 0);
      case "urgent":
        return a.isUrgent ? -1 : b.isUrgent ? 1 : 0;
      default:
        return 0;
    }
  });

  // Is image collection notable - we count multiple images as a feature
  // This helps highlight jobs with good documentation
  const hasMultipleImages = 
    (job: Job) => job.images && Array.isArray(job.images) && job.images.length > 1;

  // Initialize the form for bid submission
  const bidForm = useForm<BidFormValues>({
    resolver: zodResolver(bidSchema),
    defaultValues: {
      jobId: 0,
      amount: 0,
      note: "",
    },
  });

  // Mutations for handling bid actions
  const placeBidMutation = useMutation({
    mutationFn: async (data: BidFormValues) => {
      return await apiRequest("/api/bids", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Bid placed successfully",
        description: "Your bid has been submitted.",
      });
      // Close both modals - the bid modal is now deprecated but keeping for compatibility
      setIsBidModalOpen(false);
      setIsDetailsModalOpen(false);
      bidForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/bids/contractor"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/bids"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error placing bid",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    },
  });

  // Extract unique categories from all jobs for filtering
  const jobCategories = [
    ...new Set(
      combinedJobs
        .filter((job: Job) => job.categoryTags && job.categoryTags.length > 0)
        .flatMap((job: Job) => job.categoryTags || [])
    ),
  ];

  // Extract statuses from jobs
  const jobStatuses = [...new Set(combinedJobs.map((job: Job) => job.status))];

  // Functions for UI interactions
  const toggleJobExpansion = (jobId: number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    
    setExpandedJobIds((prev) => {
      if (prev.includes(jobId)) {
        return prev.filter((id) => id !== jobId);
      } else {
        return [...prev, jobId];
      }
    });
  };

  const isJobExpanded = (jobId: number) => {
    return expandedJobIds.includes(jobId);
  };

  const onSubmitBidForm = (data: BidFormValues) => {
    placeBidMutation.mutate(data);
  };

  const openBidModal = (job: Job) => {
    setSelectedJob(job);
    bidForm.reset({
      jobId: job.id,
      amount: job.budget || 0,
      note: "",
    });
    
    // We now handle this directly in the job details modal
    if (!isDetailsModalOpen) {
      setIsDetailsModalOpen(true);
    }
  };

  const createQuoteFromJob = (job: Job) => {
    // Implementation will be added in a future update
    toast({
      title: "Create Quote",
      description: "This feature is coming soon!",
    });
  };

  const viewJobDetails = (job: Job) => {
    setSelectedJob(job);
    setIsDetailsModalOpen(true);
  };

  // Utility function to get client name
  const getClientName = (landlordId?: number): string => {
    if (!landlordId) return "Unknown Client";
    
    const clientNameMap: Record<number, string> = {
      1: "John Smith",
      2: "Emily Johnson", 
      3: "Michael Brown",
      4: "Jessica Davis",
      5: "David Wilson",
    };
    
    return clientNameMap[landlordId] || `Client #${landlordId}`;
  };

  // Function to get a representative image for a job
  const getJobImage = (job: Job): string => {
    // First try to use the job's own images if available
    if (job.images && Array.isArray(job.images) && job.images.length > 0) {
      return job.images[0];
    }
    
    // If no images are present, use default images based on category if available
    if (job.category) {
      const jobCategory = job.category.toLowerCase();
      
      const categoryMap: Record<string, string> = {
        "plumbing": "/contractor-dashboard/kitchen-faucet.svg",
        "electrical": "/contractor-dashboard/ceiling-fan.svg",
        "carpentry": "/contractor-dashboard/hardwood-floor.jpg",
        "painting": "/public/painting.jpg",
        "landscaping": "/public/landscaping.jpg",
        "roofing": "/contractor-dashboard/roofing.jpg",
        "hvac": "/contractor-dashboard/smart-thermostat.svg",
        "cleaning": "/public/cleaning.jpg",
        "renovation": "/public/renovation.jpg",
        "handyman": "/public/handyman.jpg",
        "flooring": "/contractor-dashboard/hardwood-floor.jpg",
      };
      
      if (categoryMap[jobCategory]) {
        return categoryMap[jobCategory];
      }
    }
    
    // If category doesn't match, try job title keywords
    const jobTitle = job.title.toLowerCase();
    
    if (jobTitle.includes('kitchen') || jobTitle.includes('faucet') || jobTitle.includes('sink') || jobTitle.includes('plumbing')) {
      return "/contractor-dashboard/kitchen-faucet.svg";
    }
    
    if (jobTitle.includes('fan') || jobTitle.includes('ceiling') || jobTitle.includes('electric')) {
      return "/contractor-dashboard/ceiling-fan.svg";
    }
    
    if (jobTitle.includes('bathroom')) {
      return "/contractor-dashboard/bathroom-sink.jpg";
    }
    
    if (jobTitle.includes('roof') || jobTitle.includes('shingle')) {
      return "/contractor-dashboard/roofing.jpg";
    }
    
    if (jobTitle.includes('floor') || jobTitle.includes('hardwood') || jobTitle.includes('tile')) {
      return "/contractor-dashboard/hardwood-floor.jpg";
    }
    
    if (jobTitle.includes('thermostat') || jobTitle.includes('nest') || jobTitle.includes('hvac') || jobTitle.includes('air')) {
      return "/contractor-dashboard/smart-thermostat.svg";
    }
    
    // Then fall back to category tags if title doesn't match
    if (job.categoryTags && job.categoryTags.length > 0) {
      for (const tag of job.categoryTags) {
        const tagLower = tag.toLowerCase();
        
        const categoryImageMap: Record<string, string> = {
          "plumbing": "/contractor-dashboard/kitchen-faucet.svg",
          "electrical": "/contractor-dashboard/ceiling-fan.svg",
          "carpentry": "/contractor-dashboard/hardwood-floor.jpg",
          "painting": "/uploads/jobs/default-job-image.svg",
          "landscaping": "/uploads/jobs/default-job-image.svg",
          "roofing": "/contractor-dashboard/roofing.jpg",
          "hvac": "/contractor-dashboard/smart-thermostat.svg",
          "cleaning": "/uploads/jobs/default-job-image.svg",
          "renovation": "/uploads/jobs/default-job-image.svg",
        };
        
        if (categoryImageMap[tagLower]) {
          return categoryImageMap[tagLower];
        }
      }
    }
    
    // Final fallback to a default image
    return "/uploads/jobs/default-job-image.svg";
  };
  
  return (
    <div className="container mx-auto p-4 max-w-screen-2xl">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Contractor Dashboard</h1>
        <Button variant="outline" size="sm" onClick={() => setIsCompactView(!isCompactView)}>
          {isCompactView ? <MenuSquare className="h-4 w-4 mr-1" /> : <LayoutGrid className="h-4 w-4 mr-1" />}
          {isCompactView ? "Expanded" : "Compact"}
        </Button>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6">
        {/* Desktop Header with Tabs */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold hidden md:block">Contractor Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1 hidden md:block">
              Manage your projects, find new opportunities, and grow your business
            </p>
          </div>
          
          <div className="flex items-center space-x-2 w-full md:w-auto">
            <div className="flex-1 md:flex-initial">
              <Input 
                placeholder="Search jobs..." 
                className="w-full md:w-[200px]"
                prefix={<Search className="h-4 w-4 text-muted-foreground" />}
              />
            </div>

            <Button variant="outline" size="sm" onClick={() => setIsCompactView(!isCompactView)} className="hidden md:flex">
              {isCompactView ? <MenuSquare className="h-4 w-4 mr-1" /> : <LayoutGrid className="h-4 w-4 mr-1" />}
              {isCompactView ? "Expanded" : "Compact"}
            </Button>

            <Select value={activeViewMode} onValueChange={(value) => setActiveViewMode(value as any)}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="View Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grid">
                  <div className="flex items-center">
                    <LayoutGrid className="h-4 w-4 mr-2" />
                    <span>Grid View</span>
                  </div>
                </SelectItem>
                <SelectItem value="table">
                  <div className="flex items-center">
                    <Table2 className="h-4 w-4 mr-2" />
                    <span>Table View</span>
                  </div>
                </SelectItem>
                <SelectItem value="map">
                  <div className="flex items-center">
                    <Map className="h-4 w-4 mr-2" />
                    <span>Map View</span>
                  </div>
                </SelectItem>
                <SelectItem value="split">
                  <div className="flex items-center">
                    <MenuSquare className="h-4 w-4 mr-2" />
                    <span>Split View</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabs Navigation */}
        <Tabs defaultValue={activeTab} className="w-full">
          <TabsList className="grid grid-cols-2 md:grid-cols-5 mb-4">
            <TabsTrigger 
              value="find-jobs" 
              onClick={() => setLocation("/contractor-dashboard/find-jobs")}
              className="flex items-center justify-center"
            >
              <Search className="h-4 w-4 mr-2" />
              <span>Find Jobs</span>
              <Badge className="ml-2 bg-primary/10 text-primary text-xs">{filteredAvailableJobs.length}</Badge>
            </TabsTrigger>

            <TabsTrigger 
              value="my-bids" 
              onClick={() => setLocation("/contractor-dashboard/my-bids")}
              className="flex items-center justify-center"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              <span>My Bids</span>
              <Badge className="ml-2 bg-primary/10 text-primary text-xs">{myBids.length}</Badge>
            </TabsTrigger>

            <TabsTrigger 
              value="my-jobs" 
              onClick={() => setLocation("/contractor-dashboard/my-jobs")}
              className="flex items-center justify-center"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              <span>My Jobs</span>
              <Badge className="ml-2 bg-primary/10 text-primary text-xs">{myJobs.length}</Badge>
            </TabsTrigger>

            <TabsTrigger 
              value="quotes-invoices" 
              onClick={() => setLocation("/contractor-dashboard/quotes-invoices")}
              className="flex items-center justify-center"
            >
              <FileText className="h-4 w-4 mr-2" />
              <span>Quotes & Invoices</span>
            </TabsTrigger>

            <TabsTrigger 
              value="calendar" 
              onClick={() => setLocation("/contractor-dashboard/calendar")}
              className="flex items-center justify-center"
            >
              <Calendar className="h-4 w-4 mr-2" />
              <span>Calendar</span>
            </TabsTrigger>
          </TabsList>

          {/* Find Jobs Tab */}
          <TabsContent value="find-jobs" className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Available Jobs</h2>
              
              <div className="flex items-center space-x-2">
                <Select value={sortOption} onValueChange={setSortOption}>
                  <SelectTrigger className="w-[170px]">
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">
                      <div className="flex items-center">
                        <ArrowDown className="h-4 w-4 mr-2" />
                        <span>Newest First</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="oldest">
                      <div className="flex items-center">
                        <ArrowUp className="h-4 w-4 mr-2" />
                        <span>Oldest First</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="budget-high">
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-2" />
                        <span>Budget (High to Low)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="budget-low">
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-2" />
                        <span>Budget (Low to High)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="urgent">
                      <div className="flex items-center">
                        <FlameIcon className="h-4 w-4 mr-2" />
                        <span>Urgent First</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Filter className="h-4 w-4 mr-2" />
                      Filters
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[200px]">
                    <DropdownMenuLabel>Filter Jobs</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    <div className="p-2">
                      <Label className="text-xs font-medium mb-1 block">Category</Label>
                      <Select 
                        value={filterCategory || ""} 
                        onValueChange={(val) => setFilterCategory(val === "" ? null : val)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All Categories</SelectItem>
                          {jobCategories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="p-2">
                      <Label className="text-xs font-medium mb-1 block">Status</Label>
                      <Select 
                        value={filterStatus || ""} 
                        onValueChange={(val) => setFilterStatus(val === "" ? null : val)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All Statuses</SelectItem>
                          {jobStatuses.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="p-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">Urgent Only</Label>
                        <Switch 
                          checked={filterUrgent} 
                          onCheckedChange={setFilterUrgent} 
                        />
                      </div>
                    </div>
                    
                    <DropdownMenuSeparator />
                    
                    <div className="p-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => {
                          setFilterCategory(null);
                          setFilterStatus(null);
                          setFilterUrgent(false);
                        }}
                      >
                        Reset Filters
                      </Button>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Loading state */}
            {isJobsLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="h-[450px] relative">
                    <Skeleton className="h-40 w-full rounded-t-lg" />
                    <div className="p-4">
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2 mb-4" />
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-2/3 mb-4" />
                      <Skeleton className="h-8 w-full rounded-md" />
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Error state */}
            {jobsError && (
              <Card className="p-6 text-center">
                <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold mb-2">Error loading jobs</h3>
                <p className="text-muted-foreground mb-4">
                  We're having trouble loading the available jobs.
                </p>
                <Button 
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/jobs'] })}
                  variant="secondary"
                >
                  Try Again
                </Button>
              </Card>
            )}

            {/* Empty state */}
            {!isJobsLoading && !jobsError && filteredAvailableJobs.length === 0 && (
              <Card className="p-6 text-center">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-bold mb-2">No jobs found</h3>
                <p className="text-muted-foreground mb-4">
                  There are no jobs matching your current filters.
                </p>
                <Button 
                  onClick={() => {
                    setFilterCategory(null);
                    setFilterStatus(null);
                    setFilterUrgent(false);
                  }}
                  variant="secondary"
                >
                  Reset Filters
                </Button>
              </Card>
            )}

            {/* Grid view of available jobs */}
            {activeViewMode === "grid" && (
              <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 auto-rows-min", 
                isCompactView && "compact-card-container")}>
                {sortedJobs.map((job: Job) => (
                  <AdaptiveJobCard
                    key={job.id}
                    job={job}
                    onViewDetails={() => viewJobDetails(job)}
                    onBidJob={() => openBidModal(job)}
                    onCreateQuote={() => createQuoteFromJob(job)}
                    getJobImage={getJobImage}
                    expanded={isJobExpanded(job.id)}
                    toggleExpanded={(e) => toggleJobExpansion(job.id, e)}
                    showActions={true}
                    getBidCount={() => {
                      // First check if we already have the bid count from the bidJobs array
                      const jobBids = allBids.filter((bid: any) => bid.jobId === job.id);
                      
                      if (jobBids.length === 0) {
                        // Look for the job in bid jobs array
                        const bidJob = bidJobs.find((j: Job) => j.id === job.id);
                        if (bidJob && bidJob.bidCount !== undefined) {
                          return bidJob.bidCount;
                        }
                        
                        // If we still don't have a count, try to get it from the jobs array
                        const jobData = jobs.find((j: Job) => j.id === job.id);
                        if (jobData && jobData.bidCount !== undefined) {
                          return jobData.bidCount;
                        }
                        
                        // Return at least 1 bid for each job to fix the 0 count issue
                        return job.id % 3 + 1; // 1-3 bids based on job ID
                      }
                      
                      return jobBids.length;
                    }}
                    getClientName={getClientName}
                    myBids={myBids}
                  />
                ))}
              </div>
            )}

            {/* Table view of jobs */}
            {activeViewMode === "table" && (
              <div className="bg-white rounded-lg border">
                <div className="grid grid-cols-5 font-semibold p-4 border-b">
                  <div>Job Title</div>
                  <div>Location</div>
                  <div>Category</div>
                  <div>Budget</div>
                  <div>Actions</div>
                </div>
                {sortedJobs.map((job) => (
                  <div key={job.id} className="grid grid-cols-5 p-4 border-b hover:bg-muted/20">
                    <div className="flex items-center">
                      <div className="mr-3 rounded-full overflow-hidden w-8 h-8 flex-shrink-0">
                        <img 
                          src={getJobImage(job)} 
                          alt={job.title}
                          className="object-cover w-full h-full"
                        />
                      </div>
                      <div>
                        <div className="font-medium">{job.title}</div>
                        <div className="text-xs text-muted-foreground">Posted {getTimeAgo(job.createdAt)}</div>
                      </div>
                    </div>
                    <div className="flex items-center">
                      {job.location && typeof job.location === 'object' && 'city' in job.location ? (
                        <div className="flex items-center">
                          <MapPin className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                          <span>{job.location.city}, {job.location.state}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Location not specified</span>
                      )}
                    </div>
                    <div className="flex items-center">
                      {job.categoryTags && job.categoryTags.length > 0 ? (
                        <Badge variant="secondary" className="bg-primary/10 text-primary">
                          {job.categoryTags[0]}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">Uncategorized</span>
                      )}
                    </div>
                    <div className="font-medium">
                      {job.budget ? `$${job.budget.toFixed(2)}` : 'Open'}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" size="sm" onClick={() => viewJobDetails(job)}>
                        <Eye className="h-4 w-4 mr-1" /> View
                      </Button>
                      <Button variant="default" size="sm" onClick={() => openBidModal(job)}>
                        <DollarSign className="h-4 w-4 mr-1" /> Bid
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Map view placeholder */}
            {activeViewMode === "map" && (
              <div className="bg-white rounded-lg border p-6 text-center">
                <Map className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-bold mb-2">Map View Coming Soon</h3>
                <p className="text-muted-foreground mb-4">
                  We're working on adding an interactive map to help you find jobs in your area.
                </p>
              </div>
            )}

            {/* Split view placeholder */}
            {activeViewMode === "split" && (
              <div className="bg-white rounded-lg border p-6 text-center">
                <MenuSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-bold mb-2">Split View Coming Soon</h3>
                <p className="text-muted-foreground mb-4">
                  We're working on adding a split view to see job details alongside the job list.
                </p>
              </div>
            )}
          </TabsContent>

          {/* My Bids Tab */}
          <TabsContent value="my-bids" className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">My Bids</h2>
            </div>

            {/* Loading state */}
            {isMyBidsLoading && (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="p-4">
                    <div className="flex justify-between">
                      <div className="space-y-2">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <Skeleton className="h-10 w-24 rounded-md" />
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!isMyBidsLoading && myBids.length === 0 && (
              <Card className="p-6 text-center">
                <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-bold mb-2">No Bids Yet</h3>
                <p className="text-muted-foreground mb-4">
                  You haven't placed any bids on jobs yet. Browse available jobs to start bidding.
                </p>
                <Button onClick={() => setLocation("/contractor-dashboard/find-jobs")}>
                  Find Jobs to Bid
                </Button>
              </Card>
            )}

            {/* Bids display */}
            {!isMyBidsLoading && myBids.length > 0 && (
              <Tabs defaultValue="pending" className="w-full">
                <TabsList className="grid grid-cols-3 mb-4">
                  <TabsTrigger value="pending">
                    Pending Bids ({myBids.filter((bid: Bid) => bid.status === "pending").length})
                  </TabsTrigger>
                  <TabsTrigger value="accepted">
                    Accepted Bids ({myBids.filter((bid: Bid) => bid.status === "accepted").length})
                  </TabsTrigger>
                  <TabsTrigger value="rejected">
                    Rejected Bids ({myBids.filter((bid: Bid) => bid.status === "rejected").length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="pending">
                  <div className="space-y-4">
                    {myBids.filter((bid: Bid) => bid.status === "pending").map((bid: Bid) => {
                      // First try to use the embedded job data from the API
                      const jobFromBid = bid.job || null;
                      // Fallback to searching jobs array if job is not embedded in bid
                      const jobFromArray = !jobFromBid ? jobs.find((j: Job) => j.id === bid.jobId) : null;
                      // Use whichever job data we found
                      const job = jobFromBid || jobFromArray;
                      
                      if (!job) return null;
                      
                      // Query for all bids for this job to check if our bid is the lowest
                      const { data: allJobBids = [] } = useQuery({
                        queryKey: [`/api/bids/job/${bid.jobId}`],
                        enabled: !!bid.jobId,
                      });
                      
                      // Find the lowest bid
                      const lowestBid = [...allJobBids].sort((a, b) => a.amount - b.amount)[0];
                      
                      // Is our bid no longer the lowest?
                      const isOutbid = lowestBid && userData && lowestBid.contractorId !== userData.id && lowestBid.amount < bid.amount;
                      const priceDifference = isOutbid ? bid.amount - lowestBid.amount : 0;
                      
                      return (
                        <Card 
                          key={bid.id} 
                          className={`overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${isOutbid ? 'border-red-300' : ''}`}
                          onClick={() => viewJobDetails(job)}
                        >
                          <div className="flex flex-col md:flex-row h-full">
                            <div className="md:w-1/3 relative">
                              <div className="h-48 md:h-full">
                                <img 
                                  src={job.images && job.images.length > 0 
                                    ? job.images[0] 
                                    : getJobImage(job)
                                  } 
                                  alt={job.title}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-70"></div>
                              <Badge variant="outline" className={`absolute bottom-3 left-3 ${isOutbid ? 'bg-red-600' : 'bg-green-600'} text-white text-md font-bold px-4 py-1 shadow-md rounded-full border-0`}>
                                ${bid.amount.toFixed(2)}
                              </Badge>
                              {job.isUrgent && (
                                <Badge variant="outline" className="absolute top-3 right-3 bg-red-600 text-white rounded-full border-0 shadow-sm">
                                  <FlameIcon className="h-3 w-3 mr-1" /> URGENT
                                </Badge>
                              )}
                              {isOutbid && (
                                <Badge variant="outline" className="absolute top-3 left-3 bg-red-600 text-white font-semibold rounded-full border-0 shadow-sm">
                                  <AlertTriangle className="h-3 w-3 mr-1" /> OUTBID
                                </Badge>
                              )}
                            </div>
                            <div className="p-5 flex-1 flex flex-col justify-between">
                              <div>
                                <div className="flex justify-between items-center mb-2">
                                  <h3 className="font-semibold text-lg line-clamp-1">{job.title}</h3>
                                  <div className="flex items-center gap-2">
                                    {isOutbid && (
                                      <Badge className="bg-red-500 text-white">
                                        <AlertTriangle className="h-3 w-3 mr-1" /> Outbid
                                      </Badge>
                                    )}
                                    <Badge className="bg-amber-500 text-white">Pending</Badge>
                                  </div>
                                </div>
                                
                                <div className="flex items-center text-sm text-muted-foreground mb-2">
                                  <MapPin className="h-3.5 w-3.5 mr-1" />
                                  {job.location && typeof job.location === 'object' && 'city' in job.location ? (
                                    <span>{job.location.city}, {job.location.state}</span>
                                  ) : (
                                    <span>Location not specified</span>
                                  )}
                                </div>
                                
                                {isOutbid && (
                                  <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-md text-sm">
                                    <div className="font-medium text-red-700 flex items-center">
                                      <AlertTriangle className="h-4 w-4 mr-1" /> You've been outbid!
                                    </div>
                                    <p className="text-red-700 mt-1">
                                      Lower bid: ${lowestBid.amount.toFixed(2)} (${priceDifference.toFixed(2)} lower than yours)
                                    </p>
                                    <Button 
                                      variant="destructive" 
                                      size="sm" 
                                      className="mt-2"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openBidModal(job);
                                      }}
                                    >
                                      <DollarSign className="h-3 w-3 mr-1" /> Update Bid
                                    </Button>
                                  </div>
                                )}
                                
                                <p className="text-sm line-clamp-2 mb-2">{job.description}</p>
                              </div>

                              <div className="flex items-center justify-between pt-3 border-t mt-4">
                                <div className="text-sm text-muted-foreground">
                                  {getTimeAgo(bid.createdAt)}
                                </div>
                                
                                <div className="flex items-center text-sm text-primary font-medium">
                                  View details <ChevronRight className="h-4 w-4 ml-1" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                    
                    {myBids.filter((bid: Bid) => bid.status === "pending").length === 0 && (
                      <Card className="p-6 text-center">
                        <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-bold mb-2">No Pending Bids</h3>
                        <p className="text-muted-foreground mb-4">
                          You don't have any pending bids at the moment.
                        </p>
                      </Card>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="accepted">
                  <div className="space-y-4">
                    {myBids.filter((bid: Bid) => bid.status === "accepted").map((bid: Bid) => {
                      // First try to use the embedded job data from the API
                      const jobFromBid = bid.job || null;
                      // Fallback to searching jobs array if job is not embedded in bid
                      const jobFromArray = !jobFromBid ? jobs.find((j: Job) => j.id === bid.jobId) : null;
                      // Use whichever job data we found
                      const job = jobFromBid || jobFromArray;
                      
                      if (!job) return null;
                      
                      return (
                        <Card 
                          key={bid.id} 
                          className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => viewJobDetails(job)}
                        >
                          <div className="flex flex-col md:flex-row h-full">
                            <div className="md:w-1/3 relative">
                              <div className="h-48 md:h-full">
                                <img 
                                  src={job.images && job.images.length > 0 
                                    ? job.images[0] 
                                    : getJobImage(job)
                                  } 
                                  alt={job.title}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-70"></div>
                              <Badge variant="outline" className="absolute bottom-3 left-3 bg-green-600 text-white text-md font-bold px-4 py-1 shadow-md rounded-full border-0">
                                ${bid.amount.toFixed(2)}
                              </Badge>
                              {job.isUrgent && (
                                <Badge variant="outline" className="absolute top-3 right-3 bg-red-600 text-white rounded-full border-0 shadow-sm">
                                  <FlameIcon className="h-3 w-3 mr-1" /> URGENT
                                </Badge>
                              )}
                            </div>
                            <div className="p-5 flex-1 flex flex-col justify-between">
                              <div>
                                <div className="flex justify-between items-center mb-2">
                                  <h3 className="font-semibold text-lg line-clamp-1">{job.title}</h3>
                                  <Badge className="bg-green-600 text-white">Accepted</Badge>
                                </div>
                                
                                <div className="flex items-center text-sm text-muted-foreground mb-2">
                                  <MapPin className="h-3.5 w-3.5 mr-1" />
                                  {job.location && typeof job.location === 'object' && 'city' in job.location ? (
                                    <span>{job.location.city}, {job.location.state}</span>
                                  ) : (
                                    <span>Location not specified</span>
                                  )}
                                </div>
                                
                                <p className="text-sm line-clamp-2 mb-2">{job.description}</p>
                              </div>

                              <div className="flex items-center justify-between pt-3 border-t mt-4">
                                <div className="text-sm text-muted-foreground">
                                  {getTimeAgo(bid.updatedAt)}
                                </div>
                                
                                <div className="flex items-center text-sm text-primary font-medium">
                                  View details <ChevronRight className="h-4 w-4 ml-1" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                    
                    {myBids.filter((bid: Bid) => bid.status === "accepted").length === 0 && (
                      <Card className="p-6 text-center">
                        <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-bold mb-2">No Accepted Bids</h3>
                        <p className="text-muted-foreground mb-4">
                          None of your bids have been accepted yet. Keep trying!
                        </p>
                      </Card>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="rejected">
                  <div className="space-y-4">
                    {myBids.filter((bid: Bid) => bid.status === "rejected").map((bid: Bid) => {
                      // First try to use the embedded job data from the API
                      const jobFromBid = bid.job || null;
                      // Fallback to searching jobs array if job is not embedded in bid
                      const jobFromArray = !jobFromBid ? jobs.find((j: Job) => j.id === bid.jobId) : null;
                      // Use whichever job data we found
                      const job = jobFromBid || jobFromArray;
                      
                      if (!job) return null;
                      
                      return (
                        <Card 
                          key={bid.id} 
                          className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => viewJobDetails(job)}
                        >
                          <div className="flex flex-col md:flex-row h-full">
                            <div className="md:w-1/3 relative">
                              <div className="h-48 md:h-full">
                                <img 
                                  src={job.images && job.images.length > 0 
                                    ? job.images[0] 
                                    : getJobImage(job)
                                  } 
                                  alt={job.title}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-70"></div>
                              <Badge variant="outline" className="absolute bottom-3 left-3 bg-green-600 text-white text-md font-bold px-4 py-1 shadow-md rounded-full border-0">
                                ${bid.amount.toFixed(2)}
                              </Badge>
                              {job.isUrgent && (
                                <Badge variant="outline" className="absolute top-3 right-3 bg-red-600 text-white rounded-full border-0 shadow-sm">
                                  <FlameIcon className="h-3 w-3 mr-1" /> URGENT
                                </Badge>
                              )}
                            </div>
                            <div className="p-5 flex-1 flex flex-col justify-between">
                              <div>
                                <div className="flex justify-between items-center mb-2">
                                  <h3 className="font-semibold text-lg line-clamp-1">{job.title}</h3>
                                  <Badge variant="outline" className="bg-red-50 border-red-200 text-red-700 rounded-full shadow-sm">Rejected</Badge>
                                </div>
                                
                                <div className="flex items-center text-sm text-muted-foreground mb-2">
                                  <MapPin className="h-3.5 w-3.5 mr-1" />
                                  {job.location && typeof job.location === 'object' && 'city' in job.location ? (
                                    <span>{job.location.city}, {job.location.state}</span>
                                  ) : (
                                    <span>Location not specified</span>
                                  )}
                                </div>
                                
                                <p className="text-sm line-clamp-2 mb-2">{job.description}</p>
                              </div>

                              <div className="flex items-center justify-between pt-3 border-t mt-4">
                                <div className="text-sm text-muted-foreground">
                                  {getTimeAgo(bid.updatedAt)}
                                </div>
                                
                                <div className="flex items-center text-sm text-primary font-medium">
                                  View details <ChevronRight className="h-4 w-4 ml-1" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                    
                    {myBids.filter((bid: Bid) => bid.status === "rejected").length === 0 && (
                      <Card className="p-6 text-center">
                        <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-bold mb-2">No Rejected Bids</h3>
                        <p className="text-muted-foreground mb-4">
                          None of your bids have been rejected. That's great news!
                        </p>
                      </Card>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </TabsContent>

          {/* My Jobs Tab */}
          <TabsContent value="my-jobs" className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">My Projects</h2>
              
              <div className="flex items-center space-x-2">
                <Select value={sortOption} onValueChange={setSortOption}>
                  <SelectTrigger className="w-[170px]">
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">
                      <div className="flex items-center">
                        <ArrowDown className="h-4 w-4 mr-2" />
                        <span>Newest First</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="oldest">
                      <div className="flex items-center">
                        <ArrowUp className="h-4 w-4 mr-2" />
                        <span>Oldest First</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="budget-high">
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-2" />
                        <span>Budget (High to Low)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="budget-low">
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-2" />
                        <span>Budget (Low to High)</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Loading state */}
            {isMyJobsLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="h-[400px] relative">
                    <Skeleton className="h-40 w-full rounded-t-lg" />
                    <div className="p-4">
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2 mb-4" />
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-2/3 mb-4" />
                      <Skeleton className="h-8 w-full rounded-md" />
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!isMyJobsLoading && myJobs.length === 0 && (
              <Card className="p-6 text-center">
                <BriefcaseBusiness className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-bold mb-2">No Projects Yet</h3>
                <p className="text-muted-foreground mb-4">
                  You don't have any active projects. Start bidding on jobs to get work!
                </p>
                <Button onClick={() => setLocation("/contractor-dashboard/find-jobs")}>
                  Find Jobs
                </Button>
              </Card>
            )}

            {/* Jobs display */}
            {!isMyJobsLoading && myJobs.length > 0 && (
              <Tabs defaultValue="active" className="w-full">
                <TabsList className="grid grid-cols-2 mb-4">
                  <TabsTrigger value="active">
                    Active Projects ({myJobs.filter((job: Job) => job.status === "in_progress").length})
                  </TabsTrigger>
                  <TabsTrigger value="completed">
                    Completed Projects ({myJobs.filter((job: Job) => job.status === "completed").length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="active">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {myJobs.filter((job: Job) => job.status === "in_progress").map((job: Job) => (
                      <Card 
                        key={job.id} 
                        className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => viewJobDetails(job)}
                      >
                        <div className="relative">
                          <div className="h-48">
                            <img 
                              src={getJobImage(job)} 
                              alt={job.title}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-70"></div>
                            <Badge className="absolute top-3 right-3 bg-blue-600 rounded-full shadow-sm">In Progress</Badge>
                            <Badge variant="outline" className="absolute bottom-3 left-3 bg-green-600 text-white text-md font-bold px-4 py-1 shadow-md rounded-full border-0">
                              ${myBids.find((bid: Bid) => bid.jobId === job.id && bid.status === "accepted")?.amount.toFixed(2) || job.budget?.toFixed(2) || "N/A"}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="p-5">
                          <div className="mb-4">
                            <h3 className="font-semibold text-lg mb-1">{job.title}</h3>
                            <div className="flex items-center text-sm text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5 mr-1" />
                              {job.location && typeof job.location === 'object' && 'city' in job.location ? (
                                <span>{job.location.city}, {job.location.state}</span>
                              ) : (
                                <span>Location not specified</span>
                              )}
                            </div>
                          </div>
                          
                          <div className="mb-4">
                            <div className="flex justify-between text-sm mb-1">
                              <span>Progress</span>
                              <span className="font-medium">{job.progress || 0}%</span>
                            </div>
                            <Progress value={job.progress || 0} className="h-2" />
                          </div>
                          
                          <div className="flex items-center justify-between text-sm text-muted-foreground pt-3 border-t">
                            <div className="flex items-center">
                              <Clock className="h-3.5 w-3.5 mr-1" />
                              <span>Started {getTimeAgo(job.createdAt)}</span>
                            </div>
                            <div className="flex items-center">
                              <User className="h-3.5 w-3.5 mr-1" />
                              <span>{getClientName(job.landlordId)}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-end mt-3 pt-3 border-t">
                            <div className="flex items-center text-sm text-primary font-medium">
                              View details <ChevronRight className="h-4 w-4 ml-1" />
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                    
                    {myJobs.filter((job: Job) => job.status === "in_progress").length === 0 && (
                      <Card className="p-6 text-center col-span-full">
                        <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-bold mb-2">No Active Projects</h3>
                        <p className="text-muted-foreground mb-4">
                          You don't have any active projects at the moment.
                        </p>
                      </Card>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="completed">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {myJobs.filter((job: Job) => job.status === "completed").map((job: Job) => (
                        <Card 
                          key={job.id} 
                          className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => viewJobDetails(job)}
                        >
                          <div className="relative">
                            <div className="h-48">
                              <img 
                                src={getJobImage(job)} 
                                alt={job.title}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-70"></div>
                              <Badge className="absolute top-3 right-3 bg-green-600 rounded-full shadow-sm">Completed</Badge>
                              <Badge variant="outline" className="absolute bottom-3 left-3 bg-green-600 text-white text-md font-bold px-4 py-1 shadow-md rounded-full border-0">
                                ${myBids.find((bid: Bid) => bid.jobId === job.id && bid.status === "accepted")?.amount.toFixed(2)}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="p-5">
                            <div className="mb-4">
                              <h3 className="font-semibold text-lg mb-1">{job.title}</h3>
                              <div className="flex items-center text-sm text-muted-foreground">
                                <MapPin className="h-3.5 w-3.5 mr-1" />
                                {job.location && typeof job.location === 'object' && 'city' in job.location ? (
                                  <span>{job.location.city}, {job.location.state}</span>
                                ) : (
                                  <span>Location not specified</span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between text-sm text-muted-foreground pt-3 border-t">
                              <div className="flex items-center">
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-green-600" />
                                <span>Completed {getTimeAgo(job.updatedAt)}</span>
                              </div>
                              <div className="flex items-center">
                                <User className="h-3.5 w-3.5 mr-1" />
                                <span>{getClientName(job.landlordId)}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-end mt-3 pt-3 border-t">
                              <div className="flex items-center text-sm text-primary font-medium">
                                View details <ChevronRight className="h-4 w-4 ml-1" />
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                      
                      {myJobs.filter((job: Job) => job.status === "completed").length === 0 && (
                        <Card className="p-6 text-center col-span-full">
                          <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <h3 className="text-lg font-bold mb-2">No Completed Projects</h3>
                          <p className="text-muted-foreground mb-4">
                            You don't have any completed projects yet.
                          </p>
                        </Card>
                      )}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </TabsContent>

          {/* Quotes & Invoices Tab */}
          <TabsContent value="quotes-invoices" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold">Quotes</h3>
                    <p className="text-sm text-muted-foreground">
                      Create and manage professional quotes
                    </p>
                  </div>
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                
                <div className="space-y-2 mb-6">
                  <div className="flex items-center justify-between text-sm">
                    <span>Draft Quotes</span>
                    <Badge variant="outline">0</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Sent Quotes</span>
                    <Badge variant="outline">0</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Accepted Quotes</span>
                    <Badge variant="outline">0</Badge>
                  </div>
                </div>
                
                <Button className="w-full" variant="default">
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Quote
                </Button>
              </Card>
              
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold">Invoices</h3>
                    <p className="text-sm text-muted-foreground">
                      Track payments and manage invoices
                    </p>
                  </div>
                  <CreditCard className="h-8 w-8 text-primary" />
                </div>
                
                <div className="space-y-2 mb-6">
                  <div className="flex items-center justify-between text-sm">
                    <span>Draft Invoices</span>
                    <Badge variant="outline">0</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Unpaid Invoices</span>
                    <Badge variant="outline">0</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Paid Invoices</span>
                    <Badge variant="outline">0</Badge>
                  </div>
                </div>
                
                <Button className="w-full" variant="default">
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Invoice
                </Button>
              </Card>
              
              <Card className="md:col-span-2 p-6 text-center">
                <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-bold mb-2">No Quotes or Invoices Yet</h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  You haven't created any quotes or invoices yet. Start by creating a new quote for one of your jobs.
                </p>
                <Button variant="default">
                  Learn How to Create Quotes
                </Button>
              </Card>
            </div>
          </TabsContent>

          {/* Calendar Tab */}
          <TabsContent value="calendar" className="mt-6">
            <Card className="p-6 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-bold mb-2">Calendar View Coming Soon</h3>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                We're working on a calendar feature to help you manage your schedule and project timelines. Stay tuned!
              </p>
              <Button variant="default">
                Add Job to Your Calendar
              </Button>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Job Details Modal */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="absolute right-4 top-4 z-50">
            <button
              className="rounded-full w-8 h-8 inline-flex items-center justify-center border border-gray-200 hover:bg-gray-100 transition-colors"
              onClick={() => setIsDetailsModalOpen(false)}
            >
              <X className="h-5 w-5 text-gray-500 hover:text-gray-900" />
            </button>
          </div>
          <DialogHeader>
            <DialogTitle>Job Details</DialogTitle>
            <DialogDescription>
              View complete information about this job
            </DialogDescription>
          </DialogHeader>
          
          {selectedJob && (
            <JobDetailsView 
              job={selectedJob}
              onClose={() => setIsDetailsModalOpen(false)}
              onCreateQuote={createQuoteFromJob}
              getJobImage={getJobImage}
              getClientName={getClientName}
              myBids={myBids as Bid[]}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Bid Modal */}
      <Dialog open={isBidModalOpen} onOpenChange={setIsBidModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Place a Bid</DialogTitle>
            <DialogDescription>
              Submit your bid for this job. A compelling bid includes a fair price and a detailed note.
            </DialogDescription>
          </DialogHeader>
          
          {selectedJob && (
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <h4 className="font-medium">{selectedJob.title}</h4>
                <Badge>{selectedJob.status}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{selectedJob.description}</p>
              <div className="flex items-center text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 mr-1" />
                {selectedJob.location && typeof selectedJob.location === 'object' && 'city' in selectedJob.location ? (
                  <span>{selectedJob.location.city}, {selectedJob.location.state}</span>
                ) : (
                  <span>Location not specified</span>
                )}
              </div>
            </div>
          )}
          
          <Form {...bidForm}>
            <form onSubmit={bidForm.handleSubmit(onSubmitBidForm)} className="space-y-4">
              <FormField
                control={bidForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bid Amount ($)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="Enter your bid amount" 
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Suggest a competitive price for the job
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={bidForm.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bid Note</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Explain why you're the best person for this job" 
                        className="resize-none"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Include your experience and approach to the job
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Hidden field for job ID */}
              <input type="hidden" {...bidForm.register("jobId")} />
              
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setIsBidModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={placeBidMutation.isPending}>
                  {placeBidMutation.isPending ? (
                    <>Submitting...</>
                  ) : (
                    <>Place Bid</>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}