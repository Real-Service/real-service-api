import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Job, Bid, Transaction, ContractorProfile, coordinateSchema } from "@shared/schema";
import { 
  Loader2, Wallet, List, FileText, Home, DollarSign, Star, Search, Building, Clock, Calendar, MapPin, Edit, 
  Save, SlidersHorizontal, ChevronDown, ChevronUp, ChevronRight, X, Filter, Pin, Info, RefreshCcw, CheckCircle2, 
  ImageIcon, MapIcon, MessageCircle, Briefcase, Heart, HeartOff, ShieldCheck, User, Bell, Settings, 
  ArrowUpRight, TrendingUp, Users, Layers, PieChart, SearchIcon, Inbox, LogOut, BarChart2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ReviewForm from "@/components/ReviewForm";
import { LocationSearch } from "@/components/LocationSearch";
import { ServiceAreaMapInput } from "@/components/ServiceAreaMapInput";
import { ServiceAreaDisplay } from "@/components/ServiceAreaDisplay";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { UserProfileCard } from "@/components/UserProfileCard";
import { JobCalendar } from "@/components/JobCalendar";
import { MobileNavigation } from "@/components/MobileNavigation";
import { ChatInterface } from "@/components/ChatInterface";
import { ProfileSettings } from "@/components/ProfileSettings";
import { AdminTools } from "@/components/AdminTools";

const bidSchema = z.object({
  amount: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "Amount must be a positive number",
  }),
  proposal: z.string().min(10, "Proposal must be at least 10 characters"),
  timeEstimate: z.string().min(3, "Please provide a time estimate"),
  proposedStartDate: z.date({
    required_error: "Please select a start date",
  }),
});

type BidFormValues = z.infer<typeof bidSchema>;

export default function ContractorDashboard() {
  const { toast } = useToast();
  const { user: authUser, logoutMutation } = useAuth();
  const [activeSection, setActiveSection] = useState("jobs");
  const [activeJobCategory, setActiveJobCategory] = useState("all"); // Options: all, fixed, open
  const [isEditingServiceArea, setIsEditingServiceArea] = useState(false);
  const [serviceAreaMarker, setServiceAreaMarker] = useState({
    latitude: 44.6488,
    longitude: -63.5752, // Halifax as default
  });
  const [serviceRadius, setServiceRadius] = useState(25);
  const [searchQuery, setSearchQuery] = useState("");
  const [bidModalOpen, setBidModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [jobToReview, setJobToReview] = useState<Job | null>(null);
  const [savedJobs, setSavedJobs] = useState<number[]>([]);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("open");
  const [filterDistance, setFilterDistance] = useState(100);

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

  // Update service area from profile data
  useEffect(() => {
    if (profileData?.serviceArea) {
      const { serviceArea, serviceRadius: radius } = profileData;
      if (serviceArea?.latitude && serviceArea?.longitude) {
        setServiceAreaMarker({
          latitude: serviceArea.latitude,
          longitude: serviceArea.longitude
        });
      }
      if (radius) {
        setServiceRadius(radius);
      }
    }
  }, [profileData]);

  // Get available jobs
  const { data: jobs = [], isLoading: isJobsLoading } = useQuery({
    queryKey: ['/api/jobs'],
    queryFn: async () => {
      const res = await fetch('/api/jobs');
      if (!res.ok) throw new Error('Failed to fetch jobs');
      return res.json();
    }
  });

  // Get my bids
  const { data: myBids = [], isLoading: isBidsLoading } = useQuery({
    queryKey: ['/api/bids', authUser?.id],
    queryFn: async () => {
      if (!authUser?.id) return [];
      const res = await fetch(`/api/bids?contractorId=${authUser.id}`);
      if (!res.ok) throw new Error('Failed to fetch bids');
      return res.json();
    },
    enabled: !!authUser?.id
  });
  
  // Get all contractor job data from the new API endpoint with structured response
  const { data: jobData = { availableJobs: [], activeJobs: [], myBids: [] }, isLoading: isDirectJobsLoading } = useQuery({
    queryKey: ['/api/contractor-jobs', authUser?.id],
    queryFn: async () => {
      if (!authUser?.id) return { availableJobs: [], activeJobs: [], myBids: [] };
      console.log("Fetching jobs for contractor:", authUser.id);
      
      // Get stored auth data
      const userData = sessionStorage.getItem('auth_user');
      let headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      // Add authentication headers
      if (userData) {
        try {
          const user = JSON.parse(userData);
          if (user && user.id) {
            headers["X-User-ID"] = String(user.id);
            headers["X-Auth-Token"] = `user-${user.id}-${Date.now()}`;
            headers["X-Auth-Timestamp"] = Date.now().toString();
            console.log("Using X-User-ID header:", user.id);
          }
        } catch (err) {
          console.error("Failed to parse stored user data:", err);
        }
      }
      
      // Add forced contractor ID for reliability
      headers["X-Contractor-ID"] = String(authUser.id);
      
      // Make the request with enhanced authentication
      const res = await fetch(`/api/contractor-jobs/${authUser.id}?_t=${Date.now()}`, {
        headers,
        credentials: "include"
      });
      
      if (!res.ok) {
        console.error("Failed to fetch contractor jobs:", await res.text());
        return { availableJobs: [], activeJobs: [], myBids: [] };
      }
      
      const data = await res.json();
      console.log("Contractor jobs response:", data);
      return data;
    },
    enabled: !!authUser?.id
  });
  
  // Extract data from the structured response
  const availableJobs = jobData?.availableJobs || [];
  const activeJobs = jobData?.activeJobs || [];
  const serverBids = jobData?.myBids || [];

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
      if (filterCategory !== "all" && (!job.categoryTags || !job.categoryTags.includes(filterCategory))) {
        return false;
      }
      
      return true;
    });
  }, [jobs, searchQuery, filterCategory, filterStatus]);
  
  // Filter available jobs based on search and filters
  const filteredAvailableJobs = useMemo(() => {
    if (!availableJobs?.length) return [];
    
    return availableJobs.filter((job: Job) => {
      // Filter by status
      if (filterStatus !== "all" && job.status !== filterStatus) return false;
      
      // Filter by search query
      if (searchQuery && !job.title.toLowerCase().includes(searchQuery.toLowerCase()) 
          && !job.description.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Filter by category
      if (filterCategory !== "all" && (!job.categoryTags || !job.categoryTags.includes(filterCategory))) {
        return false;
      }
      
      return true;
    });
  }, [availableJobs, searchQuery, filterCategory, filterStatus]);

  // Filter jobs based on job subcategory (all, fixed, open)
  const filterJobsByPricingType = useMemo(() => {
    if (!filteredAvailableJobs?.length) return [];
    
    // If 'all' is selected, don't filter by pricing type
    if (activeJobCategory === "all") return filteredAvailableJobs;
    
    // Filter by pricing type (fixed or open_bid)
    return filteredAvailableJobs.filter((job: Job) => {
      if (activeJobCategory === "fixed" && job.pricingType === "fixed") return true;
      if (activeJobCategory === "open" && job.pricingType === "open_bid") return true;
      return false;
    });
  }, [filteredAvailableJobs, activeJobCategory]);

  // Use activeJobs directly from the new API response
  const myJobs = useMemo(() => {
    // The activeJobs array from the API already contains both:
    // 1. Jobs with accepted bids from this contractor
    // 2. Jobs directly assigned to this contractor
    if (!activeJobs?.length) {
      console.log("No active jobs for this contractor");
      return [];
    }
    
    console.log("Active jobs from API:", activeJobs.length);
    
    // Additional filtering can be done here if needed
    return activeJobs;
  }, [activeJobs]);

  // Update service area
  const saveServiceArea = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "PATCH", 
        `/api/contractor-profile/${authUser?.id}`, 
        { 
          serviceArea: { 
            ...serviceAreaMarker,
            type: "Point" 
          },
          serviceRadius
        }
      );
      
      if (!res.ok) {
        throw new Error("Failed to update service area");
      }
      
      return res.json();
    },
    onSuccess: () => {
      setIsEditingServiceArea(false);
      toast({
        title: "Service area updated",
        description: "Your service area has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/contractor-profile', authUser?.id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Place bid on job
  const placeBidMutation = useMutation({
    mutationFn: async (data: BidFormValues) => {
      if (!authUser?.id || !selectedJob) {
        throw new Error("Missing job or user information");
      }
      
      const bidData = {
        jobId: selectedJob.id,
        contractorId: authUser.id,
        amount: parseFloat(data.amount),
        proposal: data.proposal,
        timeEstimate: data.timeEstimate,
        proposedStartDate: data.proposedStartDate,
        status: "pending"
      };
      
      const res = await apiRequest("POST", "/api/bids", bidData);
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to place bid");
      }
      
      return res.json();
    },
    onSuccess: () => {
      setBidModalOpen(false);
      bidForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/bids'] });
      toast({
        title: "Bid placed successfully",
        description: "Your bid has been submitted. You will be notified if it's accepted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Bid submission failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Update job progress
  const updateJobProgressMutation = useMutation({
    mutationFn: async ({ jobId, progress }: { jobId: number; progress: number }) => {
      const res = await apiRequest("PATCH", `/api/jobs/${jobId}/progress`, { progress });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update job progress");
      }
      return res.json();
    },
    onSuccess: () => {
      // Invalidate multiple query keys to ensure data is refreshed
      queryClient.invalidateQueries({ queryKey: ['/api/users', authUser?.id, 'jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: "Progress updated",
        description: "Job progress has been successfully updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Progress update failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Bid form
  const bidForm = useForm<BidFormValues>({
    resolver: zodResolver(bidSchema),
    defaultValues: {
      amount: "",
      proposal: "",
      timeEstimate: "",
    },
  });

  const onSubmitBidForm = (data: BidFormValues) => {
    placeBidMutation.mutate(data);
  };

  const openBidModal = (job: Job) => {
    setSelectedJob(job);
    setBidModalOpen(true);
  };
  
  const viewJobDetails = (job: Job) => {
    setSelectedJob(job);
    setIsDetailsModalOpen(true);
  };

  const toggleSaveJob = (jobId: number) => {
    if (savedJobs.includes(jobId)) {
      setSavedJobs(savedJobs.filter(id => id !== jobId));
    } else {
      setSavedJobs([...savedJobs, jobId]);
    }
  };

  const handleServiceRadiusChange = (value: number[]) => {
    setServiceRadius(value[0]);
  };

  const handleLogout = async () => {
    try {
      // Clear all local/session storage
      sessionStorage.clear();
      localStorage.clear();
      
      // Clear query client cache
      queryClient.clear();
      
      // Make the logout API call
      const response = await fetch('/api/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      // Show toast and redirect
      toast({
        title: "Logging out...",
        description: "You will be redirected shortly"
      });
      
      // Redirect to auth page after a short delay
      setTimeout(() => {
        window.location.href = '/auth';
      }, 300);
    } catch (error) {
      console.error('Logout error:', error);
      // Redirect even if there's an error
      window.location.href = '/auth';
    }
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
              className={`w-full justify-start text-white hover:bg-blue-800 ${activeSection === "jobs" ? "bg-blue-800" : ""}`}
              onClick={() => setActiveSection("jobs")}
            >
              <Briefcase className="h-5 w-5 mr-3" />
              <span>Jobs</span>
            </Button>
            
            <Button
              variant="ghost"
              className={`w-full justify-start text-white hover:bg-blue-800 ${activeSection === "inbox" ? "bg-blue-800" : ""}`}
              onClick={() => setActiveSection("inbox")}
            >
              <Inbox className="h-5 w-5 mr-3" />
              <span>Inbox</span>
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
            
            {/* Admin tools button */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-white hover:bg-blue-800"
                >
                  <RefreshCcw className="h-5 w-5 mr-3" />
                  <span>Admin Tools</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset Database</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete all jobs and bids in the database. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/reset-database', {
                          method: 'DELETE',
                          headers: {
                            'Content-Type': 'application/json'
                          }
                        });
                        
                        const data = await response.json();
                        
                        if (response.ok) {
                          toast({
                            title: "Success",
                            description: "Database reset successful! All jobs and bids have been deleted.",
                          });
                          
                          // Refresh the page after a short delay
                          setTimeout(() => {
                            window.location.reload();
                          }, 1500);
                        } else {
                          toast({
                            title: "Error",
                            description: `Failed to reset database: ${data.message || 'Unknown error'}`,
                            variant: "destructive"
                          });
                        }
                      } catch (error) {
                        toast({
                          title: "Error",
                          description: `Error resetting database: ${error instanceof Error ? error.message : 'Unknown error'}`,
                          variant: "destructive"
                        });
                      }
                    }}
                  >
                    Reset Database
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </nav>
        </div>
        
        <div className="p-4 border-t border-blue-800">
          {/* Logout moved to profile dropdown */}
        </div>
      </aside>
      
      {/* Main content area */}
      <main className="flex-1 overflow-auto">
        {/* Top navbar */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="flex justify-between items-center px-6 py-3">
            <div className="flex items-center">
              <h2 className="text-xl font-semibold">
                {activeSection === "jobs" && (
                  <>
                    Jobs
                    {activeJobCategory !== "all" && (
                      <span className="ml-2 text-sm text-muted-foreground">
                        {activeJobCategory === "fixed" ? "Fixed Price" : "Open Bid"}
                      </span>
                    )}
                  </>
                )}
                {activeSection === "inbox" && "Inbox"}
                {activeSection === "service-area" && "Service Area"}
                {activeSection === "profile" && "My Profile"}
                {activeSection === "settings" && "Settings"}
              </h2>
            </div>
            
            <div className="flex items-center space-x-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative p-0">
                    <Bell className="h-5 w-5 text-gray-500" />
                    {myBids.filter((bid: Bid) => bid.status === "accepted").length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                        {myBids.filter((bid: Bid) => bid.status === "accepted").length}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <div className="p-4 border-b">
                    <h3 className="font-medium">Notifications</h3>
                  </div>
                  <ScrollArea className="h-[300px]">
                    {myBids.filter((bid: Bid) => bid.status === "accepted").length > 0 ? (
                      <div className="divide-y">
                        {myBids.filter((bid: Bid) => bid.status === "accepted").map((bid: Bid) => {
                          const relatedJob = jobs.find(j => j.id === bid.jobId);
                          return (
                            <div key={bid.id} className="p-4 hover:bg-gray-50">
                              <div className="flex items-start gap-3">
                                <div className="bg-green-100 p-2 rounded-full">
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                </div>
                                <div>
                                  <p className="font-medium">Bid Accepted!</p>
                                  <p className="text-sm text-muted-foreground">
                                    Your bid for "{relatedJob?.title}" has been accepted
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {new Date(bid.updatedAt).toLocaleDateString()}
                                  </p>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="mt-2"
                                    onClick={() => {
                                      setActiveSection("inbox");
                                      const relatedJob = jobs.find(j => j.id === bid.jobId);
                                      if (relatedJob) {
                                        viewJobDetails(relatedJob);
                                      }
                                    }}
                                  >
                                    View Details
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 text-center">
                        <p className="text-muted-foreground">No new notifications</p>
                      </div>
                    )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex items-center space-x-2 p-1">
                    <ProfileAvatar 
                      src={profileData?.profilePicture} 
                      alt={authUser.fullName || ""}
                      initials={authUser.fullName?.split(' ').map((n: string) => n[0]).join('') || ""}
                      size="sm"
                    />
                    <span className="font-medium hidden md:block">{authUser.fullName}</span>
                    <ChevronDown className="h-4 w-4 hidden md:block" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="end">
                  <div className="flex flex-col space-y-2">
                    <Button 
                      variant="ghost" 
                      className="justify-start" 
                      onClick={() => setActiveSection("profile")}
                    >
                      <User className="h-4 w-4 mr-2" />
                      My Profile
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="justify-start" 
                      onClick={() => setActiveSection("settings")}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </Button>
                    <Separator className="my-1" />
                    <Button 
                      variant="ghost" 
                      className="justify-start text-red-500 hover:text-red-500 hover:bg-red-50" 
                      onClick={handleLogout}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </header>
        
        <div className="p-6">
          {/* Dashboard section completely removed */}
          

          
          {/* Jobs Section */}
          {activeSection === "jobs" && (
            <div className="space-y-6 w-full overflow-x-hidden">
              <div className="flex flex-col sm:flex-row gap-4 justify-between">
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
                    <option value="plumbing">Plumbing</option>
                    <option value="electrical">Electrical</option>
                    <option value="carpentry">Carpentry</option>
                    <option value="painting">Painting</option>
                    <option value="landscaping">Landscaping</option>
                    <option value="cleaning">Cleaning</option>
                    <option value="general">General</option>
                  </select>
                  
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-2 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
              
              {/* Job subcategory tabs - mobile view */}
              <div className="mb-4 px-4 md:hidden">
                <div className="flex space-x-2 overflow-x-auto pb-2 hide-scrollbar">
                  <Button 
                    variant={activeJobCategory === "all" ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setActiveJobCategory("all")}
                  >
                    All Jobs
                  </Button>
                  <Button 
                    variant={activeJobCategory === "fixed" ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setActiveJobCategory("fixed")}
                  >
                    Fixed Price
                  </Button>
                  <Button 
                    variant={activeJobCategory === "open" ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setActiveJobCategory("open")}
                  >
                    Open Bid
                  </Button>
                </div>
              </div>
              
              {/* Job subcategory sections - desktop view - Settings style tabs */}
              <div className="hidden md:block mt-6 mb-0">
                <Tabs value={activeJobCategory} onValueChange={setActiveJobCategory} className="w-full">
                  <TabsList className="w-full mb-4">
                    <TabsTrigger 
                      value="all" 
                      className="flex-1 flex items-center justify-center"
                      onClick={() => setActiveJobCategory("all")}
                    >
                      <Briefcase className="h-4 w-4 mr-2" />
                      All Jobs
                    </TabsTrigger>
                    <TabsTrigger 
                      value="fixed" 
                      className="flex-1 flex items-center justify-center"
                      onClick={() => setActiveJobCategory("fixed")}
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Fixed Price
                    </TabsTrigger>
                    <TabsTrigger 
                      value="open" 
                      className="flex-1 flex items-center justify-center"
                      onClick={() => setActiveJobCategory("open")}
                    >
                      <BarChart2 className="h-4 w-4 mr-2" />
                      Open Bid
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              
              {/* Content container - styled with card component */}
              <div className="hidden md:block mb-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle>
                      {activeJobCategory === "all" ? "All Available Jobs" : 
                       activeJobCategory === "fixed" ? "Fixed Price Jobs" : 
                       "Open Bid Jobs"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isDirectJobsLoading ? (
                      <div className="flex justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : (filterJobsByPricingType?.length > 0) ? (
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-[1800px] mx-auto">
                        {filterJobsByPricingType.map((job) => (
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
                                      {job.startDate ? new Date(job.startDate).toLocaleDateString() : 'Flexible'}
                                    </div>
                                  </div>
                                  
                                  <div className="flex space-x-2">
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      onClick={() => toggleSaveJob(job.id)}
                                    >
                                      {savedJobs.includes(job.id) ? (
                                        <Heart className="h-5 w-5 fill-primary text-primary" />
                                      ) : (
                                        <Heart className="h-5 w-5" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                                
                                <div className="flex flex-wrap gap-2 mb-2">
                                  <Badge variant="secondary">{job.pricingType === "fixed" ? "Fixed Price" : "Open Bid"}</Badge>
                                  {job.categoryTags && job.categoryTags.map((tag, i) => (
                                    <Badge key={i} variant="outline">{tag}</Badge>
                                  ))}
                                  <Badge
                                    variant={
                                      job.status === "open" ? "default" :
                                      job.status === "in_progress" ? "secondary" :
                                      job.status === "completed" ? "outline" : "destructive"
                                    }
                                  >
                                    {job.status.replace('_', ' ')}
                                  </Badge>
                                </div>
                                
                                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                                  {job.description}
                                </p>
                                
                                <div className="flex justify-between items-center">
                                  <div className="font-bold text-xl">
                                    {job.budget ? `$${job.budget.toFixed(2)}` : 'Open Budget'}
                                  </div>
                                  
                                  <div className="flex space-x-2">
                                    {myBids.find((bid: Bid) => bid.jobId === job.id) && (
                                      <div className="text-sm bg-muted px-3 py-1 rounded-full flex items-center">
                                        <DollarSign className="h-3 w-3 mr-1" />
                                        Your bid: ${myBids.find((bid: Bid) => bid.jobId === job.id).amount.toFixed(2)}
                                      </div>
                                    )}
                                    
                                    <Button
                                      onClick={() => openBidModal(job)}
                                      disabled={job.status !== "open" || myBids.some((bid: Bid) => bid.jobId === job.id)}
                                    >
                                      {myBids.some((bid: Bid) => bid.jobId === job.id) ? "Bid Placed" : "Place Bid"}
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
                          <h3 className="text-lg font-medium">No Available Jobs Found</h3>
                          <p className="text-muted-foreground mb-4">
                            All open jobs in your area have been assigned to your active jobs. 
                            Check back later for new opportunities.
                          </p>
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              setSearchQuery("");
                              setFilterCategory("all");
                              setFilterStatus("open");
                            }}
                          >
                            Reset Filters
                          </Button>
                        </CardContent>
                      </Card>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
          
          {/* Inbox Section */}
          {activeSection === "inbox" && (
            <div className="space-y-6">
              {/* Stats Cards Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Pending Bids</p>
                      <p className="text-2xl font-bold">{myBids.filter((bid: Bid) => bid.status === "pending").length}</p>
                    </div>
                    <div className="bg-blue-200 dark:bg-blue-800 p-2 rounded-full">
                      <FileText className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Active Jobs</p>
                      <p className="text-2xl font-bold">{myJobs.filter(job => job.status === "in_progress").length}</p>
                    </div>
                    <div className="bg-green-200 dark:bg-green-800 p-2 rounded-full">
                      <Briefcase className="h-5 w-5 text-green-600 dark:text-green-300" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Available Jobs</p>
                      <p className="text-2xl font-bold">{jobs.filter(job => job.status === "open").length}</p>
                    </div>
                    <div className="bg-purple-200 dark:bg-purple-800 p-2 rounded-full">
                      <Search className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Calendar Quick View */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl">Upcoming Schedule</CardTitle>
                </CardHeader>
                <CardContent>
                  <JobCalendar 
                    jobs={activeJobs?.length ? activeJobs : myJobs} 
                    userType="contractor" 
                    onViewJobDetails={viewJobDetails}
                  />
                </CardContent>
              </Card>
              
              <Tabs defaultValue="my-bids" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="my-bids">My Bids</TabsTrigger>
                  <TabsTrigger value="active-jobs">Active Jobs</TabsTrigger>
                </TabsList>
                <TabsContent value="my-bids">
                  <Card>
                    <CardHeader>
                      <CardTitle>My Bids</CardTitle>
                      <CardDescription>Track all your submitted bids</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isBidsLoading ? (
                        <div className="flex justify-center p-8">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                      ) : myBids.length > 0 ? (
                        <div className="space-y-4">
                          <Tabs defaultValue="pending">
                            <TabsList className="grid w-full grid-cols-3">
                              <TabsTrigger value="pending">Pending</TabsTrigger>
                              <TabsTrigger value="accepted">Accepted</TabsTrigger>
                              <TabsTrigger value="rejected">Rejected</TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="pending">
                              <div className="space-y-4 mt-4">
                                {myBids.filter((bid: Bid) => bid.status === "pending").map((bid: Bid) => {
                                  const job = jobs.find(j => j.id === bid.jobId);
                                  return job ? (
                                    <Card key={bid.id}>
                                      <CardContent className="p-4">
                                        <div className="flex justify-between">
                                          <div>
                                            <h3 className="font-semibold">{job.title}</h3>
                                            <p className="text-sm text-muted-foreground">
                                              {job.location?.city}, {job.location?.state}
                                            </p>
                                          </div>
                                          <Badge>Pending</Badge>
                                        </div>
                                        <Separator className="my-3" />
                                        <div className="grid grid-cols-2 gap-4">
                                          <div>
                                            <p className="text-sm font-medium">Your Bid</p>
                                            <p className="text-lg font-bold">${bid.amount.toFixed(2)}</p>
                                          </div>
                                          <div>
                                            <p className="text-sm font-medium">Time Estimate</p>
                                            <p>{bid.timeEstimate}</p>
                                          </div>
                                        </div>
                                        <Separator className="my-3" />
                                        <div>
                                          <p className="text-sm font-medium">Your Proposal</p>
                                          <p className="text-sm line-clamp-2">{bid.proposal}</p>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ) : null;
                                })}
                                
                                {myBids.filter((bid: Bid) => bid.status === "pending").length === 0 && (
                                  <div className="text-center p-6">
                                    <p className="text-muted-foreground">No pending bids</p>
                                  </div>
                                )}
                              </div>
                            </TabsContent>
                            
                            <TabsContent value="accepted">
                              <div className="space-y-4 mt-4">
                                {myBids.filter((bid: Bid) => bid.status === "accepted").map((bid: Bid) => {
                                  const job = jobs.find(j => j.id === bid.jobId);
                                  return job ? (
                                    <Card key={bid.id}>
                                      <CardContent className="p-4">
                                        <div className="flex justify-between">
                                          <div>
                                            <h3 className="font-semibold">{job.title}</h3>
                                            <p className="text-sm text-muted-foreground">
                                              {job.location?.city}, {job.location?.state}
                                            </p>
                                          </div>
                                          <Badge className="bg-green-600">Accepted</Badge>
                                        </div>
                                        <Separator className="my-3" />
                                        <div className="grid grid-cols-2 gap-4">
                                          <div>
                                            <p className="text-sm font-medium">Your Bid</p>
                                            <p className="text-lg font-bold">${bid.amount.toFixed(2)}</p>
                                          </div>
                                          <div>
                                            <p className="text-sm font-medium">Time Estimate</p>
                                            <p>{bid.timeEstimate}</p>
                                          </div>
                                        </div>
                                        <Separator className="my-3" />
                                        <div className="flex justify-between">
                                          <Button 
                                            size="sm" 
                                            variant="outline"
                                            onClick={() => viewJobDetails(job)}
                                          >
                                            View Job Details
                                          </Button>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ) : null;
                                })}
                                
                                {myBids.filter((bid: Bid) => bid.status === "accepted").length === 0 && (
                                  <div className="text-center p-6">
                                    <p className="text-muted-foreground">No accepted bids</p>
                                  </div>
                                )}
                              </div>
                            </TabsContent>
                            
                            <TabsContent value="rejected">
                              <div className="space-y-4 mt-4">
                                {myBids.filter((bid: Bid) => bid.status === "rejected").map((bid: Bid) => {
                                  const job = jobs.find(j => j.id === bid.jobId);
                                  return job ? (
                                    <Card key={bid.id}>
                                      <CardContent className="p-4">
                                        <div className="flex justify-between">
                                          <div>
                                            <h3 className="font-semibold">{job.title}</h3>
                                            <p className="text-sm text-muted-foreground">
                                              {job.location?.city}, {job.location?.state}
                                            </p>
                                          </div>
                                          <Badge variant="destructive">Rejected</Badge>
                                        </div>
                                        <Separator className="my-3" />
                                        <div className="grid grid-cols-2 gap-4">
                                          <div>
                                            <p className="text-sm font-medium">Your Bid</p>
                                            <p className="text-lg font-bold">${bid.amount.toFixed(2)}</p>
                                          </div>
                                          <div>
                                            <p className="text-sm font-medium">Time Estimate</p>
                                            <p>{bid.timeEstimate}</p>
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ) : null;
                                })}
                                
                                {myBids.filter((bid: Bid) => bid.status === "rejected").length === 0 && (
                                  <div className="text-center p-6">
                                    <p className="text-muted-foreground">No rejected bids</p>
                                  </div>
                                )}
                              </div>
                            </TabsContent>
                          </Tabs>
                        </div>
                      ) : (
                        <div className="text-center p-8">
                          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <h3 className="text-lg font-medium">No Bids Yet</h3>
                          <p className="text-muted-foreground mb-4">
                            You haven't placed any bids on jobs yet.
                          </p>
                          <Button onClick={() => setActiveSection("jobs")}>
                            Browse Available Jobs
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="active-jobs">
                  <div className="space-y-6">
                    <JobCalendar 
                      jobs={activeJobs?.length ? activeJobs : myJobs} 
                      userType="contractor" 
                      onViewJobDetails={viewJobDetails}
                    />
                    
                    <Card>
                      <CardHeader>
                        <CardTitle>Active Jobs</CardTitle>
                        <CardDescription>Jobs where your bid was accepted or you've been directly assigned</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {isDirectJobsLoading || isJobsLoading || isBidsLoading ? (
                          <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          </div>
                        ) : (activeJobs?.length || myJobs.length) > 0 ? (
                          <div className="space-y-4">
                            {(activeJobs?.length ? activeJobs : myJobs).map((job) => (
                              <Card key={job.id} data-job-id={job.id}>
                                <CardContent className="p-6">
                                  <div className="flex justify-between mb-2">
                                    <h3 className="text-lg font-bold">{job.title}</h3>
                                    <Badge
                                      variant={
                                        job.status === "in_progress" ? "secondary" :
                                        job.status === "completed" ? "outline" : "default"
                                      }
                                    >
                                      {job.status.replace('_', ' ')}
                                    </Badge>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <div>
                                      <p className="text-sm text-muted-foreground">Location</p>
                                      <p className="font-medium">
                                        {job.location?.city}, {job.location?.state}
                                      </p>
                                    </div>
                                    
                                    <div>
                                      <p className="text-sm text-muted-foreground">Payment</p>
                                      <p className="font-medium">
                                        ${myBids.find((bid: Bid) => bid.jobId === job.id && bid.status === "accepted")?.amount.toFixed(2) || job.budget?.toFixed(2) || "N/A"}
                                      </p>
                                    </div>
                                    
                                    {job.status === "in_progress" && (
                                      <div>
                                        <p className="text-sm text-muted-foreground">Progress</p>
                                        <div className="flex items-center gap-2">
                                          <Progress value={job.progress || 0} className="flex-1" />
                                          <span className="text-sm font-medium">{job.progress || 0}%</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="flex flex-wrap gap-2">
                                    <Button variant="outline" size="sm" onClick={() => viewJobDetails(job)}>
                                      <Info className="h-4 w-4 mr-1" />
                                      Details
                                    </Button>
                                    
                                    {job.status === "in_progress" && (
                                      <Dialog>
                                        <DialogTrigger asChild>
                                          <Button variant="outline" size="sm">
                                            <TrendingUp className="h-4 w-4 mr-1" />
                                            Update Progress
                                          </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                          <DialogHeader>
                                            <DialogTitle>Update Job Progress</DialogTitle>
                                          </DialogHeader>
                                          <div className="space-y-4 py-4">
                                            <div className="space-y-2">
                                              <Label>Current Progress: {job.progress || 0}%</Label>
                                              <Slider
                                                value={[job.progress || 0]}
                                                min={0}
                                                max={100}
                                                step={5}
                                                onValueChange={(value) => {
                                                  if (value[0] === 100) {
                                                    setJobToReview(job);
                                                    setIsReviewModalOpen(true);
                                                  } else {
                                                    updateJobProgressMutation.mutate({
                                                      jobId: job.id,
                                                      progress: value[0]
                                                    });
                                                  }
                                                }}
                                              />
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                              Move the slider to update your progress on this job. At 100%, you'll be prompted to leave a review and mark the job as complete.
                                            </p>
                                          </div>
                                        </DialogContent>
                                      </Dialog>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center p-8">
                            <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-medium">No Active Jobs</h3>
                            <p className="text-muted-foreground mb-4">
                              You don't have any active jobs at the moment.
                            </p>
                            <Button onClick={() => setActiveSection("jobs")}>
                              Browse Available Jobs
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
              
              {/* Recent Jobs Section */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-xl">Recent Jobs</CardTitle>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      className="text-blue-600 hover:text-blue-800 font-medium px-2"
                      onClick={() => setActiveSection("jobs")}
                    >
                      View All <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {isJobsLoading ? (
                    <div className="flex justify-center p-6">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : jobs.filter((job: Job) => job.status === "open").length > 0 ? (
                    <div className="space-y-4">
                      {jobs.filter((job: Job) => job.status === "open")
                        .sort((a: Job, b: Job) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .slice(0, 3)
                        .map((job: Job) => (
                          <div key={job.id} className="flex items-start space-x-4 p-2 hover:bg-accent rounded-lg transition-colors">
                            <div className="bg-primary/10 p-2 rounded-full">
                              <Briefcase className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium">{job.title}</h4>
                                <Badge variant="outline">${job.budget?.toFixed(2) || "Open Bid"}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">{job.description}</p>
                              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                <span>{job.location?.city}, {job.location?.state}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => setActiveSection("jobs")}
                      >
                        View All Available Jobs
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center p-6">
                      <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium">No Jobs Available</h3>
                      <p className="text-muted-foreground mb-4">
                        There are no jobs matching your skills and preferences at the moment.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* DEPRECATED - My Bids Section - Keep for reference */}
          {false && activeSection === "my-bids" && (
            <div className="space-y-6 w-full overflow-x-hidden">
              <Card>
                <CardHeader>
                  <CardTitle>My Bids</CardTitle>
                  <CardDescription>Track all your submitted bids</CardDescription>
                </CardHeader>
                <CardContent>
                  {isBidsLoading ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : myBids.length > 0 ? (
                    <div className="space-y-4">
                      <Tabs defaultValue="pending">
                        <TabsList className="grid w-full grid-cols-3">
                          <TabsTrigger value="pending">Pending</TabsTrigger>
                          <TabsTrigger value="accepted">Accepted</TabsTrigger>
                          <TabsTrigger value="rejected">Rejected</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="pending">
                          <div className="space-y-4 mt-4">
                            {myBids.filter((bid: Bid) => bid.status === "pending").map((bid: Bid) => {
                              const job = jobs.find(j => j.id === bid.jobId);
                              return job ? (
                                <Card key={bid.id}>
                                  <CardContent className="p-4">
                                    <div className="flex justify-between">
                                      <div>
                                        <h3 className="font-semibold">{job.title}</h3>
                                        <p className="text-sm text-muted-foreground">
                                          {job.location?.city}, {job.location?.state}
                                        </p>
                                      </div>
                                      <Badge>Pending</Badge>
                                    </div>
                                    <Separator className="my-3" />
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <p className="text-sm font-medium">Your Bid</p>
                                        <p className="text-lg font-bold">${bid.amount.toFixed(2)}</p>
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium">Time Estimate</p>
                                        <p>{bid.timeEstimate}</p>
                                      </div>
                                    </div>
                                    <Separator className="my-3" />
                                    <div>
                                      <p className="text-sm font-medium">Your Proposal</p>
                                      <p className="text-sm line-clamp-2">{bid.proposal}</p>
                                    </div>
                                  </CardContent>
                                </Card>
                              ) : null;
                            })}
                            
                            {myBids.filter((bid: Bid) => bid.status === "pending").length === 0 && (
                              <div className="text-center p-6">
                                <p className="text-muted-foreground">No pending bids</p>
                              </div>
                            )}
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="accepted">
                          <div className="space-y-4 mt-4">
                            {myBids.filter((bid: Bid) => bid.status === "accepted").map((bid: Bid) => {
                              const job = jobs.find(j => j.id === bid.jobId);
                              return job ? (
                                <Card key={bid.id}>
                                  <CardContent className="p-4">
                                    <div className="flex justify-between">
                                      <div>
                                        <h3 className="font-semibold">{job.title}</h3>
                                        <p className="text-sm text-muted-foreground">
                                          {job.location?.city}, {job.location?.state}
                                        </p>
                                      </div>
                                      <Badge className="bg-green-600">Accepted</Badge>
                                    </div>
                                    <Separator className="my-3" />
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <p className="text-sm font-medium">Your Bid</p>
                                        <p className="text-lg font-bold">${bid.amount.toFixed(2)}</p>
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium">Time Estimate</p>
                                        <p>{bid.timeEstimate}</p>
                                      </div>
                                    </div>
                                    <Separator className="my-3" />
                                    <div className="flex justify-between">
                                      <Dialog>
                                        <DialogTrigger asChild>
                                          <Button variant="outline" size="sm" className="flex items-center gap-1">
                                            <MessageCircle className="h-4 w-4" />
                                            Chat
                                          </Button>
                                        </DialogTrigger>
                                        <DialogContent 
                                          className="max-w-4xl max-h-[90vh] h-[80vh] p-0"
                                          aria-describedby={`job-chat-dialog-${job.id}`}
                                        >
                                          <DialogHeader className="px-6 py-4 border-b">
                                            <DialogTitle>Chat - {job.title}</DialogTitle>
                                            <DialogDescription id={`job-chat-dialog-${job.id}`} className="sr-only">
                                              Chat with client for job: {job.title}
                                            </DialogDescription>
                                          </DialogHeader>
                                          <div className="h-full">
                                            {(job.chatRoomId || job.id) && (
                                              <ChatInterface 
                                                chatRoomId={job.chatRoomId || job.id} 
                                                userId={authUser?.id || 0} 
                                                userName={authUser?.fullName || authUser?.username || ""} 
                                                otherUserName={job.landlordName || "Landlord"}
                                                isJobId={!job.chatRoomId && !!job.id}
                                                className="h-[calc(100%-70px)]"
                                              />
                                            )}
                                            {!job.chatRoomId && (
                                              <div className="flex flex-col items-center justify-center h-64">
                                                <p className="text-muted-foreground">Chat not available for this job yet.</p>
                                              </div>
                                            )}
                                          </div>
                                        </DialogContent>
                                      </Dialog>
                                      <Button size="sm">View Job Details</Button>
                                    </div>
                                  </CardContent>
                                </Card>
                              ) : null;
                            })}
                            
                            {myBids.filter((bid: Bid) => bid.status === "accepted").length === 0 && (
                              <div className="text-center p-6">
                                <p className="text-muted-foreground">No accepted bids</p>
                              </div>
                            )}
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="rejected">
                          <div className="space-y-4 mt-4">
                            {myBids.filter((bid: Bid) => bid.status === "rejected").map((bid: Bid) => {
                              const job = jobs.find(j => j.id === bid.jobId);
                              return job ? (
                                <Card key={bid.id}>
                                  <CardContent className="p-4">
                                    <div className="flex justify-between">
                                      <div>
                                        <h3 className="font-semibold">{job.title}</h3>
                                        <p className="text-sm text-muted-foreground">
                                          {job.location?.city}, {job.location?.state}
                                        </p>
                                      </div>
                                      <Badge variant="destructive">Rejected</Badge>
                                    </div>
                                    <Separator className="my-3" />
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <p className="text-sm font-medium">Your Bid</p>
                                        <p className="text-lg font-bold">${bid.amount.toFixed(2)}</p>
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium">Time Estimate</p>
                                        <p>{bid.timeEstimate}</p>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ) : null;
                            })}
                            
                            {myBids.filter((bid: Bid) => bid.status === "rejected").length === 0 && (
                              <div className="text-center p-6">
                                <p className="text-muted-foreground">No rejected bids</p>
                              </div>
                            )}
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>
                  ) : (
                    <div className="text-center p-8">
                      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium">No Bids Yet</h3>
                      <p className="text-muted-foreground mb-4">
                        You haven't placed any bids on jobs yet.
                      </p>
                      <Button onClick={() => setActiveSection("inbox")}>
                        Go to Inbox
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Active Jobs Section */}
          {activeSection === "active-jobs" && (
            <div className="space-y-6 w-full overflow-x-hidden">
              {/* Use our direct API for the job calendar to improve reliability */}
              <JobCalendar 
                jobs={activeJobs?.length ? activeJobs : myJobs} 
                userType="contractor" 
                onViewJobDetails={viewJobDetails}
              />
              
              {isDirectJobsLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {/* Debug information for testing */}
                  <div className="p-4 bg-gray-100 rounded-md mb-2 text-xs">
                    <p><strong>Debug:</strong> Found {activeJobs?.length || 0} active jobs and {availableJobs?.length || 0} available jobs</p>
                  </div>
                </>
              )}
            
              <Card>
                <CardHeader>
                  <CardTitle>Active Jobs</CardTitle>
                  <CardDescription>Jobs where your bid was accepted or you've been directly assigned</CardDescription>
                </CardHeader>
                <CardContent>
                  {isDirectJobsLoading || isJobsLoading || isBidsLoading ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : (activeJobs?.length || myJobs.length) > 0 ? (
                    <div className="space-y-4">
                      {/* Use active jobs from API */}
                      {(activeJobs?.length ? activeJobs : myJobs).map((job) => (
                        <Card key={job.id} data-job-id={job.id}>
                          <CardContent className="p-6">
                            <div className="flex justify-between mb-2">
                              <h3 className="text-lg font-bold">{job.title}</h3>
                              <Badge
                                variant={
                                  job.status === "in_progress" ? "secondary" :
                                  job.status === "completed" ? "outline" : "default"
                                }
                              >
                                {job.status.replace('_', ' ')}
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                              <div>
                                <p className="text-sm text-muted-foreground">Location</p>
                                <p className="font-medium">
                                  {job.location?.city}, {job.location?.state}
                                </p>
                              </div>
                              
                              <div>
                                <p className="text-sm text-muted-foreground">Start Date</p>
                                <p className="font-medium">
                                  {job.startDate ? new Date(job.startDate).toLocaleDateString() : 'Flexible'}
                                </p>
                              </div>
                              
                              <div>
                                <p className="text-sm text-muted-foreground">Contract Amount</p>
                                <p className="font-bold">
                                  ${myBids.find((bid: Bid) => bid.jobId === job.id && bid.status === "accepted")?.amount.toFixed(2)}
                                </p>
                              </div>
                            </div>
                            
                            {/* Job Progress Slider */}
                            {job.status === "in_progress" && (
                              <div className="mb-6 mt-2">
                                <div className="flex justify-between items-center mb-2">
                                  <p className="text-sm font-medium">Job Progress</p>
                                  <p className="text-sm font-medium">{job.progress || 0}%</p>
                                </div>
                                <div className="flex items-center space-x-4">
                                  <Slider
                                    defaultValue={[job.progress || 0]}
                                    max={100}
                                    step={5}
                                    className="flex-1"
                                    onValueCommit={(value) => {
                                      updateJobProgressMutation.mutate({
                                        jobId: job.id,
                                        progress: value[0]
                                      });
                                    }}
                                  />
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    disabled={job.progress === 100}
                                    onClick={() => {
                                      setJobToReview(job);
                                      setIsReviewModalOpen(true);
                                    }}
                                  >
                                    Mark Complete
                                  </Button>
                                </div>
                              </div>
                            )}
                            
                            <div className="flex justify-end space-x-2">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="outline"
                                    data-dialog-trigger="chat"
                                  >
                                    <MessageCircle className="mr-2 h-4 w-4" />
                                    Message Client
                                  </Button>
                                </DialogTrigger>
                                <DialogContent 
                                  className="max-w-4xl max-h-[90vh] h-[80vh] p-0"
                                  aria-describedby={`chat-dialog-${job.id}`}
                                >
                                  <DialogHeader className="px-6 py-4 border-b">
                                    <DialogTitle>Chat - {job.title}</DialogTitle>
                                    <DialogDescription id={`chat-dialog-${job.id}`} className="sr-only">
                                      Chat with client for job: {job.title}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="h-full">
                                    {(job.chatRoomId || job.id) && (
                                      <ChatInterface 
                                        chatRoomId={job.chatRoomId || job.id} 
                                        userId={authUser?.id || 0} 
                                        userName={authUser?.fullName || authUser?.username || ""} 
                                        otherUserName={job.landlordName || "Landlord"}
                                        className="h-[calc(100%-70px)]"
                                        isJobId={!job.chatRoomId && !!job.id}
                                      />
                                    )}
                                    {!job.chatRoomId && !job.id && (
                                      <div className="flex flex-col items-center justify-center h-64">
                                        <p className="text-muted-foreground">Chat not available for this job yet.</p>
                                      </div>
                                    )}
                                  </div>
                                </DialogContent>
                              </Dialog>
                              <Button onClick={() => viewJobDetails(job)}>View Details</Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center p-8">
                      <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium">No Active Jobs</h3>
                      <p className="text-muted-foreground mb-4">
                        You don't have any active jobs at the moment.
                        When a landlord accepts your bid or assigns you directly to a job, 
                        it will appear here with all communication tools and progress tracking features.
                      </p>
                      <Button onClick={() => setActiveSection("jobs")}>
                        Check New Job Opportunities
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
                  <TabsTrigger value="service-area" className="flex-1">Service Area</TabsTrigger>
                  <TabsTrigger value="account" className="flex-1">Account</TabsTrigger>
                </TabsList>
                
                <TabsContent value="profile">
                  <Card>
                    <CardHeader>
                      <CardTitle>My Profile</CardTitle>
                      <CardDescription>View and update your professional profile</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 sm:p-6">
                      {!isProfileLoading && authUser ? (
                        <ProfileSettings user={authUser} />
                      ) : (
                        <div className="flex items-center justify-center p-8">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="service-area">
                  <Card>
                    <CardHeader>
                      <CardTitle>Service Area Settings</CardTitle>
                      <CardDescription>Define the geographic area where you provide services</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {!isEditingServiceArea ? (
                        <div className="space-y-6">
                          <div className="h-[400px] rounded-md overflow-hidden">
                            <ServiceAreaDisplay
                              longitude={serviceAreaMarker.longitude}
                              latitude={serviceAreaMarker.latitude}
                              radius={serviceRadius}
                              height="400px"
                            />
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Service Radius</p>
                              <p className="text-2xl font-bold">{serviceRadius} km</p>
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Location</p>
                              <p className="text-lg font-medium">
                                {profileData?.city || ''}, {profileData?.state || ''}
                              </p>
                            </div>
                            
                            <div className="flex items-end">
                              <Button onClick={() => setIsEditingServiceArea(true)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Service Area
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                            <div>
                              <Label htmlFor="location">Service Center Location</Label>
                              <LocationSearch
                                onSelectLocation={(location) => {
                                  setServiceAreaMarker({
                                    latitude: location.latitude,
                                    longitude: location.longitude
                                  });
                                }}
                                defaultValue={`${profileData?.city || ''}, ${profileData?.state || ''}`}
                                placeholder="Search for your city or address"
                              />
                            </div>
                            
                            <div>
                              <Label>Service Radius: {serviceRadius} km</Label>
                              <Slider
                                value={[serviceRadius]}
                                min={5}
                                max={150}
                                step={5}
                                onValueChange={handleServiceRadiusChange}
                                className="mt-8"
                              />
                            </div>
                          </div>
                          
                          <div className="h-[400px] rounded-md overflow-hidden mb-4">
                            <ServiceAreaMapInput
                              longitude={serviceAreaMarker.longitude}
                              latitude={serviceAreaMarker.latitude}
                              radius={serviceRadius}
                              onMarkerChange={(marker) => setServiceAreaMarker(marker)}
                              interactive={true}
                              height="400px"
                            />
                          </div>
                          
                          <div className="flex justify-end space-x-2">
                            <Button 
                              variant="outline" 
                              onClick={() => setIsEditingServiceArea(false)}
                            >
                              Cancel
                            </Button>
                            <Button 
                              onClick={() => saveServiceArea.mutate()}
                              disabled={saveServiceArea.isPending}
                            >
                              {saveServiceArea.isPending ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <Save className="mr-2 h-4 w-4" />
                                  Save Service Area
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="account">
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
                          <h3 className="text-lg font-medium mb-4">Privacy Settings</h3>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">Profile Visibility</p>
                                <p className="text-sm text-muted-foreground">Make your profile visible to potential clients</p>
                              </div>
                              <Switch defaultChecked />
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
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </main>
      
      {/* Bid Modal */}
      <Dialog open={bidModalOpen} onOpenChange={setBidModalOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" aria-describedby="bid-details-description">
          <DialogHeader className="sticky top-0 bg-background z-10 pb-2 mb-2 border-b">
            <DialogTitle>Place Bid on Job</DialogTitle>
            <DialogDescription id="bid-details-description">
              Provide your bid details for: {selectedJob?.title}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...bidForm}>
            <form onSubmit={bidForm.handleSubmit(onSubmitBidForm)} className="space-y-4">
              <FormField
                control={bidForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bid Amount ($)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={bidForm.control}
                name="timeEstimate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time Estimate</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 2-3 days, 1 week" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={bidForm.control}
                name="proposal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proposal</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe your approach, experience, and why you're the right contractor for this job" 
                        className="min-h-[100px]" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={bidForm.control}
                name="proposedStartDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Proposed Start Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={`w-full pl-3 text-left font-normal ${!field.value ? "text-muted-foreground" : ""}`}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <Calendar className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setBidModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={placeBidMutation.isPending}>
                  {placeBidMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Bid"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      {/* Job Details Modal */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="job-details-description">
          <DialogHeader className="sticky top-0 bg-background z-10 pb-2 mb-2 border-b">
            <DialogTitle>Job Details</DialogTitle>
            <DialogDescription id="job-details-description">
              Complete information about this job
            </DialogDescription>
          </DialogHeader>
          
          {selectedJob && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="md:w-2/3">
                  <div className="flex justify-between items-start">
                    <h2 className="text-2xl font-bold">{selectedJob.title}</h2>
                    <Badge
                      variant={
                        selectedJob.status === "open" ? "default" :
                        selectedJob.status === "in_progress" ? "secondary" :
                        selectedJob.status === "completed" ? "outline" : "destructive"
                      }
                    >
                      {selectedJob.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  
                  <div className="mt-2 text-muted-foreground flex items-center">
                    <MapPin className="h-4 w-4 mr-1" />
                    <span>{selectedJob.location?.city}, {selectedJob.location?.state}</span>
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium">Description</h3>
                      <p className="mt-1">{selectedJob.description}</p>
                    </div>
                    
                    {selectedJob.categoryTags && selectedJob.categoryTags.length > 0 && (
                      <div>
                        <h3 className="text-lg font-medium">Categories</h3>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {selectedJob.categoryTags.map((tag, i) => (
                            <Badge key={i} variant="outline">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="md:w-1/3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Job Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Budget</p>
                        <p className="font-bold text-xl">
                          {selectedJob.pricingType === "fixed" 
                            ? `$${selectedJob.budget?.toFixed(2)}` 
                            : "Open Bid"}
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Start Date</p>
                        <p>{selectedJob.startDate 
                          ? new Date(selectedJob.startDate).toLocaleDateString() 
                          : "Flexible"}
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Posted</p>
                        <p>{new Date(selectedJob.createdAt).toLocaleDateString()}</p>
                      </div>
                      
                      {selectedJob.status === "in_progress" && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Progress</p>
                          <div className="flex items-center">
                            <Progress value={selectedJob.progress || 0} className="h-2 flex-1 mr-2" />
                            <span className="text-sm font-medium">{selectedJob.progress || 0}%</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex-col space-y-2">
                      {(selectedJob.status === "open" && !myBids.some((bid: Bid) => bid.jobId === selectedJob.id)) && (
                        <Button 
                          className="w-full" 
                          onClick={() => {
                            setIsDetailsModalOpen(false);
                            openBidModal(selectedJob);
                          }}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Place Bid
                        </Button>
                      )}
                      
                      {myBids.some((bid: Bid) => bid.jobId === selectedJob.id) && (
                        <div className="border rounded-md p-3 w-full">
                          <p className="text-sm font-medium text-muted-foreground">Your Bid</p>
                          <p className="font-bold">${myBids.find((bid: Bid) => bid.jobId === selectedJob.id)?.amount.toFixed(2)}</p>
                          <Badge className="mt-1">
                            {myBids.find((bid: Bid) => bid.jobId === selectedJob.id)?.status}
                          </Badge>
                        </div>
                      )}
                      
                      {selectedJob.chatRoomId && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              className="w-full"
                            >
                              <MessageCircle className="mr-2 h-4 w-4" />
                              Message Client
                            </Button>
                          </DialogTrigger>
                          <DialogContent 
                            className="max-w-4xl max-h-[90vh] h-[80vh] p-0"
                            aria-describedby={`job-detail-chat-${selectedJob.id}`}
                          >
                            <DialogHeader className="px-6 py-4 border-b">
                              <DialogTitle>Chat - {selectedJob.title}</DialogTitle>
                              <DialogDescription id={`job-detail-chat-${selectedJob.id}`} className="sr-only">
                                Chat with client for job: {selectedJob.title}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="h-full">
                              <ChatInterface 
                                chatRoomId={selectedJob.chatRoomId || selectedJob.id} 
                                userId={authUser?.id || 0} 
                                userName={authUser?.fullName || authUser?.username || ""} 
                                otherUserName="Landlord"
                                className="h-[calc(100%-70px)]"
                                isJobId={!selectedJob.chatRoomId && !!selectedJob.id}
                              />
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </CardFooter>
                  </Card>
                </div>
              </div>
              
              {selectedJob.images && selectedJob.images.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Images</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {selectedJob.images.map((image, index) => (
                      <div key={index} className="aspect-video rounded-md overflow-hidden">
                        <img 
                          src={image} 
                          alt={`Job image ${index + 1}`} 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailsModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Modal */}
      <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" aria-describedby="review-prompt-description">
          <DialogHeader className="sticky top-0 bg-background z-10 pb-2 mb-2 border-b">
            <DialogTitle>Review Landlord</DialogTitle>
            <DialogDescription id="review-prompt-description">
              Before marking this job as complete, please provide a review for the landlord.
            </DialogDescription>
          </DialogHeader>
          
          {jobToReview && authUser && (
            <div className="space-y-4">
              <ReviewForm
                jobId={jobToReview.id}
                reviewerId={authUser.id}
                revieweeId={jobToReview.landlordId || 0}
                onSuccess={() => {
                  setIsReviewModalOpen(false);
                  // After leaving a review, update job progress to 100%
                  updateJobProgressMutation.mutate({
                    jobId: jobToReview.id,
                    progress: 100
                  });
                }}
                onCancel={() => setIsReviewModalOpen(false)}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Facebook-style mobile navigation */}
      <MobileNavigation 
        activeSection={activeSection}
        onChangeSection={setActiveSection}
        userType="contractor"
        activeJobCategory={activeJobCategory}
        onChangeJobCategory={setActiveJobCategory}
      />
    </div>
  );
}