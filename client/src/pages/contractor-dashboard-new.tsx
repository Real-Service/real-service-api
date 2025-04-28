import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Job,
  Bid,
  Transaction,
  ContractorProfile,
  coordinateSchema,
} from "@shared/schema";
import {
  Loader2,
  Wallet,
  List,
  FileText,
  Home,
  DollarSign,
  Star,
  Search,
  Building,
  Clock,
  Calendar,
  MapPin,
  Edit,
  Save,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  X,
  Filter,
  Pin,
  Info,
  RefreshCcw,
  CheckCircle2,
  ImageIcon,
  MapIcon,
  MessageCircle,
  Briefcase,
  Heart,
  HeartOff,
  ShieldCheck,
  User,
  Bell,
  Settings,
  ArrowUpRight,
  TrendingUp,
  Users,
  Layers,
  PieChart,
  SearchIcon,
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
import { ContractorJobsTab } from "@/components/ContractorJobsTab";

const bidSchema = z.object({
  amount: z
    .string()
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: "Amount must be a positive number",
    }),
  proposal: z.string().min(10, "Proposal must be at least 10 characters"),
  timeEstimate: z.string().min(3, "Please provide a time estimate"),
});

type BidFormValues = z.infer<typeof bidSchema>;

export default function ContractorDashboard() {
  const { toast } = useToast();
  const { user: authUser, logoutMutation } = useAuth();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [isEditingServiceArea, setIsEditingServiceArea] = useState(false);
  const [serviceAreaMarker, setServiceAreaMarker] = useState({
    latitude: 44.6488,
    longitude: -63.5752, // Halifax as default
  });
  const [serviceRadius, setServiceRadius] = useState(25);
  const [searchQuery, setSearchQuery] = useState("");
  const [bidModalOpen, setBidModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [savedJobs, setSavedJobs] = useState<number[]>([]);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("open");
  const [filterDistance, setFilterDistance] = useState(100);

  // Get contractor profile
  const { data: profileData, isLoading: isProfileLoading } = useQuery({
    queryKey: ["/api/contractor-profile", authUser?.id],
    queryFn: async () => {
      if (!authUser?.id) return null;
      const res = await fetch(`/api/contractor-profile/${authUser.id}`);
      if (!res.ok) throw new Error("Failed to fetch contractor profile");
      return res.json();
    },
    enabled: !!authUser?.id,
  });

  // Update service area from profile data
  useEffect(() => {
    if (profileData?.profile?.serviceArea) {
      const { serviceArea, serviceRadius: radius } = profileData.profile;
      if (serviceArea?.latitude && serviceArea?.longitude) {
        setServiceAreaMarker({
          latitude: serviceArea.latitude,
          longitude: serviceArea.longitude,
        });
      }
      if (radius) {
        setServiceRadius(radius);
      }
    }
  }, [profileData]);

  // Get available jobs
  const { data: jobs = [], isLoading: isJobsLoading } = useQuery({
    queryKey: ["/api/jobs"],
    queryFn: async () => {
      const res = await fetch("/api/jobs");
      if (!res.ok) throw new Error("Failed to fetch jobs");
      return res.json();
    },
  });

  // Get my bids
  const { data: myBids = [], isLoading: isBidsLoading } = useQuery({
    queryKey: ["/api/bids", authUser?.id],
    queryFn: async () => {
      if (!authUser?.id) return [];
      const res = await fetch(`/api/bids?contractorId=${authUser.id}`);
      if (!res.ok) throw new Error("Failed to fetch bids");
      return res.json();
    },
    enabled: !!authUser?.id,
  });

  // Filter jobs based on search and filters
  const filteredJobs = useMemo(() => {
    if (!jobs?.length) return [];

    return jobs.filter((job) => {
      // Filter by status
      if (filterStatus !== "all" && job.status !== filterStatus) return false;

      // Filter by search query
      if (
        searchQuery &&
        !job.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !job.description.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }

      // Filter by category
      if (
        filterCategory !== "all" &&
        (!job.categoryTags || !job.categoryTags.includes(filterCategory))
      ) {
        return false;
      }

      return true;
    });
  }, [jobs, searchQuery, filterCategory, filterStatus]);

  // Get my jobs (from accepted bids)
  const myJobs = useMemo(() => {
    if (!jobs?.length || !myBids?.length) return [];

    const acceptedBids = myBids.filter((bid: Bid) => bid.status === "accepted");
    return jobs.filter((job) =>
      acceptedBids.some((bid: Bid) => bid.jobId === job.id),
    );
  }, [jobs, myBids]);

  // Update service area
  const saveServiceArea = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "PATCH",
        `/api/contractor-profile/${authUser?.id}`,
        {
          serviceArea: {
            ...serviceAreaMarker,
            type: "Point",
          },
          serviceRadius,
        },
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
      queryClient.invalidateQueries({
        queryKey: ["/api/contractor-profile", authUser?.id],
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
        status: "pending",
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
      queryClient.invalidateQueries({ queryKey: ["/api/bids"] });
      toast({
        title: "Bid placed successfully",
        description:
          "Your bid has been submitted. You will be notified if it's accepted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Bid submission failed",
        description: error.message,
        variant: "destructive",
      });
    },
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

  const toggleSaveJob = (jobId: number) => {
    if (savedJobs.includes(jobId)) {
      setSavedJobs(savedJobs.filter((id) => id !== jobId));
    } else {
      setSavedJobs([...savedJobs, jobId]);
    }
  };

  const handleServiceRadiusChange = (value: number[]) => {
    setServiceRadius(value[0]);
  };

  const handleLogout = async (): Promise<void> => {
    await logoutMutation.mutateAsync();
    return Promise.resolve();
  };

  if (!authUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              You need to be logged in to view this page.
            </CardDescription>
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
      <aside className="w-16 md:w-64 bg-blue-950 text-white flex flex-col h-screen sticky top-0 relative">
        <div className="p-4 border-b border-blue-800 flex items-center justify-center md:justify-start">
          <h1 className="text-xl font-bold hidden md:block">Real Service</h1>
          <span className="text-2xl font-bold md:hidden">RS</span>
        </div>

        <div className="flex-1 py-4 overflow-y-auto">
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
              <span className="hidden md:inline">Available Jobs</span>
            </Button>

            <Button
              variant="ghost"
              className={`w-full justify-start text-white hover:bg-blue-800 ${activeSection === "my-bids" ? "bg-blue-800" : ""}`}
              onClick={() => setActiveSection("my-bids")}
            >
              <FileText className="h-5 w-5 md:mr-3" />
              <span className="hidden md:inline">My Bids</span>
            </Button>

            <Button
              variant="ghost"
              className={`w-full justify-start text-white hover:bg-blue-800 ${activeSection === "active-jobs" ? "bg-blue-800" : ""}`}
              onClick={() => setActiveSection("active-jobs")}
            >
              <Layers className="h-5 w-5 md:mr-3" />
              <span className="hidden md:inline">Active Jobs</span>
            </Button>

            <Button
              variant="ghost"
              className={`w-full justify-start text-white hover:bg-blue-800 ${activeSection === "service-area" ? "bg-blue-800" : ""}`}
              onClick={() => setActiveSection("service-area")}
            >
              <MapPin className="h-5 w-5 md:mr-3" />
              <span className="hidden md:inline">Service Area</span>
            </Button>

            <Button
              variant="ghost"
              className={`w-full justify-start text-white hover:bg-blue-800 ${activeSection === "profile" ? "bg-blue-800" : ""}`}
              onClick={() => setActiveSection("profile")}
            >
              <User className="h-5 w-5 md:mr-3" />
              <span className="hidden md:inline">My Profile</span>
            </Button>
          </nav>
        </div>

        {/* Location Settings Section placed above bottom items */}
        <div className="px-2 mb-4">
          <Separator className="my-4 bg-blue-800" />

          <div className="mt-2 mb-2 bg-blue-900/50 rounded-md py-2">
            <h3 className="px-4 py-2 text-sm font-semibold text-blue-200 flex items-center border-l-4 border-blue-500 mb-2">
              <MapPin className="h-5 w-5 mr-2 text-blue-400" />
              <span className="hidden md:inline">Location Settings</span>
              <span className="md:hidden">Location</span>
            </h3>

            <Button
              variant="ghost"
              className="w-full justify-start text-white hover:bg-blue-800/80 flex items-center group px-4 py-2"
              onClick={() => setIsEditingServiceArea(true)}
            >
              <div className="flex flex-col items-start w-full">
                <span className="text-sm font-medium text-white mb-1 hidden md:block">
                  Set Service Location
                </span>
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center">
                    {profileData?.profile?.city ? (
                      <span className="text-sm text-blue-200 group-hover:text-blue-100">
                        {profileData.profile.city}, {profileData.profile.state}
                      </span>
                    ) : (
                      <span className="text-sm text-blue-300 italic">
                        Not set
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-xs text-blue-300 hidden md:inline">
                      Radius:
                    </span>
                    <Badge
                      variant="outline"
                      className="px-2 py-0 h-6 border-blue-500/60 bg-blue-800/60 text-blue-100 text-xs font-medium"
                    >
                      {serviceRadius}km
                    </Badge>
                  </div>
                </div>
              </div>
            </Button>
          </div>
        </div>

        <div className="mb-16 px-2">
          <Button
            variant="ghost"
            className="w-full justify-start text-white hover:bg-blue-800"
            onClick={handleLogout}
          >
            <X className="h-5 w-5 md:mr-3" />
            <span className="hidden md:inline">Logout</span>
          </Button>
        </div>

        {/* Settings button - fixed to the bottom left */}
        <div className="absolute bottom-4 left-0 w-full flex justify-center md:justify-start md:pl-4">
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full bg-blue-800 hover:bg-blue-700 text-white border-blue-700 shadow-md"
            onClick={() => setActiveSection("settings")}
            title="Settings"
          >
            <Settings className="h-6 w-6" />
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
                {activeSection === "jobs" && "Available Jobs"}
                {activeSection === "my-bids" && "My Bids"}
                {activeSection === "active-jobs" && "Active Jobs"}
                {activeSection === "service-area" && "Service Area"}
                {activeSection === "profile" && "My Profile"}
                {activeSection === "settings" && "Settings"}
              </h2>
            </div>

            <div className="flex items-center space-x-4">
              <div className="relative">
                <Bell className="h-5 w-5 text-gray-500" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                  3
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <ProfileAvatar
                  src={profileData?.profile?.profilePicture}
                  alt={authUser.fullName || ""}
                  initials={
                    authUser.fullName
                      ?.split(" ")
                      .map((n: string) => n[0])
                      .join("") || ""
                  }
                  size="sm"
                />
                <span className="font-medium hidden md:block">
                  {authUser.fullName}
                </span>
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
                      <h3 className="text-sm font-medium text-muted-foreground">
                        Available Jobs
                      </h3>
                      <ArrowUpRight className="h-4 w-4 text-green-500" />
                    </div>
                    <div className="text-2xl font-bold">
                      {jobs.filter((job) => job.status === "open").length}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Open jobs in your service area
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-medium text-muted-foreground">
                        Pending Bids
                      </h3>
                      <FileText className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="text-2xl font-bold">
                      {
                        myBids.filter((bid: Bid) => bid.status === "pending")
                          .length
                      }
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Waiting for client response
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-medium text-muted-foreground">
                        Active Jobs
                      </h3>
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="text-2xl font-bold">
                      {
                        myJobs.filter((job) => job.status === "in_progress")
                          .length
                      }
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Jobs currently in progress
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Recent Jobs</CardTitle>
                    <CardDescription>
                      Most recent jobs in your service area
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isJobsLoading ? (
                      <div className="flex justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : jobs.filter((job) => job.status === "open").length >
                      0 ? (
                      <div className="space-y-4">
                        {jobs
                          .filter((job) => job.status === "open")
                          .slice(0, 5)
                          .map((job) => (
                            <div
                              key={job.id}
                              className="flex items-center justify-between border-b pb-4"
                            >
                              <div>
                                <h4 className="font-medium">{job.title}</h4>
                                <div className="flex items-center text-sm text-muted-foreground">
                                  <MapPin className="h-3 w-3 mr-1" />
                                  {job.location?.city}, {job.location?.state}
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Badge>
                                  {job.pricingType === "fixed"
                                    ? `$${job.budget}`
                                    : "Open Bid"}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openBidModal(job)}
                                >
                                  Bid Now
                                </Button>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-center p-4">
                        <p className="text-muted-foreground">
                          No jobs available in your area
                        </p>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button
                      variant="outline"
                      onClick={() => setActiveSection("jobs")}
                      className="w-full"
                    >
                      View All Jobs
                    </Button>
                  </CardFooter>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Service Area</CardTitle>
                    <CardDescription>
                      Your current work coverage area
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px] rounded-md overflow-hidden mb-4">
                      <ServiceAreaDisplay
                        longitude={serviceAreaMarker.longitude}
                        latitude={serviceAreaMarker.latitude}
                        radius={serviceRadius}
                        height="250px"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">
                        Current Service Radius
                      </p>
                      <p className="text-2xl font-bold">{serviceRadius} km</p>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      variant="outline"
                      onClick={() => setActiveSection("service-area")}
                      className="w-full"
                    >
                      Edit Service Area
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </div>
          )}

          {/* Service Area Section */}
          {activeSection === "service-area" && (
            <Card>
              <CardHeader>
                <CardTitle>Service Area Settings</CardTitle>
                <CardDescription>
                  Define the geographic area where you provide services
                </CardDescription>
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
                        <p className="text-sm font-medium text-muted-foreground">
                          Service Radius
                        </p>
                        <p className="text-2xl font-bold">{serviceRadius} km</p>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Location
                        </p>
                        <p className="text-lg font-medium">
                          {profileData?.profile?.city},{" "}
                          {profileData?.profile?.state}
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
                        <Label htmlFor="location">
                          Service Center Location
                        </Label>
                        <LocationSearch
                          onSelectLocation={(location) => {
                            setServiceAreaMarker({
                              latitude: location.latitude,
                              longitude: location.longitude,
                            });
                          }}
                          defaultValue={`${profileData?.profile?.city || ""}, ${profileData?.profile?.state || ""}`}
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
                        onMarkerChange={(marker) =>
                          setServiceAreaMarker(marker)
                        }
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
          )}

          {/* Jobs Section */}
          {activeSection === "jobs" && (
            <ContractorJobsTab
              onBidJob={openBidModal}
              onViewDetails={(job: Job) => setSelectedJob(job)}
              searchQuery={searchQuery}
              filterCategory={filterCategory}
              onResetFilters={() => {
                setSearchQuery("");
                setFilterCategory("all");
              }}
              serviceCity={profileData?.profile?.city || ""}
              serviceState={profileData?.profile?.state || ""}
              serviceRadius={serviceRadius}
              serviceAreaMarker={serviceAreaMarker}
              onLocationChange={(data) => {
                setServiceAreaMarker({
                  latitude: data.latitude,
                  longitude: data.longitude,
                });
              }}
              onRadiusChange={(radius) => setServiceRadius(radius)}
              notificationCount={
                myBids.filter((bid: Bid) => bid.status === "accepted").length
              }
              profilePicture={profileData?.profile?.profilePicture}
              fullName={authUser.fullName}
              onChangeSection={setActiveSection}
              onLogout={handleLogout}
            />
          )}

          {/* My Bids Section */}
          {activeSection === "my-bids" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>My Bids</CardTitle>
                  <CardDescription>
                    Track all your submitted bids
                  </CardDescription>
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
                            {myBids
                              .filter((bid: Bid) => bid.status === "pending")
                              .map((bid: Bid) => {
                                const job = jobs.find(
                                  (j) => j.id === bid.jobId,
                                );
                                return job ? (
                                  <Card key={bid.id}>
                                    <CardContent className="p-4">
                                      <div className="flex justify-between">
                                        <div>
                                          <h3 className="font-semibold">
                                            {job.title}
                                          </h3>
                                          <p className="text-sm text-muted-foreground">
                                            {job.location?.city},{" "}
                                            {job.location?.state}
                                          </p>
                                        </div>
                                        <Badge>Pending</Badge>
                                      </div>
                                      <Separator className="my-3" />
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <p className="text-sm font-medium">
                                            Your Bid
                                          </p>
                                          <p className="text-lg font-bold">
                                            ${bid.amount.toFixed(2)}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-sm font-medium">
                                            Time Estimate
                                          </p>
                                          <p>{bid.timeEstimate}</p>
                                        </div>
                                      </div>
                                      <Separator className="my-3" />
                                      <div>
                                        <p className="text-sm font-medium">
                                          Your Proposal
                                        </p>
                                        <p className="text-sm line-clamp-2">
                                          {bid.proposal}
                                        </p>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ) : null;
                              })}

                            {myBids.filter(
                              (bid: Bid) => bid.status === "pending",
                            ).length === 0 && (
                              <div className="text-center p-6">
                                <p className="text-muted-foreground">
                                  No pending bids
                                </p>
                              </div>
                            )}
                          </div>
                        </TabsContent>

                        <TabsContent value="accepted">
                          <div className="space-y-4 mt-4">
                            {myBids
                              .filter((bid: Bid) => bid.status === "accepted")
                              .map((bid: Bid) => {
                                const job = jobs.find(
                                  (j) => j.id === bid.jobId,
                                );
                                return job ? (
                                  <Card key={bid.id}>
                                    <CardContent className="p-4">
                                      <div className="flex justify-between">
                                        <div>
                                          <h3 className="font-semibold">
                                            {job.title}
                                          </h3>
                                          <p className="text-sm text-muted-foreground">
                                            {job.location?.city},{" "}
                                            {job.location?.state}
                                          </p>
                                        </div>
                                        <Badge className="bg-green-600">
                                          Accepted
                                        </Badge>
                                      </div>
                                      <Separator className="my-3" />
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <p className="text-sm font-medium">
                                            Your Bid
                                          </p>
                                          <p className="text-lg font-bold">
                                            ${bid.amount.toFixed(2)}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-sm font-medium">
                                            Time Estimate
                                          </p>
                                          <p>{bid.timeEstimate}</p>
                                        </div>
                                      </div>
                                      <Separator className="my-3" />
                                      <div className="flex justify-end">
                                        <Button size="sm">
                                          View Job Details
                                        </Button>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ) : null;
                              })}

                            {myBids.filter(
                              (bid: Bid) => bid.status === "accepted",
                            ).length === 0 && (
                              <div className="text-center p-6">
                                <p className="text-muted-foreground">
                                  No accepted bids
                                </p>
                              </div>
                            )}
                          </div>
                        </TabsContent>

                        <TabsContent value="rejected">
                          <div className="space-y-4 mt-4">
                            {myBids
                              .filter((bid: Bid) => bid.status === "rejected")
                              .map((bid: Bid) => {
                                const job = jobs.find(
                                  (j) => j.id === bid.jobId,
                                );
                                return job ? (
                                  <Card key={bid.id}>
                                    <CardContent className="p-4">
                                      <div className="flex justify-between">
                                        <div>
                                          <h3 className="font-semibold">
                                            {job.title}
                                          </h3>
                                          <p className="text-sm text-muted-foreground">
                                            {job.location?.city},{" "}
                                            {job.location?.state}
                                          </p>
                                        </div>
                                        <Badge variant="destructive">
                                          Rejected
                                        </Badge>
                                      </div>
                                      <Separator className="my-3" />
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <p className="text-sm font-medium">
                                            Your Bid
                                          </p>
                                          <p className="text-lg font-bold">
                                            ${bid.amount.toFixed(2)}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-sm font-medium">
                                            Time Estimate
                                          </p>
                                          <p>{bid.timeEstimate}</p>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ) : null;
                              })}

                            {myBids.filter(
                              (bid: Bid) => bid.status === "rejected",
                            ).length === 0 && (
                              <div className="text-center p-6">
                                <p className="text-muted-foreground">
                                  No rejected bids
                                </p>
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
            </div>
          )}

          {/* Active Jobs Section */}
          {activeSection === "active-jobs" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Active Jobs</CardTitle>
                  <CardDescription>
                    Jobs where your bid was accepted
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isJobsLoading || isBidsLoading ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : myJobs.length > 0 ? (
                    <div className="space-y-4">
                      {myJobs.map((job) => (
                        <Card key={job.id}>
                          <CardContent className="p-6">
                            <div className="flex justify-between mb-2">
                              <h3 className="text-lg font-bold">{job.title}</h3>
                              <Badge
                                variant={
                                  job.status === "in_progress"
                                    ? "secondary"
                                    : job.status === "completed"
                                      ? "outline"
                                      : "default"
                                }
                              >
                                {job.status.replace("_", " ")}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                              <div>
                                <p className="text-sm text-muted-foreground">
                                  Location
                                </p>
                                <p className="font-medium">
                                  {job.location?.city}, {job.location?.state}
                                </p>
                              </div>

                              <div>
                                <p className="text-sm text-muted-foreground">
                                  Start Date
                                </p>
                                <p className="font-medium">
                                  {job.startDate
                                    ? new Date(
                                        job.startDate,
                                      ).toLocaleDateString()
                                    : "Flexible"}
                                </p>
                              </div>

                              <div>
                                <p className="text-sm text-muted-foreground">
                                  Contract Amount
                                </p>
                                <p className="font-bold">
                                  $
                                  {myBids
                                    .find(
                                      (bid: Bid) =>
                                        bid.jobId === job.id &&
                                        bid.status === "accepted",
                                    )
                                    ?.amount.toFixed(2)}
                                </p>
                              </div>
                            </div>

                            <div className="flex justify-end space-x-2">
                              <Button variant="outline">
                                <MessageCircle className="mr-2 h-4 w-4" />
                                Message Client
                              </Button>
                              <Button>View Details</Button>
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
          )}

          {/* Profile Section */}
          {activeSection === "profile" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>My Profile</CardTitle>
                  <CardDescription>
                    Manage your profile information and settings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <UserProfileCard
                      user={authUser}
                      allowEdit={true}
                      showDetails={true}
                      skills={profileData?.profile?.skills}
                      location={`${profileData?.profile?.city || ""}, ${profileData?.profile?.state || ""}`}
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
                  <CardDescription>
                    Manage your account preferences
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium mb-4">
                        Notification Settings
                      </h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">Email Notifications</p>
                            <p className="text-sm text-muted-foreground">
                              Receive job and bid updates via email
                            </p>
                          </div>
                          <Switch />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">SMS Notifications</p>
                            <p className="text-sm text-muted-foreground">
                              Receive urgent updates via text message
                            </p>
                          </div>
                          <Switch />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="text-lg font-medium mb-4">
                        Privacy Settings
                      </h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">Profile Visibility</p>
                            <p className="text-sm text-muted-foreground">
                              Make your profile visible to potential clients
                            </p>
                          </div>
                          <Switch defaultChecked />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="text-lg font-medium mb-4">
                        Account Actions
                      </h3>
                      <div className="space-y-2">
                        <Button variant="outline" className="w-full sm:w-auto">
                          Change Password
                        </Button>
                        <Button
                          variant="destructive"
                          className="w-full sm:w-auto"
                        >
                          Delete Account
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>

      {/* Bid Modal */}
      <Dialog open={bidModalOpen} onOpenChange={setBidModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Place Bid on Job</DialogTitle>
            <DialogDescription>
              Provide your bid details for: {selectedJob?.title}
            </DialogDescription>
          </DialogHeader>

          <Form {...bidForm}>
            <form
              onSubmit={bidForm.handleSubmit(onSubmitBidForm)}
              className="space-y-4"
            >
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
                        min="0"
                        placeholder="0.00"
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

              <DialogFooter>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setBidModalOpen(false)}
                >
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
    </div>
  );
}
