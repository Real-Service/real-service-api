import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Job, Bid, Transaction, LandlordProfile, User } from "@shared/schema";
import { 
  Loader2, Wallet, List, FileText, Home, DollarSign, Star, Search, Building, Clock, Calendar, MapPin, Edit, 
  Save, SlidersHorizontal, ChevronDown, ChevronUp, X, Filter, Pin, Info, RefreshCcw, CheckCircle2, XCircle,
  ImageIcon, MapIcon, MessageCircle, Briefcase, Heart, HeartOff, ShieldCheck, Shield, User as UserIcon, Bell, Settings, 
  ArrowUpRight, TrendingUp, Users, Layers, PieChart, SearchIcon, Upload, Camera, Plus, Check, LockKeyhole,
  MessageSquare, Phone, LogOut, Inbox, AlertCircle, CheckCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ReviewForm from "@/components/ReviewForm";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { UserProfileCard } from "@/components/UserProfileCard";
import { LocationSearch } from "@/components/LocationSearch";
import { TodayJobsOverview } from "@/components/TodayJobsOverview";
import { MobileNavigation } from "@/components/MobileNavigation";
import { ChatInterface } from "@/components/ChatInterface";
import { AdminTools } from "@/components/AdminTools";
import { MapboxAddressAutofill } from "@/components/MapboxAddressAutofill";
import { AVAILABLE_CATEGORIES, getCategoryValue, getCategoryDisplayName } from "@shared/constants";

const jobSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  address: z.string().min(2, "Please enter an address"),
  city: z.string().min(1, "Please enter a city").or(z.literal('')),
  state: z.string().min(1, "Please enter a state").or(z.literal('')),
  zipCode: z.string().min(1, "Please enter a zip code").or(z.literal('')),
  pricingType: z.enum(["fixed", "open_bid"]),
  budget: z.string().optional().or(z.literal('')),
  isUrgent: z.boolean().default(false),
  startDate: z.string().optional().or(z.literal('')),
  category: z.string({
    required_error: "Please select a category"
  }).refine(cat => AVAILABLE_CATEGORIES.includes(cat), {
    message: "Please select a valid category"
  }),
  images: z.array(z.string()).optional(),
});

type JobFormValues = z.infer<typeof jobSchema>;

export default function LandlordDashboard() {
  const { toast } = useToast();
  const { user: authUser, logoutMutation } = useAuth();
  const [activeSection, setActiveSection] = useState("inbox");
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [jobToReview, setJobToReview] = useState<Job | null>(null);
  const [contractorToReview, setContractorToReview] = useState<number | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [jobBids, setJobBids] = useState<Bid[]>([]);
  const [isBidsLoading, setIsBidsLoading] = useState(false);
  const [selectedBid, setSelectedBid] = useState<Bid | null>(null);
  const [isBidDetailsOpen, setIsBidDetailsOpen] = useState(false);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [activeJobStatus, setActiveJobStatus] = useState("all"); // Options: all, draft, open, in_progress, completed
  const [contractorProfiles, setContractorProfiles] = useState<{[key: number]: any}>({});

  // State for image upload
  const [images, setImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch landlord profile
  const { data: profile, isLoading: isProfileLoading } = useQuery<LandlordProfile>({
    queryKey: ["/api/landlord-profile", authUser?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/landlord-profile/${authUser?.id}`);
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
    enabled: !!authUser?.id,
  });

  // Fetch landlord's jobs
  const jobsQuery = useQuery<Job[]>({
    queryKey: ["/api/users", authUser?.id, "jobs"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/users/${authUser?.id}/jobs`);
      if (!res.ok) throw new Error("Failed to fetch jobs");
      return res.json();
    },
    enabled: !!authUser?.id,
  });

  // Fetch transactions
  const { data: transactions = [], isLoading: isTransactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/users", authUser?.id, "transactions"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/users/${authUser?.id}/transactions`);
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return res.json();
    },
    enabled: !!authUser?.id,
  });

  // Extract jobs data from jobsQuery
  const { data: jobs = [], isLoading: isJobsLoading } = jobsQuery;
  
  // Fetch all bids for landlord's jobs
  const { data: allBids = [], isLoading: isAllBidsLoading } = useQuery<Bid[]>({
    queryKey: ["/api/landlord", authUser?.id, "bids"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/landlord/${authUser?.id}/bids`);
      if (!res.ok) throw new Error("Failed to fetch bids");
      return res.json();
    },
    enabled: !!authUser?.id,
  });

  // Filter jobs based on search and filters
  const filteredJobs = useMemo(() => {
    if (!jobs?.length) return [];
    
    return jobs.filter((job: Job) => {
      // Filter by status tab
      if (activeJobStatus !== "all" && job.status !== activeJobStatus) return false;
      
      // Filter by status dropdown (additional filter)
      if (filterStatus !== "all" && job.status !== filterStatus) return false;
      
      // Filter by search query
      if (searchQuery && !job.title.toLowerCase().includes(searchQuery.toLowerCase()) 
          && !job.description.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Filter by category
      if (filterCategory !== "all") {
        const tags = Array.isArray(job.categoryTags) ? job.categoryTags.map(tag => getCategoryValue(tag)) : [];
        if (!tags.includes(filterCategory)) {
          return false;
        }
      }
      
      return true;
    });
  }, [jobs, searchQuery, filterCategory, filterStatus, activeJobStatus]);

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setIsUploading(true);
    
    try {
      const fileList = Array.from(e.target.files);
      const newImageUrls: string[] = [];
      
      for (const file of fileList) {
        // Convert file to base64 for simplicity (in a real app, you'd upload to cloud storage)
        const reader = new FileReader();
        const imageDataUrl = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        
        newImageUrls.push(imageDataUrl);
      }
      
      // Set the images in state and in the form
      setImages([...images, ...newImageUrls]);
      const currentImages = jobForm.getValues("images") || [];
      jobForm.setValue("images", [...currentImages, ...newImageUrls], { shouldValidate: true });
    } catch (error) {
      toast({
        title: "Image upload failed",
        description: "There was an error uploading your images. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Remove image
  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
    jobForm.setValue("images", newImages, { shouldValidate: true });
  };

  // Create job form
  const jobForm = useForm<JobFormValues>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      title: "",
      description: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      pricingType: "fixed",
      budget: "",
      isUrgent: false,
      startDate: "",
      category: undefined,
      images: [],
    },
  });

  // Create job mutation
  const createJobMutation = useMutation({
    mutationFn: async (data: JobFormValues) => {
      // Transform the location fields into the structure expected by the backend API
      const { address, city, state, zipCode, category, ...otherData } = data;
      
      // Make start date required if job is marked as urgent
      if (data.isUrgent && !data.startDate) {
        throw new Error("Start date is required for urgent jobs");
      }
      
      // Send data in the format expected by the server
      // The server expects individual address fields, not a location object
      const jobData = {
        ...otherData,
        address,
        city, 
        state,
        zipCode,
        category,
        pricingType: data.pricingType || "fixed", // Provide default if missing
        isUrgent: data.isUrgent || false,
        budget: data.budget ? parseFloat(data.budget) : undefined,
        status: "draft", // Change to draft so users can review before publishing
        landlordId: authUser?.id,
        categoryTags: [data.category], // Convert single category to array for database
      };
      
      console.log("Creating job with landlord ID:", authUser?.id);
      console.log("Job data:", JSON.stringify(jobData, null, 2));
      
      // Add special headers for authentication
      const customHeaders = {
        "X-User-ID": String(authUser?.id),
        "X-Auth-Token": `user-${authUser?.id}-${Date.now()}`,
        "X-Auth-Timestamp": Date.now().toString(),
        "X-Request-For": "job-creation",
      };
      
      console.log("Using custom headers:", customHeaders);
      
      try {
        const res = await apiRequest("POST", "/api/jobs", jobData, customHeaders);
        
        console.log("Job creation response status:", res.status);
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error("Job creation failed:", errorText);
          try {
            const errorData = JSON.parse(errorText);
            throw new Error(errorData.message || "Failed to create job");
          } catch (parseError) {
            throw new Error(errorText || "Failed to create job: Unknown error");
          }
        }
        
        const responseData = await res.json();
        console.log("Job created successfully:", responseData);
        return responseData;
      } catch (error) {
        console.error("Job creation exception:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", authUser?.id, "jobs"] });
      setIsJobModalOpen(false);
      jobForm.reset();
      setImages([]);
      toast({
        title: "Job created",
        description: "Your job has been created in draft mode. Publish it to make it visible to contractors.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create job",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Helper function to check if all required form fields are completed
  const isFormComplete = () => {
    return !!(
      jobForm.watch("title") && 
      jobForm.watch("description") && 
      jobForm.watch("category") && 
      jobForm.watch("address") &&
      jobForm.watch("pricingType")
    );
  };

  // Update job mutation for publishing drafts
  const updateJobMutation = useMutation({
    mutationFn: async (data: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/jobs/${data.id}`, { status: data.status });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to update job");
      }
      return res.json();
    },
    onSuccess: (updatedJob) => {
      // Invalidate the relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/users", authUser?.id, "jobs"] });
      
      // Update the job in the local jobs data
      if (jobs && Array.isArray(jobs)) {
        const jobIndex = jobs.findIndex(job => job.id === updatedJob.id);
        if (jobIndex !== -1) {
          jobs[jobIndex] = { ...jobs[jobIndex], ...updatedJob };
        }
      }

      // If there's a selected job, update it too
      if (selectedJob && selectedJob.id === updatedJob.id) {
        setSelectedJob(prev => ({ ...prev, ...updatedJob }));
      }
      
      toast({
        title: "Job updated",
        description: "Your job status has been updated successfully.",
      });
      
      setIsDetailsModalOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update job",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update bid status mutation
  const updateBidMutation = useMutation({
    mutationFn: async (data: { bidId: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/bids/${data.bidId}`, { status: data.status });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to update bid status");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (selectedJob) {
        fetchBidsForJob(selectedJob.id);
        // If a bid was accepted, also update the job status to in_progress
        if (data.status === "accepted") {
          updateJobMutation.mutate({ id: selectedJob.id, status: "in_progress" });
        } else {
          // Update bids data directly without page reload
          if (jobBids && Array.isArray(jobBids)) {
            // Find and update the bid in the jobBids array
            const bidIndex = jobBids.findIndex(bid => bid.id === data.id);
            if (bidIndex !== -1) {
              jobBids[bidIndex] = { ...jobBids[bidIndex], ...data };
            }
          }
          
          toast({
            title: "Bid updated",
            description: `The bid has been ${data.status}.`,
          });
        }
      }
      setIsBidDetailsOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update bid",
        description: error.message,
        variant: "destructive",
      });
    },
  });

    // State to prevent multiple submissions
  const [isSubmitting, setIsSubmitting] = useState(false);

const onSubmitJobForm = async (data: JobFormValues) => {
    // Prevent multiple submissions
    if (isSubmitting) {
      console.log("Form submission already in progress, preventing duplicate submission");
      return;
    }
    
    try {
      setIsSubmitting(true);
      console.log("Submitting job form with data:", data);
      
      // Use the mutation instead of direct fetch
      createJobMutation.mutate(data, {
        onSuccess: (responseData) => {
          console.log("Job created successfully:", responseData);
          
          // Invalidate queries and reset form
          queryClient.invalidateQueries({ queryKey: ["/api/users", authUser?.id, "jobs"] });
          
          // Force a refetch to update the UI immediately
          jobsQuery.refetch();
          
          setIsJobModalOpen(false);
          jobForm.reset();
          setImages([]);
          
          toast({
            title: "Job created",
            description: "Your job has been created in draft mode.",
          });
        },
        onError: (error: Error) => {
          console.error("Job creation failed:", error);
          
          toast({
            title: "Failed to create job",
            description: error.message || "Could not create job. Please try again.",
            variant: "destructive",
          });
        }
      });
    } catch (error) {
      console.error("Job submission error:", error);
      toast({
        title: "Error submitting job",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      // Reset submission state to allow future submissions
      setIsSubmitting(false);
    }
  };
  
  // Effect to fetch bids when job details modal is opened
  useEffect(() => {
    if (isDetailsModalOpen && selectedJob) {
      fetchBidsForJob(selectedJob.id);
    }
  }, [isDetailsModalOpen, selectedJob]);
  
  // Function to fetch contractor profile
  const fetchContractorProfile = async (contractorId: number) => {
    try {
      const res = await apiRequest("GET", `/api/contractor-profile/${contractorId}`);
      if (!res.ok) throw new Error("Failed to fetch contractor profile");
      const profileData = await res.json();
      
      // Update the contractorProfiles state with the fetched profile
      setContractorProfiles(prevProfiles => ({
        ...prevProfiles,
        [contractorId]: profileData
      }));
      
      return profileData;
    } catch (error) {
      console.error(`Error fetching contractor profile for ID ${contractorId}:`, error);
      return null;
    }
  };

  // Function to fetch bids for a job
  const fetchBidsForJob = async (jobId: number) => {
    setIsBidsLoading(true);
    try {
      const res = await apiRequest("GET", `/api/jobs/${jobId}/bids`);
      if (!res.ok) throw new Error("Failed to fetch bids");
      const bidsData = await res.json();
      setJobBids(bidsData);
      
      // Fetch contractor profiles for each bid
      const contractorIds = bidsData.map((bid: Bid) => bid.contractorId);
      // Create a unique array of contractor IDs without using Set
      const uniqueContractorIds = contractorIds.filter((id, index) => 
        contractorIds.indexOf(id) === index
      );
      
      // Fetch profiles for contractors we don't already have
      const promises = uniqueContractorIds
        .filter(id => !contractorProfiles[id])
        .map(id => fetchContractorProfile(id));
      
      await Promise.all(promises);
    } catch (error) {
      console.error("Error fetching bids:", error);
      toast({
        title: "Failed to load bids",
        description: "There was an error loading the bids for this job. Please try again.",
        variant: "destructive",
      });
      setJobBids([]);
    } finally {
      setIsBidsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { bg: string, text: string } } = {
      draft: { bg: "bg-gray-100", text: "text-gray-800" },
      open: { bg: "bg-blue-100", text: "text-blue-800" },
      in_progress: { bg: "bg-yellow-100", text: "text-yellow-800" },
      completed: { bg: "bg-green-100", text: "text-green-800" },
      cancelled: { bg: "bg-red-100", text: "text-red-800" },
    };

    const style = statusMap[status] || { bg: "bg-gray-100", text: "text-gray-800" };

    return (
      <Badge className={`${style.bg} ${style.text} border-0`}>
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const handleLogout = async () => {
    try {
      toast({
        title: "Logging out...",
        description: "You will be redirected shortly"
      });
      
      // Use the logout method from Auth context, which properly handles cleanup and redirection
      await logoutMutation.mutateAsync();
      
      // The Auth context's logout function will handle:
      // 1. API call to /api/logout
      // 2. Clearing cache and storage
      // 3. Redirecting to the home page
    } catch (error) {
      console.error('Logout error:', error);
      // If there's an error with the Auth context's logout, fall back to a direct redirect
      window.location.href = '/';
    }
  };

  const viewJobDetails = (job: Job) => {
    setSelectedJob(job);
    setIsDetailsModalOpen(true);
  };

  const viewBidDetails = (bid: Bid) => {
    setSelectedBid(bid);
    setIsBidDetailsOpen(true);
  };

  const publishJob = (jobId: number) => {
    updateJobMutation.mutate({ id: jobId, status: "open" }, {
      onSuccess: (updatedJob) => {
        // Update local state for immediate UI feedback
        if (selectedJob && selectedJob.id === jobId) {
          setSelectedJob({...selectedJob, status: "open"});
        }
        
        // Invalidate all relevant queries to ensure fresh data
        queryClient.invalidateQueries({ queryKey: ['/api/users', authUser?.id, 'jobs'] });
        
        // Force a refetch to update the UI immediately
        jobsQuery.refetch();
        
        toast({
          title: "Job published",
          description: "Your job is now visible to contractors and accepting bids."
        });
      },
      onError: (error: Error) => {
        toast({
          title: "Error",
          description: error.message || "Failed to publish job",
          variant: "destructive",
        });
      }
    });
  };

  const completeJob = (jobId: number) => {
    // Find the job and contractor to review
    const job = jobs?.find((job: Job) => job.id === jobId);
    if (job && job.contractorId) {
      // First update the job status to completed
      updateJobMutation.mutate(
        { id: jobId, status: "completed" },
        {
          onSuccess: () => {
            // Then show the review modal
            setJobToReview(job);
            setContractorToReview(job.contractorId as number);
            setIsReviewModalOpen(true);
            
            // Force a refetch to update the UI immediately
            jobsQuery.refetch();
            
            toast({
              title: "Job completed",
              description: "Please leave a review for the contractor."
            });
          },
          onError: (error: Error) => {
            toast({
              title: "Error",
              description: error.message || "Failed to complete job",
              variant: "destructive",
            });
          }
        }
      );
    } else {
      toast({
        title: "Error",
        description: "Could not find job details or no contractor assigned",
        variant: "destructive",
      });
    }
  };

  const cancelJob = (jobId: number) => {
    // First close any potentially open modals
    setIsDetailsModalOpen(false);
    
    // Show a cancellation confirmation dialog if needed
    toast({
      title: "Cancelling job...",
      description: "Please wait while we update the job status."
    });
    
    // Mutate the job status
    updateJobMutation.mutate({ id: jobId, status: "cancelled" }, {
      onSuccess: (updatedJob) => {
        // Update local state for immediate UI feedback
        if (selectedJob && selectedJob.id === jobId) {
          setSelectedJob({...selectedJob, status: "cancelled"});
        }
        
        // Invalidate all relevant queries to ensure fresh data
        queryClient.invalidateQueries({ queryKey: ['/api/users', authUser?.id, 'jobs'] });
        queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
        
        toast({
          title: "Job cancelled",
          description: "The job has been cancelled successfully."
        });
      },
      onError: (error: Error) => {
        toast({
          title: "Error",
          description: error.message || "Failed to cancel job",
          variant: "destructive",
        });
      }
    });
  };

  const acceptBid = (bidId: number) => {
    updateBidMutation.mutate(
      { bidId, status: "accepted" },
      {
        onSuccess: (data) => {
          toast({
            title: "Bid accepted",
            description: "Contractor has been notified and the job is now in progress."
          });
          
          // Force a refetch to update the UI immediately
          jobsQuery.refetch();
        },
        onError: (error: Error) => {
          toast({
            title: "Error",
            description: error.message || "Failed to accept bid",
            variant: "destructive",
          });
        }
      }
    );
  };

  const rejectBid = (bidId: number) => {
    updateBidMutation.mutate(
      { bidId, status: "rejected" },
      {
        onSuccess: (data) => {
          toast({
            title: "Bid rejected",
            description: "The contractor has been notified."
          });
          
          // No need to refetch jobs since rejecting doesn't change job status
          // Just update local bid state
          if (jobBids) {
            const updatedBids = jobBids.map(bid => 
              bid.id === bidId ? { ...bid, status: "rejected" } : bid
            );
            setJobBids(updatedBids);
          }
        },
        onError: (error: Error) => {
          toast({
            title: "Error",
            description: error.message || "Failed to reject bid",
            variant: "destructive",
          });
        }
      }
    );
  };

  const openReviewModal = (job: Job, contractorId: number) => {
    setJobToReview(job);
    setContractorToReview(contractorId);
    setIsReviewModalOpen(true);
  };

  if (!authUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>You need to be logged in to view this page.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <a href="/auth">Login or Register</a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex pb-16 md:pb-0">
      {/* Salesforce-style left sidebar - hidden on mobile */}
      <aside className="hidden md:flex w-64 bg-blue-950 text-white flex-col h-screen sticky top-0">
        <div className="p-4 border-b border-blue-800 flex items-center justify-start">
          <h1 className="text-xl font-bold">Real Service</h1>
        </div>
        
        <div className="flex-1 py-4">
          <nav className="space-y-1 px-2">
            <Button
              variant="ghost"
              className={`w-full justify-start text-white hover:bg-blue-800 ${activeSection === "inbox" ? "bg-blue-800" : ""}`}
              onClick={() => setActiveSection("inbox")}
            >
              <Inbox className="h-5 w-5 mr-3" />
              <span>Inbox</span>
            </Button>
            
            <Button
              variant="ghost"
              className={`w-full justify-start text-white hover:bg-blue-800 ${activeSection === "transactions" ? "bg-blue-800" : ""}`}
              onClick={() => setActiveSection("transactions")}
            >
              <FileText className="h-5 w-5 mr-3" />
              <span>Invoices</span>
            </Button>
            
            <Button
              variant="ghost"
              className={`w-full justify-start text-white hover:bg-blue-800 ${activeSection === "contractors" ? "bg-blue-800" : ""}`}
              onClick={() => setActiveSection("contractors")}
            >
              <Users className="h-5 w-5 mr-3" />
              <span>Contractors</span>
            </Button>
            
            <Separator className="my-4 bg-blue-800" />
            
            <Button
              variant="ghost"
              className={`w-full justify-start text-white hover:bg-blue-800 ${activeSection === "settings" ? "bg-blue-800" : ""}`}
              onClick={() => setActiveSection("settings")}
            >
              <Settings className="h-5 w-5 mr-3" />
              <span>Settings</span>
            </Button>
          </nav>
        </div>
        
        <div className="p-4 border-t border-blue-800">
          <Button
            variant="ghost"
            className="w-full justify-start text-white hover:bg-blue-800"
            onClick={handleLogout}
          >
            <X className="h-5 w-5 mr-3" />
            <span>Logout</span>
          </Button>
        </div>
      </aside>
      
      {/* Main content area */}
      <main className="flex-1 overflow-auto">
        {/* Top navbar */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="flex justify-between items-center px-6 py-3">
            <div className="flex items-center">
              <h2 className="text-xl font-semibold">
                {activeSection === "inbox" && "Inbox"}
                {activeSection === "transactions" && "Invoices"}
                {activeSection === "contractors" && "Contractors"}
                {activeSection === "settings" && "Settings"}
              </h2>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Bell className="h-5 w-5 text-gray-500" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                  2
                </span>
              </div>
              
              <div className="flex items-center">
                <ProfileAvatar 
                  src={typeof profile?.properties === 'object' && profile?.properties ? 
                    (profile.properties as any).profilePicture : undefined} 
                  alt={authUser.fullName || ""}
                  initials={authUser.fullName?.split(' ').map((n: string) => n[0]).join('') || ""}
                  size="sm"
                />
              </div>
            </div>
          </div>
        </header>
        
        <div className="p-6">
          {/* Dashboard/Home Section - Jobs combined with Home */}
          {activeSection === "dashboard" && (
            <div className="space-y-6">
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Recent Jobs</CardTitle>
                    <CardDescription>Your most recently posted jobs</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isJobsLoading ? (
                      <div className="flex justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : jobs && jobs.length > 0 ? (
                      <div className="space-y-4">
                        {jobs.slice(0, 5).map((job) => (
                          <div key={job.id} className="flex items-center justify-between border-b pb-4">
                            <div>
                              <h4 className="font-medium">{job.title}</h4>
                              <div className="flex items-center text-sm text-muted-foreground">
                                <MapPin className="h-3 w-3 mr-1" />
                                {job.location?.city}, {job.location?.state}
                                <span className="mx-2">•</span>
                                {getStatusBadge(job.status)}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline">${job.budget?.toFixed(2) || "Open"}</Badge>
                              <Button size="sm" variant="outline" onClick={() => viewJobDetails(job)}>
                                Details
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center p-4">
                        <p className="text-muted-foreground">No jobs posted yet</p>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button onClick={() => setIsJobModalOpen(true)} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Post New Job
                    </Button>
                  </CardFooter>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Job Status</CardTitle>
                    <CardDescription>Overview of your current jobs</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Draft</span>
                        <span className="text-sm font-bold">{jobs?.filter(job => job.status === "draft").length || 0}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full">
                        <div 
                          className="h-2 bg-gray-400 rounded-full" 
                          style={{ 
                            width: `${jobs?.length ? (jobs.filter(job => job.status === "draft").length / jobs.length) * 100 : 0}%` 
                          }}
                        ></div>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Open</span>
                        <span className="text-sm font-bold">{jobs?.filter(job => job.status === "open").length || 0}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full">
                        <div 
                          className="h-2 bg-blue-400 rounded-full" 
                          style={{ 
                            width: `${jobs?.length ? (jobs.filter(job => job.status === "open").length / jobs.length) * 100 : 0}%` 
                          }}
                        ></div>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm">In Progress</span>
                        <span className="text-sm font-bold">{jobs?.filter(job => job.status === "in_progress").length || 0}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full">
                        <div 
                          className="h-2 bg-yellow-400 rounded-full" 
                          style={{ 
                            width: `${jobs?.length ? (jobs.filter(job => job.status === "in_progress").length / jobs.length) * 100 : 0}%` 
                          }}
                        ></div>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Completed</span>
                        <span className="text-sm font-bold">{jobs?.filter(job => job.status === "completed").length || 0}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full">
                        <div 
                          className="h-2 bg-green-400 rounded-full" 
                          style={{ 
                            width: `${jobs?.length ? (jobs.filter(job => job.status === "completed").length / jobs.length) * 100 : 0}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {transactions && transactions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Transactions</CardTitle>
                    <CardDescription>Your most recent financial activities</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {transactions.slice(0, 3).map((transaction) => (
                        <div key={transaction.id} className="flex justify-between items-center border-b pb-3">
                          <div className="flex items-center">
                            <div className={`p-2 rounded-full mr-3 ${transaction.type === 'payment' ? 'bg-red-100' : 'bg-green-100'}`}>
                              {transaction.type === 'payment' ? (
                                <ArrowUpRight className="h-4 w-4 text-red-500" />
                              ) : (
                                <ArrowUpRight className="h-4 w-4 text-green-500 transform rotate-180" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{transaction.description || transaction.type}</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(transaction.timestamp).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <p className={`font-bold ${transaction.type === 'payment' ? 'text-red-500' : 'text-green-500'}`}>
                            {transaction.type === 'payment' ? '-' : '+'} ${transaction.amount.toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full" onClick={() => setActiveSection("transactions")}>
                      View All Transactions
                    </Button>
                  </CardFooter>
                </Card>
              )}
            </div>
          )}
          
          {/* Inbox Section - Dashboard content merged here */}
          {activeSection === "inbox" && (
            <div className="space-y-6 w-full overflow-x-hidden">
              
              {/* Today's Jobs Overview */}
              <TodayJobsOverview
                jobs={jobs}
                bids={allBids}
                userType="landlord"
                onViewJobDetails={viewJobDetails}
                onViewBidDetails={viewBidDetails}
              />
            
              {/* Job status tabs */}
              <div className="mb-4 px-4 md:px-0">
                <Tabs value={activeJobStatus} onValueChange={setActiveJobStatus} className="w-full">
                  <TabsList className="w-full flex-nowrap">
                    <TabsTrigger 
                      value="all" 
                      className="flex-1 flex items-center justify-center"
                    >
                      <span>All</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="draft" 
                      className="flex-1 flex items-center justify-center"
                    >
                      <span>Drafts</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="open" 
                      className="flex-1 flex items-center justify-center"
                    >
                      <span>Open</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="in_progress" 
                      className="flex-1 flex items-center justify-center"
                    >
                      <span>Active</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="completed" 
                      className="flex-1 flex items-center justify-center"
                    >
                      <span>Done</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-between mb-4">
                <div className="flex-1">
                  <form className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search for jobs by title or description"
                      className="pl-10"
                    />
                  </form>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-3 py-2 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="all">All Categories</option>
                    {AVAILABLE_CATEGORIES.map((category) => (
                      <option key={category} value={getCategoryValue(category)}>{category}</option>
                    ))}
                  </select>
                  
                  <Button onClick={() => setIsJobModalOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Post Job
                  </Button>
                </div>
              </div>
              
              {isJobsLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredJobs.length > 0 ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-[1800px] mx-auto">
                  {filteredJobs.map((job) => (
                    <Card key={job.id} className="overflow-hidden">
                      <div className="flex flex-col md:flex-row">
                        {job.images && job.images.length > 0 && (
                          <div className="md:w-1/4 h-48 md:h-auto">
                            <img 
                              src={job.images[0]} 
                              alt={job.title} 
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        
                        <div className="flex-1 p-6">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="text-lg font-bold">{job.title}</h3>
                              <div className="flex items-center text-sm text-muted-foreground mb-2">
                                <MapPin className="h-3 w-3 mr-1" />
                                {job.location?.city}, {job.location?.state}
                                <span className="mx-2">•</span>
                                <Calendar className="h-3 w-3 mr-1" />
                                {job.startDate ? new Date(job.startDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'No start date'}
                              </div>
                            </div>
                            
                            <div>
                              {getStatusBadge(job.status)}
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-2 mb-2">
                            <Badge variant="outline">{job.pricingType === "fixed" ? "Fixed Price" : "Open Bid"}</Badge>
                            {job.categoryTags && job.categoryTags.map((tag, i) => (
                              <Badge key={i} variant="secondary">{tag}</Badge>
                            ))}
                          </div>
                          
                          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                            {job.description}
                          </p>
                          
                          <div className="flex justify-between items-center">
                            <div className="font-bold text-xl">
                              {job.budget ? `$${job.budget.toFixed(2)}` : 'Open Budget'}
                            </div>
                            
                            <div className="flex space-x-2">
                              {job.status === "draft" && (
                                <Button 
                                  size="sm" 
                                  onClick={() => publishJob(job.id)}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Publish
                                </Button>
                              )}
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => viewJobDetails(job)}
                              >
                                View Details
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-6 text-center">
                    <div className="mb-2 flex justify-center p-4">
                      <SearchIcon className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium">No Jobs Found</h3>
                    <p className="text-muted-foreground mb-4">
                      {jobs && jobs.length > 0 
                        ? "No jobs matching your search criteria were found." 
                        : "You haven't posted any jobs yet."}
                    </p>
                    <Button 
                      variant={jobs && jobs.length > 0 ? "outline" : "default"}
                      onClick={() => {
                        if (jobs && jobs.length > 0) {
                          setSearchQuery("");
                          setFilterCategory("all");
                          setFilterStatus("all");
                          setActiveJobStatus("all");
                        } else {
                          setIsJobModalOpen(true);
                        }
                      }}
                    >
                      {jobs && jobs.length > 0 ? "Reset Filters" : "Post Your First Job"}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          
          {/* Transactions Section */}
          {activeSection === "transactions" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Your Transactions</CardTitle>
                  <CardDescription>History of all your financial activities</CardDescription>
                </CardHeader>
                <CardContent>
                  {isTransactionsLoading ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : transactions && transactions.length > 0 ? (
                    <div className="space-y-4">
                      <div className="rounded-md border">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {transactions.map((transaction) => (
                              <tr key={transaction.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {new Date(transaction.timestamp).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                </td>
                                <td className="px-6 py-4">
                                  {transaction.description || "Transaction"}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <Badge
                                    variant={transaction.type === "payment" ? "destructive" : "default"}
                                    className="capitalize"
                                  >
                                    {transaction.type}
                                  </Badge>
                                </td>
                                <td className={`px-6 py-4 whitespace-nowrap font-medium ${
                                  transaction.type === "payment" ? "text-red-500" : "text-green-500"
                                }`}>
                                  {transaction.type === "payment" ? "-" : "+"} ${transaction.amount.toFixed(2)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <Badge variant="outline" className="capitalize">
                                    {transaction.status || "completed"}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-8">
                      <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium">No Transactions Yet</h3>
                      <p className="text-muted-foreground mb-4">
                        You haven't made any transactions yet.
                      </p>
                      <Button onClick={() => setActiveSection("inbox")}>
                        Post a Job
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Contractors Section */}
          {activeSection === "contractors" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Contractors</CardTitle>
                  <CardDescription>Professionals you've worked with</CardDescription>
                </CardHeader>
                <CardContent>
                  {isJobsLoading ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="text-center p-8">
                      <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium">Contractor Directory</h3>
                      <p className="text-muted-foreground mb-4">
                        This section will show contractors who have bid on your jobs or completed work for you.
                      </p>
                      <Button onClick={() => setActiveSection("inbox")}>
                        View Your Jobs
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
          
          
          {/* Settings Section */}
          {activeSection === "settings" && (
            <div className="space-y-6 w-full overflow-x-hidden">
              <Tabs defaultValue="profile" className="w-full">
                <TabsList className="w-full mb-4">
                  <TabsTrigger value="profile" className="flex-1">My Profile</TabsTrigger>
                  <TabsTrigger value="notifications" className="flex-1">Notifications</TabsTrigger>
                  <TabsTrigger value="payment" className="flex-1">Payment</TabsTrigger>
                </TabsList>
                
                <TabsContent value="profile">
                  <Card>
                    <CardHeader>
                      <CardTitle>My Profile</CardTitle>
                      <CardDescription>View and update your profile information</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <UserProfileCard 
                          user={authUser}
                          allowEdit={true}
                          showDetails={true}
                          location={`${profile?.city || ''}, ${profile?.state || ''}`}
                        />
                        
                        <div className="mt-6 border-t pt-6">
                          <h3 className="text-lg font-medium mb-4">Account Actions</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <Button variant="outline" className="w-full">
                              <LockKeyhole className="mr-2 h-4 w-4" />
                              Change Password
                            </Button>
                            <Button variant="outline" className="w-full">
                              <Settings className="mr-2 h-4 w-4" />
                              Advanced Settings
                            </Button>
                            <Button variant="destructive" onClick={handleLogout} className="w-full">
                              <LogOut className="mr-2 h-4 w-4" />
                              Logout
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="notifications">
                  <Card>
                    <CardHeader>
                      <CardTitle>Notification Preferences</CardTitle>
                      <CardDescription>Manage how you receive updates and alerts</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-lg font-medium mb-4">Communication Channels</h3>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">Email Notifications</p>
                                <p className="text-sm text-muted-foreground">Receive job and bid updates via email</p>
                              </div>
                              <Switch />
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">SMS Notifications</p>
                                <p className="text-sm text-muted-foreground">Receive urgent updates via text message</p>
                              </div>
                              <Switch />
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">Push Notifications</p>
                                <p className="text-sm text-muted-foreground">Receive alerts in your browser or app</p>
                              </div>
                              <Switch />
                            </div>
                          </div>
                        </div>
                        
                        <Separator />
                        
                        <div>
                          <h3 className="text-lg font-medium mb-4">Notification Types</h3>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">New Bids</p>
                                <p className="text-sm text-muted-foreground">When contractors place bids on your jobs</p>
                              </div>
                              <Switch defaultChecked />
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">Job Status Updates</p>
                                <p className="text-sm text-muted-foreground">When your job's status changes</p>
                              </div>
                              <Switch defaultChecked />
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">Messages</p>
                                <p className="text-sm text-muted-foreground">When you receive new messages</p>
                              </div>
                              <Switch defaultChecked />
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="payment">
                  <Card>
                    <CardHeader>
                      <CardTitle>Payment Settings</CardTitle>
                      <CardDescription>Manage your payment methods and preferences</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-lg font-medium mb-4">Payment Methods</h3>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">Default Payment Method</p>
                                <p className="text-sm text-muted-foreground">Manage your payment options</p>
                              </div>
                              <Button variant="outline">Manage</Button>
                            </div>
                          </div>
                        </div>
                        
                        <Separator />
                        
                        <div>
                          <h3 className="text-lg font-medium mb-4">Billing Information</h3>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">Billing Address</p>
                                <p className="text-sm text-muted-foreground">Update your billing details</p>
                              </div>
                              <Button variant="outline">Update</Button>
                            </div>
                          </div>
                        </div>
                        
                        <Separator />
                        
                        <div>
                          <h3 className="text-lg font-medium mb-4">Account Plan</h3>
                          <div className="bg-muted/50 p-4 rounded-md">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-bold">Standard Plan</p>
                                <p className="text-sm text-muted-foreground">$25/month</p>
                              </div>
                              <Badge variant="secondary">Active</Badge>
                            </div>
                            <div className="mt-2">
                              <Button variant="outline" size="sm">
                                View Plan Details
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </main>
      
      {/* Job Creation Modal */}
      <Dialog open={isJobModalOpen} onOpenChange={setIsJobModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create a New Job</DialogTitle>
            <DialogDescription>
              Post a new maintenance job for contractors to bid on.
            </DialogDescription>
          </DialogHeader>
          
          {/* Form Completion Status */}
          <div className="mb-4 mt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-muted-foreground">Form Completion Status</h4>
              <div className="flex items-center gap-2">
                {isFormComplete() ? (
                  <span className="text-sm text-green-600 flex items-center">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Ready to submit
                  </span>
                ) : (
                  <span className="text-sm text-amber-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    Required fields missing
                  </span>
                )}
              </div>
            </div>
            <Progress 
              value={
                [
                  jobForm.watch("title"),
                  jobForm.watch("description"),
                  jobForm.watch("address"),
                  jobForm.watch("category"),
                  jobForm.watch("pricingType")
                ].filter(Boolean).length * 100 / 5
              } 
              className="h-2 mt-2" 
            />
          </div>
          
          <Form {...jobForm}>
            <form onSubmit={jobForm.handleSubmit(onSubmitJobForm)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={jobForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Bathroom Plumbing Repair" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={jobForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {AVAILABLE_CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>{category}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={jobForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe the job in detail including any special requirements" 
                        className="min-h-[100px]" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={jobForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormControl>
                        <MapboxAddressAutofill
                          defaultValue={field.value}
                          error={jobForm.formState.errors.address?.message}
                          onAddressSelect={(addressData) => {
                            // Update all address-related fields
                            jobForm.setValue("address", addressData.address, { shouldValidate: true });
                            jobForm.setValue("city", addressData.city, { shouldValidate: true });
                            jobForm.setValue("state", addressData.state, { shouldValidate: true });
                            jobForm.setValue("zipCode", addressData.postalCode, { shouldValidate: true });
                            
                            // Set the location coordinates if we have schema support for it
                            // This would update when we modify the schema
                            field.onChange(addressData.address);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Hidden fields that get auto-filled by MapboxAddressAutofill */}
                <div className="hidden">
                  <FormField
                    control={jobForm.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={jobForm.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={jobForm.control}
                    name="zipCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="space-y-4">
                  <FormField
                    control={jobForm.control}
                    name="isUrgent"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Mark as Urgent</FormLabel>
                          <FormDescription className="text-xs">
                            Urgent jobs are highlighted to qualified contractors in the area
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={!!field.value}
                            onCheckedChange={(checked) => field.onChange(checked)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={jobForm.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date{jobForm.watch().isUrgent ? " (Required for urgent jobs)" : " (Optional)"}</FormLabel>
                        <FormDescription>
                          When would you like this job to begin?
                        </FormDescription>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={jobForm.control}
                  name="pricingType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pricing Type</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select pricing type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="fixed">Fixed Price</SelectItem>
                          <SelectItem value="open_bid">Open for Bids</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {jobForm.watch("pricingType") === "fixed" && (
                  <FormField
                    control={jobForm.control}
                    name="budget"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Budget (CAD)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
              
              <div>
                <Label htmlFor="images">Upload Images (Optional)</Label>
                <div className="border border-dashed rounded-md p-4 mt-2">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Camera className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Drag & drop images or click to browse</p>
                    <Input
                      id="images"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      ref={fileInputRef}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Images
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {images.length > 0 && (
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {images.map((image, index) => (
                        <div key={index} className="relative rounded-md overflow-hidden h-20">
                          <img src={image} alt={`Preview ${index}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            className="absolute top-1 right-1 bg-black bg-opacity-70 rounded-full p-1"
                            onClick={() => removeImage(index)}
                          >
                            <X className="h-4 w-4 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <DialogFooter>
                <Button 
                  variant="outline" 
                  type="button" 
                  onClick={() => {
                    setIsJobModalOpen(false);
                    setImages([]);
                    jobForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createJobMutation.isPending || !isFormComplete()}
                >
                  {createJobMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Job"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Job Details Modal */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedJob && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedJob.title}</DialogTitle>
                <DialogDescription>
                  {getStatusBadge(selectedJob.status)}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Budget</p>
                  <p className="font-bold text-lg">
                    ${selectedJob.budget?.toFixed(2) || "Open Bid"}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-medium">
                    {selectedJob.location?.city}, {selectedJob.location?.state}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">Category</p>
                  <p className="font-medium">
                    {selectedJob.categoryTags?.join(", ") || "General"}
                  </p>
                </div>
              </div>
              
              <div className="mb-4">
                <h4 className="font-medium mb-2">Description</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedJob.description}
                </p>
              </div>
              
              {/* Job Progress (only shown for in-progress jobs) */}
              {selectedJob.status === "in_progress" && (
                <div className="mb-4 p-4 bg-blue-50 rounded-md">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium">Job Progress</h4>
                    <Badge variant={selectedJob.progress === 100 ? "default" : "secondary"}>
                      {selectedJob.progress === 100 ? "Complete" : "In Progress"}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">0%</span>
                      <span className="text-sm font-medium">{selectedJob.progress || 0}%</span>
                      <span className="text-sm text-muted-foreground">100%</span>
                    </div>
                    <Progress value={selectedJob.progress || 0} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-2">
                      Last updated: {new Date(selectedJob.updatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
              
              {selectedJob.images && selectedJob.images.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium mb-2">Images</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedJob.images.map((image, index) => (
                      <div key={index} className="rounded-md overflow-hidden h-24">
                        <img src={image} alt={`Job ${index}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <Tabs defaultValue="bids" className="mt-4">
                <TabsList>
                  <TabsTrigger value="bids">Bids</TabsTrigger>
                  <TabsTrigger value="details">Full Details</TabsTrigger>
                  {selectedJob?.status === "in_progress" && (
                    <TabsTrigger value="chat">
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-4 w-4" />
                        <span>Chat</span>
                      </div>
                    </TabsTrigger>
                  )}
                </TabsList>
                
                <TabsContent value="bids">
                  {isBidsLoading ? (
                    <div className="flex justify-center p-4">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : jobBids.length > 0 ? (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto p-1">
                      {jobBids.map((bid) => (
                        <Card 
                          key={bid.id} 
                          className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => viewBidDetails(bid)}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                  <AvatarFallback className="bg-blue-100 text-blue-600">
                                    {bid.contractorId.toString().substring(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">
                                    {contractorProfiles[bid.contractorId]?.name || `Contractor #${bid.contractorId}`}
                                    <span className="ml-2 text-xs text-blue-600 font-normal">(View Profile)</span>
                                  </p>
                                  <div className="flex items-center text-sm text-muted-foreground">
                                    {contractorProfiles[bid.contractorId] ? (
                                      <>
                                        <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                                        <span className="mr-2">
                                          {contractorProfiles[bid.contractorId].averageRating?.toFixed(1) || "No ratings"}
                                        </span>
                                        {contractorProfiles[bid.contractorId].totalRatings > 0 && (
                                          <span className="mr-2">
                                            ({contractorProfiles[bid.contractorId].totalRatings} {contractorProfiles[bid.contractorId].totalRatings === 1 ? 'rating' : 'ratings'})
                                          </span>
                                        )}
                                      </>
                                    ) : (
                                      <>
                                        <Star className="h-3 w-3 mr-1 text-muted-foreground" />
                                        <span className="mr-2">No reviews yet</span>
                                      </>
                                    )}
                                    <MapPin className="h-3 w-3 mr-1" />
                                    <span>Local contractor</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <Badge
                              className={
                                bid.status === "pending" ? "bg-yellow-100 text-yellow-800 border-0" :
                                bid.status === "accepted" ? "bg-green-100 text-green-800 border-0" :
                                "bg-red-100 text-red-800 border-0"
                              }
                            >
                              {bid.status}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                            <div className="flex items-center text-sm">
                              <div className="bg-blue-50 p-2 rounded-full mr-2">
                                <DollarSign className="h-4 w-4 text-blue-600" />
                              </div>
                              <div>
                                <p className="text-muted-foreground">Bid Amount</p>
                                <p className="font-medium">${bid.amount.toFixed(2)} CAD</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center text-sm">
                              <div className="bg-green-50 p-2 rounded-full mr-2">
                                <Clock className="h-4 w-4 text-green-600" />
                              </div>
                              <div>
                                <p className="text-muted-foreground">Time Estimate</p>
                                <p className="font-medium">{bid.timeEstimate}</p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="mt-3">
                            <p className="text-sm font-medium mb-1">Proposal</p>
                            <div className="text-sm bg-gray-50 rounded-md p-3">
                              {bid.proposal}
                            </div>
                          </div>
                          
                          {bid.proposedStartDate && (
                            <div className="mt-3 text-sm">
                              <p className="font-medium mb-1">Proposed Start Date</p>
                              <div className="flex items-center text-blue-600">
                                <Calendar className="h-4 w-4 mr-2" />
                                {new Date(bid.proposedStartDate).toLocaleDateString()} 
                              </div>
                            </div>
                          )}
                          
                          {bid.status === "pending" && (
                            <div className="flex justify-end space-x-2 mt-3">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="text-red-500 hover:text-red-700"
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent triggering the card click
                                  rejectBid(bid.id);
                                }}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                              <Button 
                                size="sm" 
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent triggering the card click
                                  acceptBid(bid.id);
                                }}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Accept
                              </Button>
                            </div>
                          )}
                          
                          {bid.status === "accepted" && selectedJob.status === "in_progress" && (
                            <div className="flex justify-end mt-3">
                              <Button 
                                size="sm" 
                                onClick={() => openReviewModal(selectedJob, bid.contractorId)}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Mark Complete
                              </Button>
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center p-4">
                      <p className="text-muted-foreground">No bids received yet.</p>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="details">
                  <div className="space-y-4">
                    {/* Job Info Section */}
                    <div>
                      <h3 className="text-md font-semibold mb-2">Job Information</h3>
                      <div className="space-y-3 bg-gray-50 p-3 rounded-md">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Full Address</p>
                          <p className="text-sm">
                            {selectedJob.location?.address}, {selectedJob.location?.city}, {selectedJob.location?.state} {selectedJob.location?.zip}
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Posted On</p>
                            <p className="text-sm">{new Date(selectedJob.createdAt).toLocaleDateString()}</p>
                          </div>
                          
                          {selectedJob.startDate && (
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Start Date</p>
                              <p className="text-sm">{new Date(selectedJob.startDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                            </div>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Pricing Type</p>
                            <p className="text-sm capitalize">{selectedJob.pricingType.replace('_', ' ')}</p>
                          </div>
                          
                          {selectedJob.budget && (
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Budget</p>
                              <p className="text-sm">${selectedJob.budget.toFixed(2)} CAD</p>
                            </div>
                          )}
                        </div>
                        
                        {selectedJob.categoryTags && selectedJob.categoryTags.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Categories</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Array.isArray(selectedJob.categoryTags) && selectedJob.categoryTags.map((tag, index) => (
                                <Badge key={index} variant="outline" className="bg-blue-50">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Accepted Bid Section - only show if there's an accepted bid */}
                    {selectedJob.status === "in_progress" && selectedJob.contractorId && (
                      <div>
                        <h3 className="text-md font-semibold mb-2">Accepted Contractor</h3>
                        <div className="bg-green-50 p-3 rounded-md">
                          {jobBids.filter(bid => bid.status === "accepted").map(acceptedBid => (
                            <div key={acceptedBid.id} className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-10 w-10">
                                    <AvatarFallback className="bg-green-100 text-green-600">
                                      {acceptedBid.contractorId.toString().substring(0, 2)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium">Contractor #{acceptedBid.contractorId}</p>
                                    <div className="flex items-center text-sm text-muted-foreground">
                                      {contractorProfiles[acceptedBid.contractorId] ? (
                                        <>
                                          <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                                          <span>
                                            {contractorProfiles[acceptedBid.contractorId].averageRating?.toFixed(1) || "No ratings"} 
                                            {contractorProfiles[acceptedBid.contractorId].totalRatings > 0 && 
                                              ` (${contractorProfiles[acceptedBid.contractorId].totalRatings} ${contractorProfiles[acceptedBid.contractorId].totalRatings === 1 ? 'rating' : 'ratings'})`
                                            } • Local contractor
                                          </span>
                                        </>
                                      ) : (
                                        <>
                                          <Star className="h-3 w-3 mr-1 text-muted-foreground" />
                                          <span>No reviews yet • Local contractor</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <Badge className="bg-green-100 text-green-800 border-0">
                                  Accepted
                                </Badge>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Contract Amount</p>
                                  <p className="text-lg font-semibold">${acceptedBid.amount.toFixed(2)} CAD</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Time Estimate</p>
                                  <p className="text-sm">{acceptedBid.timeEstimate}</p>
                                </div>
                              </div>
                              
                              {acceptedBid.proposedStartDate && (
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Start Date</p>
                                  <div className="flex items-center text-sm">
                                    <Calendar className="h-4 w-4 mr-2 text-green-600" />
                                    {new Date(acceptedBid.proposedStartDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                  </div>
                                </div>
                              )}
                              
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Contact</p>
                                <div className="flex items-center space-x-2 mt-1">
                                  <Button variant="outline" size="sm" className="h-8">
                                    <MessageSquare className="h-4 w-4 mr-1" />
                                    Message
                                  </Button>
                                  <Button variant="outline" size="sm" className="h-8">
                                    <Phone className="h-4 w-4 mr-1" />
                                    Call
                                  </Button>
                                </div>
                              </div>
                              
                              <div className="pt-2">
                                <Button 
                                  variant="default" 
                                  className="w-full"
                                  onClick={() => openReviewModal(selectedJob, acceptedBid.contractorId)}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Mark Job as Complete
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Add Chat Tab Content */}
                <TabsContent value="chat" className="h-[500px]">
                  {selectedJob?.status === "in_progress" && selectedJob.contractorId && (
                    <>
                      {jobBids.filter(bid => bid.status === "accepted").map(acceptedBid => (
                        <ChatInterface 
                          key={`chat-${selectedJob.id}-${acceptedBid.contractorId}`}
                          chatRoomId={selectedJob.id} 
                          userId={authUser.id}
                          userName={authUser.fullName || authUser.username}
                          otherUserName={`Contractor #${acceptedBid.contractorId}`}
                          className="h-full"
                          isJobId={true}
                        />
                      ))}
                    </>
                  )}
                </TabsContent>
              </Tabs>
              
              <Separator className="my-4" />
              
              <div className="flex justify-between">
                <div className="space-x-2">
                  {selectedJob.status === "draft" && (
                    <Button 
                      onClick={() => publishJob(selectedJob.id)}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Publish
                    </Button>
                  )}
                  
                  {selectedJob.status === "in_progress" && (
                    <Button 
                      onClick={() => completeJob(selectedJob.id)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Mark Complete
                    </Button>
                  )}
                  
                  {(selectedJob.status === "draft" || selectedJob.status === "open") && (
                    <Button 
                      variant="outline" 
                      className="text-red-500 hover:text-red-700"
                      onClick={() => cancelJob(selectedJob.id)}
                    >
                      Cancel Job
                    </Button>
                  )}
                </div>
                
                <Button 
                  variant="outline" 
                  onClick={() => setIsDetailsModalOpen(false)}
                >
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Review Modal */}
      {jobToReview && contractorToReview && (
        <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Leave a Review</DialogTitle>
              <DialogDescription>
                Rate and review the contractor's work on {jobToReview.title}
              </DialogDescription>
            </DialogHeader>
            
            <ReviewForm
              jobId={jobToReview.id}
              reviewerId={authUser?.id || 0}
              revieweeId={contractorToReview}
              onSuccess={() => {
                setIsReviewModalOpen(false);
                // Call the update job mutation directly to avoid infinite loop
                updateJobMutation.mutate({ id: jobToReview.id, status: "completed" });
              }}
              onCancel={() => setIsReviewModalOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
      {/* Bid Details Modal */}
      {selectedBid && (
        <Dialog open={isBidDetailsOpen} onOpenChange={setIsBidDetailsOpen}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="sticky top-0 bg-background z-10 pb-2 mb-2 border-b">
              <DialogTitle>Contractor Profile & Bid Details</DialogTitle>
              <DialogDescription>
                Review this contractor's profile and bid information
              </DialogDescription>
            </DialogHeader>
            
            {contractorProfiles[selectedBid.contractorId] ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                {/* Contractor Profile Section */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <ProfileAvatar 
                      size="lg"
                      src={contractorProfiles[selectedBid.contractorId].profilePicture} 
                      initials={contractorProfiles[selectedBid.contractorId].name?.split(' ').map((n: string) => n[0]).join('') || '?'} 
                    />
                    <div>
                      <h3 className="text-lg font-medium">{contractorProfiles[selectedBid.contractorId].name || 'Contractor'}</h3>
                      <div className="flex items-center text-amber-500">
                        <Star className="h-4 w-4 fill-current" />
                        <span className="ml-1 text-sm">
                          {contractorProfiles[selectedBid.contractorId].averageRating?.toFixed(1) || "No ratings"} 
                          {contractorProfiles[selectedBid.contractorId].totalRatings > 0 && 
                            ` (${contractorProfiles[selectedBid.contractorId].totalRatings} ${contractorProfiles[selectedBid.contractorId].totalRatings === 1 ? 'rating' : 'ratings'})`
                          }
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Trade Information */}
                  <div className="rounded-lg border p-4">
                    <h4 className="font-medium mb-2">Trades & Expertise</h4>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {Array.isArray(contractorProfiles[selectedBid.contractorId].trades) && 
                      contractorProfiles[selectedBid.contractorId].trades.length > 0 ? (
                        contractorProfiles[selectedBid.contractorId].trades.map((trade: string, i: number) => (
                          <Badge key={i} variant="secondary">{trade}</Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">No trades specified</span>
                      )}
                    </div>
                    
                    <h4 className="font-medium mt-3 mb-2">Experience</h4>
                    <p className="text-sm">
                      {contractorProfiles[selectedBid.contractorId].experience || 'No experience information provided'}
                    </p>
                  </div>

                  {/* Insurance & Warranty Information */}
                  <div className="rounded-lg border p-4">
                    <h4 className="font-medium mb-2">Insurance & Warranty</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center">
                        <Shield className="h-4 w-4 mr-2 text-green-500" />
                        <span>
                          {contractorProfiles[selectedBid.contractorId].hasLiabilityInsurance ? 
                            'Has liability insurance' : 
                            'No liability insurance'}
                        </span>
                      </div>
                      {contractorProfiles[selectedBid.contractorId].insuranceCoverage && (
                        <div className="ml-6 text-sm text-muted-foreground">
                          {contractorProfiles[selectedBid.contractorId].insuranceCoverage}
                        </div>
                      )}
                      
                      <div className="flex items-start mt-2">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-green-500 mt-0.5" />
                        <div>
                          <span className="font-medium">Warranty/Guarantee</span>
                          <p className="text-muted-foreground">
                            {contractorProfiles[selectedBid.contractorId].warranty || 'No warranty information provided'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Additional Information */}
                  <div className="rounded-lg border p-4 space-y-3">
                    <div>
                      <h4 className="font-medium mb-1">Payment Methods</h4>
                      <div className="flex flex-wrap gap-2">
                        {Array.isArray(contractorProfiles[selectedBid.contractorId].paymentMethods) && 
                        contractorProfiles[selectedBid.contractorId].paymentMethods.length > 0 ? (
                          contractorProfiles[selectedBid.contractorId].paymentMethods.map((method: string, i: number) => (
                            <Badge key={i} variant="outline">{method}</Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">No payment methods specified</span>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-1">Languages</h4>
                      <div className="flex flex-wrap gap-2">
                        {Array.isArray(contractorProfiles[selectedBid.contractorId].languages) && 
                        contractorProfiles[selectedBid.contractorId].languages.length > 0 ? (
                          contractorProfiles[selectedBid.contractorId].languages.map((language: string, i: number) => (
                            <Badge key={i} variant="outline">{language}</Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">No languages specified</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Bid Details Section */}
                <div className="space-y-4">
                  <div className="rounded-lg border p-4 bg-muted/50">
                    <h3 className="text-lg font-semibold mb-3">Bid Details</h3>
                    <div className="space-y-3">
                      <div className="bg-background rounded p-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Bid Amount</span>
                          <span className="font-semibold text-lg">${selectedBid.amount.toFixed(2)}</span>
                        </div>
                      </div>
                      
                      <div className="bg-background rounded p-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Status</span>
                          <Badge 
                            variant={selectedBid.status === "accepted" ? "secondary" : 
                              selectedBid.status === "rejected" ? "destructive" : "default"}
                            className={selectedBid.status === "accepted" ? "bg-green-100 text-green-800 hover:bg-green-200" : ""}
                          >
                            {selectedBid.status}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="bg-background rounded p-3">
                        <span className="text-sm font-medium">Notes</span>
                        <p className="text-sm mt-1">
                          {selectedBid.proposal || 'No additional information provided'}
                        </p>
                      </div>
                      
                      <div className="bg-background rounded p-3">
                        <span className="text-sm font-medium">Submitted</span>
                        <p className="text-sm mt-1">
                          {new Date(selectedBid.createdAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {new Date(selectedBid.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Portfolio Section */}
                  <div className="rounded-lg border p-4">
                    <h3 className="text-lg font-semibold mb-3">Portfolio</h3>
                    {Array.isArray(contractorProfiles[selectedBid.contractorId].portfolio) && 
                    contractorProfiles[selectedBid.contractorId].portfolio.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {contractorProfiles[selectedBid.contractorId].portfolio.map((image: string, i: number) => (
                          <div key={i} className="relative aspect-square rounded-md overflow-hidden">
                            <img 
                              src={image} 
                              alt={`Portfolio image ${i+1}`} 
                              className="object-cover w-full h-full"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        <p>No portfolio images available</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Action Buttons - Sticky footer on mobile */}
                  <div className="mt-4 pt-4 border-t sticky bottom-0 bg-background pb-2">
                    {selectedBid.status === "pending" && (
                      <div className="flex space-x-3 mb-3">
                        <Button 
                          className="flex-1" 
                          onClick={() => acceptBid(selectedBid.id)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Accept Bid
                        </Button>
                        <Button 
                          variant="outline" 
                          className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" 
                          onClick={() => rejectBid(selectedBid.id)}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Reject Bid
                        </Button>
                      </div>
                    )}
                    
                    <Button 
                      variant="ghost" 
                      className="w-full" 
                      onClick={() => setIsBidDetailsOpen(false)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-2 text-sm text-muted-foreground">Loading contractor profile...</p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
      
      {/* Facebook-style mobile navigation */}
      <MobileNavigation 
        activeSection={activeSection}
        onChangeSection={setActiveSection}
        userType="landlord"
      />
    </div>
  );
}