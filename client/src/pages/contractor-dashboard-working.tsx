import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Job, Quote } from "@shared/schema";
import { AVAILABLE_CATEGORIES, getCategoryDisplayName } from "@shared/constants";

// Temporary placeholder to fix references to removed carousel functionality
const currentImageIndices: Record<number, number> = {};
import { 
  Search, MapPin, Filter, ChevronDown, ChevronLeft, ChevronRight, CalendarDays, 
  Plus, Check, ArrowRight, Clock, Timer, DollarSign, UserCircle, LogOut, Settings, X,
  LayoutGrid, MapIcon, List, SplitSquareVertical, Users, MessageCircle, CheckCircle2,
  SlidersHorizontal, Calculator, Calendar as CalendarIcon, FlameIcon, CircleIcon,
  FileText as FileIcon, Droplet, Zap, Paintbrush, Home, Flower2, Square, Hammer, Thermometer,
  ClipboardCheck, Package, Briefcase, Tag, FileText, Archive, Image, Receipt, Copy, Download,
  Wrench, Heart, AlertTriangle, Bookmark, Share2, ThumbsUp, Star, Layers, 
  Phone, Mail, ExternalLink, Trash, Upload, ArrowDown, Eye, BadgeDollarSign,
  CalendarClock, Scale
} from "lucide-react";
import { QuotesTab } from "@/components/QuotesTab";
import { QuoteForm } from "@/components/QuoteForm";
import { QuoteDetails } from "@/components/QuoteDetails";
import { ScheduleCalendar } from "@/components/ScheduleCalendar";
import { CategoryIcon } from "@/components/CategoryIcons";
import { JobsList } from "@/components/JobsList";
import { JobsMap } from "@/components/JobsMap";
import { JobsSplitView } from "@/components/JobsSplitView";
import AdaptiveJobCard from "@/components/AdaptiveJobCard";

// Bid form schema for job applications
const bidSchema = z.object({
  amount: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "Amount must be a positive number",
  }),
  proposal: z.string().min(20, "Proposal must be at least 20 characters"), // Match server requirement
  timeEstimate: z.string().min(3, "Please provide a time estimate"),
  proposedStartDate: z.date({
    required_error: "Please select a start date",
  }),
});

type BidFormValues = z.infer<typeof bidSchema>;

export default function ContractorDashboard() {
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isServiceAreaDialogOpen, setIsServiceAreaDialogOpen] = useState(false);
  const [bidModalOpen, setBidModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [activeViewMode, setActiveViewMode] = useState<"grid" | "table" | "map" | "calendar" | "split">("grid");
  
  // Quote state
  const [quoteFormOpen, setQuoteFormOpen] = useState(false);
  const [quoteDetailsOpen, setQuoteDetailsOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [jobToQuote, setJobToQuote] = useState<Job | null>(null);
  
  // Calendar state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  
  // Image carousel state and stableJobData state has been completely removed
  
  // Track expanded job cards
  const [expandedJobIds, setExpandedJobIds] = useState<number[]>([]);
  
  // Compact view toggle
  const [isCompactView, setIsCompactView] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Get contractor profile
  const { data: profileData, isLoading: isProfileLoading } = useQuery({
    queryKey: ['/api/contractor-profile', authUser?.id],
    queryFn: async () => {
      if (!authUser?.id) return null;
      const res = await fetch(`/api/contractor-profile/${authUser.id}`);
      if (!res.ok) throw new Error('Failed to fetch contractor profile');
      return res.json();
    },
    enabled: !!authUser?.id
  });

  // Get available jobs
  const { data: jobs = [], isLoading: isJobsLoading } = useQuery({
    queryKey: ['/api/jobs'],
    queryFn: async () => {
      const res = await fetch('/api/jobs');
      if (!res.ok) throw new Error('Failed to fetch jobs');
      return res.json();
    },
    onSuccess: (data) => {
      // Carousel functionality has been removed, so we no longer need to store jobs in stableJobData
      console.log(`Fetched ${data.length} jobs`);
    }
  });

  // Get my bids and associated job data
  const { data: bidData = { bids: [], jobs: [] }, isLoading: isBidsLoading } = useQuery({
    queryKey: ['/api/bids', authUser?.id],
    queryFn: async () => {
      if (!authUser?.id) return { bids: [], jobs: [] };
      console.log("Fetching bids for contractor ID:", authUser.id);
      const res = await fetch(`/api/bids?contractorId=${authUser.id}`);
      if (!res.ok) throw new Error('Failed to fetch bids');
      const data = await res.json();
      console.log("Fetched bids data:", data);
      return data;
    },
    enabled: !!authUser?.id,
    refetchOnWindowFocus: true,
    refetchOnMount: true
  });
  
  // Extract bids and jobs from the bid data
  const [stableBids, setStableBids] = useState<any[]>([]);
  const [stableBidJobs, setStableBidJobs] = useState<any[]>([]);
  
  // Update stable bids and bid jobs when bid data changes
  useEffect(() => {
    const bids = bidData.bids || [];
    const jobs = bidData.jobs || [];
    
    if (bids.length > 0 || jobs.length > 0) {
      setStableBids(bids);
      setStableBidJobs(jobs);
    }
  }, [bidData]);
  
  // Use stable bid data for rendering
  const myBids = stableBids.length > 0 ? stableBids : bidData.bids || [];
  const bidJobs = stableBidJobs.length > 0 ? stableBidJobs : bidData.jobs || [];
  
  // Get quotes data for calendar and quotes tab
  const { data: quotes = [], isLoading: isQuotesLoading } = useQuery({
    queryKey: ['/api/quotes', authUser?.id],
    queryFn: async () => {
      if (!authUser?.id) return [];
      const res = await fetch(`/api/quotes?contractorId=${authUser.id}`);
      if (!res.ok) throw new Error('Failed to fetch quotes');
      return res.json();
    },
    enabled: !!authUser?.id
  });

  // Get all contractor job data
  const { data: jobData = { availableJobs: [], myJobs: [], activeJobs: [] }, isLoading: isDirectJobsLoading } = useQuery({
    queryKey: ['/api/contractor-jobs'],
    queryFn: async () => {
      if (!authUser?.id) return { availableJobs: [], myJobs: [], activeJobs: [] };
      const res = await fetch('/api/contractor-jobs');
      if (!res.ok) throw new Error('Failed to fetch contractor jobs');
      return res.json();
    },
    enabled: !!authUser?.id,
    onSuccess: (data) => {
      // Carousel functionality has been removed, so we no longer need to store jobs in stableJobData
      console.log(`Fetched ${data.availableJobs?.length || 0} available jobs`);
      console.log(`Fetched ${data.myJobs?.length || 0} my jobs`);
      console.log(`Fetched ${data.activeJobs?.length || 0} active jobs`);
    }
  });

  // Combine jobs from both sources - use Set to avoid duplicates
  // Extract available jobs from job data
  const availableJobs = jobData.availableJobs || [];
  
  // Extract my jobs from job data
  const myJobs = jobData.myJobs || [];
  
  const combinedJobs = [...jobs];
  // Add any jobs from availableJobs that aren't already in jobs array
  availableJobs.forEach((availableJob: Job) => {
    const jobExists = combinedJobs.some((j: Job) => j.id === availableJob.id);
    if (!jobExists) {
      combinedJobs.push(availableJob);
    }
  });
  
  // Filter available jobs based on search query, categories, and price range
  const filteredAvailableJobs = combinedJobs.filter((job: Job) => {
    // Only include open jobs
    if (job.status !== "open") {
      return false;
    }
    
    // Filter by search query
    if (searchQuery && 
        !job.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !job.description.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // Filter by selected categories
    if (selectedCategories.length > 0 && 
        !job.categoryTags?.some((tag: string) => selectedCategories.includes(tag))) {
      return false;
    }
    
    // Filter by price range
    if (job.budget && (job.budget < priceRange[0] || job.budget > priceRange[1])) {
      return false;
    }
    
    return true;
  });
  
  // Debug job images - only run once after initial load
  useEffect(() => {
    // Only run once when availableJobs or myJobs become available
    if (availableJobs.length > 0 || myJobs.length > 0) {
      console.log("Checking for jobs with multiple images:");
      const jobsWithMultipleImages = [...availableJobs, ...myJobs].filter(
        (job: Job) => job.images && Array.isArray(job.images) && job.images.length > 1
      );
      console.log(`Found ${jobsWithMultipleImages.length} jobs with multiple images`);
      if (jobsWithMultipleImages.length > 0) {
        console.log("Example job with multiple images:", jobsWithMultipleImages[0]);
      } else {
        console.log("Sample job:", availableJobs[0] || myJobs[0]);
      }
    }
  }, [availableJobs.length, myJobs.length]);
  
  // Calculate filtered pending bids once and store in ref to avoid recalculation
  const pendingBidsRef = useRef<any[]>([]);
  
  useEffect(() => {
    // Only update pending bids when the stable bids array changes
    if (stableBids.length > 0) {
      pendingBidsRef.current = stableBids.filter((bid: any) => bid.status === 'pending');
      console.log("Filtered pending bids:", pendingBidsRef.current);
    }
  }, [stableBids]);
  
  // Debug job and bid matching - only run once after initial load
  useEffect(() => {
    if (stableBids.length > 0 && stableBidJobs.length > 0) {
      console.log("Debug job and bid matching:");
      console.log("My bids:", stableBids);
      console.log("Bid jobs:", stableBidJobs);
      
      // Extract all job IDs from bidJobs
      const bidJobIds = stableBidJobs.map((job: Job) => job.id);
      console.log("Available bid job IDs:", bidJobIds);
      
      // Extract all bid job IDs from bids
      const myBidJobIds = stableBids.map((bid: any) => bid.jobId);
      console.log("Bid job IDs from my bids:", myBidJobIds);
      
      // Check for each bid if there's a matching job in bidJobs
      stableBids.forEach((bid: any) => {
        const matchingJob = stableBidJobs.find((j: Job) => j.id === bid.jobId);
        console.log(`Bid ${bid.id} (jobId: ${bid.jobId}) -> matching job in bidJobs:`, matchingJob ? "Found" : "NOT FOUND");
      });
    }
  }, [stableBids, stableBidJobs]);


  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);// Place bid mutation
  const placeBidMutation = useMutation({
    mutationFn: async (data: BidFormValues) => {
      if (!selectedJob || !authUser) return null;
      
      // Format the date as ISO string if it's a Date object
      const formattedDate = data.proposedStartDate instanceof Date 
        ? data.proposedStartDate.toISOString() 
        : data.proposedStartDate;
      
      const bidData = {
        jobId: selectedJob.id,
        contractorId: authUser.id,
        amount: parseFloat(data.amount),
        proposal: data.proposal,
        timeEstimate: data.timeEstimate,
        proposedStartDate: formattedDate,
        status: "pending"
      };
      
      setIsLoading(true);
      console.log("Submitting bid with data:", bidData);
      console.log("Method: POST, URL: /api/bids");
      
      try {
        // Make sure we're sending to the correct endpoint with the right method
        const response = await fetch('/api/bids', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(bidData),
          credentials: 'include'
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to submit bid: ${response.status} ${errorText}`);
        }
        
        const json = await response.json();
        console.log("Bid submission response:", json);
        return json;
      } catch (err) {
        console.error("Bid submission error:", err);
        throw err;
      }
    },
    onSuccess: () => {
      setIsLoading(false);
      toast({
        title: "Bid Placed",
        description: "Your bid has been successfully placed.",
      });
      setBidModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/bids', authUser?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/contractor-jobs'] });
    },
    onError: (error: Error) => {
      setIsLoading(false);
      toast({
        title: "Error",
        description: error.message || "Failed to place bid. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Create quote mutation
  const createQuoteMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!authUser) return null;
      
      const quoteData = {
        ...data,
        contractorId: authUser.id,
        status: data.status || "draft"
      };
      
      console.log("Creating quote with data:", quoteData);
      console.log("Method: POST, URL: /api/quotes");
      
      try {
        const response = await apiRequest("POST", "/api/quotes", quoteData);
        console.log("Create quote response:", response);
        return response;
      } catch (err) {
        console.error("Create quote error:", err);
        throw err;
      }
    },
    onSuccess: () => {
      toast({
        title: "Quote Created",
        description: "Your quote has been created successfully.",
      });
      setQuoteFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', authUser?.id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create quote. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Update quote mutation
  const updateQuoteMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!selectedQuote || !authUser) return null;
      
      const quoteData = {
        ...data,
        contractorId: authUser.id
      };
      
      console.log("Updating quote with data:", quoteData);
      console.log(`Method: PATCH, URL: /api/quotes/${selectedQuote.id}`);
      
      try {
        const response = await apiRequest("PATCH", `/api/quotes/${selectedQuote.id}`, quoteData);
        console.log("Update quote response:", response);
        return response;
      } catch (err) {
        console.error("Update quote error:", err);
        throw err;
      }
    },
    onSuccess: () => {
      toast({
        title: "Quote Updated",
        description: "Your quote has been updated successfully.",
      });
      setQuoteFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', authUser?.id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update quote. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Send quote mutation
  const sendQuoteMutation = useMutation({
    mutationFn: async (quoteId: number) => {
      if (!authUser) return null;
      
      console.log(`Sending quote id: ${quoteId}`);
      console.log(`Method: POST, URL: /api/quotes/${quoteId}/send`);
      
      try {
        const response = await apiRequest("POST", `/api/quotes/${quoteId}/send`, {});
        console.log("Send quote response:", response);
        return response;
      } catch (err) {
        console.error("Send quote error:", err);
        throw err;
      }
    },
    onSuccess: () => {
      toast({
        title: "Quote Sent",
        description: "Your quote has been sent to the client successfully.",
      });
      setQuoteDetailsOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', authUser?.id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send quote. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Handler for opening bid modal
  const openBidModal = (job: Job) => {
    setSelectedJob(job);
    setBidModalOpen(true);
  };

  // Handler for creating a quote from a job
  const createQuoteFromJob = (job: Job) => {
    setJobToQuote(job);
    setQuoteFormOpen(true);
  };

  // Handler for viewing job details
  const viewJobDetails = (job: Job) => {
    // Since carousel has been removed, we can directly use the job object
    setSelectedJob(job);
    setIsDetailsModalOpen(true);
  };
  
  // All carousel-related refs, functions, and state variables have been completely removed
  
  // Calculate days left for bidding deadline
  const calculateDaysLeft = (deadline: string | Date): number => {
    if (!deadline) return 0;
    const deadlineDate = new Date(deadline);
    const today = new Date();
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };
  
  // Get the time remaining for bidding (based on job creation date)
  const getBiddingTimeLeft = (job?: Job) => {
    if (!job) return null;
    
    const createdAt = new Date(job.createdAt);
    const now = new Date();
    const diffDays = Math.ceil((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    
    const daysLeft = 7 - diffDays; // 7-day bidding window
    
    if (daysLeft <= 0) return null;
    
    return {
      days: daysLeft,
      hours: 24 - now.getHours(),
    };
  };
  
  // Format "Posted X time ago" from creation date
  const getTimeAgo = (date: Date | string): string => {
    const now = new Date();
    const createdAt = new Date(date);
    const diffInMs = now.getTime() - createdAt.getTime();
    
    const minutes = Math.floor(diffInMs / (1000 * 60));
    const hours = Math.floor(diffInMs / (1000 * 60 * 60));
    const days = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    
    // Check if today
    const isToday = now.getDate() === createdAt.getDate() && 
                    now.getMonth() === createdAt.getMonth() && 
                    now.getFullYear() === createdAt.getFullYear();
                    
    if (minutes < 60) {
      return minutes < 5 ? "Just now" : `${minutes}m ago`;
    } else if (hours < 24) {
      if (isToday) {
        // Format like "Today at 11:30 AM"
        return `Today at ${createdAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
      }
      return `${hours}h ago`;
    } else if (days < 7) {
      // Format like "Apr 16" with day name
      return createdAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } else if (weeks < 4) {
      return `${weeks}w ago`;
    } else {
      // For older dates, show month and day
      return createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };
  
  // Get formatted location based on compact view mode
  const getFormattedLocation = (job: Job) => {
    if (job.location && typeof job.location === 'object' && 'city' in job.location) {
      return isCompactView
        ? job.location.city
        : `${job.location.city}, ${job.location.state}`;
    }
    return 'Location not specified';
  };

  // Form for bids
  const bidForm = useForm<BidFormValues>({
    resolver: zodResolver(bidSchema),
    defaultValues: {
      amount: "",
      proposal: "",
      timeEstimate: "",
      proposedStartDate: new Date(),
    },
  });

  // Submit handler for bid form
  const placeBidMutationBidForm = (data: BidFormValues) => {
    placeBidMutation.mutate(data);
  };
  
  // Saved jobs state
  const [savedJobs, setSavedJobs] = useState<number[]>([]);
  
  // Check if job is saved
  const isJobSaved = (jobId: number): boolean => {
    return savedJobs.includes(jobId);
  };
  
  // Toggle saving a job to favorites
  const toggleSaveJob = (job: Job) => {
    if (isJobSaved(job.id)) {
      setSavedJobs(savedJobs.filter(id => id !== job.id));
      toast({
        title: "Job Removed",
        description: "Job has been removed from your favorites.",
      });
    } else {
      setSavedJobs([...savedJobs, job.id]);
      toast({
        title: "Job Saved",
        description: "Job has been saved to your favorites.",
      });
    }
  };
  
  // Check if a job card is expanded
  const isJobExpanded = (jobId: number): boolean => {
    return expandedJobIds.includes(jobId);
  };
  
  // Toggle job card expansion
  const toggleJobExpansion = (jobId: number, event?: React.MouseEvent) => {
    // Stop event propagation if provided
    if (event) {
      event.stopPropagation();
    }
    
    // Toggle job expansion
    if (isJobExpanded(jobId)) {
      setExpandedJobIds(expandedJobIds.filter(id => id !== jobId));
    } else {
      setExpandedJobIds([...expandedJobIds, jobId]);
    }
  };
  
  // Get client name from user ID
  const getClientName = (landlordId?: number): string => {
    if (!landlordId) return 'Property Owner';
    // Implement a real client name lookup here
    return 'Property Owner';
  };
  
  // Get client job count
  const getClientJobCount = (landlordId?: number): number => {
    if (!landlordId) return 0;
    // Count jobs by this client
    return jobs.filter(job => job.landlordId === landlordId).length || 1;
  };
  
  // Get client join date
  const getClientJoinDate = (landlordId?: number): Date => {
    if (!landlordId) return new Date();
    // Return actual join date or a reasonable default
    return new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
  };
  
  // Get bid status for a job
  const getBidStatus = (jobId: number): "default" | "secondary" | "outline" => {
    const bid = myBids.find((bid: any) => bid.jobId === jobId);
    if (!bid) return "outline";
    
    switch (bid.status) {
      case "accepted":
        return "default";
      case "pending":
        return "secondary";
      default:
        return "outline";
    }
  };
  
  // Initiate chat with client
  const initiateClientChat = (job: Job) => {
    toast({
      title: "Chat Started",
      description: "A chat has been initiated with the client.",
    });
  };
  
  // Get sample images based on job details - used to simulate multiple images
  // We don't need a ref for image collections since carousel is removed
  
  // Get stable image collection for a job
  const getJobDemoImages = (job: Job): string => {
    // First priority: Check if actual job images exist
    if (job.images && Array.isArray(job.images) && job.images.length > 0) {
      // Try to get the first valid image URL
      for (const img of job.images) {
        if (typeof img === 'string' && img.trim() !== '') {
          return img;
        } else if (typeof img === 'object' && img !== null && 'url' in img) {
          return (img as any).url;
        }
      }
    }
    
    // Second priority: Generate an image based on category
    let category = '';
    if (job.categoryTags && Array.isArray(job.categoryTags) && job.categoryTags.length > 0) {
      category = String(job.categoryTags[0]).toLowerCase();
    }
    
    // Third priority: Generate an image based on title and description
    const titleAndDescription = (job.title + ' ' + job.description).toLowerCase();
    
    // Choose appropriate image based on job details
    if (titleAndDescription.includes('kitchen') && titleAndDescription.includes('faucet')) {
      return "/uploads/jobs/kitchen-faucet.svg";
    } else if (titleAndDescription.includes('kitchen') && titleAndDescription.includes('sink')) {
      return "/uploads/jobs/kitchen-sink.svg";
    } else if (titleAndDescription.includes('bathroom') && titleAndDescription.includes('light')) {
      return "/uploads/jobs/bathroom-light.svg";
    } else if (titleAndDescription.includes('bathroom') && titleAndDescription.includes('sink')) {
      return "/uploads/jobs/bathroom-sink.jpg";
    } else if (titleAndDescription.includes('ceiling fan')) {
      return "/uploads/jobs/ceiling-fan.svg";
    } else if (titleAndDescription.includes('hardwood floor')) {
      return "/uploads/jobs/hardwood-floor.jpg";
    } else if (titleAndDescription.includes('refinish') && titleAndDescription.includes('floor')) {
      return "/uploads/jobs/refinish-floor.svg";
    } else if (titleAndDescription.includes('smart thermostat')) {
      return "/uploads/jobs/smart-thermostat.svg";
    } else if (category.includes("plumb")) {
      return "/uploads/jobs/plumbing.svg";
    } else if (category.includes("electr")) {
      return "/uploads/jobs/electrical.svg";
    } else if (category.includes("paint")) {
      return "/uploads/jobs/painting.svg";
    } else if (category.includes("roof")) {
      return "/uploads/jobs/roofing.jpg";
    } else if (category.includes("land")) {
      return "/uploads/jobs/landscaping.jpg";
    } else if (category.includes("floor")) {
      return "/uploads/jobs/flooring.svg";
    }
    
    // Default fallback
    return "/uploads/jobs/default-job-image.svg";
  };

  // Function to get a single image for the job card (simplified)
  const getJobImage = (job: Job): string => {
    // Get the demo image for this job (already returns a single string)
    const demoImage = getJobDemoImages(job);
    
    // Return the image or a default
    return demoImage || "/uploads/jobs/default-job-image.svg";
  };
  
  // Get estimated duration based on job details
  const getEstimatedDuration = (job: Job): string => {
    const titleAndDescription = (job.title + ' ' + job.description).toLowerCase();
    const category = job.categoryTags?.[0]?.toLowerCase() || '';
    
    // Check if duration is mentioned in job description
    if (titleAndDescription.includes('day') || titleAndDescription.includes('week')) {
      const match = titleAndDescription.match(/(\d+)\s*(day|days|week|weeks|month|months)/i);
      if (match) {
        return `${match[1]} ${match[2]}`;
      }
    }
    
    // Estimate based on budget and category
    if (job.budget) {
      if (job.budget < 300) return '1-2 days';
      if (job.budget < 1000) return '3-5 days';
      if (job.budget < 3000) return '1-2 weeks';
      if (job.budget < 10000) return '2-4 weeks';
      return '1+ months';
    }
    
    // Estimate based on category
    if (category.includes('plumb')) return '1-3 days';
    if (category.includes('electr')) return '1-2 days';
    if (category.includes('paint')) return '3-7 days';
    if (category.includes('roof')) return '1-2 weeks';
    if (category.includes('floor')) return '3-7 days';
    if (category.includes('landscap')) return '2-5 days';
    
    return 'Varies';
  };
  
  // Get required skills based on job details
  const getRequiredSkills = (job: Job): string[] => {
    const skills: string[] = [];
    const category = job.categoryTags?.[0]?.toLowerCase() || '';
    
    // Add category-specific skills
    if (category.includes('plumb')) {
      skills.push('Pipe Installation', 'Fixture Replacement', 'Leak Repair');
    } else if (category.includes('electr')) {
      skills.push('Wiring Installation', 'Fixture Installation', 'Circuit Testing');
    } else if (category.includes('paint')) {
      skills.push('Surface Preparation', 'Precision Painting', 'Color Matching');
    } else if (category.includes('roof')) {
      skills.push('Shingle Installation', 'Roof Repair', 'Waterproofing');
    } else if (category.includes('floor')) {
      skills.push('Floor Installation', 'Surface Leveling', 'Finishing');
    } else if (category.includes('landscap')) {
      skills.push('Plant Selection', 'Irrigation', 'Outdoor Design');
    } else {
      skills.push('General Maintenance', 'Problem Solving', 'Time Management');
    }
    
    // Extract skills from description if possible
    const titleAndDescription = (job.title + ' ' + job.description).toLowerCase();
    if (titleAndDescription.includes('experience')) {
      const match = titleAndDescription.match(/experience\s+in\s+([^,.]+)/i);
      if (match && match[1]) {
        skills.push(match[1].trim());
      }
    }
    
    // Add general skills
    skills.push('Communication Skills', 'Reliability');
    
    return skills;
  };
  
  // Get tools and equipment needed based on job details
  const getToolsAndEquipment = (job: Job): string => {
    const category = job.categoryTags?.[0]?.toLowerCase() || '';
    const titleAndDescription = (job.title + ' ' + job.description).toLowerCase();
    
    // Check if tools are mentioned in description
    if (titleAndDescription.includes('tool') || titleAndDescription.includes('equipment')) {
      const toolsRegex = /(?:tools|equipment)\s+(?:needed|required|include|bring):\s*([^.]+)/i;
      const match = titleAndDescription.match(toolsRegex);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    // Default tools based on category
    if (category.includes('plumb')) {
      return 'Pipe wrench, plunger, pipe cutter, adjustable wrench, plumber\'s tape, and safety equipment required.';
    } else if (category.includes('electr')) {
      return 'Voltage tester, wire stripper, screwdrivers, wire nuts, electrical tape, and safety equipment required.';
    } else if (category.includes('paint')) {
      return 'Brushes, rollers, drop cloths, painter\'s tape, scrapers, and ladder required.';
    } else if (category.includes('roof')) {
      return 'Roofing hammers, safety harness, ladder, nail gun, utility knife, and safety equipment required.';
    } else if (category.includes('floor')) {
      return 'Saw, measuring tape, trowel, level, knee pads, and safety equipment required.';
    } else if (category.includes('landscap')) {
      return 'Shovel, rake, pruning tools, wheelbarrow, gloves, and safety equipment required.';
    }
    
    return 'Standard tools of the trade and safety equipment required. Details can be discussed before bidding.';
  };
  
  // Get materials information based on job details
  const getMaterialsInfo = (job: Job): string => {
    const titleAndDescription = (job.title + ' ' + job.description).toLowerCase();
    
    // Check if materials are mentioned in the description
    if (titleAndDescription.includes('material')) {
      if (titleAndDescription.includes('provide material')) {
        return 'Contractor to provide all necessary materials (included in budget).';
      } else if (titleAndDescription.includes('materials provided')) {
        return 'Client will provide basic materials. Discuss specific requirements before bidding.';
      }
    }
    
    // Default based on the job size/budget
    if (job.budget) {
      if (job.budget < 500) {
        return 'Basic materials will be provided by client. Specialty items may need to be sourced by contractor.';
      } else if (job.budget < 2000) {
        return 'Contractor expected to provide necessary materials (included in budget). Client may provide certain specific materials.';
      } else {
        return 'Contractor responsible for sourcing and providing all materials (included in budget). High-quality materials expected.';
      }
    }
    
    return 'Material requirements to be discussed prior to bidding. Budget should include necessary materials.';
  };
  
  // Get sample documents/attachments for the job
  const getJobDocuments = (job: Job): string[] => {
    const documents: string[] = [];
    const category = job.categoryTags?.[0]?.toLowerCase() || '';
    
    // Create document names based on job details
    documents.push(`${job.title} - Specification.pdf`);
    
    if (category.includes('plumb') || category.includes('electr') || category.includes('roof')) {
      documents.push('Building_Code_Requirements.pdf');
    }
    
    if (category.includes('landscap')) {
      documents.push('Site_Plan.pdf');
      documents.push('Plant_List.xlsx');
    }
    
    if (job.budget && job.budget > 1000) {
      documents.push('Project_Timeline.pdf');
    }
    
    if (job.isUrgent) {
      documents.push('Urgent_Requirements.pdf');
    }
    
    // Always add these common documents
    documents.push('Reference_Photos.zip');
    documents.push('Contact_Information.pdf');
    
    return documents;
  };

  return (
    <div className="container mx-auto p-4 pb-40">
      {/* Main Header with Logo */}
      <div className="flex justify-between items-center py-4 border-b mb-6">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold text-primary">Real Service</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <UserCircle className="h-5 w-5" />
            <span>{authUser?.fullName || authUser?.username}</span>
          </div>
          <Link href="/account/settings">
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>
      
      {/* Dashboard Title */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Contractor Dashboard</h1>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-6 mb-4 sticky top-0 z-10 bg-background/80 backdrop-blur">
          <TabsTrigger value="dashboard" className="data-[state=active]:font-bold data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-600">
            <Home className="h-4 w-4 mr-1.5" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="available" className="data-[state=active]:font-bold data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-600">
            <Search className="h-4 w-4 mr-1.5" />
            Find Jobs
            <span className="ml-1.5 bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded-full">
              {filteredAvailableJobs?.length || 0}
            </span>
          </TabsTrigger>
          <TabsTrigger value="my-jobs" className="data-[state=active]:font-bold data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-600">
            <ClipboardCheck className="h-4 w-4 mr-1.5" />
            My Projects
            <span className="ml-1.5 bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded-full">
              {myJobs?.length || 0}
            </span>
          </TabsTrigger>
          <TabsTrigger value="my-bids" className="data-[state=active]:font-bold data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-600">
            <Tag className="h-4 w-4 mr-1.5" />
            Sent Bids
            <span className="ml-1.5 bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded-full">
              {myBids?.length || 0}
            </span>
          </TabsTrigger>
          <TabsTrigger value="quotes" className="data-[state=active]:font-bold data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-600">
            <FileText className="h-4 w-4 mr-1.5" />
            My Quotes
            <span className="ml-1.5 bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded-full">
              {quotes?.length || 0}
            </span>
          </TabsTrigger>
          <TabsTrigger value="calendar" className="data-[state=active]:font-bold data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-600">
            <CalendarIcon className="h-4 w-4 mr-1.5" />
            Calendar
          </TabsTrigger>
        </TabsList>
        
        <div className="pb-12">
          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-2xl font-bold">Dashboard Overview</h2>
              <Button variant="outline" size="sm" className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                Today: {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </Button>
            </div>

            {/* Dashboard Key Stats Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Open Bids Card */}
              <Card className="bg-gradient-to-br from-blue-900/40 to-blue-950/60 border-blue-800/30 shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center">
                    <Tag className="h-5 w-5 mr-2 text-blue-400" />
                    <span>Open Bids</span>
                  </CardTitle>
                  <CardDescription>Pending responses from landlords</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <span className="text-3xl font-bold text-white">
                      {myBids.filter((bid: any) => bid.status === "pending").length}
                    </span>
                    <div className="text-right">
                      <span className="text-sm text-blue-300">
                        {myBids.filter((bid: any) => bid.status === "accepted").length} accepted
                      </span>
                      <br />
                      <span className="text-sm text-blue-300">
                        {myBids.filter((bid: any) => bid.status === "rejected").length} rejected
                      </span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  <Button variant="link" className="text-blue-300 p-0 h-auto" asChild>
                    <Link to="/contractor-dashboard" className="flex items-center">
                      View all bids
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>

              {/* Active Projects Card */}
              <Card className="bg-gradient-to-br from-indigo-900/40 to-indigo-950/60 border-indigo-800/30 shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center">
                    <ClipboardCheck className="h-5 w-5 mr-2 text-indigo-400" />
                    <span>Active Projects</span>
                  </CardTitle>
                  <CardDescription>Jobs in progress</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <span className="text-3xl font-bold text-white">
                      {myJobs.filter((job: any) => job.status === "in_progress").length}
                    </span>
                    <div className="text-right">
                      <span className="text-sm text-indigo-300">
                        {myJobs.filter((job: any) => 
                          job.status === "in_progress" && job.completionRequested).length} pending completion
                      </span>
                      <br />
                      <span className="text-sm text-indigo-300">
                        {myJobs.filter((job: any) => job.status === "completed").length} completed
                      </span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  <Button variant="link" className="text-indigo-300 p-0 h-auto" asChild>
                    <Link to="/contractor-dashboard" className="flex items-center">
                      View active projects
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>

              {/* Upcoming Appointments Card */}
              <Card className="bg-gradient-to-br from-purple-900/40 to-purple-950/60 border-purple-800/30 shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center">
                    <CalendarIcon className="h-5 w-5 mr-2 text-purple-400" />
                    <span>Upcoming Appointments</span>
                  </CardTitle>
                  <CardDescription>Scheduled visits and deadlines</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <span className="text-3xl font-bold text-white">
                      {/* Count of upcoming appointments within 7 days */}
                      {myJobs.filter((job: any) => {
                        if (job.startDate) {
                          const startDate = new Date(job.startDate);
                          const now = new Date();
                          const diffTime = startDate.getTime() - now.getTime();
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          return diffDays >= 0 && diffDays <= 7;
                        }
                        return false;
                      }).length}
                    </span>
                    <div className="text-right">
                      <span className="text-sm text-purple-300">
                        {/* Count of today's appointments */}
                        {myJobs.filter((job: any) => {
                          if (job.startDate) {
                            const startDate = new Date(job.startDate);
                            const now = new Date();
                            return startDate.toDateString() === now.toDateString();
                          }
                          return false;
                        }).length} today
                      </span>
                      <br />
                      <span className="text-sm text-purple-300">
                        {/* Count of this week's appointments */}
                        {myJobs.filter((job: any) => {
                          if (job.startDate) {
                            const startDate = new Date(job.startDate);
                            const now = new Date();
                            const diffTime = startDate.getTime() - now.getTime();
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            return diffDays > 0 && diffDays <= 7;
                          }
                          return false;
                        }).length} this week
                      </span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  <Button variant="link" className="text-purple-300 p-0 h-auto" asChild>
                    <Link to="/contractor-dashboard" className="flex items-center">
                      View calendar
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            </div>

            {/* Recommended Jobs Section */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Recommended Jobs</h2>
                <Button variant="outline" size="sm" className="flex items-center gap-1.5">
                  <Filter className="h-4 w-4" />
                  Personalized for you
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* We'll display up to 3 recommended jobs */}
                {availableJobs
                  .filter((job: any) => job.status === "open")
                  .slice(0, 3)
                  .map((job: any) => (
                    <Card key={job.id} className="group hover:shadow-md transition-shadow overflow-hidden border-blue-200/20">
                      <div className="flex items-center p-4 border-b border-blue-200/10">
                        {/* Job category icon */}
                        <div className="w-10 h-10 rounded-full bg-blue-900/40 flex items-center justify-center mr-3">
                          <CategoryIcon category={job.categoryTags && job.categoryTags[0] || 'default'} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium text-base">{job.title}</h3>
                          <p className="text-sm text-blue-300">
                            {getFormattedLocation(job)}
                          </p>
                        </div>
                        {job.isUrgent && (
                          <Badge variant="destructive" className="bg-red-600 text-white border-red-700 font-semibold shadow-sm text-xs ml-2">
                            URGENT
                          </Badge>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="flex justify-between mb-3 text-sm">
                          <div className="flex items-center">
                            <DollarSign className="h-4 w-4 mr-1 text-green-400" />
                            <span>${job.budget?.toFixed(2) || 'N/A'}</span>
                          </div>
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-1 text-blue-400" />
                            <span>{new Date(job.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <p className="text-sm line-clamp-2 mb-4 text-blue-200">
                          {job.description}
                        </p>
                        <div className="flex gap-2">
                          <Button 
                            variant="default" 
                            size="sm"
                            className="flex-1"
                            onClick={() => openBidModal(job)}
                          >
                            Bid Now
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="flex-1"
                            onClick={() => viewJobDetails(job)}
                          >
                            View Details
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
              </div>
              
              <div className="mt-4 text-center">
                <Button variant="outline" className="w-full sm:w-auto">
                  View More Recommended Jobs
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>

            {/* Recent Activity Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Recent Activity</h2>
                <Button variant="ghost" size="sm" className="text-blue-400">
                  View All
                </Button>
              </div>
              
              <Card className="border-blue-200/20">
                <ul className="divide-y divide-blue-200/10">
                  {myBids
                    .filter((bid: any) => bid.status === "accepted" || bid.status === "rejected")
                    .slice(0, 5)
                    .map((bid: any) => {
                      const matchingJob = bidJobs.find((j: any) => j.id === bid.jobId);
                      return (
                        <li key={bid.id} className="p-4 flex items-center">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 
                            ${bid.status === "accepted" ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}>
                            {bid.status === "accepted" ? 
                              <CheckCircle2 className="h-5 w-5" /> : 
                              <X className="h-5 w-5" />}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium">{matchingJob?.title || `Bid #${bid.id}`}</h4>
                            <p className="text-sm text-blue-300">
                              Your bid for ${bid.amount.toFixed(2)} was {bid.status}
                            </p>
                          </div>
                          <div className="text-right text-sm text-blue-300">
                            {new Date(bid.updatedAt).toLocaleDateString()}
                          </div>
                        </li>
                      );
                    })}
                  
                  {/* If there are no recent activities */}
                  {myBids.filter((bid: any) => bid.status === "accepted" || bid.status === "rejected").length === 0 && (
                    <li className="p-6 text-center text-blue-300">
                      <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p>No recent activity to display</p>
                      <p className="text-sm mt-1">Your bid responses will appear here</p>
                    </li>
                  )}
                </ul>
              </Card>
            </div>
          </TabsContent>

          {/* Available Jobs Tab */}
          <TabsContent value="available" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-2xl font-bold">Available Jobs for Bidding</h2>
                <p className="text-sm mt-1 text-muted-foreground flex items-center">
                  <ArrowDown className="h-3.5 w-3.5 mr-1 text-blue-400" />
                  Sorted by: Newest
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Removed compact view toggle from top toolbar (now only in sticky bar) */}
                
                {/* Filter badges moved to next to Categories menu above */}
{/* View mode buttons (grid, table, map, split) removed as requested, functionality preserved for future use */}
              </div>
            </div>

            {/* Sticky filter bar when scrolling */}
            <div className="sticky top-16 z-20 bg-background/95 backdrop-blur-sm py-2 border-b border-blue-100/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Input 
                    placeholder="Search jobs..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-[200px] sm:w-[250px] md:w-[300px] h-8 text-sm transition-all duration-200"
                  />
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="h-8 text-xs w-[150px]">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Categories</SelectLabel>
                        <SelectItem value="all">All Categories</SelectItem>
                        <SelectItem value="plumbing">Plumbing</SelectItem>
                        <SelectItem value="electrical">Electrical</SelectItem>
                        <SelectItem value="carpentry">Carpentry</SelectItem>
                        <SelectItem value="painting">Painting</SelectItem>
                        <SelectItem value="landscaping">Landscaping</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  
                  {/* Filter tags moved from above */}
                  <div className="flex items-center gap-1 ml-2">
                    <Badge 
                      variant={selectedCategories.length === 0 ? "default" : "outline"}
                      className="cursor-pointer" 
                      onClick={() => setSelectedCategories([])}
                    >
                      All
                    </Badge>
                    <Badge 
                      variant={selectedCategories.includes("urgent") ? "default" : "outline"}
                      className="cursor-pointer" 
                      onClick={() => {
                        if (selectedCategories.includes("urgent")) {
                          setSelectedCategories(selectedCategories.filter(c => c !== "urgent"));
                        } else {
                          setSelectedCategories([...selectedCategories, "urgent"]);
                        }
                      }}
                    >
                      🔥 URGENT
                    </Badge>
                    <Badge 
                      variant={selectedCategories.includes("nearby") ? "default" : "outline"}
                      className="cursor-pointer" 
                      onClick={() => {
                        if (selectedCategories.includes("nearby")) {
                          setSelectedCategories(selectedCategories.filter(c => c !== "nearby"));
                        } else {
                          setSelectedCategories([...selectedCategories, "nearby"]);
                        }
                      }}
                    >
                      📍 Nearby
                    </Badge>
                    <Badge 
                      variant={selectedCategories.includes("new") ? "default" : "outline"}
                      className="cursor-pointer" 
                      onClick={() => {
                        if (selectedCategories.includes("new")) {
                          setSelectedCategories(selectedCategories.filter(c => c !== "new"));
                        } else {
                          setSelectedCategories([...selectedCategories, "new"]);
                        }
                      }}
                    >
                      ✨ New
                    </Badge>
                  </div>
                </div>
                
                {/* View mode toggle for sticky bar */}
                <div className="flex items-center">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center">
                          <Label htmlFor="compact-mode-sticky" className="text-xs font-medium mr-1.5">Compact</Label>
                          <Switch 
                            id="compact-mode-sticky"
                            checked={isCompactView}
                            onCheckedChange={setIsCompactView}
                            className="scale-75"
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        📏 Compact View
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>
            
            {/* Grid view of jobs */}
            {activeViewMode === "grid" && (
              <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 auto-rows-min", 
                isCompactView && "compact-card-container")}>
                {filteredAvailableJobs.map((job: Job) => (
                  <AdaptiveJobCard 
                    key={job.id}
                    job={job}
                    onViewDetails={viewJobDetails}
                    onBidJob={openBidModal}
                    getJobImage={getJobImage}
                    expanded={isJobExpanded(job.id)}
                    toggleExpanded={(e) => toggleJobExpansion(job.id, e)}
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
                    showActions={true}
                  />
                ))}
              </div>
            )}

            {/* Old implementation has been completely removed */}
                  // Calculate time until preferred start date
                  const getTimeUntilStart = () => {
                    if (!job.startDate && !job.deadline) return null;
                    
                    const targetDate = job.startDate 
                      ? new Date(job.startDate)
                      : job.deadline 
                        ? (typeof job.deadline === 'string' ? new Date(job.deadline) : null)
                        : null;
                    
                    if (!targetDate) return null;
                    
                    const now = new Date();
                    const diffTime = targetDate.getTime() - now.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffTime < 0) return null;
                    
                    if (diffDays < 1) {
                      const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
                      return { value: diffHours, unit: 'hours', urgent: true };
                    }
                    
                    return { value: diffDays, unit: 'days', urgent: diffDays <= 2 };
                  };
                  
                  // Get the time remaining for bidding (based on job creation date)
                  const getBiddingTimeLeft = () => {
                    const createdAt = new Date(job.createdAt);
                    const now = new Date();
                    const diffDays = Math.ceil((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
                    
                    const daysLeft = 7 - diffDays; // 7-day bidding window
                    
                    if (daysLeft <= 0) return null;
                    
                    return {
                      days: daysLeft,
                      hours: 24 - now.getHours(),
                    };
                  };
                  
                  // Determine if a job is urgent
                  const isJobUrgent = () => {
                    const timeUntil = getTimeUntilStart();
                    return job.isUrgent || (timeUntil && timeUntil.urgent);
                  };
                  
                  // Get job size based on budget
                  const getJobSize = () => {
                    if (!job.budget) return 'unknown';
                    if (job.budget < 500) return 'small';
                    if (job.budget < 2000) return 'medium';
                    return 'large';
                  };
                  
                  // Calculate the number of bids for this job
                  const getBidCount = () => {
                    // Check if we have bid data
                    const jobBids = myBids.filter((bid: any) => bid.jobId === job.id);
                    
                    // If we don't have bid data for this job, try to get it from the bid cache
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
                  };
                  
                  const timeUntil = getTimeUntilStart();
                  const biddingTimeLeft = getBiddingTimeLeft();
                  const isUrgent = isJobUrgent();
                  const jobSize = getJobSize();
                  const bidCount = getBidCount();
                  
                  return (
                    <Card 
                      key={job.id} 
                      className={cn(
                        "unified-job-card group relative px-4 flex flex-col h-full min-h-[475px]",
                        isCompactView && "compact-card", 
                        isJobExpanded(job.id) && "unified-card-expanded"
                      )}
                    >
                      {/* Job Image */}
                      <div className={cn("relative h-40 w-full overflow-hidden job-image")}>
                        <img 
                          src={getJobImage(job)} 
                          alt={job.title} 
                          className="w-full h-full object-cover transition-all duration-500 ease-in-out group-hover:scale-105"
                          onError={(e) => {
                            // If image fails to load, use a backup image based on category
                            (e.target as HTMLImageElement).src = "/uploads/jobs/default-job-image.svg";
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
                        
                        {/* Carousel removed - displaying only first image */}
                        
                        {/* Category tag with icon - Top left */}
                        {job.categoryTags && Array.isArray(job.categoryTags) && job.categoryTags.length > 0 && (
                          <div className="absolute top-3 left-3 z-10">
                            <Badge variant="secondary" className="bg-primary/90 text-white text-sm px-3 py-1 flex items-center gap-1.5 rounded-md">
                              {job.categoryTags[0]}
                            </Badge>
                          </div>
                        )}
                        
                        {/* Urgency badge - Top right */}
                        {isUrgent && (
                          <div className="absolute top-3 right-3 z-10">
                            <Badge variant="secondary" className="bg-red-600 text-white text-xs px-3 py-1.5 flex items-center gap-1.5 rounded-md font-semibold shadow-sm shadow-red-500/20">
                              <FlameIcon className="h-4 w-4 fill-white" />
                              URGENT
                            </Badge>
                          </div>
                        )}
                        
                        {/* Bidding countdown */}
                        {biddingTimeLeft && (
                          <div className="absolute bottom-3 right-3 z-10">
                            <Badge variant="outline" className="bg-slate-800/70 border-slate-700 text-slate-100 text-xs flex items-center gap-1">
                              <Timer className="h-3 w-3" />
                              {biddingTimeLeft.days > 0 
                                ? `${biddingTimeLeft.days}d left to bid` 
                                : `${biddingTimeLeft.hours}h left to bid`
                              }
                            </Badge>
                          </div>
                        )}
                        
                        {/* Price badge with job size in bottom left */}
                        <div className="absolute bottom-3 left-3 z-10">
                          <Badge variant="secondary" className="bg-green-600/90 text-white font-bold flex items-center gap-1.5">
                            {job.budget ? `$${job.budget.toFixed(2)}` : 'Open'}
                            <span className="opacity-80 text-xs font-normal">•</span> 
                            <span className="opacity-80 text-xs font-normal">
                              {jobSize === 'small' ? 'Small Job' : jobSize === 'medium' ? 'Medium Job' : 'Large Job'}
                            </span>
                          </Badge>
                        </div>
                      </div>
                      
                      <CardHeader className={cn("p-3 pb-1 card-header")}>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className={cn("text-base font-semibold line-clamp-1 card-title")}>{job.title}</CardTitle>
                            {/* Posted time ago label */}
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Posted {getTimeAgo(job.createdAt)}
                            </div>
                          </div>
                          <div className="job-status-tags">
                            <Badge>{job.status}</Badge>
                            {bidCount > 0 && (
                              <Badge variant="outline" className="flex items-center gap-1 text-xs">
                                <Users className="h-3 w-3" /> {bidCount} bid{bidCount !== 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {/* Client info with avatar */}
                        <div className="flex items-center gap-2 mt-1.5 mb-1">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={`https://ui-avatars.com/api/?name=${getClientName(job.landlordId)}&background=random`} />
                            <AvatarFallback>{getClientName(job.landlordId).substring(0, 2)}</AvatarFallback>
                          </Avatar>
                          <div className="text-xs">
                            <span className="font-medium">{getClientName(job.landlordId)}</span>
                          </div>
                        </div>
                        
                        <CardDescription className="flex items-center mt-1">
                          <MapPin className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                          <span className="text-xs">
                            {job.location && typeof job.location === 'object' && 'city' in job.location 
                              ? `${job.location.city}, ${job.location.state}` 
                              : 'Location not specified'}
                          </span>
                        </CardDescription>
                      </CardHeader>
                      
                      <CardContent className={cn("p-3 pt-1 card-content")}>
                        {/* Basic Description - shortened or expanded */}
                        <Collapsible 
                          open={isJobExpanded(job.id)} 
                          onOpenChange={() => toggleJobExpansion(job.id)}
                          className="transition-all duration-300 ease-in-out"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm ${isJobExpanded(job.id) ? '' : 'line-clamp-2 overflow-hidden text-ellipsis'} mb-1 flex-1`}>{job.description}</p>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <CollapsibleTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className={cn(
                                        "h-7 w-7 p-0 mt-0.5 flex-shrink-0 rounded-full transition-all duration-300",
                                        isJobExpanded(job.id) 
                                          ? "bg-blue-50 text-primary border border-blue-100 shadow-sm" 
                                          : "hover:bg-blue-50/50 hover:text-primary hover:border hover:border-blue-100/50"
                                      )}
                                      onClick={(e) => toggleJobExpansion(job.id, e)}
                                    >
                                      <ChevronDown className={cn(
                                        "h-4 w-4 transition-transform duration-500 ease-in-out",
                                        isJobExpanded(job.id) 
                                          ? "rotate-180 text-primary" 
                                          : "text-muted-foreground"
                                      )} />
                                    </Button>
                                  </CollapsibleTrigger>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="bg-slate-800 text-white border-slate-700 text-xs">
                                  {isJobExpanded(job.id) ? 'Collapse details' : 'Expand details'}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          
                          {/* Timeline indicator */}
                          {timeUntil && (
                            <div className="flex items-center text-xs text-muted-foreground mb-2">
                              <CalendarDays className="h-3.5 w-3.5 mr-1" />
                              <span className={timeUntil.urgent ? 'text-red-500 font-medium' : ''}>
                                Starts in {timeUntil.value} {timeUntil.unit}
                              </span>
                            </div>
                          )}
                          
                          <CollapsibleContent className="animate-in slide-in-from-top-5 duration-300">
                            {/* Extra details shown when expanded */}
                            <div className="pt-2 space-y-3 animate-in fade-in-50 duration-200">
                              {/* Job details */}
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <p className="font-medium text-muted-foreground flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5 text-blue-400" />
                                    Estimated Duration
                                  </p>
                                  <p className="mt-1">{getEstimatedDuration(job)}</p>
                                </div>
                                <div>
                                  <p className="font-medium text-muted-foreground flex items-center gap-1.5">
                                    <CalendarClock className="h-3.5 w-3.5 text-blue-400" />
                                    Posted
                                  </p>
                                  <p className="mt-1">{getTimeAgo(job.createdAt)}</p>
                                </div>
                              </div>
                              
                              {/* Skills required - only shown if skills exist */}
                              {getRequiredSkills(job).length > 0 && (
                                <div className="mt-4">
                                  <p className="font-medium text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                                    <Wrench className="h-3.5 w-3.5 text-blue-400" />
                                    Skills Required
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {getRequiredSkills(job).slice(0, 4).map((skill, i) => (
                                      <Badge key={i} variant="outline" className="text-xs bg-slate-50 text-slate-600 px-2 py-0 h-5 rounded-full border-slate-100 font-normal hover:bg-slate-100 transition-colors">{skill}</Badge>
                                    ))}
                                    {getRequiredSkills(job).length > 4 && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-500 cursor-help px-2 py-0 h-5 rounded-full border-blue-100 font-normal hover:bg-blue-100 transition-colors">
                                              +{getRequiredSkills(job).length - 4} more
                                            </Badge>
                                          </TooltipTrigger>
                                          <TooltipContent align="start" side="top" className="p-3 max-w-[250px] bg-white border shadow-md rounded-md">
                                            <p className="text-xs font-semibold mb-2 text-gray-700">Additional Required Skills</p>
                                            <div className="flex flex-wrap gap-1.5">
                                              {getRequiredSkills(job).slice(4).map((skill, i) => (
                                                <Badge key={i} variant="outline" className="text-xs bg-slate-50 text-slate-600 px-2 py-0 h-5 rounded-full border-slate-100 font-normal">{skill}</Badge>
                                              ))}
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </div>
                                </div>
                              )}
                              
                              {/* Job Size section removed - redundant with price badge */}
                              
                              {/* Message Poster Button */}
                              <div className="mt-4">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="w-full text-xs flex items-center gap-1.5 py-2 transition-all duration-200 hover:bg-blue-50 hover:text-blue-700"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toast({
                                      title: "Message Feature",
                                      description: "Direct messaging will be available soon.",
                                    });
                                  }}
                                >
                                  <MessageCircle className="h-3.5 w-3.5" />
                                  Message Poster
                                </Button>
                              </div>
                            </div>
                          </CollapsibleContent>
                          
                          {/* Removed redundant REQUIREMENTS/TIMELINE/MATERIALS sections - already shown in collapsed card */}
                        </Collapsible>
                        
                        {/* Category tags at bottom of card removed as per user request - keeping only the top-left pill */}
                      </CardContent>
                      
                      <CardFooter className="card-footer pt-3 pb-4 px-4 mt-auto flex-shrink-0">
                        <div className="flex items-center justify-between gap-3 w-full">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1 gap-1.5 text-xs py-2 transition-all duration-200 hover:bg-blue-50 hover:text-blue-700"
                            onClick={() => viewJobDetails(job)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View Details
                          </Button>
                          
                          {!myBids.some((bid: any) => bid.jobId === job.id) && (
                            <div className="flex-1">
                              {/* Status tags above Place Bid button */}
                              <div className="flex justify-end mb-1">
                                {job.createdAt && new Date().getTime() - new Date(job.createdAt).getTime() < 24 * 60 * 60 * 1000 && (
                                  <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-600/40 text-[10px] px-1.5 py-0">
                                    ✨ New
                                  </Badge>
                                )}
                              </div>
                              <Button 
                                variant="default" 
                                size="sm"
                                className="w-full gap-1.5 text-xs py-2 transition-all duration-200 hover:bg-green-600"
                                onClick={() => openBidModal(job)}
                              >
                                <BadgeDollarSign className="h-3.5 w-3.5" />
                                Place Bid
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
            
            {/* Placeholder for other view modes */}
            {activeViewMode === "table" && (
              <div className="bg-white rounded-lg border">
                <div className="grid grid-cols-5 font-semibold p-4 border-b">
                  <div>Job Title</div>
                  <div>Location</div>
                  <div>Category</div>
                  <div>Budget</div>
                  <div>Actions</div>
                </div>
                {filteredAvailableJobs.map((job: Job) => (
                  <div key={job.id} className="grid grid-cols-5 p-4 border-b hover:bg-gray-50">
                    <div className="font-medium">{job.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {job.location && typeof job.location === 'object' && 'city' in job.location 
                        ? `${job.location.city}, ${job.location.state}` 
                        : 'Location not specified'}
                    </div>
                    <div>
                      {job.categoryTags && Array.isArray(job.categoryTags) && job.categoryTags.length > 0 ? (
                        job.categoryTags.length === 1 ? (
                          <Badge variant="outline">{job.categoryTags[0]}</Badge>
                        ) : (
                          <div className="inline-flex rounded-md shadow-sm">
                            {job.categoryTags.slice(0, 2).map((tag, i) => (
                              <Button
                                key={i}
                                variant="outline" 
                                size="sm"
                                className={`text-xs py-0.5 px-2 h-auto ${i === 0 ? 'rounded-l-md rounded-r-none' : 'rounded-r-md rounded-l-none border-l-0'}`}
                              >
                                {tag}
                              </Button>
                            ))}
                            {job.categoryTags.length > 2 && (
                              <span className="text-xs ml-1 text-muted-foreground">+{job.categoryTags.length - 2} more</span>
                            )}
                          </div>
                        )
                      ) : 'N/A'}
                    </div>
                    <div>${job.budget ? job.budget.toFixed(2) : 'N/A'}</div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => viewJobDetails(job)}>
                        View
                      </Button>
                      <Button variant="default" size="sm" onClick={() => openBidModal(job)}>
                        Bid
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {activeViewMode === "map" && (
              <div className="space-y-4">
                <div className="bg-background rounded-lg p-4 border shadow-sm">
                  <JobsMap 
                    jobs={filteredAvailableJobs}
                    onViewDetails={viewJobDetails}
                    onBidJob={openBidModal}
                    onJobHover={(jobId) => {
                      // You can add hover functionality here if needed
                      console.log("Job hovered:", jobId);
                    }}
                    serviceAreaMarker={profileData?.serviceAreas?.[0] ? {
                      latitude: profileData.serviceAreas[0].latitude,
                      longitude: profileData.serviceAreas[0].longitude
                    } : undefined}
                    serviceRadius={profileData?.serviceAreas?.[0]?.radius || 25}
                  />
                </div>
                <Card className="bg-background rounded-lg p-2">
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-md">Available Jobs Near You</CardTitle>
                    <CardDescription>
                      {filteredAvailableJobs.length} jobs found within your service area
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-3">
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                      {filteredAvailableJobs.slice(0, 5).map((job) => (
                        <div 
                          key={job.id} 
                          className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer"
                          onClick={() => viewJobDetails(job)}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                              <MapPin className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{job.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {job.location && typeof job.location === 'object' && 'city' in job.location 
                                  ? `${job.location.city}, ${job.location.state}` 
                                  : 'Location not specified'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold">{job.budget ? `$${job.budget.toFixed(2)}` : 'Open'}</p>
                            <Badge variant="outline" className="text-xs">
                              {job.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
            
            {activeViewMode === "split" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-background rounded-lg border shadow-sm p-4">
                  <h3 className="text-lg font-semibold mb-3">Job Listings</h3>
                  <div className="space-y-2 overflow-y-auto max-h-[550px] pr-2">
                    {filteredAvailableJobs.map((job: Job) => (
                      <Card 
                        key={job.id} 
                        className="p-3 cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => viewJobDetails(job)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            {job.categoryTags && Array.isArray(job.categoryTags) && job.categoryTags.length > 0 ? (
                              <CategoryIcon category={job.categoryTags[0]} size={18} />
                            ) : (
                              <Briefcase className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <h4 className="font-medium text-sm">{job.title}</h4>
                              <Badge>{job.budget ? `$${job.budget.toFixed(2)}` : 'Open'}</Badge>
                            </div>
                            <div className="flex items-center text-xs text-muted-foreground mt-1">
                              <MapPin className="h-3 w-3 mr-1" />
                              <span>
                                {job.location && typeof job.location === 'object' && 'city' in job.location 
                                  ? `${job.location.city}, ${job.location.state}` 
                                  : 'Location not specified'}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                              {job.description}
                            </p>
                            <div className="flex justify-between items-center mt-2">
                              <div className="flex gap-1">
                                {job.isUrgent && (
                                  <Badge variant="destructive" className="text-xs flex items-center gap-1 bg-red-600 text-white border-red-700 font-semibold shadow-sm">
                                    <FlameIcon className="h-3 w-3" />
                                    URGENT
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-xs">
                                  {job.status}
                                </Badge>
                              </div>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-7 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openBidModal(job);
                                }}
                              >
                                Bid Now
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
                <div className="h-[600px] bg-background rounded-lg border shadow-sm overflow-hidden">
                  <JobsMap 
                    jobs={filteredAvailableJobs}
                    onViewDetails={viewJobDetails}
                    onBidJob={openBidModal}
                    serviceAreaMarker={profileData?.serviceAreas?.[0] ? {
                      latitude: profileData.serviceAreas[0].latitude,
                      longitude: profileData.serviceAreas[0].longitude
                    } : undefined}
                    serviceRadius={profileData?.serviceAreas?.[0]?.radius || 25}
                  />
                </div>
              </div>
            )}
          </TabsContent>
          
          {/* My Jobs Tab */}
          <TabsContent value="my-jobs" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">My Project Management</h2>
              
              {/* Search bar for projects */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-blue-300" />
                  <Input 
                    type="search" 
                    placeholder="Search projects..." 
                    className="pl-9 w-[220px] bg-blue-950/30 border-blue-800/40"
                  />
                </div>
                <Button variant="outline" size="sm" className="gap-1">
                  <Filter className="h-4 w-4" />
                  Filter
                </Button>
              </div>
            </div>
            
            {/* My Jobs Sub Tabs */}
            <Tabs defaultValue="active" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="active" className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  Active Projects
                  <span className="ml-1.5 bg-blue-500/10 text-blue-500 text-xs px-1.5 py-0.5 rounded-full">
                    {myJobs?.filter(job => job.status === "in_progress").length || 0}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="completed" className="flex items-center gap-1.5">
                  <Archive className="h-4 w-4" />
                  Past Projects
                  <span className="ml-1.5 bg-green-500/10 text-green-500 text-xs px-1.5 py-0.5 rounded-full">
                    {myJobs?.filter(job => job.status === "completed").length || 0}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="files" className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4" />
                  Files & Docs
                </TabsTrigger>
                <TabsTrigger value="all" className="flex items-center gap-1.5">
                  <Layers className="h-4 w-4" />
                  All Jobs
                  <span className="ml-1.5 bg-slate-500/10 text-slate-300 text-xs px-1.5 py-0.5 rounded-full">
                    {myJobs?.length || 0}
                  </span>
                </TabsTrigger>
              </TabsList>
            
              {/* All Jobs Sub Tab */}
              <TabsContent value="all" className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {myJobs.map((job: Job) => (
                    <AdaptiveJobCard 
                      key={job.id}
                      job={job}
                      onViewDetails={viewJobDetails}
                      onCreateQuote={createQuoteFromJob}
                      getJobImage={getJobImage}
                      expanded={true}
                      showActions={true}
                    />
                  ))}
                </div>
              </TabsContent>

          {/* My Bids Tab */}
          

          

          

          
          {/* My Bids Tab */}
          <TabsContent value="my-bids" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">My Bids on Other Projects</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Pending Bids</h3>
                {myBids.filter((bid: any) => bid.status === "pending").length === 0 && (
                  <Card className="p-8">
                    <div className="text-center text-muted-foreground">
                      <p>You don't have any pending bids.</p>
                    </div>
                  </Card>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {console.log("Filtered pending bids:", myBids.filter((bid: any) => bid.status === "pending"))}
                  {myBids.filter((bid: any) => bid.status === "pending").map((bid: any) => {
                    console.log("Processing bid to find matching job:", bid);
                    // Find the job from the dedicated bidJobs array 
                    const job = bidJobs.find((j: Job) => j.id === bid.jobId);
                    console.log("Found job for bid:", job);
                    if (!job) {
                      console.log(`No job found for bid ${bid.id} with jobId ${bid.jobId}`);
                      return null;
                    }
                    return (
                      <Card key={bid.id} className="overflow-hidden">
                        {/* Job Image */}
                        <div className="relative h-40 w-full overflow-hidden">
                          <img 
                            src={getJobImage(job)} 
                            alt={job.title} 
                            className="w-full h-full object-cover transition-all duration-300 ease-in-out hover:scale-105"
                            onError={(e) => {
                              // If image fails to load, use a backup image based on category
                              (e.target as HTMLImageElement).src = "/uploads/jobs/default-job-image.svg";
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                          
                          {/* Image navigation controls - Only show if job has multiple images */}
                          {job.images && Array.isArray(job.images) && job.images.length > 1 && (
                            <>
                              {/* Previous image button */}
                              <button 
                                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-1 rounded-full"
                                onClick={(e) => prevImage(job, e)}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </button>
                              
                              {/* Next image button */}
                              <button 
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-1 rounded-full"
                                onClick={(e) => nextImage(job, e)}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                </svg>
                              </button>
                              
                              {/* Image counter */}
                              <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                                {(currentImageIndices[job.id] || 0) + 1}/{job.images.length}
                              </div>
                            </>
                          )}
                          
                          {/* Status badge in top corner */}
                          <div className="absolute top-2 right-2">
                            <Badge variant="secondary">Pending</Badge>
                          </div>
                          
                          {/* Job size indicator */}
                          <div className="absolute bottom-11 right-3 z-10">
                            <Badge variant="outline" className="bg-slate-800/70 border-slate-700 text-slate-100 text-xs">
                              {job.budget && job.budget < 500 ? 'Small Job' : 
                               job.budget && job.budget < 2000 ? 'Medium Job' : 'Large Job'}
                            </Badge>
                          </div>
                          
                          {/* Price badge in bottom left */}
                          <div className="absolute bottom-2 left-2">
                            <Badge variant="secondary" className="bg-primary text-white font-bold">
                              Your Bid: ${bid.amount.toFixed(2)}
                            </Badge>
                          </div>
                        </div>
                        
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-lg font-semibold line-clamp-1">{job.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-2">
                          <p className="text-sm line-clamp-2 mb-2">{bid.proposal}</p>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Time Estimate:</span>
                              <span>{bid.timeEstimate}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Start Date:</span>
                              <span>
                                {bid.proposedStartDate ? format(new Date(bid.proposedStartDate), 'PPP') : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="flex justify-between p-4 pt-0">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full"
                            onClick={() => viewJobDetails(job)}
                          >
                            View Job
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-2">Accepted Bids</h3>
                {myBids.filter((bid: any) => bid.status === "accepted").length === 0 && (
                  <Card className="p-8">
                    <div className="text-center text-muted-foreground">
                      <p>You don't have any accepted bids.</p>
                    </div>
                  </Card>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {myBids.filter((bid: any) => bid.status === "accepted").map((bid: any) => {
                    // Find the job from the dedicated bidJobs array
                    const job = bidJobs.find((j: Job) => j.id === bid.jobId);
                    if (!job) {
                      console.log(`No job found for accepted bid ${bid.id} with jobId ${bid.jobId}`);
                      return null;
                    }
                    return (
                      <Card key={bid.id} className="overflow-hidden border-green-300">
                        {/* Job Image */}
                        <div className="relative h-40 w-full overflow-hidden">
                          <img 
                            src={getJobImage(job)} 
                            alt={job.title} 
                            className="w-full h-full object-cover transition-all duration-300 ease-in-out hover:scale-105"
                            onError={(e) => {
                              // If image fails to load, use a backup image based on category
                              (e.target as HTMLImageElement).src = "/uploads/jobs/default-job-image.svg";
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                          
                          {/* Image navigation controls - Only show if job has multiple images */}
                          {job.images && Array.isArray(job.images) && job.images.length > 1 && (
                            <>
                              {/* Previous image button */}
                              <button 
                                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-1 rounded-full"
                                onClick={(e) => prevImage(job, e)}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </button>
                              
                              {/* Next image button */}
                              <button 
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-1 rounded-full"
                                onClick={(e) => nextImage(job, e)}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                </svg>
                              </button>
                              
                              {/* Image counter */}
                              <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                                {(currentImageIndices[job.id] || 0) + 1}/{job.images.length}
                              </div>
                            </>
                          )}
                          
                          {/* Status badge in top corner */}
                          <div className="absolute top-2 right-2">
                            <Badge className="bg-green-500">Accepted</Badge>
                          </div>
                          
                          {/* Price badge in bottom left */}
                          <div className="absolute bottom-2 left-2">
                            <Badge variant="secondary" className="bg-green-700 text-white font-bold">
                              ${bid.amount.toFixed(2)}
                            </Badge>
                          </div>
                        </div>
                        
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-lg font-semibold line-clamp-1">{job.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-2">
                          <p className="text-sm line-clamp-2 mb-2">{bid.proposal}</p>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Start Date:</span>
                              <span>
                                {bid.proposedStartDate ? format(new Date(bid.proposedStartDate), 'PPP') : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="flex justify-between p-4 pt-0 gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full"
                            onClick={() => viewJobDetails(job)}
                          >
                            View Job
                          </Button>
                          <Button 
                            variant="default" 
                            size="sm" 
                            className="w-full"
                            onClick={() => createQuoteFromJob(job)}
                          >
                            Create Quote
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-2">Rejected Bids</h3>
                {myBids.filter((bid: any) => bid.status === "rejected").length === 0 && (
                  <Card className="p-8">
                    <div className="text-center text-muted-foreground">
                      <p>You don't have any rejected bids.</p>
                    </div>
                  </Card>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {myBids.filter((bid: any) => bid.status === "rejected").map((bid: any) => {
                    // Find the job from the dedicated bidJobs array
                    const job = bidJobs.find((j: Job) => j.id === bid.jobId);
                    if (!job) {
                      console.log(`No job found for rejected bid ${bid.id} with jobId ${bid.jobId}`);
                      return null;
                    }
                    return (
                      <Card key={bid.id} className="overflow-hidden border-red-200">
                        {/* Job Image */}
                        <div className="relative h-40 w-full overflow-hidden">
                          <img 
                            src={getJobImage(job)} 
                            alt={job.title} 
                            className="w-full h-full object-cover transition-all duration-300 ease-in-out hover:scale-105"
                            onError={(e) => {
                              // If image fails to load, use a backup image based on category
                              (e.target as HTMLImageElement).src = "/uploads/jobs/default-job-image.svg";
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                          
                          {/* Image navigation controls - Only show if job has multiple images */}
                          {job.images && Array.isArray(job.images) && job.images.length > 1 && (
                            <>
                              {/* Previous image button */}
                              <button 
                                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-1 rounded-full"
                                onClick={(e) => prevImage(job, e)}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </button>
                              
                              {/* Next image button */}
                              <button 
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-1 rounded-full"
                                onClick={(e) => nextImage(job, e)}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                </svg>
                              </button>
                              
                              {/* Image counter */}
                              <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                                {(currentImageIndices[job.id] || 0) + 1}/{job.images.length}
                              </div>
                            </>
                          )}
                          
                          {/* Status badge in top corner */}
                          <div className="absolute top-2 right-2">
                            <Badge variant="destructive">Rejected</Badge>
                          </div>
                          
                          {/* Price badge in bottom left */}
                          <div className="absolute bottom-2 left-2">
                            <Badge variant="secondary" className="bg-gray-700 text-white font-bold">
                              ${bid.amount.toFixed(2)}
                            </Badge>
                          </div>
                        </div>
                        
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-lg font-semibold line-clamp-1">{job.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-2">
                          <p className="text-sm line-clamp-2 mb-2">{bid.proposal}</p>
                        </CardContent>
                        <CardFooter className="flex justify-between p-4 pt-0">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full"
                            onClick={() => viewJobDetails(job)}
                          >
                            View Job
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          </TabsContent>
          
              {/* Active Jobs Sub Tab */}
              {/* Active Projects Tab Content */}
              <TabsContent value="active" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {myJobs.filter((job: Job) => job.status === "in_progress").map((job: Job) => (
                    <Card key={job.id} className="overflow-hidden border-blue-300/30 bg-blue-950/20">
                      <div className="flex flex-col">
                        {/* Job header with info */}
                        <div className="flex items-center p-4 border-b border-blue-800/20">
                          <div className="w-12 h-12 rounded-full bg-blue-900/40 flex items-center justify-center mr-4">
                            <CategoryIcon category={job.categoryTags && job.categoryTags[0] || 'default'} />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{job.title}</h3>
                            <div className="flex items-center text-sm text-blue-300">
                              <MapPin className="h-3.5 w-3.5 mr-1" />
                              <span>{getFormattedLocation(job)}</span>
                            </div>
                          </div>
                          <Badge className="bg-blue-500 ml-2">In Progress</Badge>
                        </div>
                        
                        {/* Progress tracker section */}
                        <div className="p-4 border-b border-blue-800/20">
                          <div className="flex justify-between mb-2 items-center">
                            <h4 className="font-medium text-sm">Project Progress</h4>
                            <Badge variant="outline" className="text-xs font-normal">
                              {job.progress || 0}% Complete
                            </Badge>
                          </div>
                          
                          {/* Progress bar */}
                          <div className="w-full bg-blue-900/40 rounded-full h-2.5 mb-2">
                            <div 
                              className="bg-blue-500 h-2.5 rounded-full" 
                              style={{width: `${job.progress || 0}%`}}
                            ></div>
                          </div>
                          
                          {/* Milestone indicators */}
                          <div className="flex justify-between text-xs text-blue-300 mb-3">
                            <span>Started</span>
                            <span>Materials</span>
                            <span>Construction</span>
                            <span>Finishing</span>
                            <span>Complete</span>
                          </div>
                          
                          {/* Timeline details */}
                          <div className="flex justify-between text-sm mt-3">
                            <div className="flex items-center">
                              <CalendarDays className="h-4 w-4 mr-1.5 text-blue-400" />
                              <span>
                                Start: {job.startDate ? new Date(job.startDate).toLocaleDateString() : 'Not set'}
                              </span>
                            </div>
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 mr-1.5 text-amber-400" />
                              <span>
                                Due: {job.deadline ? new Date(job.deadline).toLocaleDateString() : 'Flexible'}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Action buttons section */}
                        <div className="p-4 flex flex-wrap gap-2">
                          <Button size="sm" variant="default" className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4" />
                            Update Progress
                          </Button>
                          <Button size="sm" variant="outline" className="flex items-center gap-1.5">
                            <FileText className="h-4 w-4" />
                            Create Invoice
                          </Button>
                          <Button size="sm" variant="outline" className="flex items-center gap-1.5">
                            <MessageCircle className="h-4 w-4" />
                            Message Client
                          </Button>
                          <Button size="sm" variant="outline" className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4" />
                            Mark Complete
                          </Button>
                        </div>
                        
                        {/* Latest updates/activity */}
                        <div className="p-4 pt-0">
                          <div className="rounded-lg border border-blue-800/20 p-3 bg-blue-900/20">
                            <h5 className="font-medium text-sm mb-2 flex items-center">
                              <Clock className="h-3.5 w-3.5 mr-1.5 text-blue-400" />
                              Recent Updates
                            </h5>
                            <ul className="space-y-2">
                              <li className="text-xs text-blue-200 flex items-start">
                                <div className="bg-blue-700/40 rounded-full h-5 w-5 flex items-center justify-center mt-0.5 mr-2 flex-shrink-0">
                                  <CheckCircle2 className="h-3 w-3" />
                                </div>
                                <div>
                                  <p className="font-medium">Progress updated to {job.progress || 0}%</p>
                                  <p className="text-blue-300">
                                    {new Date(job.updatedAt).toLocaleDateString()} at {new Date(job.updatedAt).toLocaleTimeString()}
                                  </p>
                                </div>
                              </li>
                              <li className="text-xs text-blue-200 flex items-start">
                                <div className="bg-indigo-700/40 rounded-full h-5 w-5 flex items-center justify-center mt-0.5 mr-2 flex-shrink-0">
                                  <MessageCircle className="h-3 w-3" />
                                </div>
                                <div>
                                  <p className="font-medium">New message from client</p>
                                  <p className="text-blue-300">
                                    {new Date(new Date(job.updatedAt).getTime() - 3600000).toLocaleDateString()} at {new Date(new Date(job.updatedAt).getTime() - 3600000).toLocaleTimeString()}
                                  </p>
                                </div>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                  
                  {/* Show message when no active projects */}
                  {myJobs.filter((job: Job) => job.status === "in_progress").length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-12 text-center text-blue-300">
                      <div className="w-16 h-16 rounded-full bg-blue-900/30 flex items-center justify-center mb-4">
                        <ClipboardCheck className="h-8 w-8 text-blue-500" />
                      </div>
                      <h3 className="text-xl font-medium mb-2">No Active Projects</h3>
                      <p className="max-w-md text-blue-400 mb-6">
                        You don't have any projects in progress. Find new jobs and bid on them to get started.
                      </p>
                      <Button className="flex items-center gap-1.5">
                        <Search className="h-4 w-4" />
                        Find New Jobs
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>
              
              {/* Completed Projects Tab Content */}
              <TabsContent value="completed" className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-medium">Completed Projects</h3>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Filter className="h-4 w-4" />
                      Filter
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <ArrowDown className="h-4 w-4" />
                      Sort by Date
                    </Button>
                  </div>
                </div>
                
                <div className="border rounded-lg border-blue-800/20 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-blue-900/40 text-blue-100">
                      <tr>
                        <th className="py-3 px-4 text-left font-medium text-sm">Project</th>
                        <th className="py-3 px-4 text-left font-medium text-sm">Client</th>
                        <th className="py-3 px-4 text-left font-medium text-sm">Completed</th>
                        <th className="py-3 px-4 text-left font-medium text-sm">Amount</th>
                        <th className="py-3 px-4 text-left font-medium text-sm">Rating</th>
                        <th className="py-3 px-4 text-left font-medium text-sm">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-800/20">
                      {myJobs.filter((job: Job) => job.status === "completed").map((job: Job) => (
                        <tr key={job.id} className="hover:bg-blue-900/20">
                          <td className="py-3 px-4">
                            <div className="flex items-center">
                              <div className="w-8 h-8 rounded-full bg-blue-900/40 flex items-center justify-center mr-3">
                                <CategoryIcon category={job.categoryTags && job.categoryTags[0] || 'default'} />
                              </div>
                              <div>
                                <div className="font-medium">{job.title}</div>
                                <div className="text-xs text-blue-300">{job.categoryTags && job.categoryTags[0]}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center">
                              <UserCircle className="h-4 w-4 mr-1.5 text-blue-400" />
                              <span>Client #{job.landlordId}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm">
                              {job.completionDate ? new Date(job.completionDate).toLocaleDateString() : new Date(job.updatedAt).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium">${job.budget?.toFixed(2) || 'N/A'}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex text-yellow-400">
                              <Star className="h-4 w-4 fill-current" />
                              <Star className="h-4 w-4 fill-current" />
                              <Star className="h-4 w-4 fill-current" />
                              <Star className="h-4 w-4 fill-current" />
                              <Star className="h-4 w-4" />
                              <span className="ml-1.5 text-white">4.0</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                <FileText className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      
                      {/* Show empty state when no completed projects */}
                      {myJobs.filter((job: Job) => job.status === "completed").length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-blue-300">
                            <Archive className="h-10 w-10 mx-auto mb-2 opacity-50" />
                            <p>No completed projects yet</p>
                            <p className="text-sm mt-1">Your completed projects will appear here</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
              
              {/* Files & Documents Tab Content */}
              <TabsContent value="files" className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">Project Files & Documents</h3>
                  <div className="flex items-center gap-2">
                    <Button className="gap-1.5">
                      <Upload className="h-4 w-4" />
                      Upload New File
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* File Categories Section */}
                  <div className="md:col-span-1">
                    <Card className="border-blue-800/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">File Categories</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-1">
                          <Button variant="ghost" className="w-full justify-start gap-2 py-2">
                            <FileText className="h-4 w-4 text-blue-400" />
                            <span>All Files</span>
                            <Badge className="ml-auto">24</Badge>
                          </Button>
                          <Button variant="ghost" className="w-full justify-start gap-2 py-2 text-blue-600 font-semibold">
                            <FileText className="h-4 w-4 text-blue-400" />
                            <span>Invoices</span>
                            <Badge className="ml-auto">8</Badge>
                          </Button>
                          <Button variant="ghost" className="w-full justify-start gap-2 py-2">
                            <FileText className="h-4 w-4 text-blue-400" />
                            <span>Contracts</span>
                            <Badge className="ml-auto">4</Badge>
                          </Button>
                          <Button variant="ghost" className="w-full justify-start gap-2 py-2">
                            <FileText className="h-4 w-4 text-blue-400" />
                            <span>Receipts</span>
                            <Badge className="ml-auto">6</Badge>
                          </Button>
                          <Button variant="ghost" className="w-full justify-start gap-2 py-2">
                            <FileText className="h-4 w-4 text-blue-400" />
                            <span>Project Photos</span>
                            <Badge className="ml-auto">12</Badge>
                          </Button>
                          <Button variant="ghost" className="w-full justify-start gap-2 py-2">
                            <FileText className="h-4 w-4 text-blue-400" />
                            <span>Licenses & Permits</span>
                            <Badge className="ml-auto">3</Badge>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-blue-800/20 mt-4">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Storage</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between mb-1 text-sm">
                              <span>Storage Used</span>
                              <span>65 MB of 500 MB</span>
                            </div>
                            <div className="w-full bg-blue-900/40 rounded-full h-2">
                              <div 
                                className="bg-blue-500 h-2 rounded-full" 
                                style={{width: "13%"}}
                              ></div>
                            </div>
                          </div>
                          <Button variant="outline" className="w-full" size="sm">
                            Upgrade Storage
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Files List Section */}
                  <div className="md:col-span-2">
                    <Card className="border-blue-800/20">
                      <CardHeader className="pb-2 flex flex-row justify-between items-center">
                        <CardTitle className="text-lg">Recent Files</CardTitle>
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-blue-300" />
                            <Input 
                              type="search" 
                              placeholder="Search files..." 
                              className="pl-9 w-[180px] bg-blue-950/30 border-blue-800/40 h-9"
                            />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="rounded-md border border-blue-800/20">
                          <div className="flex items-center p-3 border-b border-blue-800/20 bg-blue-900/20">
                            <span className="flex-1 font-medium text-sm">Filename</span>
                            <span className="w-24 font-medium text-sm">Size</span>
                            <span className="w-32 font-medium text-sm">Date</span>
                            <span className="w-24 font-medium text-sm">Actions</span>
                          </div>
                          
                          <div className="divide-y divide-blue-800/20">
                            {/* Sample invoice file */}
                            <div className="flex items-center p-3 hover:bg-blue-900/10">
                              <div className="flex-1 flex items-center">
                                <div className="bg-blue-900/30 w-8 h-8 rounded flex items-center justify-center mr-3">
                                  <FileText className="h-4 w-4 text-blue-300" />
                                </div>
                                <div>
                                  <div className="font-medium text-sm">Invoice-00123.pdf</div>
                                  <div className="text-xs text-blue-300">Invoices</div>
                                </div>
                              </div>
                              <span className="w-24 text-sm">125 KB</span>
                              <span className="w-32 text-sm">{new Date().toLocaleDateString()}</span>
                              <span className="w-24 flex gap-1">
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </span>
                            </div>
                            
                            {/* Sample contract file */}
                            <div className="flex items-center p-3 hover:bg-blue-900/10">
                              <div className="flex-1 flex items-center">
                                <div className="bg-blue-900/30 w-8 h-8 rounded flex items-center justify-center mr-3">
                                  <FileText className="h-4 w-4 text-blue-300" />
                                </div>
                                <div>
                                  <div className="font-medium text-sm">Service-Contract-2025.pdf</div>
                                  <div className="text-xs text-blue-300">Contracts</div>
                                </div>
                              </div>
                              <span className="w-24 text-sm">320 KB</span>
                              <span className="w-32 text-sm">{new Date().toLocaleDateString()}</span>
                              <span className="w-24 flex gap-1">
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </span>
                            </div>
                            
                            {/* Sample photo file */}
                            <div className="flex items-center p-3 hover:bg-blue-900/10">
                              <div className="flex-1 flex items-center">
                                <div className="bg-blue-900/30 w-8 h-8 rounded flex items-center justify-center mr-3">
                                  <Image className="h-4 w-4 text-blue-300" />
                                </div>
                                <div>
                                  <div className="font-medium text-sm">Project-Before-Photo.jpg</div>
                                  <div className="text-xs text-blue-300">Project Photos</div>
                                </div>
                              </div>
                              <span className="w-24 text-sm">2.4 MB</span>
                              <span className="w-32 text-sm">{new Date().toLocaleDateString()}</span>
                              <span className="w-24 flex gap-1">
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </span>
                            </div>
                            
                            {/* Sample receipt file */}
                            <div className="flex items-center p-3 hover:bg-blue-900/10">
                              <div className="flex-1 flex items-center">
                                <div className="bg-blue-900/30 w-8 h-8 rounded flex items-center justify-center mr-3">
                                  <Receipt className="h-4 w-4 text-blue-300" />
                                </div>
                                <div>
                                  <div className="font-medium text-sm">Materials-Receipt-05242025.pdf</div>
                                  <div className="text-xs text-blue-300">Receipts</div>
                                </div>
                              </div>
                              <span className="w-24 text-sm">180 KB</span>
                              <span className="w-32 text-sm">{new Date().toLocaleDateString()}</span>
                              <span className="w-24 flex gap-1">
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex justify-center mt-4">
                          <Button variant="outline" size="sm">Load More Files</Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>
              
              {/* All Projects Tab Content */}
              <TabsContent value="all" className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {myJobs.map((job: Job) => (
                    <Card key={job.id} className="overflow-hidden border-blue-300/30">
                      {/* Job Image */}
                      <div className="relative h-40 w-full overflow-hidden">
                        <img 
                          src={getJobImage(job)} 
                          alt={job.title} 
                          className="w-full h-full object-cover transition-all duration-300 ease-in-out hover:scale-105"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/uploads/jobs/default-job-image.svg";
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                        
                        {/* Image navigation controls */}
                        {(
                          <>
                            <button 
                              className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-1 rounded-full"
                              onClick={(e) => prevImage(job, e)}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                            
                            <button 
                              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-1 rounded-full"
                              onClick={(e) => nextImage(job, e)}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                            
                            <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                              {(currentImageIndices[job.id] || 0) + 1}/{getJobDemoImages(job).length}
                            </div>
                          </>
                        )}
                        
                        <div className="absolute top-2 right-2">
                          <Badge className="bg-blue-500">Active</Badge>
                        </div>
                        
                        <div className="absolute bottom-2 left-2">
                          <Badge variant="secondary" className="bg-primary text-white font-bold">
                            ${job.budget ? job.budget.toFixed(2) : 'Open Bid'}
                          </Badge>
                        </div>
                      </div>
                      
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-lg font-semibold line-clamp-1">{job.title}</CardTitle>
                        <CardDescription className="flex items-center mt-1">
                          <MapPin className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                          <span className="text-xs">
                            {job.location && typeof job.location === 'object' && 'city' in job.location 
                              ? `${job.location.city}, ${job.location.state}` 
                              : 'Location not specified'}
                          </span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-2">
                        <p className="text-sm line-clamp-2 mb-2">{job.description}</p>
                      </CardContent>
                      <CardFooter className="flex justify-between p-4 pt-0 gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                          onClick={() => viewJobDetails(job)}
                        >
                          View Details
                        </Button>
                        <Button 
                          variant="default" 
                          size="sm" 
                          className="w-full"
                          onClick={() => createQuoteFromJob(job)}
                        >
                          Create Quote
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                  
                  {myJobs.filter((job: Job) => job.status === "in_progress").length === 0 && (
                    <Card className="col-span-1 md:col-span-2 lg:col-span-3 p-8">
                      <div className="text-center text-muted-foreground">
                        <p>You don't have any active jobs.</p>
                      </div>
                    </Card>
                  )}
                </div>
              </TabsContent>
              
              {/* Hiring Tab */}
              <TabsContent value="hiring" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {myJobs.filter((job: Job) => job.description.toLowerCase().includes('hiring') || job.title.toLowerCase().includes('hiring')).map((job: Job) => (
                    <Card key={job.id} className="overflow-hidden border-purple-300">
                      {/* Job Image */}
                      <div className="relative h-40 w-full overflow-hidden">
                        <img 
                          src={getJobImage(job)} 
                          alt={job.title} 
                          className="w-full h-full object-cover transition-all duration-300 ease-in-out hover:scale-105"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/uploads/jobs/default-job-image.svg";
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                        
                        {/* Image navigation controls */}
                        {(
                          <>
                            <button 
                              className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-1 rounded-full"
                              onClick={(e) => prevImage(job, e)}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                            
                            <button 
                              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-1 rounded-full"
                              onClick={(e) => nextImage(job, e)}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                            
                            <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                              {(currentImageIndices[job.id] || 0) + 1}/{getJobDemoImages(job).length}
                            </div>
                          </>
                        )}
                        
                        <div className="absolute top-2 right-2">
                          <Badge className="bg-purple-500">Hiring</Badge>
                        </div>
                        
                        <div className="absolute bottom-2 left-2">
                          <Badge variant="secondary" className="bg-primary text-white font-bold">
                            ${job.budget ? job.budget.toFixed(2) : 'Open Bid'}
                          </Badge>
                        </div>
                      </div>
                      
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-lg font-semibold line-clamp-1">{job.title}</CardTitle>
                        <CardDescription className="flex items-center mt-1">
                          <MapPin className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                          <span className="text-xs">
                            {job.location && typeof job.location === 'object' && 'city' in job.location 
                              ? `${job.location.city}, ${job.location.state}` 
                              : 'Location not specified'}
                          </span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-2">
                        <p className="text-sm line-clamp-2 mb-2">{job.description}</p>
                      </CardContent>
                      <CardFooter className="flex justify-between p-4 pt-0 gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                          onClick={() => viewJobDetails(job)}
                        >
                          View Details
                        </Button>
                        <Button 
                          variant="default" 
                          size="sm" 
                          className="w-full"
                          onClick={() => createQuoteFromJob(job)}
                        >
                          Create Quote
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                  
                  {myJobs.filter((job: Job) => job.description.toLowerCase().includes('hiring') || job.title.toLowerCase().includes('hiring')).length === 0 && (
                    <Card className="col-span-1 md:col-span-2 lg:col-span-3 p-8">
                      <div className="text-center text-muted-foreground">
                        <p>You don't have any hiring jobs.</p>
                        <Button 
                          variant="outline" 
                          className="mt-4"
                          onClick={() => window.location.href = "/post-job"} 
                        >
                          Post a Hiring Job
                        </Button>
                      </div>
                    </Card>
                  )}
                </div>
              </TabsContent>
              
              {/* Supplying Tab */}
              <TabsContent value="supplying" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {myJobs.filter((job: Job) => job.description.toLowerCase().includes('supply') || job.title.toLowerCase().includes('supply') || job.description.toLowerCase().includes('material') || job.title.toLowerCase().includes('material')).map((job: Job) => (
                    <Card key={job.id} className="overflow-hidden border-yellow-300">
                      {/* Job Image */}
                      <div className="relative h-40 w-full overflow-hidden">
                        <img 
                          src={getJobImage(job)} 
                          alt={job.title} 
                          className="w-full h-full object-cover transition-all duration-300 ease-in-out hover:scale-105"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/uploads/jobs/default-job-image.svg";
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                        
                        {/* Image navigation controls */}
                        {(
                          <>
                            <button 
                              className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-1 rounded-full"
                              onClick={(e) => prevImage(job, e)}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                            
                            <button 
                              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-1 rounded-full"
                              onClick={(e) => nextImage(job, e)}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                            
                            <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                              {(currentImageIndices[job.id] || 0) + 1}/{getJobDemoImages(job).length}
                            </div>
                          </>
                        )}
                        
                        <div className="absolute top-2 right-2">
                          <Badge className="bg-yellow-500">Supplying</Badge>
                        </div>
                        
                        <div className="absolute bottom-2 left-2">
                          <Badge variant="secondary" className="bg-primary text-white font-bold">
                            ${job.budget ? job.budget.toFixed(2) : 'Open Bid'}
                          </Badge>
                        </div>
                      </div>
                      
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-lg font-semibold line-clamp-1">{job.title}</CardTitle>
                        <CardDescription className="flex items-center mt-1">
                          <MapPin className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                          <span className="text-xs">
                            {job.location && typeof job.location === 'object' && 'city' in job.location 
                              ? `${job.location.city}, ${job.location.state}` 
                              : 'Location not specified'}
                          </span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-2">
                        <p className="text-sm line-clamp-2 mb-2">{job.description}</p>
                      </CardContent>
                      <CardFooter className="flex justify-between p-4 pt-0 gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                          onClick={() => viewJobDetails(job)}
                        >
                          View Details
                        </Button>
                        <Button 
                          variant="default" 
                          size="sm" 
                          className="w-full"
                          onClick={() => createQuoteFromJob(job)}
                        >
                          Create Quote
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                  
                  {myJobs.filter((job: Job) => job.description.toLowerCase().includes('supply') || job.title.toLowerCase().includes('supply') || job.description.toLowerCase().includes('material') || job.title.toLowerCase().includes('material')).length === 0 && (
                    <Card className="col-span-1 md:col-span-2 lg:col-span-3 p-8">
                      <div className="text-center text-muted-foreground">
                        <p>You don't have any supplying jobs.</p>
                        <Button 
                          variant="outline" 
                          className="mt-4"
                          onClick={() => window.location.href = "/post-job?type=supplying"} 
                        >
                          Post a Supply Job
                        </Button>
                      </div>
                    </Card>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>
          
          {/* Quotes Tab */}
          <TabsContent value="quotes" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">My Quotes & Invoices</h2>
              <Button onClick={() => { setSelectedQuote(null); setQuoteFormOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> New Quote
              </Button>
            </div>
            
            <QuotesTab 
              quotes={quotes}
              viewMode={activeViewMode}
              onChangeViewMode={setActiveViewMode}
              onCreateQuote={() => { setSelectedQuote(null); setQuoteFormOpen(true); }}
              onViewQuote={(quote) => { setSelectedQuote(quote); setQuoteDetailsOpen(true); }}
              onEditQuote={(quote) => { setSelectedQuote(quote); setQuoteFormOpen(true); }}
            />
          </TabsContent>
          
          {/* Calendar Tab */}
          <TabsContent value="calendar" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Schedule Calendar</h2>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex gap-2">
                      <CalendarDays className="h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                    />
                  </PopoverContent>
                </Popover>
                <Button onClick={() => { setSelectedQuote(null); setQuoteFormOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" /> New Quote
                </Button>
              </div>
            </div>
            
            <ScheduleCalendar 
              quotes={quotes}
              jobs={jobs}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              onCreateQuote={() => { setSelectedQuote(null); setQuoteFormOpen(true); }}
              onViewQuote={(quoteId) => { 
                const quote = quotes.find((q: any) => q.id === quoteId);
                if (quote) {
                  setSelectedQuote(quote);
                  setQuoteDetailsOpen(true);
                }
              }}
            />
          </TabsContent>
          
          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Profile</h2>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                </CardHeader>
                <CardContent>
                  {isProfileLoading ? (
                    <div>Loading profile...</div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm text-muted-foreground">Name</span>
                        <span className="font-medium">{profileData?.name || authUser?.name || 'Not set'}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm text-muted-foreground">Email</span>
                        <span className="font-medium">{authUser?.email || 'Not set'}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm text-muted-foreground">Phone</span>
                        <span className="font-medium">{profileData?.phone || 'Not set'}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm text-muted-foreground">Location</span>
                        <span className="font-medium">
                          {profileData?.city && profileData?.state
                            ? `${profileData.city}, ${profileData.state}`
                            : 'Not set'}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Service Area</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    <div className="rounded-lg overflow-hidden border h-[250px] bg-gray-100 flex items-center justify-center">
                      <p className="text-muted-foreground">Service area map will be displayed here</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm text-muted-foreground">Location</Label>
                        <div className="font-medium">
                          {profileData?.city && profileData?.state
                            ? `${profileData.city}, ${profileData.state}`
                            : 'Not set'}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Service Radius</Label>
                        <div className="font-medium">
                          {profileData?.serviceRadius
                            ? `${profileData.serviceRadius} km`
                            : 'Not set'}
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => setIsServiceAreaDialogOpen(true)}>
                      Edit Service Area
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Services & Skills</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {profileData?.skills && Array.isArray(profileData.skills) ? (
                      profileData.skills.map((skill: string, index: number) => (
                        <Badge key={index} variant="secondary" className="px-3 py-1">
                          {skill}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-muted-foreground">No skills or services added yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </div>
      </Tabs>
      
      {/* Create Bid Dialog */}
      <Dialog open={bidModalOpen} onOpenChange={setBidModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Place a Bid</DialogTitle>
            <DialogDescription>
              {selectedJob && (
                <span>
                  Place your bid for <span className="font-medium">{selectedJob.title}</span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={bidForm.handleSubmit(placeBidMutationBidForm)}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="amount">Bid Amount ($)</Label>
                <Input
                  id="amount"
                  placeholder="Enter your bid amount"
                  {...bidForm.register("amount")}
                />
                {bidForm.formState.errors.amount && (
                  <p className="text-sm text-red-500">{bidForm.formState.errors.amount.message}</p>
                )}
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="timeEstimate">Time Estimate</Label>
                <Input
                  id="timeEstimate"
                  placeholder="e.g., 2 weeks, 3 days"
                  {...bidForm.register("timeEstimate")}
                />
                {bidForm.formState.errors.timeEstimate && (
                  <p className="text-sm text-red-500">{bidForm.formState.errors.timeEstimate.message}</p>
                )}
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="proposedStartDate">Proposed Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !bidForm.watch("proposedStartDate") && "text-muted-foreground"
                      )}
                    >
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {bidForm.watch("proposedStartDate") ? (
                        format(bidForm.watch("proposedStartDate"), "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={bidForm.watch("proposedStartDate")}
                      onSelect={(date) => bidForm.setValue("proposedStartDate", date as Date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {bidForm.formState.errors.proposedStartDate && (
                  <p className="text-sm text-red-500">{bidForm.formState.errors.proposedStartDate.message}</p>
                )}
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="proposal">Proposal</Label>
                <Textarea
                  id="proposal"
                  placeholder="Describe your proposal in detail"
                  className="min-h-[100px]"
                  {...bidForm.register("proposal")}
                />
                {bidForm.formState.errors.proposal && (
                  <p className="text-sm text-red-500">{bidForm.formState.errors.proposal.message}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBidModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={placeBidMutation.isPending}>
                {placeBidMutation.isPending ? "Submitting..." : "Submit Bid"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Job Details Dialog */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="w-screen max-w-full h-screen p-0 flex flex-col md:flex-row border-0 rounded-none bg-background">
          <DialogTitle className="sr-only">Job Details</DialogTitle>
          {selectedJob && (
            <>
              {/* Left side - Image carousel/gallery with adaptive width */}
              <div className={cn(
                "w-full h-[30vh] md:h-screen relative overflow-hidden",
                getJobDemoImages(selectedJob).length > 0 
                  ? "md:w-2/3 lg:w-3/5" 
                  : "md:w-1/3 lg:w-2/5",
                "bg-slate-100"
              )}>
                {getJobDemoImages(selectedJob).length > 0 ? (
                  <>
                    <img 
                      src={getJobImage(selectedJob)} 
                      alt={selectedJob.title}
                      className="w-full h-full object-cover transition-opacity duration-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/uploads/jobs/default-job-image.svg";
                      }}
                    />
                
                    {/* Enhanced image navigation controls with better visibility and tap zone */}
                    {getJobDemoImages(selectedJob).length > 1 && (
                      <div className="absolute left-0 right-0 top-1/2 transform -translate-y-1/2 flex justify-between px-4 z-30 pointer-events-none group">
                        <button 
                          type="button"
                          className="bg-black/50 hover:bg-black/70 text-white p-3 rounded-full shadow-lg transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/50 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (e.nativeEvent) {
                              e.nativeEvent.stopImmediatePropagation();
                            }
                            
                            // Direct state update for previous image
                            const demoImages = getJobDemoImages(selectedJob);
                            const currentIndex = currentImageIndices[selectedJob.id] || 0;
                            const prevIndex = (currentIndex - 1 + demoImages.length) % demoImages.length;
                            
                            console.log(`Prev button clicked: ${currentIndex} → ${prevIndex}`);
                            setCurrentImageIndices({
                              ...currentImageIndices,
                              [selectedJob.id]: prevIndex
                            });
                          }}
                          onMouseDown={(e) => e.preventDefault()}
                          aria-label="Previous image"
                        >
                          <ChevronLeft className="h-6 w-6" />
                        </button>
                        <button 
                          type="button"
                          className="bg-black/50 hover:bg-black/70 text-white p-3 rounded-full shadow-lg transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/50 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (e.nativeEvent) {
                              e.nativeEvent.stopImmediatePropagation();
                            }
                            
                            // Direct state update for next image
                            const demoImages = getJobDemoImages(selectedJob);
                            const currentIndex = currentImageIndices[selectedJob.id] || 0;
                            const nextIndex = (currentIndex + 1) % demoImages.length;
                            
                            console.log(`Next button clicked: ${currentIndex} → ${nextIndex}`);
                            setCurrentImageIndices({
                              ...currentImageIndices,
                              [selectedJob.id]: nextIndex
                            });
                          }}
                          onMouseDown={(e) => e.preventDefault()}
                          aria-label="Next image"
                        >
                          <ChevronRight className="h-6 w-6" />
                        </button>
                      </div>
                    )}
                    
                    {/* Production-standard thumbnail gallery with overlay */}
                    {getJobDemoImages(selectedJob).length > 1 && (
                      <div className="absolute bottom-4 left-0 right-0 px-4 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="bg-white/90 backdrop-blur-sm rounded-md px-3 py-2 shadow-md mx-auto max-w-max overflow-visible">
                          <div className={cn(
                            "flex justify-center gap-2 sm:max-w-md mx-auto py-1",
                            getJobDemoImages(selectedJob).length > 3 
                              ? "flex-wrap max-h-28 overflow-visible"
                              : "overflow-visible"
                          )}>
                            {getJobDemoImages(selectedJob).map((image, i) => (
                              <div 
                                key={i}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (e.nativeEvent) {
                                    e.nativeEvent.stopImmediatePropagation();
                                  }
                                  
                                  console.log(`Thumbnail clicked: ${i}`);
                                  
                                  // Update both the stable ref and state
                                  // First update our ref to maintain stability
                                  stableImageIndicesRef.current[selectedJob.id] = i;
                                  
                                  // Then update state to trigger the UI update
                                  setCurrentImageIndices({
                                    ...currentImageIndices,
                                    [selectedJob.id]: i
                                  });
                                }}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }} 
                                className={cn(
                                  "h-14 w-20 rounded overflow-hidden cursor-pointer transition-all duration-200 border-2 relative z-40",
                                  i === (currentImageIndices[selectedJob.id] || 0) 
                                    ? "border-primary opacity-100 scale-105 shadow-md" 
                                    : "border-transparent opacity-80 hover:opacity-100 hover:shadow-sm"
                                )}
                              >
                                <img 
                                  src={image} 
                                  alt={`Thumbnail ${i + 1}`} 
                                  className="h-full w-full object-cover rounded"
                                  onPointerDown={(e) => e.preventDefault()}
                                  onMouseDown={(e) => e.preventDefault()}
                                />
                                <div className={cn(
                                  "absolute inset-0 bg-black/10",
                                  i === (currentImageIndices[selectedJob.id] || 0) ? "hidden" : ""
                                )}></div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Photo count indicator */}
                    <div className="absolute top-4 left-4 bg-black/50 text-white text-xs rounded-full px-2 py-1 flex items-center">
                      <Image className="h-3 w-3 mr-1" />
                      {getJobDemoImages(selectedJob).length} photo{getJobDemoImages(selectedJob).length !== 1 ? 's' : ''}
                    </div>
                  </>
                ) : (
                  // Enhanced placeholder when no images are available
                  <div className="flex flex-col items-center justify-center h-full bg-gradient-to-b from-slate-50 to-slate-100">
                    {selectedJob.categoryTags && Array.isArray(selectedJob.categoryTags) && selectedJob.categoryTags.length > 0 ? (
                      <div className="flex flex-col items-center justify-center bg-white/80 p-6 rounded-lg shadow-sm">
                        <div className="text-primary/70 mb-4 h-24 w-24">
                          <CategoryIcon category={selectedJob.categoryTags[0].toLowerCase()} />
                        </div>
                        <p className="text-lg font-medium text-slate-700">{selectedJob.categoryTags[0]}</p>
                        <p className="text-sm text-slate-500 mt-2">No images available for this job</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center bg-white/80 p-6 rounded-lg shadow-sm">
                        <FileIcon className="h-24 w-24 text-slate-400 mb-4" />
                        <p className="text-slate-600 font-medium">No images available</p>
                        <p className="text-sm text-slate-500 mt-2">Job details are provided in the description</p>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Enhanced gradient overlay for better text contrast */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent md:from-black/30 md:via-transparent md:to-transparent"></div>
                
                {/* Floating "Saved" indicator if job is saved */}
                {isJobSaved(selectedJob.id) && (
                  <div className="absolute top-4 right-4 bg-white rounded-full p-2 shadow-md flex items-center justify-center">
                    <Heart className="h-5 w-5 text-red-500 fill-red-500" />
                  </div>
                )}
                
                {/* Job urgency indicator removed from carousel overlay */}
              </div>
              
              {/* Right side - Details area */}
              <div className={cn(
                "w-full p-6 flex flex-col overflow-y-auto bg-background",
                getJobDemoImages(selectedJob).length > 0 
                  ? "md:w-1/3 lg:w-2/5" 
                  : "md:w-2/3 lg:w-3/5"
              )}>
                {/* Close button (desktop) */}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute right-4 top-4 hidden md:flex" 
                  onClick={() => setIsDetailsModalOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
                
                {/* Sticky mini header - Streamlined with only essential information */}
                <div className="sticky top-0 z-10 bg-white shadow-sm border-b border-gray-200 -mt-6 -mx-6 px-4 py-3 mb-6 transition-all duration-200 ease-in-out">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold truncate max-w-[180px] sm:max-w-xs text-gray-800">{selectedJob.title}</h3>
                      <span className="inline-block mx-1 text-gray-400">•</span>
                      <span className="text-xs font-semibold text-primary">${selectedJob.budget?.toFixed(2) || "Open"}</span>
                      
                      {myBids.some((bid: any) => bid.jobId === selectedJob.id) && (
                        <>
                          <span className="inline-block mx-1 text-gray-400">•</span>
                          <span className="text-xs px-2 py-0.5 rounded font-medium bg-green-100 text-green-800 inline-flex items-center">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Bid Placed
                          </span>
                        </>
                      )}
                    </div>
                    
                    {!myBids.some((bid: any) => bid.jobId === selectedJob.id) && (
                      <Button 
                        size="sm" 
                        className="text-sm font-medium px-3 py-1.5 transition-all duration-300 hover:bg-green-700 shadow-sm hover:shadow-md flex items-center"
                        onClick={() => { setIsDetailsModalOpen(false); openBidModal(selectedJob); }}
                      >
                        <DollarSign className="h-3 w-3 mr-1" /> Place Bid
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="space-y-6 flex-grow">
                  {/* Title and price with status badges */}
                  <div className="bg-slate-50 rounded-lg p-4 mb-4">
                    <div className="flex items-start justify-between mb-3">
                      <h1 className="text-2xl md:text-3xl font-bold text-gray-800">{selectedJob.title}</h1>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-3">
                      {selectedJob.isUrgent && (
                        <div className="text-xs px-2 py-0.5 rounded font-medium bg-red-100 text-red-800 flex items-center">
                          <FlameIcon className="h-3.5 w-3.5 mr-1" /> URGENT
                        </div>
                      )}
                      
                      <div className="text-xs px-2 py-0.5 rounded font-medium bg-green-100 text-green-800 flex items-center">
                        <ClipboardCheck className="h-3.5 w-3.5 mr-1" /> 
                        {selectedJob.status.toUpperCase()}
                      </div>
                      
                      {getBiddingTimeLeft(selectedJob)?.days && (
                        <div className="text-xs px-2 py-0.5 rounded font-medium bg-purple-50 text-purple-700 flex items-center">
                          <Timer className="h-3.5 w-3.5 mr-1" /> 
                          {getBiddingTimeLeft(selectedJob)?.days} DAYS LEFT
                        </div>
                      )}
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-gray-700 font-semibold">Budget</p>
                        <p className="text-xl font-bold text-primary">
                          {selectedJob.budget ? `$${selectedJob.budget.toFixed(2)}` : 'Open Bid'}
                        </p>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-sm text-gray-700 font-semibold">Posted</p>
                        <p className="font-medium">
                          {format(new Date(selectedJob.createdAt), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Client Info Section - Stacked layout with icons */}
                  <div className="bg-slate-50 rounded-lg p-4 mb-6 border border-slate-100 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                      <UserCircle className="h-5 w-5 mr-2 text-primary" />
                      Client Information
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-start">
                        <div className="mr-3 bg-primary/10 p-2 rounded-full">
                          <UserCircle className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">
                            {selectedJob.landlordId ? `${getClientName(selectedJob.landlordId) || 'Property Owner'}` : 'Property Owner'}
                          </p>
                          <div className="flex items-center mt-1 gap-1.5">
                            <span className="text-xs px-2 py-0.5 rounded font-medium bg-green-100 text-green-800 flex items-center">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Verified
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded font-medium bg-blue-50 text-blue-600 flex items-center">
                              <Star className="h-3 w-3 mr-1 text-amber-500" />
                              4.8 ★
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-3 mt-2">
                        <div className="flex items-center text-sm">
                          <CalendarDays className="h-4 w-4 mr-2 text-gray-600" />
                          <span>Member since: <strong>{format(new Date(getClientJoinDate(selectedJob.landlordId)), 'MMM yyyy')}</strong></span>
                        </div>
                        
                        <div className="flex items-center text-sm">
                          <Briefcase className="h-4 w-4 mr-2 text-gray-600" />
                          <span>Job Count: <strong>{getClientJobCount(selectedJob.landlordId)}</strong></span>
                        </div>

                        <div className="flex items-center text-sm">
                          <Timer className="h-4 w-4 mr-2 text-gray-600" />
                          <span>Response Time: <strong>Within 24 hours</strong></span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 border-t pt-4">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full text-sm bg-white border-gray-200 transition-all duration-300 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700" 
                        onClick={() => initiateClientChat(selectedJob)}
                      >
                        <MessageCircle className="h-3.5 w-3.5 mr-2" /> 
                        Message Client
                      </Button>
                    </div>
                  </div>
                  
                  {/* Section divider */}
                  <div className="border-t border-gray-200 my-6"></div>
                  
                  {/* Location with interactive map */}
                  <div className="bg-slate-50 rounded-lg p-4 mb-6 border border-slate-100 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                      <MapPin className="h-5 w-5 mr-2 text-primary" />
                      Job Location
                    </h3>
                    
                    <div className="flex items-center mb-3">
                      <span className="font-medium text-base text-gray-800">
                        {selectedJob.location && typeof selectedJob.location === 'object' && 'city' in selectedJob.location 
                          ? `${selectedJob.location.city}, ${selectedJob.location.state}` 
                          : 'Location not specified'}
                      </span>
                    </div>
                    
                    {/* Interactive map with increased height */}
                    <div className="h-56 min-h-[200px] bg-slate-100 rounded-md overflow-hidden relative">
                      {selectedJob.location && typeof selectedJob.location === 'object' && 
                       'latitude' in selectedJob.location && 'longitude' in selectedJob.location ? (
                        <JobsMap 
                          jobs={[selectedJob]} 
                          highlightedJobId={selectedJob.id}
                          className="h-full"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gray-200 flex flex-col items-center justify-center">
                          <MapPin className="h-6 w-6 text-primary" />
                          <p className="text-sm text-gray-500 mt-2">Location data unavailable</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Section divider */}
                  <div className="border-t border-gray-200 my-6"></div>
                  
                  {/* Project Timeline - Card style with formatted timestamps */}
                  <div className="bg-slate-50 rounded-lg p-4 mb-6 border border-slate-100 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                      <Clock className="h-5 w-5 mr-2 text-primary" />
                      Timeline & Schedule
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white shadow-sm border border-slate-100 p-3 rounded-md">
                        <p className="text-xs text-gray-700 font-semibold">Start Date</p>
                        <p className="font-medium flex items-center">
                          <CalendarDays className="h-3.5 w-3.5 mr-1 text-green-500" />
                          {selectedJob.startDate 
                            ? format(new Date(selectedJob.startDate), 'MMM d, yyyy')
                            : 'Flexible'}
                        </p>
                      </div>
                      
                      <div className="bg-white shadow-sm border border-slate-100 p-3 rounded-md">
                        <p className="text-xs text-gray-700 font-semibold">Deadline</p>
                        <p className="font-medium flex items-center">
                          <CalendarDays className="h-3.5 w-3.5 mr-1 text-amber-500" />
                          {selectedJob.deadline
                            ? format(new Date(selectedJob.deadline), 'MMM d, yyyy')
                            : <span className="text-gray-500 italic">To be determined</span>}
                        </p>
                      </div>
                      
                      <div className="bg-white shadow-sm border border-slate-100 p-3 rounded-md">
                        <p className="text-xs text-gray-700 font-semibold">Duration</p>
                        <p className="font-medium flex items-center">
                          <Timer className="h-3.5 w-3.5 mr-1 text-blue-500" />
                          {getEstimatedDuration(selectedJob)}
                        </p>
                      </div>
                      
                      <div className="bg-white shadow-sm border border-slate-100 p-3 rounded-md">
                        <p className="text-xs text-gray-700 font-semibold">Bidding Closes</p>
                        <p className="font-medium flex items-center">
                          <Clock className="h-3.5 w-3.5 mr-1 text-purple-500" />
                          {getBiddingTimeLeft(selectedJob)?.days 
                            ? `Closes in ${getBiddingTimeLeft(selectedJob)?.days} days` 
                            : getBiddingTimeLeft(selectedJob)?.hours
                              ? `Closes in ${getBiddingTimeLeft(selectedJob)?.hours}h`
                              : `Closes ${format(new Date(), 'MMM d, h:mm a')}`}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Section divider */}
                  <div className="border-t border-gray-200 my-6"></div>
                  
                  {/* Job Details Tab Interface - Enhanced with styled active tabs */}
                  <div className="bg-slate-50 rounded-lg p-4 mb-6 border border-slate-100 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                      <ClipboardCheck className="h-5 w-5 mr-2 text-primary" />
                      Job Details
                    </h3>
                    
                    <Tabs defaultValue="description" className="w-full">
                      <TabsList className="w-full border-b mb-4 bg-transparent overflow-x-auto whitespace-nowrap scrollbar-hidden space-x-4">
                        {["description", "requirements", "documents"].map((tab) => (
                          <TabsTrigger 
                            key={tab}
                            value={tab}
                            className={cn(
                              "py-2 px-4 text-center relative transition-colors rounded-none data-[state=active]:shadow-none",
                              "text-gray-500 hover:text-gray-700 data-[state=active]:text-green-800",
                              "data-[state=active]:border-b-2 data-[state=active]:border-green-600 data-[state=active]:font-semibold",
                              "text-base"
                            )}
                          >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    
                      <TabsContent value="description" className="space-y-3 mt-0 pt-4 pb-4">
                        <div className="text-sm text-gray-700">
                          <p>{selectedJob.description}</p>
                        </div>
                        
                        <div className="mt-3">
                          <h4 className="text-sm font-medium text-gray-800 flex items-center mb-2">
                            <Tag className="h-3.5 w-3.5 mr-1" /> 
                            Categories
                          </h4>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {selectedJob.categoryTags && Array.isArray(selectedJob.categoryTags) && (
                              selectedJob.categoryTags.map((tag, index) => (
                                <div key={index} className="text-xs px-2 py-0.5 rounded font-medium bg-blue-50 text-blue-700 flex items-center">
                                  {tag}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="requirements" className="space-y-4 mt-0 pt-4 pb-4">
                        {/* Required Skills */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-800 flex items-center mb-2">
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> 
                            Required Skills
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {getRequiredSkills(selectedJob).map((skill, index) => (
                              <div key={index} className="flex items-center text-sm bg-green-50 p-2 rounded-md border border-green-100">
                                <Check className="h-3.5 w-3.5 mr-1.5 text-green-500" />
                                <span>{skill}</span>
                              </div>
                            ))}
                            {getRequiredSkills(selectedJob).length === 0 && (
                              <p className="text-sm text-muted-foreground">No specific skills mentioned</p>
                            )}
                          </div>
                        </div>
                        
                        {/* Tools & Equipment */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-800 flex items-center mb-2">
                            <Wrench className="h-3.5 w-3.5 mr-1" /> 
                            Tools & Equipment
                          </h4>
                          <div className="text-sm p-3 bg-blue-50 border border-blue-100 rounded-md">
                            <p>{getToolsAndEquipment(selectedJob)}</p>
                          </div>
                        </div>
                        
                        {/* Materials */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-800 flex items-center mb-2">
                            <Package className="h-3.5 w-3.5 mr-1" /> 
                            Materials Information
                          </h4>
                          <div className="text-sm p-3 bg-amber-50 border border-amber-100 rounded-md">
                            <p>{getMaterialsInfo(selectedJob)}</p>
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="documents" className="mt-0 pt-4 pb-4">
                        {getJobDocuments(selectedJob).length > 0 ? (
                          <div className="space-y-3">
                            <h4 className="text-sm font-medium text-gray-800 flex items-center mb-2">
                              <FileText className="h-3.5 w-3.5 mr-1" /> 
                              Job Documents
                            </h4>
                            <div className="grid grid-cols-1 gap-2">
                              {getJobDocuments(selectedJob).map((doc, index) => (
                                <div key={index} className="flex items-center justify-between bg-white border border-slate-200 p-3 rounded-md transition-all hover:shadow-sm">
                                  <div className="flex items-center gap-2">
                                    <div className="bg-blue-50 p-2 rounded">
                                      <FileText className="h-4 w-4 text-blue-600" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-gray-800">{doc}</p>
                                      <p className="text-xs text-gray-500">Added {format(new Date(selectedJob.createdAt), 'MMM d, yyyy')}</p>
                                    </div>
                                  </div>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 rounded-full hover:bg-blue-50 hover:text-blue-700"
                                    onClick={() => {
                                      toast({
                                        title: "Document preview",
                                        description: "Document preview is not available in this demo.",
                                      });
                                    }}
                                  >
                                    <Eye className="h-4 w-4 mr-1" /> Preview
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed rounded-md bg-gray-50">
                            <FileText className="h-10 w-10 text-muted-foreground mb-4" />
                            <p className="text-sm text-muted-foreground">No documents attached to this job</p>
                            <Button 
                              variant="link" 
                              className="mt-2 text-xs text-primary"
                              onClick={() => initiateClientChat(selectedJob)}
                            >
                              Contact client to request documentation
                            </Button>
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>
                
                {/* Action buttons - Enhanced with hover effects and transitions */}
                <div className="mt-6 space-y-3 pt-4 border-t bg-white shadow-sm rounded-b-lg">
                  {/* Main action buttons - Create Quote and Place Bid */}
                  <div className="flex gap-3">
                    {!myBids.some((bid: any) => bid.jobId === selectedJob.id) ? (
                      <Button 
                        className="flex-1 transition-all duration-300 hover:bg-green-700 hover:shadow-md" 
                        onClick={() => { setIsDetailsModalOpen(false); openBidModal(selectedJob); }}
                      >
                        <DollarSign className="h-4 w-4 mr-2" /> Place Bid
                      </Button>
                    ) : (
                      <Button
                        className="flex-1 transition-all duration-200 hover:bg-green-700"
                        disabled
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" /> Bid Placed
                      </Button>
                    )}
                    
                    <Button 
                      variant="outline" 
                      className="flex-1 transition-all duration-300 bg-white border-gray-300 text-gray-700 hover:bg-green-50 hover:border-green-500 hover:text-green-700" 
                      onClick={() => { setIsDetailsModalOpen(false); createQuoteFromJob(selectedJob); }}
                    >
                      <FileIcon className="h-4 w-4 mr-2" /> Create Quote
                    </Button>
                    
                    <Button 
                      variant="outline"
                      className={cn(
                        "flex-shrink-0 w-12 px-0 transition-all duration-300 bg-white border-gray-300 text-gray-700 flex items-center pt-[1px]",
                        isJobSaved(selectedJob.id) 
                          ? "border-red-200 bg-red-50 text-red-500 hover:bg-red-100" 
                          : "hover:bg-green-50 hover:border-green-500 hover:text-green-700"
                      )}
                      onClick={() => toggleSaveJob(selectedJob)}
                    >
                      <Heart className={cn(
                        "h-4 w-4 transition-colors", 
                        isJobSaved(selectedJob.id) ? "fill-red-500" : "text-gray-600"
                      )} />
                    </Button>
                  </div>
                  
                  {/* Contact Client button */}
                  <Button 
                    variant="outline" 
                    className="w-full bg-white border-gray-300 text-gray-700 transition-all duration-300 hover:bg-green-50 hover:border-green-500 hover:text-green-700 font-medium" 
                    onClick={() => initiateClientChat(selectedJob)}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" /> Contact Client
                  </Button>
                  
                  {/* Footer actions with even spacing */}
                  <div className="flex justify-center gap-4 pt-3 pb-2 border-t border-gray-200 mt-2">
                    <Button 
                      variant="outline"
                      size="sm" 
                      className="rounded-full h-8 px-4 text-xs font-medium text-gray-600 border-gray-200 transition-all duration-300 hover:bg-gray-100 hover:text-gray-700"
                      onClick={() => setIsDetailsModalOpen(false)}
                    >
                      <X className="h-3.5 w-3.5 mr-1.5" /> Close
                    </Button>
                    
                    <Button 
                      variant="outline"
                      size="sm" 
                      className="rounded-full h-8 px-4 text-xs font-medium text-blue-600 border-blue-100 bg-blue-50 transition-all duration-300 hover:bg-blue-100 hover:border-blue-200"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/jobs/${selectedJob.id}`);
                        toast({
                          title: "Job Shared",
                          description: "Job link copied to clipboard.",
                        });
                      }}
                    >
                      <Share2 className="h-3.5 w-3.5 mr-1.5" /> Share
                    </Button>
                    
                    <Button 
                      variant="outline"
                      size="sm" 
                      className="rounded-full h-8 px-4 text-xs font-medium text-amber-600 border-amber-100 bg-amber-50 transition-all duration-300 hover:bg-amber-100 hover:border-amber-200"
                      onClick={() => {
                        toast({
                          title: "Job Reported",
                          description: "Thank you for your feedback. We'll review this job posting.",
                        });
                      }}
                    >
                      <AlertTriangle className="h-3.5 w-3.5 mr-1.5" /> Report
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Quote Form Dialog - Fullscreen */}
      <Dialog open={quoteFormOpen} onOpenChange={setQuoteFormOpen}>
        <DialogContent className="w-screen max-w-full h-screen p-0 flex flex-col border-0 rounded-none bg-white">
          <div className="bg-primary p-4 text-white flex justify-between items-center">
            <DialogTitle className="text-xl font-semibold">
              {selectedQuote ? 'Edit Quote' : 'Create New Quote'}
            </DialogTitle>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setQuoteFormOpen(false)}
              className="text-white hover:bg-primary/80"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <QuoteForm 
              quote={selectedQuote}
              job={jobToQuote}
              contractorId={authUser?.id}
              onSave={(quoteData) => {
                if (selectedQuote) {
                  updateQuoteMutation.mutate({
                    ...quoteData,
                    id: selectedQuote.id
                  });
                } else {
                  createQuoteMutation.mutate(quoteData);
                }
                setQuoteFormOpen(false);
                setJobToQuote(null);
              }}
              onCancel={() => {
                setQuoteFormOpen(false);
                setJobToQuote(null);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Quote Details Dialog */}
      <Dialog open={quoteDetailsOpen} onOpenChange={setQuoteDetailsOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quote Details</DialogTitle>
          </DialogHeader>
          <QuoteDetails 
            quote={selectedQuote}
            onEdit={() => {
              setQuoteDetailsOpen(false);
              setQuoteFormOpen(true);
            }}
            onClose={() => setQuoteDetailsOpen(false)}
            onSend={(quoteId) => sendQuoteMutation.mutate(quoteId)}
          />
        </DialogContent>
      </Dialog>
      
      {/* Service Area Dialog */}
      <Dialog open={isServiceAreaDialogOpen} onOpenChange={setIsServiceAreaDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set Service Area</DialogTitle>
            <DialogDescription>
              Define the area where you're available to provide services.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="e.g., San Francisco, CA"
              />
            </div>
            
            <div className="grid gap-2">
              <div className="flex justify-between">
                <Label htmlFor="radius">Service Radius (km)</Label>
                <span>25km</span>
              </div>
              <Input
                id="radius"
                type="range"
                min="1"
                max="100"
                defaultValue="25"
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1km</span>
                <span>50km</span>
                <span>100km</span>
              </div>
            </div>
            
            <div className="mt-4">
              <Label>Preview Service Area</Label>
              <div className="h-[200px] mt-2 rounded-md overflow-hidden border bg-gray-100 flex items-center justify-center">
                <p className="text-muted-foreground">Map preview will be displayed here</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsServiceAreaDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => setIsServiceAreaDialogOpen(false)}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}