import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Job, Bid, Transaction, LandlordProfile, User } from "@shared/schema";
import { 
  Loader2, Wallet, List, FileText, Home, DollarSign, Star, Search, Building, Clock, Calendar, MapPin, Edit, 
  Save, SlidersHorizontal, ChevronDown, ChevronUp, X, Filter, Pin, Info, RefreshCcw, CheckCircle2, 
  ImageIcon, MapIcon, MessageCircle, Briefcase, Heart, HeartOff, ShieldCheck, User as UserIcon, Bell, Settings, 
  ArrowUpRight, TrendingUp, Users, Layers, PieChart, SearchIcon, Upload, Camera, Plus, Check, LockKeyhole
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ReviewForm from "@/components/ReviewForm";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { UserProfileCard } from "@/components/UserProfileCard";
import { LocationSearch } from "@/components/LocationSearch";

const AVAILABLE_CATEGORIES = [
  "Plumbing", 
  "Electrical", 
  "Carpentry", 
  "Painting", 
  "Landscaping", 
  "General Maintenance", 
  "Roofing", 
  "HVAC", 
  "Cleaning",
  "Drywall",
  "Flooring",
  "Windows",
  "Pest Control",
  "Appliances"
];

const jobSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  city: z.string().min(2, "City must be at least 2 characters"),
  state: z.string().min(2, "State must be at least 2 characters"),
  zipCode: z.string().min(5, "Zip code must be at least 5 characters"),
  pricingType: z.enum(["fixed", "open_bid"]),
  budget: z.string().optional(),
  deadline: z.string().optional(),
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
  const [activeSection, setActiveSection] = useState("dashboard");
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
  const { data: jobs = [], isLoading: isJobsLoading } = useQuery<Job[]>({
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

  // Filter jobs based on search and filters
  const filteredJobs = useMemo(() => {
    if (!jobs?.length) return [];
    
    return jobs.filter(job => {
      // Filter by status
      if (filterStatus !== "all" && job.status !== filterStatus) return false;
      
      // Filter by search query
      if (searchQuery && !job.title.toLowerCase().includes(searchQuery.toLowerCase()) 
          && !job.description.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Filter by category
      if (filterCategory !== "all" && (!job.categoryTags || !job.categoryTags.includes(filterCategory.toLowerCase()))) {
        return false;
      }
      
      return true;
    });
  }, [jobs, searchQuery, filterCategory, filterStatus]);

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
      deadline: "",
      category: undefined,
      images: [],
    },
  });

  // Create job mutation
  const createJobMutation = useMutation({
    mutationFn: async (data: JobFormValues) => {
      // Transform the location fields into a location object
      const { address, city, state, zipCode, ...otherData } = data;
      
      // Ensure pricingType is explicitly included and valid
      const jobData = {
        ...otherData,
        pricingType: data.pricingType || "fixed", // Provide default if missing
        location: {
          address,
          city,
          state,
          zip: zipCode
        },
        budget: data.budget ? parseFloat(data.budget) : undefined,
        status: "draft", // Change to draft so users can review before publishing
        landlordId: authUser?.id,
        categoryTags: [data.category], // Convert single category to array for database
      };
      
      const res = await apiRequest("POST", "/api/jobs", jobData);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to create job");
      }
      return res.json();
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", authUser?.id, "jobs"] });
      toast({
        title: "Job updated",
        description: "Your job status has been updated successfully",
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
        }
      }
      setIsBidDetailsOpen(false);
      toast({
        title: "Bid updated",
        description: `The bid has been ${data.status}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update bid",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmitJobForm = (data: JobFormValues) => {
    createJobMutation.mutate(data);
  };
  
  // Effect to fetch bids when job details modal is opened
  useEffect(() => {
    if (isDetailsModalOpen && selectedJob) {
      fetchBidsForJob(selectedJob.id);
    }
  }, [isDetailsModalOpen, selectedJob]);
  
  // Function to fetch bids for a job
  const fetchBidsForJob = async (jobId: number) => {
    setIsBidsLoading(true);
    try {
      const res = await apiRequest("GET", `/api/jobs/${jobId}/bids`);
      if (!res.ok) throw new Error("Failed to fetch bids");
      const bidsData = await res.json();
      setJobBids(bidsData);
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

  const handleLogout = () => {
    logoutMutation.mutate();
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
    updateJobMutation.mutate({ id: jobId, status: "open" });
  };

  const completeJob = (jobId: number) => {
    updateJobMutation.mutate({ id: jobId, status: "completed" });
  };

  const cancelJob = (jobId: number) => {
    updateJobMutation.mutate({ id: jobId, status: "cancelled" });
  };

  const acceptBid = (bidId: number) => {
    updateBidMutation.mutate({ bidId, status: "accepted" });
  };

  const rejectBid = (bidId: number) => {
    updateBidMutation.mutate({ bidId, status: "rejected" });
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
    <div className="min-h-screen bg-background flex">
      {/* Salesforce-style left sidebar */}
      <aside className="w-16 md:w-64 bg-blue-950 text-white flex flex-col h-screen sticky top-0">
        <div className="p-4 border-b border-blue-800 flex items-center justify-center md:justify-start">
          <h1 className="text-xl font-bold hidden md:block">Real Service</h1>
          <span className="text-2xl font-bold md:hidden">RS</span>
        </div>
        
        <div className="flex-1 py-4">
          <nav className="space-y-1 px-2">
            <Button
              variant="ghost"
              className={`w-full justify-start text-white hover:bg-blue-800 ${activeSection === "dashboard" ? "bg-blue-800" : ""}`}
              onClick={() => setActiveSection("dashboard")}
            >
              <PieChart className="h-5 w-5 md:mr-3" />
              <span className="hidden md:inline">Dashboard</span>
            </Button>
            
            <Button
              variant="ghost"
              className={`w-full justify-start text-white hover:bg-blue-800 ${activeSection === "jobs" ? "bg-blue-800" : ""}`}
              onClick={() => setActiveSection("jobs")}
            >
              <Briefcase className="h-5 w-5 md:mr-3" />
              <span className="hidden md:inline">My Jobs</span>
            </Button>
            
            <Button
              variant="ghost"
              className={`w-full justify-start text-white hover:bg-blue-800 ${activeSection === "transactions" ? "bg-blue-800" : ""}`}
              onClick={() => setActiveSection("transactions")}
            >
              <DollarSign className="h-5 w-5 md:mr-3" />
              <span className="hidden md:inline">Transactions</span>
            </Button>
            
            <Button
              variant="ghost"
              className={`w-full justify-start text-white hover:bg-blue-800 ${activeSection === "contractors" ? "bg-blue-800" : ""}`}
              onClick={() => setActiveSection("contractors")}
            >
              <Users className="h-5 w-5 md:mr-3" />
              <span className="hidden md:inline">Contractors</span>
            </Button>
            
            <Separator className="my-4 bg-blue-800" />
            
            <Button
              variant="ghost"
              className={`w-full justify-start text-white hover:bg-blue-800 ${activeSection === "profile" ? "bg-blue-800" : ""}`}
              onClick={() => setActiveSection("profile")}
            >
              <UserIcon className="h-5 w-5 md:mr-3" />
              <span className="hidden md:inline">My Profile</span>
            </Button>
            
            <Button
              variant="ghost"
              className={`w-full justify-start text-white hover:bg-blue-800 ${activeSection === "settings" ? "bg-blue-800" : ""}`}
              onClick={() => setActiveSection("settings")}
            >
              <Settings className="h-5 w-5 md:mr-3" />
              <span className="hidden md:inline">Settings</span>
            </Button>
          </nav>
        </div>
        
        <div className="p-4 border-t border-blue-800">
          <Button
            variant="ghost"
            className="w-full justify-start text-white hover:bg-blue-800"
            onClick={handleLogout}
          >
            <X className="h-5 w-5 md:mr-3" />
            <span className="hidden md:inline">Logout</span>
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
                {activeSection === "dashboard" && "Dashboard"}
                {activeSection === "jobs" && "My Jobs"}
                {activeSection === "transactions" && "Transactions"}
                {activeSection === "contractors" && "Contractors"}
                {activeSection === "profile" && "My Profile"}
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
              
              <div className="flex items-center space-x-2">
                <ProfileAvatar 
                  src={profile?.profilePicture} 
                  alt={authUser.fullName || ""}
                  initials={authUser.fullName?.split(' ').map((n: string) => n[0]).join('') || ""}
                  size="sm"
                />
                <span className="font-medium hidden md:block">{authUser.fullName}</span>
              </div>
            </div>
          </div>
        </header>
        
        <div className="p-6">
          {/* Dashboard Section */}
          {activeSection === "dashboard" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-medium text-muted-foreground">Total Jobs</h3>
                      <Briefcase className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="text-2xl font-bold">
                      {jobs?.length || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Posted maintenance requests
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-medium text-muted-foreground">Active Jobs</h3>
                      <ArrowUpRight className="h-4 w-4 text-green-500" />
                    </div>
                    <div className="text-2xl font-bold">
                      {jobs?.filter(job => job.status === "open" || job.status === "in_progress").length || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Jobs in progress or awaiting bids
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-medium text-muted-foreground">Wallet Balance</h3>
                      <Wallet className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="text-2xl font-bold">
                      ${profile?.walletBalance?.toFixed(2) || "0.00"}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Available funds for projects
                    </p>
                  </CardContent>
                </Card>
              </div>
              
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
          
          {/* Jobs Section */}
          {activeSection === "jobs" && (
            <div className="space-y-6">
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
                      <option key={category} value={category.toLowerCase()}>{category}</option>
                    ))}
                  </select>
                  
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-2 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="draft">Draft</option>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
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
                <div className="grid grid-cols-1 gap-4">
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
                                {job.deadline ? new Date(job.deadline).toLocaleDateString() : 'No deadline'}
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
                                  {new Date(transaction.timestamp).toLocaleDateString()}
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
                      <Button onClick={() => setActiveSection("jobs")}>
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
                      <Button onClick={() => setActiveSection("jobs")}>
                        View Your Jobs
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Profile Section */}
          {activeSection === "profile" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>My Profile</CardTitle>
                  <CardDescription>Manage your profile information and settings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <UserProfileCard 
                      user={authUser}
                      allowEdit={true}
                      showDetails={true}
                      location={`${profile?.city || ''}, ${profile?.state || ''}`}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Settings Section */}
          {activeSection === "settings" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Account Settings</CardTitle>
                  <CardDescription>Manage your account preferences</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium mb-4">Notification Settings</h3>
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
                      </div>
                    </div>
                    
                    <Separator />
                    
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
                      <h3 className="text-lg font-medium mb-4">Account Actions</h3>
                      <div className="space-y-2">
                        <Button variant="outline" className="w-full sm:w-auto">Change Password</Button>
                        <Button variant="destructive" className="w-full sm:w-auto">Delete Account</Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
      
      {/* Job Creation Modal */}
      <Dialog open={isJobModalOpen} onOpenChange={setIsJobModalOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create a New Job</DialogTitle>
            <DialogDescription>
              Complete the form below to post a new maintenance job.
            </DialogDescription>
          </DialogHeader>
          
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={jobForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input placeholder="Street address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={jobForm.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="City" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={jobForm.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Province/State</FormLabel>
                        <FormControl>
                          <Input placeholder="Province" {...field} />
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
                  name="zipCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal/Zip Code</FormLabel>
                      <FormControl>
                        <Input placeholder="Postal code" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={jobForm.control}
                  name="deadline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deadline (Optional)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                  disabled={createJobMutation.isPending}
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
        <DialogContent className="sm:max-w-3xl">
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
                </TabsList>
                
                <TabsContent value="bids">
                  {isBidsLoading ? (
                    <div className="flex justify-center p-4">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : jobBids.length > 0 ? (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto p-1">
                      {jobBids.map((bid) => (
                        <Card key={bid.id} className="p-4">
                          <div className="flex justify-between">
                            <div>
                              <p className="font-medium">Contractor #{bid.contractorId}</p>
                              <div className="flex items-center text-sm text-muted-foreground">
                                <DollarSign className="h-3 w-3 mr-1" />
                                {bid.amount.toFixed(2)} CAD
                                <span className="mx-2">•</span>
                                <Clock className="h-3 w-3 mr-1" />
                                {bid.timeEstimate}
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
                          
                          <p className="text-sm mt-2 line-clamp-2">{bid.proposal}</p>
                          
                          {bid.status === "pending" && (
                            <div className="flex justify-end space-x-2 mt-2">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="text-red-500 hover:text-red-700"
                                onClick={() => rejectBid(bid.id)}
                              >
                                Reject
                              </Button>
                              <Button 
                                size="sm" 
                                onClick={() => acceptBid(bid.id)}
                              >
                                Accept
                              </Button>
                            </div>
                          )}
                          
                          {bid.status === "accepted" && selectedJob.status === "in_progress" && (
                            <div className="flex justify-end mt-2">
                              <Button 
                                size="sm" 
                                onClick={() => openReviewModal(selectedJob, bid.contractorId)}
                              >
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
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Full Address</p>
                      <p>
                        {selectedJob.location?.address}, {selectedJob.location?.city}, {selectedJob.location?.state} {selectedJob.location?.zip}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-muted-foreground">Posted On</p>
                      <p>{new Date(selectedJob.createdAt).toLocaleDateString()}</p>
                    </div>
                    
                    {selectedJob.deadline && (
                      <div>
                        <p className="text-sm text-muted-foreground">Deadline</p>
                        <p>{new Date(selectedJob.deadline).toLocaleDateString()}</p>
                      </div>
                    )}
                    
                    <div>
                      <p className="text-sm text-muted-foreground">Pricing Type</p>
                      <p className="capitalize">{selectedJob.pricingType.replace('_', ' ')}</p>
                    </div>
                  </div>
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
                completeJob(jobToReview.id);
              }}
              onCancel={() => setIsReviewModalOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}