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
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Job, Bid, Transaction, ContractorProfile, coordinateSchema } from "@shared/schema";
import { 
  Loader2, Wallet, List, FileText, Home, DollarSign, Star, Search, Building, Clock, Calendar, MapPin, Edit, 
  Save, SlidersHorizontal, ChevronDown, ChevronUp, X, Filter, Pin, Info, RefreshCcw, CheckCircle2, 
  ImageIcon, MapIcon, MessageCircle, Briefcase, Heart, HeartOff, ShieldCheck
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ReviewForm from "@/components/ReviewForm";
import { LocationSearch } from "@/components/LocationSearch";
import { ServiceAreaMapInput } from "@/components/ServiceAreaMapInput";
import { ServiceAreaDisplay } from "@/components/ServiceAreaDisplay";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

const bidSchema = z.object({
  amount: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "Amount must be a positive number",
  }),
  description: z.string().min(10, "Description must be at least 10 characters"),
  estimatedCompletionDays: z.string().refine(val => !isNaN(parseInt(val)) && parseInt(val) > 0, {
    message: "Estimated days must be a positive number",
  }),
});

type BidFormValues = z.infer<typeof bidSchema>;

export default function ContractorDashboard() {
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  // Get user data directly from API
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch('/api/user', {
          credentials: 'include'
        });
        
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      } finally {
        setIsAuthLoading(false);
      }
    };
    
    fetchUserData();
  }, []);
  
  // Logout function
  const logout = async () => {
    try {
      const response = await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        window.location.href = '/auth';
      }
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isBidModalOpen, setIsBidModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [jobToReview, setJobToReview] = useState<Job | null>(null);
  const [isServiceAreaDialogOpen, setIsServiceAreaDialogOpen] = useState(false);
  const [viewState, setViewState] = useState({
    longitude: -98.5795, // Center of US
    latitude: 39.8283,
    zoom: 3,
    bearing: 0,
    pitch: 0
  });
  const [marker, setMarker] = useState<{longitude: number, latitude: number} | null>(null);
  const [serviceRadius, setServiceRadius] = useState<number>(25);
  const [cityState, setCityState] = useState<{city?: string | null, state?: string | null}>({});
  const mapRef = useRef<any>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // Filter states
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Fetch contractor profile
  const { data: profile, isLoading: isProfileLoading } = useQuery<ContractorProfile>({
    queryKey: ["/api/contractor-profile", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/contractor-profile/${user?.id}`);
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
    enabled: !!user?.id,
  });

  // Fetch available jobs
  const { data: availableJobs, isLoading: isAvailableJobsLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/jobs");
      if (!res.ok) throw new Error("Failed to fetch available jobs");
      return res.json();
    },
  });

  // Fetch contractor's jobs (jobs they've bid on or are working on)
  const { data: myJobs, isLoading: isMyJobsLoading } = useQuery<Job[]>({
    queryKey: ["/api/users", user?.id, "jobs"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/users/${user?.id}/jobs`);
      if (!res.ok) throw new Error("Failed to fetch jobs");
      return res.json();
    },
    enabled: !!user?.id,
  });

  // Fetch contractor's bids
  const { data: myBids, isLoading: isMyBidsLoading } = useQuery<Bid[]>({
    queryKey: ["/api/contractors", user?.id, "bids"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/contractors/${user?.id}/bids`);
      if (!res.ok) throw new Error("Failed to fetch bids");
      return res.json();
    },
    enabled: !!user?.id,
  });

  // Fetch transactions
  const { data: transactions, isLoading: isTransactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/users", user?.id, "transactions"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/users/${user?.id}/transactions`);
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return res.json();
    },
    enabled: !!user?.id,
  });

  // Bid form
  // Update contractor profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<ContractorProfile>) => {
      if (!user?.id) throw new Error("User ID is required");
      
      // Get the user data from sessionStorage as a backup for authentication
      const userData = sessionStorage.getItem('auth_user');
      let userId = user.id;
      
      // Try to get ID from session storage if needed
      if (userData) {
        try {
          const parsedUser = JSON.parse(userData);
          if (parsedUser && parsedUser.id) {
            userId = parsedUser.id;
          }
        } catch (err) {
          console.error("Failed to parse stored user data:", err);
        }
      }
      
      // Create custom headers for authentication
      const customHeaders: Record<string, string> = {
        "X-Map-Auth": `user-${userId}-${Date.now()}`,
        "X-User-ID": String(userId),
        "X-Auth-Timestamp": Date.now().toString(),
        "Content-Type": "application/json",
      };
      
      // Log authentication information for debugging
      console.log("Update profile - using userId:", userId);
      
      // Add special headers if updating service area
      if (data.serviceArea || data.serviceRadius) {
        customHeaders["X-Service-Area-Update"] = "true";
        // Store the last time service area was updated
        sessionStorage.setItem('serviceAreaLastUpdated', new Date().toISOString());
      }
      
      const res = await apiRequest("PATCH", `/api/contractor-profile/${userId}`, data, customHeaders);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to update profile");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractor-profile", user?.id] });
      setIsServiceAreaDialogOpen(false);
      toast({
        title: "Profile updated",
        description: "Your service area has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Save service area changes
  const saveServiceArea = () => {
    if (!marker) {
      toast({
        title: "Location required",
        description: "Please select a location on the map",
        variant: "destructive",
      });
      return;
    }
    
    if (!user?.id) {
      toast({
        title: "Authentication error",
        description: "You must be logged in to update your service area",
        variant: "destructive",
      });
      return;
    }

    const { longitude, latitude } = marker;
    
    // Log the data being sent
    console.log("Saving service area with data:", {
      userId: user.id,
      city: profile?.city || "Unknown",
      state: profile?.state || "Unknown",
      serviceRadius,
      serviceArea: { longitude, latitude }
    });
    
    updateProfileMutation.mutate({
      userId: user.id,
      city: profile?.city || "Unknown",
      state: profile?.state || "Unknown",
      serviceRadius,
      serviceArea: { longitude, latitude },
    });
  };
  
  const bidForm = useForm<BidFormValues>({
    resolver: zodResolver(bidSchema),
    defaultValues: {
      amount: "",
      description: "",
      estimatedCompletionDays: "",
    },
  });

  // Create bid mutation
  const createBidMutation = useMutation({
    mutationFn: async (data: BidFormValues) => {
      if (!selectedJob) throw new Error("No job selected");
      
      const bidData = {
        jobId: selectedJob.id,
        contractorId: user?.id,
        amount: parseFloat(data.amount),
        description: data.description,
        estimatedCompletionDays: parseInt(data.estimatedCompletionDays),
        status: "pending"
      };
      
      const res = await apiRequest("POST", "/api/bids", bidData);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to submit bid");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractors", user?.id, "bids"] });
      setIsBidModalOpen(false);
      bidForm.reset();
      toast({
        title: "Bid submitted",
        description: "Your bid has been successfully submitted",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to submit bid",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmitBidForm = (data: BidFormValues) => {
    createBidMutation.mutate(data);
  };

  const openBidModal = (job: Job) => {
    setSelectedJob(job);
    setIsBidModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const statusColors: { [key: string]: string } = {
      draft: "bg-gray-500",
      open: "bg-blue-500",
      in_progress: "bg-yellow-500",
      completed: "bg-green-500",
      cancelled: "bg-red-500",
    };

    return (
      <Badge className={`${statusColors[status]} text-white`}>
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const getBidStatusBadge = (status: string) => {
    const statusColors: { [key: string]: string } = {
      pending: "bg-yellow-500",
      accepted: "bg-green-500",
      rejected: "bg-red-500",
    };

    return (
      <Badge className={`${statusColors[status]} text-white`}>
        {status}
      </Badge>
    );
  };

  // Update service area state when profile is loaded
  useEffect(() => {
    if (profile) {
      // Set service radius
      if (profile.serviceRadius) {
        setServiceRadius(profile.serviceRadius);
      }

      // Initialize city and state
      setCityState({
        city: profile.city || undefined,
        state: profile.state || undefined
      });

      // Initialize marker position if available
      if (profile.serviceArea && 
          typeof profile.serviceArea === 'object' && 
          'latitude' in profile.serviceArea && 
          'longitude' in profile.serviceArea) {
        setMarker({
          latitude: (profile.serviceArea as any).latitude,
          longitude: (profile.serviceArea as any).longitude
        });
      }
    }
  }, [profile]);
  
  // Reset service area dialog state when opening/closing
  useEffect(() => {
    if (isServiceAreaDialogOpen && profile) {
      // When opening the dialog, reset states to current profile values
      setCityState({
        city: profile.city || undefined,
        state: profile.state || undefined
      });
      
      if (profile.serviceRadius) {
        setServiceRadius(profile.serviceRadius);
      }
      
      if (profile.serviceArea && 
          typeof profile.serviceArea === 'object' && 
          'latitude' in profile.serviceArea && 
          'longitude' in profile.serviceArea) {
        setMarker({
          latitude: (profile.serviceArea as any).latitude,
          longitude: (profile.serviceArea as any).longitude
        });
      }
    }
  }, [isServiceAreaDialogOpen, profile]);
  
  if (isProfileLoading || isAvailableJobsLoading || isMyJobsLoading || isMyBidsLoading || isTransactionsLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header section - Facebook Marketplace Style */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto p-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
            <div>
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 text-transparent bg-clip-text">Real Service</h1>
              <p className="text-muted-foreground text-sm">
                Welcome, <span className="font-medium text-foreground">{user?.fullName || 'Contractor'}</span>
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search jobs..."
                  className="pl-8 w-[200px] bg-gray-100 border-0"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button 
                variant="outline" 
                onClick={async () => {
                  await logout();
                  toast({
                    title: "Logged out",
                    description: "You have been successfully logged out"
                  });
                }}
                className="border border-border/50"
                size="sm"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>
        
        {/* Service Area Section */}
        <div className="mt-6 bg-white bg-opacity-50 backdrop-blur-sm rounded-md p-4 shadow-sm border border-border/30">
          <div className="flex items-center mb-3">
            <div className="bg-primary/10 p-2 rounded-full mr-3">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">Service Area</h3>
              <p className="text-sm text-muted-foreground">Your preferred working radius</p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="ml-auto"
              onClick={() => setIsServiceAreaDialogOpen(true)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">Primary Location</span>
              <span className="font-medium">
                {profile?.serviceArea && typeof profile.serviceArea === 'object' && 
                 'latitude' in profile.serviceArea && 'longitude' in profile.serviceArea
                  ? `${profile?.city || 'Unknown'}, ${profile?.state || ''}`
                  : 'Not set'}
              </span>
              {profile?.serviceArea && typeof profile.serviceArea === 'object' && 
                'latitude' in profile.serviceArea && (
                  <span className="text-xs text-muted-foreground mt-1">
                    ({Number((profile.serviceArea as any).latitude).toFixed(3)}, 
                    {Number((profile.serviceArea as any).longitude).toFixed(3)})
                  </span>
                )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">Service Radius</span>
              <span className="font-medium">{profile?.serviceRadius || '25'} km</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">Postal Codes</span>
              <span className="font-medium">
                {Array.isArray(profile?.serviceZipCodes) 
                  ? profile.serviceZipCodes.join(', ') 
                  : 'All within radius'}
              </span>
            </div>
          </div>
          
          {/* Service area map display */}
          {profile?.serviceArea && 
           typeof profile.serviceArea === 'object' && 
           'latitude' in profile.serviceArea && 
           'longitude' in profile.serviceArea && (
            <div className="mt-2">
              <ServiceAreaDisplay 
                longitude={Number((profile.serviceArea as any).longitude)}
                latitude={Number((profile.serviceArea as any).latitude)}
                radius={profile.serviceRadius || 25}
                height="150px"
              />
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-white bg-opacity-50 backdrop-blur-sm rounded-md p-3 flex items-center space-x-3 shadow-sm border border-border/30">
            <div className="bg-primary/10 p-2 rounded-full">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Wallet Balance</p>
              <p className="font-semibold text-lg">${profile?.walletBalance?.toFixed(2) || "0.00"}</p>
            </div>
          </div>
          <div className="bg-white bg-opacity-50 backdrop-blur-sm rounded-md p-3 flex items-center space-x-3 shadow-sm border border-border/30">
            <div className="bg-primary/10 p-2 rounded-full">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Jobs</p>
              <p className="font-semibold text-lg">{myJobs?.filter(job => job.status === "in_progress").length || 0}</p>
            </div>
          </div>
          <div className="bg-white bg-opacity-50 backdrop-blur-sm rounded-md p-3 flex items-center space-x-3 shadow-sm border border-border/30">
            <div className="bg-primary/10 p-2 rounded-full">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed Jobs</p>
              <p className="font-semibold text-lg">{myJobs?.filter(job => job.status === "completed").length || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content with tabs */}
      <Tabs defaultValue="available" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-4 sticky top-0 z-10 bg-background/80 backdrop-blur">
          <TabsTrigger value="available">Available Jobs</TabsTrigger>
          <TabsTrigger value="my-jobs">My Jobs</TabsTrigger>
          <TabsTrigger value="my-bids">My Bids</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>
        
        {/* Removed overflow-hidden and other constrained styles to make content scrollable */}
        <div className="pb-12">
          <TabsContent value="available" className="space-y-4">
          {/* Facebook Marketplace Style Layout with Left Sidebar */}
          <div className="flex flex-col md:flex-row gap-4">
            {/* Filters Sidebar - Facebook Marketplace Style */}
            <div className="md:w-64 shrink-0">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 sticky top-20">
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg flex items-center">
                      <Filter className="h-4 w-4 mr-2" />
                      Filters
                    </h3>
                    {(selectedCategories.length > 0 || priceRange[0] > 0 || priceRange[1] < 10000) && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs h-8"
                        onClick={() => {
                          setSelectedCategories([]);
                          setPriceRange([0, 10000]);
                        }}
                      >
                        Clear all
                      </Button>
                    )}
                  </div>
                </div>
                
                <ScrollArea className="h-[calc(100vh-320px)]">
                  <div className="p-4 space-y-6">
                    {/* Category Filter */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-sm">Categories</h4>
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      </div>
                      <div className="space-y-2">
                        {["Plumbing", "Electrical", "Carpentry", "Painting", "Landscaping", "General Maintenance", "Roofing", "HVAC", "Cleaning"].map(category => (
                          <div 
                            key={category}
                            className={`flex items-center p-2 rounded-md cursor-pointer text-sm ${
                              selectedCategories.includes(category) 
                                ? 'bg-primary/10 text-primary font-medium' 
                                : 'hover:bg-gray-100'
                            }`}
                            onClick={() => {
                              if (selectedCategories.includes(category)) {
                                setSelectedCategories(selectedCategories.filter(c => c !== category));
                              } else {
                                setSelectedCategories([...selectedCategories, category]);
                              }
                            }}
                          >
                            <div className={`w-4 h-4 rounded-sm border mr-2 flex items-center justify-center ${
                              selectedCategories.includes(category) 
                                ? 'bg-primary border-primary' 
                                : 'border-gray-300'
                            }`}>
                              {selectedCategories.includes(category) && (
                                <CheckCircle2 className="h-3 w-3 text-white" />
                              )}
                            </div>
                            {category}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <Separator />
                    
                    {/* Price Range Filter */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-sm">Price Range</h4>
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      </div>
                      <div className="px-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">${priceRange[0]}</span>
                          <span className="font-medium">${priceRange[1] === 10000 ? priceRange[1]+"+" : priceRange[1]}</span>
                        </div>
                        <Slider 
                          defaultValue={[0, 10000]} 
                          max={10000} 
                          step={100}
                          value={priceRange}
                          onValueChange={value => setPriceRange(value as [number, number])}
                          className="my-4"
                        />
                        
                        <div className="flex justify-between gap-2 mt-4">
                          <Input 
                            type="number" 
                            className="h-8 text-sm p-2" 
                            value={priceRange[0]} 
                            onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                          />
                          <span className="text-gray-500 self-center">to</span>
                          <Input 
                            type="number" 
                            className="h-8 text-sm p-2" 
                            value={priceRange[1]} 
                            onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    {/* Location Filter */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-sm">Location</h4>
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      </div>
                      <div className="space-y-2">
                        {profile?.serviceArea && typeof profile.serviceArea === 'object' && 
                         'latitude' in profile.serviceArea && profile.serviceRadius ? (
                          <div className="bg-gray-50 p-3 rounded-md">
                            <div className="flex items-center text-sm mb-2">
                              <MapPin className="h-4 w-4 text-primary mr-2" />
                              <span className="font-medium">
                                {profile?.city ? profile.city : 'Your location'}{profile?.state ? `, ${profile.state}` : ''}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 flex items-center">
                              <Info className="h-3 w-3 mr-1" />
                              Jobs shown are within {profile.serviceRadius} km of your location
                            </div>
                          </div>
                        ) : (
                          <div className="bg-blue-50 p-3 rounded-md text-sm text-blue-700">
                            <div className="flex items-start">
                              <Info className="h-4 w-4 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
                              <div>
                                Set your service area to see jobs near you
                                <Button 
                                  variant="link" 
                                  className="text-blue-500 p-0 h-auto text-sm font-medium"
                                  onClick={() => setIsServiceAreaDialogOpen(true)}
                                >
                                  Set service area
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <Separator />
                    
                    {/* Job Status Filter */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-sm">Job Status</h4>
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center p-2 rounded-md cursor-pointer text-sm bg-primary/10 text-primary font-medium">
                          <div className="w-4 h-4 rounded-sm border mr-2 flex items-center justify-center bg-primary border-primary">
                            <CheckCircle2 className="h-3 w-3 text-white" />
                          </div>
                          Open Jobs
                        </div>
                        <div className="flex items-center p-2 rounded-md cursor-pointer text-sm hover:bg-gray-100 text-gray-500">
                          <div className="w-4 h-4 rounded-sm border mr-2 border-gray-300"></div>
                          Posted within 24 hours
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </div>
            
            {/* Main Content Area */}
            <div className="flex-grow">
              {/* Search & Filter Bar */}
              <div className="bg-white rounded-lg overflow-hidden border mb-4 sticky top-20 z-10">
                <div className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
                  <div>
                    <h2 className="text-xl font-semibold">Available Jobs</h2>
                    <p className="text-muted-foreground text-sm">
                      {availableJobs?.filter(job => job.status === "open").length || 0} jobs available
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-grow md:flex-grow-0">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search jobs..."
                        className="pl-8 w-full md:w-[250px]"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className="flex items-center"
                >
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  Filters
                  {(selectedCategories.length > 0 || priceRange[0] > 0 || priceRange[1] < 10000) && (
                    <span className="ml-1 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">
                      {selectedCategories.length + (priceRange[0] > 0 || priceRange[1] < 10000 ? 1 : 0)}
                    </span>
                  )}
                </Button>
              </div>
            </div>
            
            {isFilterOpen && (
              <div className="rounded-md border p-4 animate-in fade-in-50 slide-in-from-top-5 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium mb-3">Job Categories</h3>
                    <div className="flex flex-wrap gap-2">
                      {["Plumbing", "Electrical", "Carpentry", "Painting", "Landscaping", "General Maintenance", "Roofing", "HVAC", "Cleaning"].map(category => (
                        <Badge 
                          key={category}
                          variant={selectedCategories.includes(category) ? "default" : "outline"}
                          className="cursor-pointer hover:bg-primary/90 transition-colors"
                          onClick={() => {
                            if (selectedCategories.includes(category)) {
                              setSelectedCategories(selectedCategories.filter(c => c !== category));
                            } else {
                              setSelectedCategories([...selectedCategories, category]);
                            }
                          }}
                        >
                          {category}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium mb-3">Budget Range</h3>
                    <div className="px-2">
                      <Slider 
                        defaultValue={[0, 10000]} 
                        max={10000} 
                        step={100}
                        value={priceRange}
                        onValueChange={value => setPriceRange(value as [number, number])}
                        className="my-6"
                      />
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>${priceRange[0]}</span>
                        <span>${priceRange[1] === 10000 ? priceRange[1]+"+" : priceRange[1]}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end mt-4 space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setSelectedCategories([]);
                      setPriceRange([0, 10000]);
                    }}
                  >
                    Reset
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => setIsFilterOpen(false)}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            )}
          </div>
          
          {!(profile?.serviceArea && 
             typeof profile.serviceArea === 'object' && 
             'latitude' in profile.serviceArea && 
             profile.serviceRadius) && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
              <div className="flex items-start">
                <MapPin className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-blue-800">Service area not set</h3>
                  <p className="text-blue-700 text-sm mt-1">
                    Set your service area to see jobs near you. Click the "Edit" button in the Service Area section above.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {availableJobs && availableJobs.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {availableJobs
                .filter(job => {
                  // Only show open jobs
                  if (job.status !== "open") return false;
                  
                  // Apply search filter if search query is provided
                  if (searchQuery.trim()) {
                    const query = searchQuery.toLowerCase().trim();
                    const matchesTitle = job.title.toLowerCase().includes(query);
                    const matchesDescription = job.description.toLowerCase().includes(query);
                    
                    // Check if job has category tags that match
                    const matchesTags = Array.isArray(job.categoryTags) && 
                      job.categoryTags.some(tag => 
                        typeof tag === 'string' && tag.toLowerCase().includes(query)
                      );
                    
                    // Check if job has location data that matches
                    const matchesLocation = typeof job.location === 'object' && 
                      job.location !== null &&
                      (
                        ((job.location as any)?.city && (job.location as any).city.toLowerCase().includes(query)) ||
                        ((job.location as any)?.state && (job.location as any).state.toLowerCase().includes(query))
                      );
                    
                    // Return false if the job doesn't match the search query
                    if (!(matchesTitle || matchesDescription || matchesTags || matchesLocation)) {
                      return false;
                    }
                  }
                  
                  // Apply category filter if any categories are selected
                  if (selectedCategories.length > 0) {
                    // Check if job has any of the selected categories
                    const jobCategories = Array.isArray(job.categoryTags) 
                      ? job.categoryTags.map(tag => typeof tag === 'string' ? tag : '')
                      : [];
                    
                    const hasMatchingCategory = selectedCategories.some(category => 
                      jobCategories.some(jobCategory => 
                        jobCategory.toLowerCase() === category.toLowerCase()
                      )
                    );
                    
                    if (!hasMatchingCategory) {
                      return false;
                    }
                  }
                  
                  // Apply price range filter
                  if (job.budget) {
                    if (job.budget < priceRange[0] || job.budget > priceRange[1]) {
                      return false;
                    }
                  } else if (priceRange[0] > 0) {
                    // If the job doesn't have a budget but the min price range is set
                    return false;
                  }
                  
                  // If contractor has set a service area, filter by distance
                  if (profile?.serviceArea && 
                      profile.serviceRadius && 
                      typeof profile.serviceArea === 'object' && 
                      'latitude' in profile.serviceArea && 
                      'longitude' in profile.serviceArea) {
                    
                    // Skip if job has no location
                    if (!job.location || typeof job.location !== 'object') return true;
                    
                    // Calculate distance if job has coordinates
                    const jobLocation = job.location as any;
                    if ('latitude' in jobLocation && 'longitude' in jobLocation) {
                      // Simple distance calculation (approximate) in kilometers
                      // Convert from miles to km (1 mile ≈ 1.60934 km)
                      const dx = (jobLocation.longitude - (profile.serviceArea as any).longitude) * 
                                Math.cos((jobLocation.latitude + (profile.serviceArea as any).latitude) * Math.PI / 360) * 111.32;
                      const dy = (jobLocation.latitude - (profile.serviceArea as any).latitude) * 110.574;
                      const distance = Math.sqrt(dx * dx + dy * dy);
                      
                      // Check if job is within service radius
                      return distance <= profile.serviceRadius;
                    }
                  }
                  
                  // Default: show the job
                  return true;
                })
                .map((job) => (
                <Card key={job.id} className="overflow-hidden border-border/40 hover:shadow-md transition-shadow duration-300">
                  <div className="h-2 w-full bg-blue-500"></div>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg font-bold text-primary-foreground">{job.title}</CardTitle>
                      {getStatusBadge(job.status)}
                    </div>
                    <CardDescription className="line-clamp-2 mt-2">
                      {job.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center text-sm bg-muted/30 p-2 rounded-md">
                        <Building className="mr-2 h-4 w-4 text-primary/70" />
                        <span>{typeof job.location === 'object' ? (job.location as any)?.city || 'Location' : 'Location'}</span>
                        <Badge variant="outline" className="ml-2 text-xs bg-primary/5">
                          {profile?.serviceArea && typeof profile.serviceArea === 'object' && 
                           'latitude' in profile.serviceArea && profile.serviceRadius
                           ? `Within ${profile.serviceRadius} km` 
                           : '~1 km radius'}
                        </Badge>
                      </div>
                      {job.budget && (
                        <div className="flex items-center text-sm bg-muted/30 p-2 rounded-md">
                          <DollarSign className="mr-2 h-4 w-4 text-primary/70" />
                          <span className="font-medium">${job.budget}</span>
                        </div>
                      )}
                      {job.startDate && (
                        <div className="flex items-center text-sm bg-muted/30 p-2 rounded-md">
                          <Clock className="mr-2 h-4 w-4 text-primary/70" />
                          <span>
                            Start: {new Date(job.startDate).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center text-sm bg-primary/10 p-2 rounded-md">
                        <Star className="mr-2 h-4 w-4 text-primary/70" />
                        <span className="font-medium">
                          {job.pricingType === "fixed" ? "Fixed Price" : "Open for Bids"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-muted/30 p-3 border-t border-border/20">
                    <Button 
                      className="w-full bg-primary hover:bg-primary/90 transition-colors" 
                      onClick={() => openBidModal(job)}
                    >
                      Place Bid
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center p-8 border rounded-lg bg-muted/30">
              <h3 className="font-medium text-lg">No available jobs</h3>
              <p className="text-muted-foreground">
                Check back later for new job opportunities
              </p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="my-jobs" className="space-y-4">
          <h2 className="text-xl font-semibold mb-4">My Jobs</h2>
          {myJobs && myJobs.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {myJobs.map((job) => (
                <Card key={job.id} className="overflow-hidden border-border/40 hover:shadow-md transition-shadow duration-300">
                  <div className={`h-2 w-full ${job.status === 'open' ? 'bg-blue-500' : job.status === 'in_progress' ? 'bg-yellow-500' : job.status === 'completed' ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg font-bold text-primary-foreground">{job.title}</CardTitle>
                      {getStatusBadge(job.status)}
                    </div>
                    <CardDescription className="line-clamp-2 mt-2">
                      {job.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center text-sm bg-muted/30 p-2 rounded-md">
                        <Home className="mr-2 h-4 w-4 text-primary/70" />
                        <span>{typeof job.location === 'object' ? (job.location as any)?.city || 'Location' : 'Location'}</span>
                        <Badge variant="outline" className="ml-2 text-xs bg-primary/5">Exact location available</Badge>
                      </div>
                      {job.budget && (
                        <div className="flex items-center text-sm bg-muted/30 p-2 rounded-md">
                          <DollarSign className="mr-2 h-4 w-4 text-primary/70" />
                          <span className="font-medium">${job.budget}</span>
                        </div>
                      )}
                      {job.startDate && (
                        <div className="flex items-center text-sm bg-muted/30 p-2 rounded-md">
                          <Calendar className="mr-2 h-4 w-4 text-primary/70" />
                          <span>
                            Start: {new Date(job.startDate).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="bg-muted/30 p-3 border-t border-border/20">
                    {job.status === "completed" ? (
                      <div className="grid grid-cols-2 gap-2 w-full">
                        <Button 
                          variant="outline" 
                          className="hover:bg-primary hover:text-primary-foreground transition-colors"
                          onClick={() => {
                            setSelectedJob(job);
                            setIsDetailsModalOpen(true);
                          }}
                        >
                          View Details
                        </Button>
                        <Button 
                          variant="default" 
                          className="bg-primary hover:bg-primary/90 transition-colors"
                          onClick={() => {
                            setJobToReview(job);
                            setIsReviewModalOpen(true);
                          }}
                        >
                          Leave Review
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        variant={job.status === "in_progress" ? "default" : "outline"} 
                        className="w-full hover:bg-primary hover:text-primary-foreground transition-colors" 
                        onClick={() => {
                          if (job.status === "in_progress") {
                            // Will implement progress update functionality later
                            toast({
                              title: "Feature coming soon",
                              description: "Progress updates will be available in a future version."
                            });
                          } else {
                            setSelectedJob(job);
                            setIsDetailsModalOpen(true);
                          }
                        }}
                      >
                        {job.status === "in_progress" ? "Update Progress" : "View Details"}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center p-8 border rounded-lg bg-muted/30">
              <h3 className="font-medium text-lg">No active jobs</h3>
              <p className="text-muted-foreground">
                You're not currently working on any jobs
              </p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="my-bids" className="space-y-4">
          <h2 className="text-xl font-semibold mb-4">My Bids</h2>
          {myBids && myBids.length > 0 ? (
            <div className="rounded-md border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Job</th>
                      <th className="px-4 py-3 text-left">Amount</th>
                      <th className="px-4 py-3 text-left">Completion Time</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myBids.map((bid) => (
                      <tr key={bid.id} className="border-b">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {new Date(bid.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          {availableJobs?.find(j => j.id === bid.jobId)?.title || `Job #${bid.jobId}`}
                        </td>
                        <td className="px-4 py-3">${bid.amount.toFixed(2)}</td>
                        <td className="px-4 py-3">{bid.timeEstimate ? bid.timeEstimate : 'Not specified'}</td>
                        <td className="px-4 py-3">
                          {getBidStatusBadge(bid.status)}
                        </td>
                        <td className="px-4 py-3">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              const job = availableJobs?.find(j => j.id === bid.jobId);
                              if (job) {
                                setSelectedJob(job);
                                setIsDetailsModalOpen(true);
                              } else {
                                toast({
                                  title: "Job not found",
                                  description: "The job details could not be found.",
                                  variant: "destructive"
                                });
                              }
                            }}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center p-8 border rounded-lg bg-muted/30">
              <h3 className="font-medium text-lg">No bids submitted</h3>
              <p className="text-muted-foreground">
                You haven't placed any bids on jobs yet
              </p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="profile" className="space-y-4">
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  View and manage your contractor profile
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col space-y-1">
                  <h3 className="font-medium">Full Name</h3>
                  <p>{user?.fullName}</p>
                </div>
                <div className="flex flex-col space-y-1">
                  <h3 className="font-medium">Email</h3>
                  <p>{user?.email}</p>
                </div>
                {user?.phone && (
                  <div className="flex flex-col space-y-1">
                    <h3 className="font-medium">Phone</h3>
                    <p>{user.phone}</p>
                  </div>
                )}
                {profile?.skills && Array.isArray(profile.skills) && profile.skills.length > 0 && (
                  <div className="flex flex-col space-y-1">
                    <h3 className="font-medium">Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {profile.skills.map((skill: string, index: number) => (
                        <Badge key={index} variant="secondary">{skill}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {profile?.walletBalance !== undefined && (
                  <div className="flex flex-col space-y-1">
                    <h3 className="font-medium">Wallet Balance</h3>
                    <p>${profile.walletBalance.toFixed(2)}</p>
                  </div>
                )}
                <div className="pt-4">
                  <Button>Edit Profile</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        </div>
      </Tabs>

      {/* Create Bid Dialog */}
      <Dialog open={isBidModalOpen} onOpenChange={setIsBidModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Submit a Bid</DialogTitle>
            <DialogDescription>
              {selectedJob && (
                <div>
                  <p className="font-medium mt-2">{selectedJob.title}</p>
                  <p className="text-sm mt-1">
                    {typeof selectedJob.location === 'object' 
                      ? (selectedJob.location as any)?.city || 'Location' 
                      : 'Location'}
                  </p>
                  
                  <div className="mt-4 border rounded-md p-4 bg-muted/20">
                    <div className="flex items-center mb-2">
                      <MapPin className="h-4 w-4 mr-2 text-primary" />
                      <span className="text-sm font-medium">Job Location</span>
                      <Badge variant="outline" className="ml-2 text-xs">1 km radius area</Badge>
                    </div>
                    <div className="bg-muted/30 h-[200px] rounded-md flex items-center justify-center">
                      <div className="w-full h-full relative">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-32 h-32 rounded-full border-4 border-primary/40 flex items-center justify-center">
                            <MapPin className="h-8 w-8 text-primary" />
                          </div>
                        </div>
                        <div className="absolute bottom-2 right-2 bg-white/80 p-1 rounded text-xs">
                          Exact location revealed after bid acceptance
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <Form {...bidForm}>
            <form onSubmit={bidForm.handleSubmit(onSubmitBidForm)} className="space-y-4">
              <FormField
                control={bidForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Bid Amount ($)</FormLabel>
                    <FormControl>
                      <Input type="text" placeholder="e.g. 500" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={bidForm.control}
                name="estimatedCompletionDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Completion Time (days)</FormLabel>
                    <FormControl>
                      <Input type="text" placeholder="e.g. 7" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={bidForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description and Approach</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe how you plan to approach this job"
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsBidModalOpen(false)}
                  disabled={createBidMutation.isPending}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={createBidMutation.isPending}
                >
                  {createBidMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Submit Bid
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Leave a Review</DialogTitle>
            <DialogDescription>
              {jobToReview && (
                <div>
                  <p className="font-medium mt-2">{jobToReview.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your review will help landlords make informed decisions when hiring contractors.
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {jobToReview && user && (
            <ReviewForm
              jobId={jobToReview.id}
              reviewerId={user.id}
              revieweeId={jobToReview.landlordId}
              onSuccess={() => {
                setIsReviewModalOpen(false);
                toast({
                  title: "Review submitted",
                  description: "Thank you for your feedback!"
                });
              }}
              onCancel={() => setIsReviewModalOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Job Details Dialog */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          {selectedJob && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-xl font-semibold">{selectedJob.title}</DialogTitle>
                  {getStatusBadge(selectedJob.status)}
                </div>
                <DialogDescription>
                  Posted on {new Date(selectedJob.createdAt).toLocaleDateString()}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 py-4">
                {/* Job Images */}
                {selectedJob.images && Array.isArray(selectedJob.images) && selectedJob.images.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">Images</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {selectedJob.images.map((image, index) => (
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
                  <p className="text-muted-foreground">{selectedJob.description ? String(selectedJob.description) : 'No description provided'}</p>
                </div>
                
                {/* Category */}
                {selectedJob.categoryTags && Array.isArray(selectedJob.categoryTags) && selectedJob.categoryTags.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">Category</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedJob.categoryTags.map((category, index) => (
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
                  {selectedJob.location && typeof selectedJob.location === 'object' && (
                    <div className="bg-muted/30 p-3 rounded-md">
                      {(selectedJob.location as any).address && <p>{String((selectedJob.location as any).address)}</p>}
                      <p>
                        {(selectedJob.location as any).city ? String((selectedJob.location as any).city) : 'City not specified'}
                        {(selectedJob.location as any).state ? `, ${String((selectedJob.location as any).state)}` : ''}
                        {(selectedJob.location as any).zip ? ` ${String((selectedJob.location as any).zip)}` : ''}
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Budget & Pricing */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">Pricing Type</h3>
                    <div className="bg-muted/30 p-3 rounded-md">
                      {selectedJob.pricingType === 'fixed' ? (
                        <span className="flex items-center"><DollarSign className="h-4 w-4 mr-1" /> Fixed Price</span>
                      ) : (
                        <span className="flex items-center"><DollarSign className="h-4 w-4 mr-1" /> Open for Bids</span>
                      )}
                    </div>
                  </div>
                  
                  {selectedJob.budget && (
                    <div className="space-y-2">
                      <h3 className="text-lg font-medium">Budget</h3>
                      <div className="bg-muted/30 p-3 rounded-md">
                        <span className="font-semibold">${selectedJob.budget}</span>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Timeline */}
                {selectedJob.startDate && (
                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">Timeline</h3>
                    <div className="bg-muted/30 p-3 rounded-md">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2" />
                        <span>Starts on {new Date(selectedJob.startDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Landlord Information */}
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Posted By</h3>
                  <div className="bg-muted/30 p-3 rounded-md">
                    <p>Landlord ID: {selectedJob.landlordId}</p>
                    {/* You could fetch and display landlord info here if needed */}
                  </div>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDetailsModalOpen(false)}>
                  Close
                </Button>
                {selectedJob.status === "open" && (
                  <Button 
                    onClick={() => {
                      setIsDetailsModalOpen(false);
                      openBidModal(selectedJob);
                    }}
                  >
                    Place Bid
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Service Area Dialog */}
      <Dialog open={isServiceAreaDialogOpen} onOpenChange={setIsServiceAreaDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Set Your Service Area</DialogTitle>
            <DialogDescription>
              Select your primary location and adjust the service radius in kilometers.
              Jobs within this area will appear in your available jobs list.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Location Search with Mapbox Geocoding */}
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <LocationSearch
                  defaultValue={profile?.city && profile?.state ? `${profile.city}, ${profile.state}` : ''}
                  placeholder="Search for your location (city, address, etc.)"
                  onSelectLocation={(location) => {
                    // Update marker position
                    setMarker({
                      longitude: location.longitude,
                      latitude: location.latitude
                    });
                    
                    // Update city and state using state
                    setCityState({
                      city: location.city,
                      state: location.state
                    });
                    
                    console.log("Location selected:", {
                      longitude: location.longitude,
                      latitude: location.latitude,
                      city: location.city,
                      state: location.state
                    });
                  }}
                />
              </div>
              
              {/* Hidden inputs to store city and state values - using state to make them controlled */}
              <input 
                type="hidden" 
                id="city" 
                value={cityState?.city || profile?.city || ""} 
                onChange={(e) => setCityState(prev => ({ ...prev, city: e.target.value }))}
              />
              <input 
                type="hidden" 
                id="state" 
                value={cityState?.state || profile?.state || ""} 
                onChange={(e) => setCityState(prev => ({ ...prev, state: e.target.value }))}
              />
            </div>
            
            {/* Interactive Map with Service Radius */}
            <div className="my-6 relative">
              <ServiceAreaMapInput
                longitude={marker?.longitude || 
                  (profile?.serviceArea && typeof profile.serviceArea === 'object' && 'longitude' in profile.serviceArea 
                    ? (profile.serviceArea as any).longitude 
                    : -98.5795)
                }
                latitude={marker?.latitude || 
                  (profile?.serviceArea && typeof profile.serviceArea === 'object' && 'latitude' in profile.serviceArea 
                    ? (profile.serviceArea as any).latitude 
                    : 39.8283)
                }
                radius={serviceRadius}
                onMarkerChange={setMarker}
                height="250px"
              />
              <div className="text-center mt-2 text-sm text-muted-foreground">
                <p>Drag the marker to adjust your service area location</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="radius">Service Radius (km): {serviceRadius}</Label>
                </div>
                <div className="px-1">
                  <Slider
                    id="radius"
                    min={5}
                    max={150}
                    step={5}
                    value={[serviceRadius]}
                    onValueChange={(value: number[]) => setServiceRadius(value[0])}
                  />
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsServiceAreaDialogOpen(false)}
              disabled={updateProfileMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="button"
              onClick={() => {
                // Set a simple marker if none exists
                if (!marker) {
                  setMarker({
                    longitude: -98.5795,
                    latitude: 39.8283
                  });
                }
                
                // Get city and state values from form
                const cityInput = document.getElementById('city') as HTMLInputElement;
                const stateInput = document.getElementById('state') as HTMLInputElement;
                
                // Get the map auth token from sessionStorage as a backup for authentication
                const mapAuthToken = sessionStorage.getItem('map_auth_token');
                const userData = sessionStorage.getItem('auth_user');
                let userId = user?.id;
                
                // Try to get ID from session storage if needed
                if (userData) {
                  try {
                    const parsedUser = JSON.parse(userData);
                    if (parsedUser && parsedUser.id) {
                      userId = parsedUser.id;
                    }
                  } catch (err) {
                    console.error("Failed to parse stored user data:", err);
                  }
                }
                
                if (!userId) {
                  toast({
                    title: "Authentication error",
                    description: "You must be logged in to update your service area",
                    variant: "destructive",
                  });
                  return;
                }
                
                // Ensure we have a valid userId - this should be present from the user context
                // If for some reason it's not found, show an error
                if (!userId) {
                  toast({
                    title: "Error updating service area",
                    description: "User ID is required. Please try logging out and back in.",
                    variant: "destructive"
                  });
                  return;
                }
                
                console.log("Updating profile with userId:", userId);
                
                // Add additional logging to debug
                console.log("Form values:", {
                  city: cityState?.city || profile?.city,
                  state: cityState?.state || profile?.state,
                  marker,
                  serviceRadius
                });
                
                // Update profile with complete location data
                updateProfileMutation.mutate({
                  userId: userId,
                  city: cityState?.city || profile?.city || "Unknown",
                  state: cityState?.state || profile?.state || "Unknown",
                  serviceRadius,
                  serviceArea: marker || { longitude: -98.5795, latitude: 39.8283 },
                });
              }}
              disabled={updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Service Area
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}