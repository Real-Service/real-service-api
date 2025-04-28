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
  Filter, CheckCircle2, ChevronDown, Info, SlidersHorizontal, Menu, Settings, ArrowDown, User, BellRing
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ServiceAreaDisplay } from "@/components/ServiceAreaDisplay";
import { useToast } from "@/hooks/use-toast";
import Map from "react-map-gl";

// Define bid schema with Zod
const bidSchema = z.object({
  amount: z.coerce.number().min(1, { message: "Amount must be greater than 0" }),
  proposal: z.string().min(10, { message: "Proposal must be at least 10 characters" }),
  timeEstimate: z.string().optional(),
  proposedStartDate: z.date().optional(),
});

type BidFormValues = z.infer<typeof bidSchema>;

export default function ContractorDashboard() {
  const [user, setUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [isBidModalOpen, setIsBidModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isServiceAreaDialogOpen, setIsServiceAreaDialogOpen] = useState(false);
  const [mapCenter, setMapCenter] = useState({ latitude: 37.7749, longitude: -122.4194 });
  const [serviceRadius, setServiceRadius] = useState(25);
  const { isAuthenticated, logout } = useAuth();
  const { toast } = useToast();

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
  
  // Fetch contractor profile
  const { data: profile } = useQuery({
    queryKey: ['/api/contractor-profile', user?.id],
    enabled: Boolean(user?.id),
  });

  // Fetch jobs
  const { data: jobs = [] } = useQuery({
    queryKey: ['/api/jobs'],
    enabled: isAuthenticated,
  });

  // Fetch bids
  const { data: myBids = [] } = useQuery({
    queryKey: ['/api/bids/contractor'],
    enabled: isAuthenticated,
  });

  // Fetch my jobs (jobs where I'm the contractor)
  const { data: myJobs = [] } = useQuery({
    queryKey: ['/api/contractor-jobs'],
    enabled: isAuthenticated,
  });

  // Filter jobs based on service areas
  const availableJobs = useMemo(() => {
    if (!Array.isArray(jobs)) return [];
    return jobs;
  }, [jobs]);

  // Mutation for creating a bid
  const createBidMutation = useMutation({
    mutationFn: async (data: BidFormValues) => {
      if (!selectedJob) throw new Error("No job selected");
      
      const bidData = {
        ...data,
        jobId: selectedJob.id,
      };
      
      return apiRequest("POST", "/api/bids", bidData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bids/contractor'] });
      setIsBidModalOpen(false);
      toast({
        title: "Bid submitted",
        description: "Your bid has been submitted successfully",
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

  // Form for creating a bid
  const bidForm = useForm<BidFormValues>({
    resolver: zodResolver(bidSchema),
    defaultValues: {
      amount: 0,
      proposal: "",
      timeEstimate: "",
    },
  });

  const onSubmitBidForm = (data: BidFormValues) => {
    createBidMutation.mutate(data);
  };

  const openBidModal = (job: Job) => {
    setSelectedJob(job);
    setIsBidModalOpen(true);
    
    // Reset form with default values
    bidForm.reset({
      amount: job.budget || 0,
      proposal: "",
      timeEstimate: "",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusColors: { [key: string]: string } = {
      open: "bg-green-500",
      draft: "bg-gray-500",
      in_progress: "bg-blue-500",
      completed: "bg-purple-500",
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

  // Loading state
  if (isAuthLoading) {
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
      
      <div className="container mx-auto p-4">
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
              <p className="font-semibold text-lg">{Array.isArray(myJobs) ? myJobs.filter(job => job.status === "in_progress").length : 0}</p>
            </div>
          </div>
          <div className="bg-white bg-opacity-50 backdrop-blur-sm rounded-md p-3 flex items-center space-x-3 shadow-sm border border-border/30">
            <div className="bg-primary/10 p-2 rounded-full">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed Jobs</p>
              <p className="font-semibold text-lg">{Array.isArray(myJobs) ? myJobs.filter(job => job.status === "completed").length : 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content with tabs */}
      <div className="container mx-auto p-4 mt-4">
        <Tabs defaultValue="available" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4 sticky top-0 z-10 bg-background/80 backdrop-blur">
            <TabsTrigger value="available">Available Jobs</TabsTrigger>
            <TabsTrigger value="my-jobs">My Jobs</TabsTrigger>
            <TabsTrigger value="my-bids">My Bids</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>
          
          <div className="pb-12">
            <TabsContent value="available" className="space-y-4">
              {/* Available Jobs Tab Content */}
              <div className="flex flex-col md:flex-row gap-4">
                {/* Filters Sidebar */}
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
                      </div>
                    </ScrollArea>
                  </div>
                </div>
                
                {/* Main Content Area */}
                <div className="flex-grow">
                  {/* Job List */}
                  {Array.isArray(availableJobs) && availableJobs.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {availableJobs
                        .filter(job => job.status === "open")
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
                                </div>
                                {job.budget && (
                                  <div className="flex items-center text-sm bg-muted/30 p-2 rounded-md">
                                    <DollarSign className="mr-2 h-4 w-4 text-primary/70" />
                                    <span className="font-medium">${job.budget}</span>
                                  </div>
                                )}
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
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="my-jobs" className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">My Jobs</h2>
              {Array.isArray(myJobs) && myJobs.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {myJobs.map((job) => (
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
                          </div>
                          {job.budget && (
                            <div className="flex items-center text-sm bg-muted/30 p-2 rounded-md">
                              <DollarSign className="mr-2 h-4 w-4 text-primary/70" />
                              <span className="font-medium">${job.budget}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                      <CardFooter className="bg-muted/30 p-3 border-t border-border/20">
                        <Button 
                          className="w-full bg-primary hover:bg-primary/90 transition-colors" 
                          onClick={() => setSelectedJob(job)}
                        >
                          View Details
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 border rounded-lg bg-muted/30">
                  <h3 className="font-medium text-lg">No jobs yet</h3>
                  <p className="text-muted-foreground">
                    You haven't been assigned to any jobs yet
                  </p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="my-bids" className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">My Bids</h2>
              {Array.isArray(myBids) && myBids.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {myBids.map((bid) => {
                    // Find the corresponding job for this bid
                    const job = Array.isArray(jobs) 
                      ? jobs.find(j => j.id === bid.jobId) 
                      : null;
                      
                    if (!job) return null;
                    
                    return (
                      <Card key={bid.id} className="overflow-hidden border-border/40 hover:shadow-md transition-shadow duration-300">
                        <div className="h-2 w-full bg-blue-500"></div>
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <CardTitle className="text-lg font-bold text-primary-foreground">{job.title}</CardTitle>
                            {getBidStatusBadge(bid.status)}
                          </div>
                          <CardDescription className="line-clamp-2 mt-2">
                            {job.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex items-center text-sm bg-muted/30 p-2 rounded-md">
                              <DollarSign className="mr-2 h-4 w-4 text-primary/70" />
                              <span className="font-medium">Your bid: ${bid.amount}</span>
                            </div>
                            <div className="flex items-center text-sm bg-muted/30 p-2 rounded-md">
                              <Building className="mr-2 h-4 w-4 text-primary/70" />
                              <span>{typeof job.location === 'object' ? (job.location as any)?.city || 'Location' : 'Location'}</span>
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="bg-muted/30 p-3 border-t border-border/20">
                          <Button 
                            className="w-full bg-primary hover:bg-primary/90 transition-colors" 
                            onClick={() => setSelectedJob(job)}
                          >
                            View Details
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center p-8 border rounded-lg bg-muted/30">
                  <h3 className="font-medium text-lg">No bids yet</h3>
                  <p className="text-muted-foreground">
                    You haven't placed any bids yet
                  </p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="profile" className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Profile</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <Label>Full Name</Label>
                        <div className="font-medium mt-1">{user?.fullName || 'Not set'}</div>
                      </div>
                      <div>
                        <Label>Email</Label>
                        <div className="font-medium mt-1">{user?.email || 'Not set'}</div>
                      </div>
                      <div>
                        <Label>Phone</Label>
                        <div className="font-medium mt-1">{user?.phone || 'Not set'}</div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full">
                      Edit Profile
                    </Button>
                  </CardFooter>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Business Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <Label>Business Name</Label>
                        <div className="font-medium mt-1">{profile?.businessName || 'Not set'}</div>
                      </div>
                      <div>
                        <Label>Skills</Label>
                        <div className="font-medium mt-1 flex flex-wrap gap-1">
                          {Array.isArray(profile?.skills) && profile.skills.length > 0 
                            ? profile.skills.map((skill, i) => (
                                <Badge key={i} variant="secondary">{skill}</Badge>
                              ))
                            : 'No skills added'
                          }
                        </div>
                      </div>
                      <div>
                        <Label>Bio</Label>
                        <div className="font-medium mt-1">{profile?.bio || 'No bio added'}</div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full">
                      Edit Business Info
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
      
      {/* Bid Modal */}
      <Dialog open={isBidModalOpen} onOpenChange={setIsBidModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Place a Bid</DialogTitle>
            <DialogDescription>
              Submit your proposal and bid amount for this job.
            </DialogDescription>
          </DialogHeader>
          
          {selectedJob && (
            <div className="py-4">
              <h3 className="font-semibold text-lg">{selectedJob.title}</h3>
              <p className="text-muted-foreground mt-1">{selectedJob.description}</p>
              
              {selectedJob.budget && (
                <div className="bg-muted/20 p-3 rounded-md mt-3 flex items-center">
                  <DollarSign className="h-5 w-5 text-primary mr-2" />
                  <div>
                    <p className="text-sm text-muted-foreground">Budget</p>
                    <p className="font-semibold">${selectedJob.budget.toFixed(2)}</p>
                  </div>
                </div>
              )}
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
                      />
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
                        placeholder="Describe your approach, qualifications, and timeline" 
                        className="h-24" 
                        {...field} 
                      />
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
                      <Input 
                        placeholder="e.g., 3-5 days, 2 weeks, etc." 
                        {...field}
                        value={field.value || ''} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="submit" disabled={createBidMutation.isPending}>
                  {createBidMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Bid'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Service Area Dialog */}
      <Dialog open={isServiceAreaDialogOpen} onOpenChange={setIsServiceAreaDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Set Your Service Area</DialogTitle>
            <DialogDescription>
              Define where you provide services and your preferred working radius.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Primary Location</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1">City</Label>
                  <Input placeholder="e.g., San Francisco" />
                </div>
                <div>
                  <Label className="text-xs mb-1">State</Label>
                  <Input placeholder="e.g., CA" />
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Service Radius (km)</Label>
              <div className="flex items-center space-x-3">
                <Slider 
                  min={1}
                  max={100}
                  step={1}
                  value={[serviceRadius]}
                  onValueChange={(value) => setServiceRadius(value[0])}
                  className="flex-grow"
                />
                <span className="w-12 text-center font-medium">{serviceRadius}</span>
              </div>
              <p className="text-xs text-muted-foreground">This will determine which jobs are shown to you</p>
            </div>
            
            <div className="rounded-md overflow-hidden border h-[200px] bg-muted/20">
              <div className="text-center p-4 text-muted-foreground">Map view will appear here</div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsServiceAreaDialogOpen(false)}>
              Cancel
            </Button>
            <Button>
              Save Service Area
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}