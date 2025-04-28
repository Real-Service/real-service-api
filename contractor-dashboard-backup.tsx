import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogPortal, DialogOverlay, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { useUnreadMessages } from "@/hooks/use-unread-messages";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Job, Bid, Transaction, ContractorProfile, coordinateSchema, Quote } from "@shared/schema";
import { AVAILABLE_CATEGORIES, getCategoryValue, getCategoryDisplayName } from "@shared/constants";
import { RealEstateSidebar } from "@/components/RealEstateSidebar";
import { RealEstateTopNav } from "@/components/RealEstateTopNav";
// Extended job type that includes chatRoomId which is added by the API
interface ExtendedJob extends Omit<Job, 'images' | 'location' | 'categoryTags'> {
  chatRoomId?: number;
  images?: string[];
  location: {
    city: string;
    state: string;
    [key: string]: any;
  };
  categoryTags: string[];
  category?: string; // Added for image fallbacks
  landlordName?: string; // Added for chat functionality
}
import { 
  Loader2, Wallet, List, FileText, Home, DollarSign, Star, Search, Building, Clock, Calendar, MapPin, Edit,
  Save, SlidersHorizontal, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, X, Filter, Pin, Info as InfoIcon, RefreshCcw, CheckCircle2,
  ImageIcon, MapIcon, MessageCircle, Briefcase, Heart, HeartOff, ShieldCheck, User, Bell, Settings,
  ArrowUpRight, TrendingUp, Users, Layers, PieChart, SearchIcon, Inbox, LogOut, BarChart2, Tag, Check,
  Lock as LockIcon, Unlock as UnlockIcon, Plus, Info, Send, CalendarDays
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { CategoryIcon } from "@/components/CategoryIcons";
import ReviewForm from "@/components/ReviewForm";
import { LocationSearch } from "@/components/LocationSearch";
import { FloatingChatBubbles } from "@/components/FloatingChatBubbles";
import { ServiceAreaMapInput } from "@/components/ServiceAreaMapInput";
import { ServiceAreaDisplay } from "@/components/ServiceAreaDisplay";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { UserProfileCard } from "@/components/UserProfileCard";
import { JobCalendar } from "@/components/JobCalendar";
import { ContractorJobsTab } from "@/components/ContractorJobsTab";
import { MobileNavigation } from "@/components/MobileNavigation";
import { ChatInterface } from "@/components/ChatInterface";
import { ProfileSettings } from "@/components/ProfileSettings";
import { AdminTools } from "@/components/AdminTools";
import { QuotesTab } from "@/components/QuotesTab";
import { QuoteForm } from "@/components/QuoteForm";
import { QuoteDetails } from "@/components/QuoteDetails";
import { QuoteWizard } from "@/components/QuoteWizard";
import { ScheduleCalendar } from "@/components/ScheduleCalendar";

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

// Type definition for service area
type ServiceArea = {
  id: number;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  radius: number;
};

export default function ContractorDashboard() {
  const { toast } = useToast();
  const { user: authUser, logoutMutation } = useAuth();
  const [activeSection, setActiveSection] = useState("jobs");
  const [activeJobCategory, setActiveJobCategory] = useState("all"); // Options: all, fixed, open
  const [activeViewMode, setActiveViewMode] = useState("grid"); // Options: grid, list, map, split, calendar
  const { totalUnreadCount: unreadMessagesCount } = useUnreadMessages(authUser?.id);
  
  // Using the handleLogout function defined later in the code
  const [isEditingServiceArea, setIsEditingServiceArea] = useState(false);
  const [isAddingNewServiceArea, setIsAddingNewServiceArea] = useState(false);
  const [serviceAreaMarker, setServiceAreaMarker] = useState({
    latitude: 44.6488,
    longitude: -63.5752, // Halifax as default
  });
  const [serviceRadius, setServiceRadius] = useState(25);
  const [tempRadius, setTempRadius] = useState<number | null>(null);
  const [tempCity, setTempCity] = useState<string | null>(null);
  const [tempState, setTempState] = useState<string | null>(null);
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [nextServiceAreaId, setNextServiceAreaId] = useState(1);
  const [selectedServiceAreaId, setSelectedServiceAreaId] = useState<number | null>(null);
  // Removed search query state as we now only use category filtering
  const [bidModalOpen, setBidModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<ExtendedJob | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [jobToReview, setJobToReview] = useState<ExtendedJob | null>(null);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [isQuoteButtonVisible, setIsQuoteButtonVisible] = useState(true);
  const [savedJobs, setSavedJobs] = useState<number[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [lockedCategories, setLockedCategories] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("open");
  const [filterDistance, setFilterDistance] = useState(100);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [filtersDisabled, setFiltersDisabled] = useState(false);
  const [categorySortOrder, setCategorySortOrder] = useState<"sorted" | "unsorted">("unsorted");
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [pendingCategories, setPendingCategories] = useState<string[]>([]);
  const [categoryDialogMode, setCategoryDialogMode] = useState<"select" | "add">("select");

  // Quote state
  const [quoteFormOpen, setQuoteFormOpen] = useState(false);
  const [quoteDetailsOpen, setQuoteDetailsOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [jobToQuote, setJobToQuote] = useState<Job | null>(null);
  const [quoteWizardOpen, setQuoteWizardOpen] = useState(false);
  
  // Calendar state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  
  // Chat state
  const [chatBubbles, setChatBubbles] = useState<Array<{
    id: number;
    title: string;
    jobId?: number;
    chatRoomId: number;
    otherUserId: number;
    otherUserName: string;
    otherUserAvatar?: string;
    jobImage?: string;  // Added to display job thumbnails instead of user avatars
    lastMessage?: string;
    unreadCount?: number;
    timestamp?: string;
  }>>([]);

  // Get contractor profile
  const { data: profileData, isLoading: isProfileLoading, refetch: refetchProfile } = useQuery({
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
    if (profileData) {
      console.log("Profile data changed, updating UI state:", profileData);
      
      // Reset service areas if profile shows they're empty
      if ((!profileData.serviceAreas || !Array.isArray(profileData.serviceAreas) || profileData.serviceAreas.length === 0) &&
          (!profileData.serviceArea || !profileData.serviceArea.latitude)) {
        console.log("No service areas found in profile - clearing local state");
        setServiceAreas([]);
        setServiceRadius(25); // Default radius
        
        // Don't return early - ensure trades are still processed below
        // Instead of returning, just skip service area loading
      }
      
      // First check if multiple service areas exist in the profile data
      if (profileData.serviceAreas && Array.isArray(profileData.serviceAreas) && profileData.serviceAreas.length > 0) {
        // Use the service areas from the profile
        console.log("Loading multiple service areas from profile:", profileData.serviceAreas);
        setServiceAreas(profileData.serviceAreas);
        
        // Set the main service area marker to the first service area for the map
        const primaryArea = profileData.serviceAreas[0];
        setServiceAreaMarker({
          latitude: primaryArea.latitude,
          longitude: primaryArea.longitude
        });
        setServiceRadius(primaryArea.radius || 25);
        
        // Update the temp values if they are currently null
        if (!tempCity) setTempCity(primaryArea.city || "Unknown");
        if (!tempState) setTempState(primaryArea.state || "");
        
        // Set the next ID to be greater than any existing ID
        const maxId = Math.max(...profileData.serviceAreas.map((area: ServiceArea) => area.id));
        setNextServiceAreaId(maxId + 1);
      } 
      // Fall back to the old single service area if no array exists
      else if (profileData.serviceArea?.latitude && profileData.serviceArea?.longitude) {
        console.log("Using legacy serviceArea from profile", profileData.serviceArea);
        
        // Set the main service area marker for compatibility with existing API
        setServiceAreaMarker({
          latitude: profileData.serviceArea.latitude,
          longitude: profileData.serviceArea.longitude
        });
        
        // Create a service area based on the legacy field data
        const mainArea: ServiceArea = {
          id: 1,
          city: profileData.city || profileData.profile?.city || "Unknown",
          state: profileData.state || profileData.profile?.state || "",
          latitude: profileData.serviceArea.latitude,
          longitude: profileData.serviceArea.longitude,
          radius: profileData.serviceRadius || 25
        };
        
        // Update the service areas list
        setServiceAreas([mainArea]);
        setNextServiceAreaId(2); // Next ID will be 2
        
        // Handle service radius
        if (profileData.serviceRadius) {
          setServiceRadius(profileData.serviceRadius);
        }
        
        // Update the temp values if they are currently null
        if (!tempCity) {
          if (profileData.city) {
            setTempCity(profileData.city);
          } else if (profileData.profile?.city) {
            setTempCity(profileData.profile.city);
          }
        }
        
        if (!tempState) {
          if (profileData.state) {
            setTempState(profileData.state);
          } else if (profileData.profile?.state) {
            setTempState(profileData.profile.state);
          }
        }
      }
      
      // Load and set user's trades as locked categories
      if (profileData.trades && Array.isArray(profileData.trades) && profileData.trades.length > 0) {
        console.log("Loading contractor trades as locked categories:", profileData.trades);
        // Convert trades to category values
        const tradeCategoryValues = profileData.trades.map((trade: string) => {
          // Find matching category or use the trade as is
          const matchingCategory = AVAILABLE_CATEGORIES.find(
            cat => cat.toLowerCase() === trade.toLowerCase()
          );
          return matchingCategory ? getCategoryValue(matchingCategory) : getCategoryValue(trade);
        });
        
        // Set locked categories from user's trades
        setLockedCategories(tradeCategoryValues);
        
        // Also initially select these categories
        setSelectedCategories(tradeCategoryValues);
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
  
  // Get quotes data for calendar view
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
  
  // Get all contractor job data from the new API endpoint with structured response
  const { data: jobData = { availableJobs: [], activeJobs: [], myBids: [] }, isLoading: isDirectJobsLoading } = useQuery({
    queryKey: ['/api/contractor-jobs'],
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
      
      // Make the request with session-based authentication
      const res = await fetch(`/api/contractor-jobs?_t=${Date.now()}`, {
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
  
  // Effect to redirect from Calendar section if it's somehow selected
  useEffect(() => {
    if (activeSection === "calendar") {
      setActiveSection("jobs");
      toast({
        title: "Calendar Moved",
        description: "Calendar views are now available in each section.",
      });
    }
  }, [activeSection, toast]);

  // Filter jobs based on search and filters
  const filteredJobs = useMemo(() => {
    if (!jobs?.length) return [];
    
    return jobs.filter((job: Job) => {
      // Filter by status
      if (filterStatus !== "all" && job.status !== filterStatus) return false;
      
      // Filter by selected categories
      if (selectedCategories.length > 0) {
        // If we have categories selected and the job has no tags, exclude it
        if (!job.categoryTags || !Array.isArray(job.categoryTags) || job.categoryTags.length === 0) {
          return false;
        }
        
        // Check if any of the job's categories match any of our selected categories
        const hasMatchingCategory = job.categoryTags.some((tag: string) => 
          selectedCategories.includes(tag)
        );
        
        if (!hasMatchingCategory) {
          return false;
        }
      }
      
      return true;
    });
  }, [jobs, selectedCategories, filterStatus]);
  
  // Helper function to calculate distance between two coordinates (in km)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Check if contractor has at least one valid service area configured
  const hasValidServiceArea = (): boolean => {
    // If we have service areas array with at least one area
    if (serviceAreas.length > 0) {
      return serviceAreas.some(area => 
        typeof area.latitude === 'number' && 
        typeof area.longitude === 'number' && 
        typeof area.radius === 'number' &&
        area.radius > 0
      );
    }
    
    // Otherwise return false - no valid service areas
    return false;
  };

  // Function to check if a job is within any of the service areas
  const isJobInServiceArea = (job: Job): boolean => {
    // If there are no service areas, show all jobs
    if (!serviceAreas.length) return true;
    
    // If job doesn't have location coordinates, we can't filter it
    if (!job.location || 
        typeof job.location !== 'object' || 
        typeof (job.location as any).latitude !== 'number' || 
        typeof (job.location as any).longitude !== 'number') {
      return true; // Include jobs without proper location data
    }
    
    // Check if the job is within any of the service areas
    return serviceAreas.some(area => {
      const distance = calculateDistance(
        area.latitude, 
        area.longitude, 
        (job.location as any).latitude, 
        (job.location as any).longitude
      );
      return distance <= area.radius;
    });
  };

  // Filter available jobs based on filters
  const filteredAvailableJobs = useMemo(() => {
    if (!availableJobs?.length) return [];
    
    console.log("Filtering jobs with service areas:", serviceAreas);
    
    return availableJobs.filter((job: Job) => {
      // Filter by status
      if (filterStatus !== "all" && job.status !== filterStatus) return false;
      
      // Filter by selected categories (only if not disabled)
      if (!filtersDisabled && selectedCategories.length > 0) {
        // If we have categories selected and the job has no tags, exclude it
        if (!job.categoryTags || !Array.isArray(job.categoryTags) || job.categoryTags.length === 0) {
          return false;
        }
        
        // Check if any of the job's categories match any of our selected categories
        const hasMatchingCategory = job.categoryTags.some(tag => 
          selectedCategories.includes(tag)
        );
        
        if (!hasMatchingCategory) {
          return false;
        }
      }
      
      // Filter by service area
      if (!isJobInServiceArea(job)) {
        return false;
      }
      
      return true;
    });
  }, [availableJobs, selectedCategories, filterStatus, serviceAreas, filtersDisabled]);

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
  
  // Load chat bubbles data - this would come from an API in production
  // Load chat data for the user
  const { unreadCounts: unreadMessagesData } = useUnreadMessages(authUser?.id);

  // Load chat rooms data from server
  const { data: chatRoomsData, isLoading: isChatsLoading } = useQuery({
    queryKey: ['/api/chat/rooms', authUser?.id],
    enabled: !!authUser?.id,
    queryFn: async () => {
      try {
        // Get the user's chat rooms - this is a new endpoint we'll need to add
        // For now, we can fetch from jobs the user has bid on
        const jobsResponse = await apiRequest('GET', `/api/contractor-jobs`);
        if (!jobsResponse.ok) throw new Error('Failed to load jobs with chat rooms');
        
        const jobsData = await jobsResponse.json();
        const availableJobs = jobsData.availableJobs || [];
        const activeJobs = jobsData.activeJobs || [];
        
        // Combine available and active jobs
        const allJobs = [...availableJobs, ...activeJobs];
        
        // Map jobs to chat rooms with proper type handling
        return allJobs
          .filter((job: any) => job.chatRoomId)
          .map((job: any) => {
            // Find unread count for this chat room
            const unreadData = unreadMessagesData?.find(
              (data: any) => data.chatRoomId === job.chatRoomId
            );
            
            return {
              id: job.id, // Use job ID as bubble ID
              title: job.title,
              jobId: job.id,
              chatRoomId: job.chatRoomId,
              otherUserId: job.landlordId,
              otherUserName: job.landlordName || "Property Owner",
              jobImage: job.images && job.images.length > 0 ? job.images[0] : 
                       `/uploads/jobs/${job.category?.toLowerCase() || 'default-job-image'}.jpg`,  // Use category-based fallback image
              lastMessage: "", // Placeholder since unreadData doesn't have lastMessage property
              unreadCount: unreadData?.unreadCount || 0,
              timestamp: job.updatedAt || job.createdAt
            };
          });
      } catch (error) {
        console.error("Failed to load chat rooms:", error);
        return [];
      }
    }
  });
  
  // Initialize chat UI on first load and update when data changes
  useEffect(() => {
    // Always ensure the chat bubbles UI is visible, even if we don't have data yet
    if (!chatBubbles.length && authUser?.id) {
      // Initialize with empty array if we don't have any bubbles yet
      console.log("Initializing chat UI with empty array to ensure visibility");
      setChatBubbles([]);
    }
    
    // Then update with real data when it loads
    if (chatRoomsData && chatRoomsData.length > 0) {
      console.log("Updating chat bubbles with loaded data:", chatRoomsData.length, "items");
      setChatBubbles(chatRoomsData);
    } else if (authUser?.id && !isChatsLoading && chatRoomsData) {
      // If API returned empty array, update our state
      console.log("API returned empty chat rooms array");
      setChatBubbles([]);
    }
  }, [chatRoomsData, isChatsLoading, authUser?.id, chatBubbles.length]);

  // Update contractor profile
  const updateContractorProfile = useMutation({
    mutationFn: async (data: any) => {
      console.log("Sending profile update with data:", data);
      
      // For service area deletion, make sure we're explicitly nullifying all fields
      if (data.serviceArea === null || 
          (data.serviceAreas && Array.isArray(data.serviceAreas) && data.serviceAreas.length === 0)) {
        console.log("SERVICE AREA DELETION detected - ensuring all fields are properly nullified");
        // Ensure all related fields are set to null too
        data = {
          ...data,
          serviceArea: null,
          serviceAreaLat: null,
          serviceAreaLng: null,
          serviceRadius: null,
          // No need to modify serviceAreas if it's already []
        };
        
        // Only nullify city/state if they're not explicitly set
        if (!data.city) data.city = null;
        if (!data.state) data.state = null;
      }
      
      const res = await apiRequest(
        "PATCH", 
        `/api/contractor-profile/${authUser?.id}`, 
        data
      );
      
      if (!res.ok) {
        throw new Error("Failed to update contractor profile");
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      // Update local profile data immediately for a responsive UI
      if (data.city) {
        setTempCity(data.city);
      }
      if (data.state) {
        setTempState(data.state);
      }
      
      // Update locked categories if trades were updated
      if (data.trades && Array.isArray(data.trades)) {
        console.log("Updating locked categories from profile update:", data.trades);
        
        // Convert trades to category values
        const tradeCategoryValues = data.trades.map((trade: string) => {
          // Find matching category or use the trade as is
          const matchingCategory = AVAILABLE_CATEGORIES.find(
            cat => cat.toLowerCase() === trade.toLowerCase()
          );
          return matchingCategory ? getCategoryValue(matchingCategory) : getCategoryValue(trade);
        });
        
        // Update the locked categories
        setLockedCategories(tradeCategoryValues);
        
        // Also update the selected categories to include the locked ones
        setSelectedCategories(prev => {
          // Keep any categories that were previously selected but not in locked categories
          const nonLockedSelected = prev.filter(c => !lockedCategories.includes(c));
          // Combine with new locked categories
          return [...nonLockedSelected, ...tradeCategoryValues];
        });
      }
      
      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
      
      // Force refresh the profile data immediately with refetch
      refetchProfile();
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Update service area
  const saveServiceArea = useMutation({
    mutationFn: async () => {
      // Create a temporary service area object for the current edit
      const currentServiceArea = {
        id: selectedServiceAreaId || nextServiceAreaId,
        city: tempCity || "Unknown",
        state: tempState || "", 
        latitude: serviceAreaMarker.latitude,
        longitude: serviceAreaMarker.longitude,
        radius: serviceRadius
      };
      
      // If editing an existing area, replace it in the array
      // If adding a new one, append it to the array
      let updatedServiceAreas = [];
      if (isAddingNewServiceArea) {
        updatedServiceAreas = [...serviceAreas, currentServiceArea];
      } else if (selectedServiceAreaId) {
        updatedServiceAreas = serviceAreas.map(area => 
          area.id === selectedServiceAreaId ? currentServiceArea : area
        );
      } else {
        updatedServiceAreas = [currentServiceArea, ...serviceAreas.slice(1)];
      }
      
      // Send both the primary service area and the full array
      const res = await apiRequest(
        "PATCH", 
        `/api/contractor-profile/${authUser?.id}`, 
        { 
          serviceArea: { 
            ...serviceAreaMarker,
            type: "Point" 
          },
          serviceRadius,
          city: tempCity,
          state: tempState,
          serviceAreas: updatedServiceAreas
        }
      );
      
      if (!res.ok) {
        throw new Error("Failed to update service area");
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      // Set editing state back to false
      setIsEditingServiceArea(false);
      
      // Create the updated/new service area object
      const updatedServiceArea = {
        id: selectedServiceAreaId || nextServiceAreaId,
        city: tempCity || "Unknown",
        state: tempState || "",
        latitude: serviceAreaMarker.latitude,
        longitude: serviceAreaMarker.longitude,
        radius: serviceRadius
      };
      
      // If we're adding a new service area
      if (isAddingNewServiceArea) {
        // Add to service areas array for the sidebar
        setServiceAreas(prev => [...prev, updatedServiceArea]);
        setNextServiceAreaId(nextServiceAreaId + 1);
        setIsAddingNewServiceArea(false);
      } 
      // If we're editing an existing service area
      else if (selectedServiceAreaId) {
        // Update existing service area
        setServiceAreas(prev => 
          prev.map(area => 
            area.id === selectedServiceAreaId ? updatedServiceArea : area
          )
        );
        setSelectedServiceAreaId(null);
      } 
      // If we're updating the default service area
      else {
        // Update the main service area and make sure it's in the list
        if (serviceAreas.length > 0) {
          setServiceAreas(prev => 
            prev.map(area => 
              area.id === 1 ? {
                ...updatedServiceArea,
                id: 1 // Always ensure the default has ID 1
              } : area
            )
          );
        } else {
          // If no service areas exist yet, add the default one
          setServiceAreas([{...updatedServiceArea, id: 1}]);
        }
      }
      
      toast({
        title: "Service area updated",
        description: "Your service area has been successfully updated.",
      });
      
      // Force refresh the profile data immediately with refetch
      refetchProfile();
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
      queryClient.invalidateQueries({ queryKey: ['/api/contractor-jobs'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/contractor-jobs'] });
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

  const openBidModal = (job: ExtendedJob) => {
    setSelectedJob(job as unknown as ExtendedJob);
    setBidModalOpen(true);
  };
  
  // Function to create a quote from job data
  const createQuoteFromJob = (job: ExtendedJob) => {
    // Set selected job
    setSelectedJob(job as unknown as ExtendedJob);
    
    // Set job to quote state for the QuotesTab component to use
    setJobToQuote(job as unknown as Job);
    
    // Switch to inbox section (that now contains quotes)
    setActiveSection("inbox");
    
    // Add a small delay to ensure the section change is processed
    setTimeout(() => {
      // Open the quote wizard with job data (instead of the old form)
      setQuoteWizardOpen(true);
    }, 100);
  };
  
  const viewJobDetails = (job: ExtendedJob) => {
    setSelectedJob(job as unknown as ExtendedJob);
    setSelectedImageIndex(0); // Reset image index when viewing a new job
    setIsDetailsModalOpen(true);
  };

  const toggleSaveJob = (jobId: number) => {
    if (savedJobs.includes(jobId)) {
      setSavedJobs(savedJobs.filter(id => id !== jobId));
    } else {
      setSavedJobs([...savedJobs, jobId]);
    }
  };
  
  // Toggle category selection for multi-select functionality
  const toggleCategorySelection = (categoryValue: string) => {
    if (selectedCategories.includes(categoryValue)) {
      // If already selected, remove it (unless it's locked)
      if (!lockedCategories.includes(categoryValue)) {
        setSelectedCategories(selectedCategories.filter(cat => cat !== categoryValue));
      }
    } else {
      // If not selected, add it
      setSelectedCategories([...selectedCategories, categoryValue]);
    }
  };

  // Toggle the locked status of a category
  const toggleLockedCategory = (categoryValue: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering the button click
    
    if (lockedCategories.includes(categoryValue)) {
      // If already locked, unlock it
      setLockedCategories(lockedCategories.filter(cat => cat !== categoryValue));
    } else {
      // If not locked, lock it (and ensure it's selected)
      setLockedCategories([...lockedCategories, categoryValue]);
      if (!selectedCategories.includes(categoryValue)) {
        setSelectedCategories([...selectedCategories, categoryValue]);
      }
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
      await logoutMutation.mutateAsync();
      
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
    <div className="dashboard-container bg-white flex flex-col pb-16 md:pb-0">
      {/* Floating chat bubbles */}
      <FloatingChatBubbles 
        userId={authUser.id}
        userName={authUser.fullName || authUser.username}
        userAvatar={profileData?.profilePicture}
        chatBubbles={chatBubbles}
        useTestBubbles={authUser?.id && chatBubbles.length === 0 ? true : false} // Enable test mode if no bubbles
        onCloseBubble={(bubbleId) => {
          // Only minimize the chat bubble instead of removing it
          // This way the chat will stay in the list and can be reopened
          console.log(`Chat bubble ${bubbleId} minimized instead of removed`);
        }}
      />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Redfin/Zillow-style sidebar */}
        <RealEstateSidebar
          activeSection={activeSection}
          onChangeSection={setActiveSection}
          userName={authUser.fullName || authUser.username}
          userAvatar={profileData?.profilePicture}
          serviceAreas={serviceAreas}
          selectedCategories={selectedCategories}
          onLogout={handleLogout}
          unreadCount={unreadMessagesCount}
          className="hidden md:flex"
        />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Redfin/Zillow-style top navigation */}
          <RealEstateTopNav
            activeViewMode={activeViewMode || "grid"}
            onChangeViewMode={setActiveViewMode}
            onToggleSidebar={() => console.log("Toggle sidebar")}
            onCreateNewQuote={activeSection === "inbox" ? () => {
              setSelectedQuote(null);
              setQuoteWizardOpen(true);
            } : undefined}
          />
          
          {/* Main content area */}
          <div className="flex-1 p-4 overflow-y-auto">
            {activeSection === "jobs" && (
              <ContractorJobsTab
                jobs={filteredAvailableJobs}
                bids={myBids}
                activeJobs={activeJobs}
                activeJobCategory={activeJobCategory}
                onChangeJobCategory={setActiveJobCategory}
                onOpenBid={openBidModal}
                onViewJobDetails={viewJobDetails}
                onCreateQuote={createQuoteFromJob}
                viewMode={activeViewMode}
                onChangeViewMode={setActiveViewMode}
                savedJobs={savedJobs}
                onSaveJob={(jobId) => {
                  if (savedJobs.includes(jobId)) {
                    setSavedJobs(savedJobs.filter(id => id !== jobId));
                  } else {
                    setSavedJobs([...savedJobs, jobId]);
                  }
                }}
                serviceAreas={serviceAreas}
                isMapLoading={!hasValidServiceArea()}
              />
            )}
            
            {activeSection === "inbox" && (
              <QuotesTab
                quotes={quotes}
                viewMode={activeViewMode}
                onChangeViewMode={setActiveViewMode}
                onCreateQuote={() => {
                  setSelectedQuote(null);
                  setQuoteWizardOpen(true);
                }}
                onViewQuote={(quote) => {
                  setSelectedQuote(quote);
                  setQuoteDetailsOpen(true);
                }}
                onEditQuote={(quote) => {
                  setSelectedQuote(quote);
                  setQuoteFormOpen(true);
                }}
              />
            )}
            
            {activeSection === "map" && (
              <div className="h-full w-full">
                <h2 className="text-xl font-semibold mb-4">Property Map</h2>
                <div className="bg-white rounded-lg shadow-md h-[calc(100vh-180px)]">
                  <JobsMap
                    jobs={filteredAvailableJobs}
                    serviceAreas={serviceAreas}
                    onJobClick={viewJobDetails}
                    highlightedJob={null}
                  />
                </div>
              </div>
            )}
            
            {activeSection === "schedule" && (
              <div className="h-full w-full">
                <h2 className="text-xl font-semibold mb-4">Schedule Calendar</h2>
                <div className="bg-white rounded-lg shadow-md p-4">
                  <ScheduleCalendar
                    quotes={quotes}
                    jobs={activeJobs}
                    selectedDate={selectedDate}
                    setSelectedDate={setSelectedDate}
                    onCreateQuote={() => {
                      setSelectedQuote(null);
                      setQuoteWizardOpen(true);
                    }}
                    onViewQuote={(quote) => {
                      setSelectedQuote(quote);
                      setQuoteDetailsOpen(true);
                    }}
                  />
                </div>
              </div>
            )}
            
            {activeSection === "settings" && (
              <div className="h-full w-full">
                <ProfileSettings
                  profileData={profileData}
                  refetchProfile={refetchProfile}
                  isLoading={isProfileLoading}
                  userId={authUser?.id}
                  serviceAreas={serviceAreas}
                  setServiceAreas={setServiceAreas}
                  nextServiceAreaId={nextServiceAreaId}
                  setNextServiceAreaId={setNextServiceAreaId}
                  selectedCategories={selectedCategories}
                  setSelectedCategories={setSelectedCategories}
                  lockedCategories={lockedCategories}
                />
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Modals and dialogs */}
      <Dialog
        open={bidModalOpen}
        onOpenChange={setBidModalOpen}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Place Bid on Job</DialogTitle>
            <DialogDescription>
              Enter your bid amount and any additional notes for the landlord.
            </DialogDescription>
          </DialogHeader>
          {selectedJob && (
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
                          placeholder="Enter your bid amount" 
                          {...field}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value);
                            field.onChange(isNaN(value) ? 0 : value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={bidForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Additional information about your bid" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setBidModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={placeBidMutation.isPending}
                  >
                    {placeBidMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Submit Bid
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDetailsModalOpen}
        onOpenChange={setIsDetailsModalOpen}
      >
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedJob?.title}</DialogTitle>
          </DialogHeader>
          {selectedJob && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[80vh] overflow-y-auto">
              {/* Job images */}
              <div className="relative">
                {selectedJob.images && selectedJob.images.length > 0 ? (
                  <div className="relative aspect-video rounded-lg overflow-hidden">
                    <img 
                      src={selectedJob.images[selectedImageIndex]} 
                      alt={`Job image ${selectedImageIndex + 1}`} 
                      className="object-cover w-full h-full"
                    />
                    
                    {selectedJob.images.length > 1 && (
                      <>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white rounded-full hover:bg-black/70"
                          onClick={() => setSelectedImageIndex(prev => (prev - 1 + selectedJob.images!.length) % selectedJob.images!.length)}
                        >
                          <ChevronLeft className="h-6 w-6" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white rounded-full hover:bg-black/70"
                          onClick={() => setSelectedImageIndex(prev => (prev + 1) % selectedJob.images!.length)}
                        >
                          <ChevronRight className="h-6 w-6" />
                        </Button>
                      </>
                    )}
                    
                    {selectedJob.images.length > 1 && (
                      <div className="absolute bottom-2 left-0 right-0 flex justify-center space-x-2">
                        {selectedJob.images.map((_, index) => (
                          <Button
                            key={index}
                            variant="ghost"
                            size="icon"
                            className={`w-3 h-3 p-0 rounded-full ${selectedImageIndex === index ? 'bg-white' : 'bg-white/50'}`}
                            onClick={() => setSelectedImageIndex(index)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center bg-muted rounded-lg aspect-video">
                    <ImageIcon className="h-24 w-24 text-muted-foreground" />
                    <p className="text-muted-foreground">No images available</p>
                  </div>
                )}
                
                {/* Thumbnail gallery */}
                {selectedJob.images && selectedJob.images.length > 1 && (
                  <div className="flex mt-2 space-x-2 overflow-x-auto pb-2">
                    {selectedJob.images.map((image, index) => (
                      <div 
                        key={index} 
                        className={`relative w-16 h-16 flex-shrink-0 cursor-pointer rounded overflow-hidden border-2 ${selectedImageIndex === index ? 'border-primary' : 'border-transparent'}`}
                        onClick={() => setSelectedImageIndex(index)}
                      >
                        <img 
                          src={image} 
                          alt={`Thumbnail ${index + 1}`} 
                          className="object-cover w-full h-full"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Job details */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Description</h3>
                  <p className="mt-1 text-sm text-gray-600 whitespace-pre-line">{selectedJob.description}</p>
                </div>
                
                <div className="flex flex-wrap gap-1">
                  {selectedJob.categoryTags && selectedJob.categoryTags.map((tag, i) => (
                    <Badge key={i} variant="outline" className="bg-blue-50">
                      {getCategoryLabel(tag)}
                    </Badge>
                  ))}
                </div>
                
                <div>
                  <h3 className="text-lg font-medium">Location</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {selectedJob.location.city}, {selectedJob.location.state}
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium">Budget</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    ${selectedJob.budget?.toFixed(2) || "Not specified"}
                  </p>
                </div>
                
                {isChatVisible ? (
                  <div className="border rounded-lg p-3">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-lg font-medium">Chat with {selectedJob.landlordName || "Landlord"}</h3>
                      <Button variant="ghost" size="sm" onClick={() => {
                        setIsChatVisible(false);
                        setIsQuoteButtonVisible(true);
                      }}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="h-[300px] overflow-y-auto border rounded-lg p-2 mb-2">
                      {/* Messages will be shown here */}
                      <div className="flex flex-col gap-2">
                        {selectedJob.id && chatMessages.filter(msg => 
                          msg.jobId === selectedJob.id
                        ).map((msg, idx) => (
                          <div 
                            key={idx} 
                            className={`flex ${msg.senderId === authUser.id ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-[80%] p-2 rounded-lg ${
                              msg.senderId === authUser.id 
                                ? 'bg-blue-500 text-white rounded-tr-none' 
                                : 'bg-gray-200 text-gray-800 rounded-tl-none'
                            }`}>
                              <p>{msg.message}</p>
                              <p className={`text-xs ${
                                msg.senderId === authUser.id ? 'text-blue-100' : 'text-gray-500'
                              }`}>
                                {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Input 
                        value={chatMessage} 
                        onChange={(e) => setChatMessage(e.target.value)} 
                        placeholder="Type a message..." 
                        className="flex-1"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && chatMessage.trim()) {
                            // Send message
                            const newMessage = {
                              jobId: selectedJob.id,
                              senderId: authUser.id,
                              message: chatMessage,
                              timestamp: new Date().toISOString()
                            };
                            
                            // Add to local messages
                            setChatMessage('');
                            
                            // Here you would normally send to an API
                            toast({
                              title: "Message sent",
                              description: "Your message has been sent to the landlord."
                            });
                          }
                        }}
                      />
                      <Button 
                        disabled={!chatMessage.trim()} 
                        onClick={() => {
                          // Send message logic
                          const newMessage = {
                            jobId: selectedJob.id,
                            senderId: authUser.id,
                            message: chatMessage,
                            timestamp: new Date().toISOString()
                          };
                          
                          // Find if there's an existing chat bubble for this job
                          const existingBubbleIndex = chatBubbles.findIndex(bubble => 
                            bubble.jobId === selectedJob.id
                          );
                          
                          // Create new message
                          // This is where you'd normally post to an API
                          setSelectedJob({
                            ...selectedJob,
                            chatRoomId: selectedJob.chatRoomId || Date.now() // Use existing or generate temp ID
                          });
                          
                          setChatMessage('');
                          
                          toast({
                            title: "Message sent",
                            description: "Your message has been sent to the landlord."
                          });
                        }}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2 mt-4">
                    {isQuoteButtonVisible && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsChatVisible(true);
                          setIsQuoteButtonVisible(false);
                        }}
                        className="flex-1"
                      >
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Contact Landlord
                      </Button>
                    )}
                    
                    {!isQuoteButtonVisible && (
                      <Button
                        variant="outline"
                        onClick={() => setIsQuoteButtonVisible(true)}
                        className="flex-1"
                      >
                        Show Actions
                      </Button>
                    )}
                    
                    {isQuoteButtonVisible && (
                      <>
                        <Button 
                          variant="outline"
                          onClick={() => {
                            setIsDetailsModalOpen(false);
                            createQuoteFromJob(selectedJob);
                          }} 
                          className="flex-1"
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Create Quote
                        </Button>
                        
                        {/* Only show bid button for open jobs that haven't been bid on yet */}
                        {selectedJob.status === "open" && !myBids.some((bid: Bid) => bid.jobId === selectedJob.id) && (
                          <Button 
                            onClick={() => {
                              setIsDetailsModalOpen(false);
                              openBidModal(selectedJob);
                            }} 
                            className="flex-1"
                          >
                            <DollarSign className="mr-2 h-4 w-4" />
                            Place Bid
                          </Button>
                        )}
                        
                        {/* Show bid status if already bid */}
                        {myBids.some((bid: Bid) => bid.jobId === selectedJob.id) && (
                          <Button 
                            variant="outline" 
                            className="flex-1 cursor-default"
                            disabled
                          >
                            <Badge className={`${
                              myBids.find((bid: Bid) => bid.jobId === selectedJob.id)?.status === "accepted" 
                                ? "bg-green-100 text-green-800" 
                                : myBids.find((bid: Bid) => bid.jobId === selectedJob.id)?.status === "rejected"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-blue-100 text-blue-800"
                            }`}>
                              Bid {myBids.find((bid: Bid) => bid.jobId === selectedJob.id)?.status}
                            </Badge>
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isReviewModalOpen}
        onOpenChange={setIsReviewModalOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Job</DialogTitle>
            <DialogDescription>
              Rate your experience with the landlord and job.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target as HTMLFormElement);
            const rating = parseInt(formData.get('rating') as string);
            const comments = formData.get('comments') as string;
            
            // Submit review
            const review = {
              jobId: jobToReview?.id,
              contractorId: authUser.id,
              landlordId: jobToReview?.landlordId,
              rating,
              comments
            };
            
            setIsReviewModalOpen(false);
            
            // In a real app, this would be a mutation
            updateJobProgressMutation.mutate({ 
              id: jobToReview!.id, 
              status: "completed" 
            });
            
            toast({
              title: "Review submitted",
              description: "Thank you for your feedback!"
            });
          }}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="rating">Rating</Label>
                <div className="flex space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Label
                      key={star}
                      htmlFor={`star-${star}`}
                      className="cursor-pointer"
                    >
                      <input
                        type="radio"
                        id={`star-${star}`}
                        name="rating"
                        value={star}
                        className="sr-only"
                        defaultChecked={star === 5}
                      />
                      <Star className="w-8 h-8 text-muted-foreground peer-checked:text-yellow-400 peer-checked:fill-yellow-400" />
                    </Label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="comments">Comments</Label>
                <Textarea
                  id="comments"
                  name="comments"
                  placeholder="Share your experience..."
                  className="min-h-[100px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Submit Review</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={quoteFormOpen}
        onOpenChange={setQuoteFormOpen}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedQuote ? "Edit Quote" : "Create Quote"}</DialogTitle>
            <DialogDescription>
              {selectedQuote ? "Update the quote details" : "Create a new quote for a client"}
            </DialogDescription>
          </DialogHeader>
          <QuoteForm 
            quote={selectedQuote} 
            userId={authUser?.id}
            job={jobToQuote}
            onSuccess={(savedQuote) => {
              setQuoteFormOpen(false);
              setJobToQuote(null);
              
              toast({
                title: selectedQuote ? "Quote Updated" : "Quote Created",
                description: `The quote "${savedQuote.title}" was ${selectedQuote ? "updated" : "created"} successfully.`,
              });
            }}
            onCancel={() => {
              setQuoteFormOpen(false);
              setJobToQuote(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={quoteDetailsOpen}
        onOpenChange={setQuoteDetailsOpen}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quote Details: {selectedQuote?.title}</DialogTitle>
          </DialogHeader>
          <QuoteDetails 
            quote={selectedQuote as ExtendedQuote} 
            onEdit={() => {
              setQuoteDetailsOpen(false);
              setQuoteFormOpen(true);
            }}
            onClose={() => setQuoteDetailsOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={quoteWizardOpen}
        onOpenChange={setQuoteWizardOpen}
      >
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <QuoteWizard
            isOpen={quoteWizardOpen}
            onClose={() => {
              setQuoteWizardOpen(false);
              setJobToQuote(null);
            }}
            onSaveAsDraft={(quote) => {
              setQuoteWizardOpen(false);
              setJobToQuote(null);
              
              toast({
                title: "Quote Saved as Draft",
                description: "Your quote has been saved. You can edit it later from the Quotes tab.",
              });
            }}
            onSendQuote={(quote) => {
              setQuoteWizardOpen(false);
              setJobToQuote(null);
              
              toast({
                title: "Quote Sent",
                description: "Your quote has been sent to the client.",
              });
            }}
            userId={authUser?.id}
            job={jobToQuote}
            quote={selectedQuote}
          />
        </DialogContent>
      </Dialog>

      {/* Mobile navigation (only visible on small screens) */}
      <MobileNavigation
        activeSection={activeSection}
        onChangeSection={setActiveSection}
        userType="contractor"
        activeJobCategory={activeJobCategory}
        onChangeJobCategory={setActiveJobCategory}
      />
                    {serviceAreas.length > 0 ? (
                      serviceAreas.map(area => (
                        <div key={area.id} className="relative flex mb-1">
                          <Button
                            variant="ghost"
                            className="w-full justify-between text-blue-200 hover:bg-blue-700 py-2 px-4 rounded-lg border border-blue-800/50 pr-8"
                            onClick={() => {
                              setIsAddingNewServiceArea(false);
                              setSelectedServiceAreaId(area.id);
                              setServiceAreaMarker({
                                latitude: area.latitude,
                                longitude: area.longitude
                              });
                              setServiceRadius(area.radius);
                              setTempCity(area.city);
                              setTempState(area.state);
                              setIsEditingServiceArea(true);
                            }}
                          >
                            <div className="flex items-center overflow-hidden">
                              <MapPin className="h-5 w-5 mr-3 flex-shrink-0 text-blue-400" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm text-blue-300 truncate max-w-[120px]">
                                    {area.city}
                                  </span>
                                  <span className="text-sm text-blue-400 flex-shrink-0">•</span>
                                  <span className="text-sm text-blue-300 flex-shrink-0">{area.radius}km</span>
                                </div>
                              </div>
                            </div>
                          </Button>
                          <button 
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-blue-900"
                            onClick={() => {
                              // If this was the last service area, clear everything
                              if (serviceAreas.length <= 1) {
                                // Reset everything
                                setServiceAreas([]);
                                setServiceAreaMarker({
                                  latitude: 44.6488,
                                  longitude: -63.5752, // Reset to default
                                });
                                setServiceRadius(25); // Default radius
                                setTempCity(null);
                                setTempState(null);
                                setTempRadius(null);
                                
                                // Prepare data for API call - make sure to clear all relevant fields
                                const newData = {
                                  serviceAreas: [],
                                  serviceArea: null,
                                  serviceAreaLat: null,
                                  serviceAreaLng: null,
                                  serviceRadius: null,
                                  city: null,
                                  state: null
                                };
                                
                                // Force a complete refresh with an immediate server update
                                console.log("Clearing all service area data", newData);
                                updateContractorProfile.mutate(newData, {
                                  onSuccess: () => {
                                    console.log("Service area deletion complete");
                                    // Force a complete refresh of profile data
                                    refetchProfile();
                                  }
                                });
                                
                                // Early exit to avoid further processing
                                return;
                              } 
                              
                              // If this isn't the last area, handle removing just this one
                              const updatedAreas = serviceAreas.filter(a => a.id !== area.id);
                              
                              // If we're removing the currently selected area, switch to the first one
                              if (area.id === selectedServiceAreaId && updatedAreas.length > 0) {
                                const firstArea = updatedAreas[0];
                                setServiceAreaMarker({
                                  latitude: firstArea.latitude,
                                  longitude: firstArea.longitude
                                });
                                setServiceRadius(firstArea.radius || 25);
                                setTempCity(firstArea.city || "Unknown");
                                setTempState(firstArea.state || "");
                              }
                              
                              // Update local state immediately
                              setServiceAreas(updatedAreas);
                              
                              // Prepare data for API call - include BOTH the updated array AND the 
                              // legacy field values to ensure everything stays in sync
                              const newData = {
                                serviceAreas: updatedAreas,
                                serviceAreaLat: updatedAreas.length > 0 ? updatedAreas[0].latitude : null,
                                serviceAreaLng: updatedAreas.length > 0 ? updatedAreas[0].longitude : null,
                                serviceRadius: updatedAreas.length > 0 ? updatedAreas[0].radius : null,
                                city: updatedAreas.length > 0 ? updatedAreas[0].city : null,
                                state: updatedAreas.length > 0 ? updatedAreas[0].state : null
                              };
                              
                              // Update profile with service area information
                              console.log("Updating service areas", newData);
                              updateContractorProfile.mutate(newData, {
                                onSuccess: () => {
                                  console.log("Service area update complete");
                                  // Force a complete refresh of profile data
                                  refetchProfile();
                                }
                              });
                              
                              // Clear any current editing state for the removed area
                              if (selectedServiceAreaId === area.id) {
                                setSelectedServiceAreaId(null);
                                setIsEditingServiceArea(false);
                              }
                            }}
                          >
                            <X className="h-4 w-4 text-red-400 hover:text-red-300" />
                          </button>
                        </div>
                      ))
                    ) : null /* Removed placeholder button, only show + button below */}
                    
                    {/* Add New Service Area button at bottom - full width */}
                    <Button
                      variant="ghost"
                      className={`w-full justify-center py-2 px-4 rounded-lg border border-dashed mt-2 ${
                        serviceAreas.length > 0 
                          ? 'border-blue-800/50 text-blue-400/50 cursor-not-allowed' 
                          : 'border-blue-800/50 text-blue-300 hover:bg-blue-700'
                      }`}
                      onClick={() => {
                        // Only allow adding a service area if none exist
                        if (serviceAreas.length === 0) {
                          // Open the dialog in "add new area" mode
                          setIsAddingNewServiceArea(true);
                          
                          // Reset temporary values for new service area
                          setTempRadius(25); // Default radius for new areas
                          setTempCity(null);
                          setTempState(null);
                          
                          // Reset marker to default (can be updated with location search)
                          setServiceAreaMarker({
                            latitude: 44.6488,
                            longitude: -63.5752,
                          });
                          
                          // Open the dialog
                          setIsEditingServiceArea(true);
                        }
                      }}
                      title={serviceAreas.length > 0 ? "Only one service area allowed" : "Add Service Area"}
                      disabled={serviceAreas.length > 0}
                    >
                      {serviceAreas.length > 0 ? (
                        <LockIcon className="h-4 w-4 text-blue-400/50" />
                      ) : (
                        <Plus className="h-4 w-4 text-blue-400" />
                      )}
                    </Button>
                  </div>
                </div>
                
                {/* Using a fragment to wrap adjacent elements */}
                <>
                  <div className="dialog-container">
                    {/* Use non-triggered dialog for service area editing */}
                    {/* Use non-triggered dialog for service area editing (manual control) */}
                    <Dialog 
                      open={isEditingServiceArea} 
                      onOpenChange={(open) => {
                      setIsEditingServiceArea(open);
                      if (!open) {
                        // Reset temporary values when dialog closes
                        setTempRadius(null);
                        setTempCity(null);
                        setTempState(null);
                        setIsAddingNewServiceArea(false);
                      }
                    }}
                  >
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Set Service Area</DialogTitle>
                        <DialogDescription>
                          Define the area where you're available to provide services.
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-4 py-2">
                        <div className="space-y-2">
                          <Label htmlFor="location">Location</Label>
                          <LocationSearch 
                            onSelectLocation={(location) => {
                              setServiceAreaMarker({
                                latitude: location.latitude,
                                longitude: location.longitude
                              });
                              setTempCity(location.city);
                              setTempState(location.state);
                            }}
                            defaultValue={profileData?.profile?.city ? `${profileData.profile.city}, ${profileData.profile.state}` : ""}
                            placeholder="Enter your location"
                            className="w-full"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <Label htmlFor="radius">Service Radius: {tempRadius || serviceRadius}km</Label>
                          </div>
                          <Slider
                            id="radius"
                            min={1}
                            max={100}
                            step={1}
                            defaultValue={[serviceRadius]}
                            onValueChange={(value) => setTempRadius(value[0])}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>1km</span>
                            <span>50km</span>
                            <span>100km</span>
                          </div>
                        </div>
                        
                        {serviceAreaMarker && (
                          <div className="mt-4">
                            <Label>Preview Service Area</Label>
                            <div className="h-[200px] mt-2 rounded-md overflow-hidden border">
                              <ServiceAreaDisplay 
                                longitude={serviceAreaMarker.longitude}
                                latitude={serviceAreaMarker.latitude}
                                radius={tempRadius || serviceRadius}
                                height="200px"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <DialogFooter className="sm:justify-between">
                        <Button type="button" variant="outline" onClick={() => setIsEditingServiceArea(false)}>
                          Cancel
                        </Button>
                        <Button 
                          type="button" 
                          onClick={() => {
                            if (serviceAreaMarker && tempCity && tempState) {
                              // Update service areas for the sidebar
                              let updatedServiceAreas = [...serviceAreas];
                              const updatedRadius = tempRadius || serviceRadius;
                              
                              if (isAddingNewServiceArea) {
                                // Add to service areas array
                                const newServiceArea: ServiceArea = {
                                  id: nextServiceAreaId,
                                  city: tempCity,
                                  state: tempState || "",
                                  latitude: serviceAreaMarker.latitude,
                                  longitude: serviceAreaMarker.longitude,
                                  radius: updatedRadius
                                };
                                
                                updatedServiceAreas = [...serviceAreas, newServiceArea];
                                setServiceAreas(updatedServiceAreas);
                                setNextServiceAreaId(nextServiceAreaId + 1);
                              } else if (serviceAreas.length > 0) {
                                // Find and update the service area being edited
                                updatedServiceAreas = serviceAreas.map(area => 
                                  area.id === (selectedServiceAreaId || 1) ? {
                                    ...area,
                                    city: tempCity,
                                    state: tempState || "",
                                    latitude: serviceAreaMarker.latitude,
                                    longitude: serviceAreaMarker.longitude,
                                    radius: updatedRadius
                                  } : area
                                );
                                setServiceAreas(updatedServiceAreas);
                              } else {
                                // If we don't have any areas, create one for the primary service area
                                const newServiceArea: ServiceArea = {
                                  id: 1,
                                  city: tempCity,
                                  state: tempState || "",
                                  latitude: serviceAreaMarker.latitude,
                                  longitude: serviceAreaMarker.longitude,
                                  radius: updatedRadius
                                };
                                updatedServiceAreas = [newServiceArea];
                                setServiceAreas(updatedServiceAreas);
                                setNextServiceAreaId(2);
                              }
                              
                              // Update local state immediately for better user experience
                              setServiceRadius(updatedRadius);
                              
                              // Prepare data for API call, including the full array of service areas
                              const newData = {
                                city: tempCity,
                                state: tempState,
                                serviceAreaLat: serviceAreaMarker.latitude,
                                serviceAreaLng: serviceAreaMarker.longitude,
                                serviceRadius: updatedRadius,
                                // Add the updated list of service areas
                                serviceAreas: updatedServiceAreas
                              };
                              
                              // Update profile with service area information (server-side)
                              updateContractorProfile.mutate(newData);
                              
                              // Since we're updating city/state in the profile directly,
                              // store these locally as well for the UI
                              if (profileData) {
                                // Create a shallow copy of profileData and update
                                const updatedProfile = { 
                                  ...profileData,
                                  city: tempCity,
                                  state: tempState
                                };
                                
                                // We can't directly update the query data, but we 
                                // can optimistically update our local UI right away
                                queryClient.setQueryData(
                                  ['/api/contractor-profile', authUser?.id], 
                                  updatedProfile
                                );
                              }
                              
                              setIsEditingServiceArea(false);
                              setIsAddingNewServiceArea(false);
                            }
                          }}
                          disabled={!serviceAreaMarker || !tempCity || !tempState}
                        >
                          {isAddingNewServiceArea ? 'Add Service Area' : 'Save Changes'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </>
          </div>
          
          {/* Reduced padding between sections */}
          <div className="py-2"></div>
          
          {/* Divider line under the spacing */}
          <Separator className="mb-3 bg-blue-800" />
          
          {/* Categories Section with header and filters */}
          <div className="px-2 flex-shrink-0 flex items-center justify-between mb-2 h-8">
            <div className="flex items-center">
              <h3 className="text-sm font-medium text-blue-300">Categories</h3>
              <Button
                size="sm"
                variant="ghost"
                className={`ml-2 h-6 px-1 text-xs ${filtersDisabled ? 'bg-blue-700 text-white' : 'text-blue-300 hover:text-white hover:bg-blue-800'}`}
                onClick={() => {
                  setFiltersDisabled(!filtersDisabled);
                }}
                title={filtersDisabled ? "Enable category filtering" : "Show all jobs (ignore categories)"}
              >
                <Filter className="h-3 w-3" />
              </Button>
            </div>
            {selectedCategories.length > 0 && selectedCategories.length !== lockedCategories.length && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-blue-300 hover:text-white hover:bg-blue-800"
                onClick={() => setSelectedCategories(lockedCategories)}
                title="Reset to your locked categories"
              >
                Reset
              </Button>
            )}
          </div>
          
          {/* Categories list in similar style to service areas */}
          <div className="mb-2 w-full overflow-hidden pr-0">
            <div className="categories-list custom-scrollbar max-h-[calc(100vh-390px)] w-full overflow-y-auto overflow-x-hidden pr-0">
              <div className="space-y-1 px-2">
                {/* Selected categories list */}
                {selectedCategories.length > 0 ? (
                  selectedCategories.map(categoryValue => {
                    const category = AVAILABLE_CATEGORIES.find(c => getCategoryValue(c) === categoryValue) || categoryValue;
                    const isLocked = lockedCategories.includes(categoryValue);
                    
                    return (
                      <div key={categoryValue} className="relative flex mb-1">
                        <Button
                          variant="ghost"
                          className={`w-full justify-between text-blue-200 ${isLocked ? 'pointer-events-none bg-green-900/10' : 'hover:bg-blue-700'} py-2 px-4 rounded-lg border ${isLocked ? 'border-green-700/70' : 'border-blue-800/50'} pr-8`}
                          // Removed onClick handler + added pointer-events-none to locked categories
                        >
                          <div className="flex items-center overflow-hidden">
                            <CategoryIcon 
                              category={categoryValue} 
                              className="h-5 w-5 mr-3 flex-shrink-0 text-blue-400" 
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm text-blue-300 truncate max-w-[120px]">
                                  {category}
                                </span>
                                {isLocked && (
                                  <>
                                    <span className="text-sm text-blue-400 flex-shrink-0">•</span>
                                    <span className="text-sm text-green-500 flex-shrink-0">Your Trade</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </Button>
                        {!isLocked && (
                          <button 
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-blue-900"
                            onClick={() => {
                              // Remove this category
                              setSelectedCategories(prev => prev.filter(c => c !== categoryValue));
                            }}
                          >
                            <X className="h-4 w-4 text-red-400 hover:text-red-300" />
                          </button>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <Button
                    variant="ghost"
                    className="w-full justify-between text-blue-200 hover:bg-blue-700 py-2 px-4 rounded-lg border border-blue-800/50"
                    onClick={() => {
                      // Before opening the dialog, refetch the contractor profile to get latest trades
                      queryClient.invalidateQueries({ queryKey: ['/api/contractor-profile', authUser?.id] })
                        .then(() => {
                          // After data refreshes, update the pending categories
                          setPendingCategories([]);
                          setCategoryDialogMode("select");
                          setIsCategoryDialogOpen(true);
                        });
                    }}
                  >
                    <div className="flex items-center overflow-hidden">
                      <Plus className="h-5 w-5 mr-4 flex-shrink-0 text-blue-400" />
                      <div className="min-w-0">
                        <span className="text-sm text-blue-300 italic">Select categories</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-blue-400 flex-shrink-0 ml-2" />
                  </Button>
                )}
                
                {/* Add New Custom Category button */}
                <Button
                  variant="ghost"
                  className="w-full justify-center text-blue-300 hover:bg-blue-700 py-2 px-4 rounded-lg border border-blue-800/50 border-dashed mt-2"
                  onClick={() => {
                    // Before opening the dialog, refetch the contractor profile to get latest trades
                    queryClient.invalidateQueries({ queryKey: ['/api/contractor-profile', authUser?.id] })
                      .then(() => {
                        // Open dialog in "select" mode instead of "add" mode
                        setPendingCategories(selectedCategories);
                        setCategoryDialogMode("select");
                        setIsCategoryDialogOpen(true);
                        setCategorySearchQuery("");
                      });
                  }}
                  title="Add Categories"
                >
                  <Plus className="h-4 w-4 text-blue-400" />
                </Button>
              </div>
            </div>
          </div>
          
          {/* Category Selection Dialog */}
          <Dialog 
            open={isCategoryDialogOpen} 
            onOpenChange={(open) => {
              setIsCategoryDialogOpen(open);
              if (!open) {
                setCategorySearchQuery("");
              }
            }}
          >
            <DialogContent className="sm:max-w-md bg-[#081235] border border-blue-900 text-blue-50 shadow-xl">
              <DialogHeader>
                <DialogTitle className="text-blue-100">{categoryDialogMode === "select" ? "Select Categories" : "Add Custom Category"}</DialogTitle>
                <DialogDescription className="text-blue-300">
                  {categoryDialogMode === "select" 
                    ? "Choose the categories you're interested in to filter available jobs."
                    : "Add a custom category if you don't see what you're looking for."}
                </DialogDescription>
              </DialogHeader>
              
              {categoryDialogMode === "select" ? (
                <div className="space-y-4 py-2">
                  {/* Search input for categories */}
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="Search categories..."
                      className="pl-8 py-1 h-8 bg-blue-900/80 border-blue-800 placeholder:text-blue-400 text-blue-50 focus-visible:ring-blue-700 focus-visible:border-blue-600"
                      value={categorySearchQuery}
                      onChange={e => setCategorySearchQuery(e.target.value)}
                    />
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-400" />
                    {categorySearchQuery && (
                      <button
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-blue-400 hover:text-blue-300"
                        onClick={() => setCategorySearchQuery('')}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  
                  {/* Categories list with checkbox selection */}
                  <div className="max-h-[280px] h-auto w-full rounded-md border border-blue-900 px-4 py-2 overflow-y-auto custom-scrollbar bg-[#061530]">
                    <div className="space-y-2">
                      {AVAILABLE_CATEGORIES
                        .filter(category => 
                          !categorySearchQuery || 
                          category.toLowerCase().includes(categorySearchQuery.toLowerCase())
                        )
                        .sort((a, b) => {
                          // Sort by locked first, then alphabetically
                          const valueA = getCategoryValue(a);
                          const valueB = getCategoryValue(b);
                          
                          const isLockedA = lockedCategories.includes(valueA);
                          const isLockedB = lockedCategories.includes(valueB);
                          
                          if (isLockedA && !isLockedB) return -1;
                          if (!isLockedA && isLockedB) return 1;
                          return a.localeCompare(b);
                        })
                        .map(category => {
                          const categoryValue = getCategoryValue(category);
                          const isSelected = pendingCategories.includes(categoryValue);
                          const isLocked = lockedCategories.includes(categoryValue);
                          
                          return (
                            <div 
                              key={categoryValue} 
                              className={`flex items-center p-2 rounded-md ${isSelected ? 'bg-blue-800/40' : isLocked ? 'bg-green-900/10' : 'hover:bg-blue-900/40'} ${isLocked ? 'border-l-2 border-green-500' : ''}`}
                            >
                              <input
                                type="checkbox"
                                id={`category-${categoryValue}`}
                                checked={isSelected}
                                onChange={() => {
                                  if (isSelected && !isLocked) {
                                    setPendingCategories(prev => prev.filter(c => c !== categoryValue));
                                  } else if (!isSelected) {
                                    setPendingCategories(prev => [...prev, categoryValue]);
                                  }
                                }}
                                disabled={isLocked}
                                className={`h-5 w-5 rounded appearance-none ${isLocked 
                                  ? 'border-green-600/50 checked:bg-green-600/50 bg-green-950/30 opacity-70 cursor-not-allowed' 
                                  : 'border-blue-600 checked:bg-blue-600 bg-blue-950/70 focus:ring-blue-600'} 
                                  mr-3 shadow-sm ring-1 ring-inset ${isLocked ? 'ring-green-600/30' : 'ring-blue-600/40'}
                                  relative before:absolute before:inset-0 before:content-[""] checked:before:bg-no-repeat
                                  checked:before:bg-center checked:before:bg-[length:65%_65%] checked:before:bg-[url('data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PScwIDAgMTYgMTYnIGZpbGw9J3doaXRlJyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnPjxwYXRoIGQ9J00xMi4yMDcgNC43OTNhMSAxIDAgMDEwIDEuNDE0bC01IDVhMSAxIDAgMDEtMS40MTQgMGwtMi0yYTEgMSAwIDAxMS40MTQtMS40MTRMNi41IDkuMDg2bDQuMjkzLTQuMjkzYTEgMSAwIDAxMS40MTQgMHonLz48L3N2Zz4=')]`}
                              />
                              <label 
                                htmlFor={`category-${categoryValue}`}
                                className={`text-sm ${isLocked ? 'text-green-400/80 font-medium cursor-not-allowed' : 'text-blue-100 cursor-pointer'} flex-1 flex items-center`}
                              >
                                <CategoryIcon 
                                  category={categoryValue} 
                                  className="h-4 w-4 mr-2 flex-shrink-0 text-blue-400" 
                                />
                                {category}
                                {isLocked && <span className="text-xs text-green-500 ml-2">(Your Trade)</span>}
                              </label>
                              {/* Removed X button for cleaner interface */}
                            </div>
                          );
                        })
                      }
                      
                      {AVAILABLE_CATEGORIES.filter(category => 
                        !categorySearchQuery || 
                        category.toLowerCase().includes(categorySearchQuery.toLowerCase())
                      ).length === 0 && (
                        <div className="text-center py-4 text-blue-400">
                          No categories found matching "{categorySearchQuery}"
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 py-2">
                  {/* Form to add a custom category */}
                  <div className="space-y-2">
                    <Label htmlFor="custom-category" className="text-blue-200">Custom Category Name</Label>
                    <div className="relative">
                      <Input
                        id="custom-category"
                        type="text"
                        placeholder="Enter a custom category..."
                        value={categorySearchQuery}
                        onChange={e => setCategorySearchQuery(e.target.value)}
                        className="pl-8 py-1 bg-blue-900/80 border-blue-800 placeholder:text-blue-400 text-blue-50 focus-visible:ring-blue-700 focus-visible:border-blue-600"
                      />
                      <Plus className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-400" />
                    </div>
                  </div>
                  
                  <div className="mt-4 rounded-md border border-blue-800 bg-blue-900/30 p-3">
                    <div className="flex items-center">
                      <InfoIcon className="h-5 w-5 text-blue-400 mr-2" />
                      <p className="text-sm text-blue-300">
                        Add a custom category to filter jobs more effectively. Custom categories will be shown alongside the standard ones.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <DialogFooter className="sm:justify-between border-t border-blue-900/60 pt-4 mt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCategoryDialogOpen(false);
                    setCategorySearchQuery("");
                  }}
                  className="border-blue-800 text-blue-300 hover:text-blue-100 hover:bg-blue-900 hover:border-blue-700"
                >
                  Cancel
                </Button>
                
                <Button
                  onClick={() => {
                    if (categoryDialogMode === "select") {
                      // Apply the pending categories
                      setSelectedCategories(pendingCategories);
                    } else if (categoryDialogMode === "add" && categorySearchQuery.trim()) {
                      // Add custom category
                      const customCategoryValue = getCategoryValue(categorySearchQuery.trim());
                      if (!selectedCategories.includes(customCategoryValue)) {
                        setSelectedCategories(prev => [...prev, customCategoryValue]);
                      }
                    }
                    setIsCategoryDialogOpen(false);
                    setCategorySearchQuery("");
                  }}
                  className="bg-blue-700 hover:bg-blue-600 text-white"
                  disabled={categoryDialogMode === "add" && !categorySearchQuery.trim()}
                >
                  {categoryDialogMode === "select" ? 'Apply Filters' : 'Add Category'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {/* Bottom spacing to ensure some space at the bottom of the sidebar */}
          <div className="h-4"></div>
        </div>
      </aside>
      
      {/* Main content area */}
      <main className="flex-1 bg-[#040f2d] text-white relative main-content-area custom-scrollbar">
        {/* Top navbar removed - we'll only use the one in ContractorJobsTab */}
        
        <div className="p-3 pt-0">
          {/* Dashboard section completely removed */}
          

          
          {/* Jobs Section */}
          {activeSection === "jobs" && (
            <div className="space-y-3 w-full overflow-x-hidden">
              {/* Title section removed */}
              
              {/* Use the ContractorJobsTab component */}
              <ContractorJobsTab
                onBidJob={openBidModal}
                onViewDetails={viewJobDetails}
                searchQuery={''}
                filterCategory={filtersDisabled ? 'all' : filterCategory}
                selectedCategories={filtersDisabled ? [] : selectedCategories}
                onResetFilters={() => {
                  setFilterCategory('all');
                  setSelectedCategories([]);
                }}
                serviceCity={profileData?.city}
                serviceState={profileData?.state}
                serviceRadius={serviceRadius}
                serviceAreaMarker={serviceAreaMarker}
                hasServiceArea={hasValidServiceArea()}
                onLocationChange={(location) => {
                  setServiceAreaMarker({
                    latitude: location.latitude,
                    longitude: location.longitude
                  });
                  saveServiceArea.mutate();
                }}
                onRadiusChange={(radius) => {
                  setServiceRadius(radius);
                  // Also update the profile when radius changes
                  if (serviceAreaMarker) {
                    saveServiceArea.mutate();
                  }
                }}
              />
            </div>
          )}
          
          {/* Inbox Section */}
          {activeSection === "inbox" && (
            <div className="space-y-3">
              {/* Using QuotesTab with full functionality */}
              <QuotesTab 
                userId={authUser?.id || 0}
                userType="contractor"
                jobToQuote={jobToQuote}
                onViewJob={viewJobDetails}
                onCreateQuote={() => {
                  // Open quote creation wizard
                  setQuoteWizardOpen(true);
                  setSelectedQuote(null);
                }}
                onEditQuote={(quote) => {
                  // Open quote editing wizard with the selected quote
                  setQuoteWizardOpen(true);
                  setSelectedQuote(quote);
                }}
                onViewQuote={(quote) => {
                  // Open quote details view
                  setQuoteDetailsOpen(true);
                  setSelectedQuote(quote);
                }}
                onConvertToInvoice={(quote) => {
                  // Handle converting to invoice
                  toast({
                    title: "Converting Quote to Invoice",
                    description: "Converting quote #" + quote.quoteNumber + " to an invoice...",
                  });
                  // We'll implement this in the next phase
                }}
                onViewChat={(roomId, jobId) => {
                  // Find the job for this chat room
                  const job = jobs.find(job => job.id === jobId) as ExtendedJob;
                  if (job) {
                    job.chatRoomId = roomId;
                    setSelectedJob(job);
                    setIsChatVisible(true);
                  }
                }}
                onReviseQuote={(quote, job) => {
                  // Handle quote revision
                  openBidModal(job as ExtendedJob);
                }}
                onCancelQuote={(quote) => {
                  // Handle quote cancellation
                  toast({
                    title: "Not yet implemented",
                    description: "Quote cancellation will be available in a future update.",
                  });
                }}
                onMarkComplete={(job) => {
                  // Handle marking a job as complete
                  toast({
                    title: "Not yet implemented",
                    description: "Job completion will be available in a future update.",
                  });
                }}
                onInvoice={(job) => {
                  // Handle creating an invoice
                  toast({
                    title: "Not yet implemented",
                    description: "Invoicing will be available in a future update.",
                  });
                }}
              />
            </div>
          )}
          
          {/* Quotes Section has been merged into the Inbox */}
          
          {/* Calendar has been removed, we'll redirect to Jobs if it's somehow selected */}
          
          {activeSection === "active-jobs" && (
            <div className="space-y-3">
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
                                      <CardContent className="p-3">
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
                                  <div className="text-center p-3">
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
                                      <CardContent className="p-3">
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
                                  <div className="text-center p-3">
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
                                      <CardContent className="p-3">
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
                                  <div className="text-center p-3">
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
                  <div className="space-y-3">
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
                                <CardContent className="p-3">
                                  <div className="flex justify-between mb-1">
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
                          <div className="text-center p-3">
                            <Briefcase className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                            <h3 className="text-lg font-medium">No Active Jobs</h3>
                            <p className="text-muted-foreground mb-2">
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
                    <div className="flex justify-center p-3">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
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
                    <div className="text-center p-3">
                      <Search className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                      <h3 className="text-lg font-medium">No Jobs Available</h3>
                      {serviceAreas.length === 0 ? (
                        <>
                          <p className="text-muted-foreground mb-2">
                            Please select a service area to see available jobs.
                          </p>
                          <p className="text-xs text-muted-foreground mb-4">
                            Jobs are filtered based on your service area radius.
                          </p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setActiveSection("profile")}
                            className="mx-auto"
                          >
                            <MapPin className="h-4 w-4 mr-2" />
                            Add Service Area
                          </Button>
                        </>
                      ) : (
                        <p className="text-muted-foreground mb-2">
                          There are no jobs matching your skills and preferences at the moment.
                        </p>
                      )}
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
                              const job = jobs.find((j: Job) => j.id === bid.jobId);
                              return job ? (
                                <Card key={bid.id}>
                                  <CardContent className="p-3">
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
                              <div className="text-center p-3">
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
                                          className="max-w-4xl max-h-[90vh] h-[85vh] p-0"
                                          aria-describedby={`job-chat-dialog-${job.id}`}
                                        >
                                          <DialogHeader className="px-6 py-4 border-b">
                                            <DialogTitle>Chat - {job.title}</DialogTitle>
                                            <DialogDescription id={`job-chat-dialog-${job.id}`} className="sr-only">
                                              Chat with client for job: {job.title}
                                            </DialogDescription>
                                          </DialogHeader>
                                          <div className="h-[calc(100%-74px)]">
                                            {(job.chatRoomId || job.id) && (
                                              <ChatInterface 
                                                chatRoomId={job.chatRoomId || job.id} 
                                                userId={authUser?.id || 0} 
                                                userName={authUser?.fullName || authUser?.username || ""} 
                                                otherUserName={job.landlordName || "Landlord"}
                                                isJobId={!job.chatRoomId && !!job.id}
                                                className="h-full"
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
                              <div className="text-center p-3">
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
                              <div className="text-center p-3">
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
                <div className="flex justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
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
                    <div className="flex justify-center p-4">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
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
                                  className="max-w-4xl max-h-[90vh] h-[85vh] p-0"
                                  aria-describedby={`chat-dialog-${job.id}`}
                                >
                                  <DialogHeader className="px-6 py-4 border-b">
                                    <DialogTitle>Chat - {job.title}</DialogTitle>
                                    <DialogDescription id={`chat-dialog-${job.id}`} className="sr-only">
                                      Chat with client for job: {job.title}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="h-[calc(100%-74px)]">
                                    {(job.chatRoomId || job.id) && (
                                      <ChatInterface 
                                        chatRoomId={job.chatRoomId || job.id} 
                                        userId={authUser?.id || 0} 
                                        userName={authUser?.fullName || authUser?.username || ""} 
                                        otherUserName={job.landlordName || "Landlord"}
                                        className="h-full"
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
                    <div className="text-center p-4">
                      <Briefcase className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
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
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
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
        <DialogContent className="sm:max-w-4xl max-h-[90vh] h-[90vh] overflow-hidden bg-blue-950 border-blue-900 p-0 flex flex-col">
          <DialogTitle className="sr-only">Job Details</DialogTitle>
          <DialogDescription id="job-details-description" className="sr-only">
            View detailed information about this job
          </DialogDescription>
          
          {selectedJob && (
            <div className="flex-grow overflow-hidden p-0 h-full">
              <div className="flex flex-col md:flex-row h-full">
                <div className="md:w-2/3">
                  {/* Display images in main area with full height and thumbnails */}
                  {(() => {
                    // Function to get all available images for a job, including uploaded and fallback images
                    const getJobImages = (job: ExtendedJob) => {
                      const images: string[] = [];
                      
                      // First add any uploaded images from the server
                      if (job.images && Array.isArray(job.images) && job.images.length > 0) {
                        job.images.forEach(image => {
                          if (typeof image === 'string' && image.trim() !== '') {
                            images.push(image);
                          } else if (typeof image === 'object' && image !== null && 'url' in image) {
                            images.push((image as any).url);
                          }
                        });
                      }
                      
                      // Initialize category tag value for fallback logic
                      let category = '';
                      if (job.categoryTags && Array.isArray(job.categoryTags) && job.categoryTags.length > 0) {
                        category = String(job.categoryTags[0]).toLowerCase();
                      }
                      
                      // Combine title and description for better matching
                      const titleAndDescription = (job.title + ' ' + job.description).toLowerCase();
                      
                      // Add potential fallback images based on job content
                      const fallbackImages: string[] = [];
                      
                      // Map default server-stored images based on job type
                      if (titleAndDescription.includes('kitchen') && titleAndDescription.includes('faucet')) {
                        fallbackImages.push("/uploads/jobs/kitchen-faucet.svg");
                      } 
                      if (titleAndDescription.includes('kitchen') && titleAndDescription.includes('sink')) {
                        fallbackImages.push("/uploads/jobs/kitchen-sink.svg");
                      }
                      if (titleAndDescription.includes('bathroom') && titleAndDescription.includes('light')) {
                        fallbackImages.push("/uploads/jobs/bathroom-light.svg");
                      }
                      if (titleAndDescription.includes('bathroom') && titleAndDescription.includes('sink')) {
                        fallbackImages.push("/uploads/jobs/bathroom-sink.jpg");
                      }
                      if (titleAndDescription.includes('ceiling fan')) {
                        fallbackImages.push("/uploads/jobs/ceiling-fan.svg");
                      }
                      if (titleAndDescription.includes('hardwood floor')) {
                        fallbackImages.push("/uploads/jobs/hardwood-floor.jpg");
                      }
                      if (titleAndDescription.includes('refinish') && titleAndDescription.includes('floor')) {
                        fallbackImages.push("/uploads/jobs/refinish-floor.svg");
                      }
                      if (titleAndDescription.includes('smart thermostat')) {
                        fallbackImages.push("/uploads/jobs/smart-thermostat.svg");
                      }
                      
                      // Generic category-based fallbacks
                      if (category) {
                        if (category.includes("plumb")) {
                          fallbackImages.push("/uploads/jobs/plumbing.svg");
                        } else if (category.includes("electr")) {
                          fallbackImages.push("/uploads/jobs/electrical.svg");
                        } else if (category.includes("paint")) {
                          fallbackImages.push("/uploads/jobs/painting.svg");
                        } else if (category.includes("carp")) {
                          fallbackImages.push("/uploads/jobs/carpentry.jpg");
                        } else if (category.includes("roof")) {
                          fallbackImages.push("/uploads/jobs/roofing.jpg");
                        } else if (category.includes("land")) {
                          fallbackImages.push("/uploads/jobs/landscaping.jpg");
                        } else if (category.includes("floor")) {
                          fallbackImages.push("/uploads/jobs/flooring.svg");
                        } else if (category.includes("general")) {
                          fallbackImages.push("/uploads/jobs/general-contracting.jpg");
                        }
                      }
                      
                      // Add default image as last resort
                      fallbackImages.push("/uploads/jobs/default-job-image.svg");
                      
                      // Combine uploaded and fallback images, filtered for uniqueness
                      const allImages = [...images];
                      
                      // Only add fallback images if we don't have any uploaded images
                      if (allImages.length === 0) {
                        allImages.push(...fallbackImages);
                      }
                      
                      // Ensure we have at least one image
                      if (allImages.length === 0) {
                        allImages.push("/uploads/jobs/default-job-image.svg");
                      }
                      
                      return allImages;
                    };
                    
                    // Get all available images for this job
                    const jobImages = getJobImages(selectedJob);
                    
                    // Ensure selectedImageIndex is within bounds (without useEffect to avoid React Hook errors)
                    // This will run each time the component renders
                    if (selectedImageIndex >= jobImages.length) {
                      // Use a timeout to avoid batched state updates issue
                      setTimeout(() => setSelectedImageIndex(0), 0);
                    }
                    
                    return (
                      <div className="h-full flex flex-col group">
                        {/* Main image display - takes most of the space */}
                        <div 
                          className="flex-grow h-[calc(100%-80px)] overflow-hidden border-r border-blue-800 bg-blue-900/30 relative"
                          tabIndex={0} // Make div focusable for keyboard navigation
                          onKeyDown={(e) => {
                            // Add keyboard navigation with arrow keys
                            if (jobImages.length > 1) {
                              if (e.key === 'ArrowLeft') {
                                // Navigate to previous image (or loop to end)
                                setSelectedImageIndex(prev => 
                                  prev === 0 ? jobImages.length - 1 : prev - 1
                                );
                                e.preventDefault();
                              } else if (e.key === 'ArrowRight') {
                                // Navigate to next image (or loop to beginning)
                                setSelectedImageIndex(prev => 
                                  prev === jobImages.length - 1 ? 0 : prev + 1
                                );
                                e.preventDefault();
                              }
                            }
                          }}
                        >
                          <img 
                            src={jobImages[selectedImageIndex]} 
                            alt={`Job image ${selectedImageIndex + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // If image fails to load, use a backup image from our server
                              (e.target as HTMLImageElement).src = "/uploads/jobs/default-job-image.svg";
                            }}
                          />
                          
                          {/* Image counter badge removed as per user request */}
                          
                          {/* Navigation buttons (only show if multiple images) */}
                          {jobImages.length > 1 && (
                            <>
                              <button 
                                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-blue-900/70 hover:bg-blue-900/90 text-blue-200 p-1 rounded-full"
                                onClick={() => setSelectedImageIndex(prev => 
                                  prev === 0 ? jobImages.length - 1 : prev - 1
                                )}
                                aria-label="Previous image"
                              >
                                <ChevronLeft className="h-5 w-5" />
                              </button>
                              <button 
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-900/70 hover:bg-blue-900/90 text-blue-200 p-1 rounded-full"
                                onClick={() => setSelectedImageIndex(prev => 
                                  prev === jobImages.length - 1 ? 0 : prev + 1
                                )}
                                aria-label="Next image"
                              >
                                <ChevronRight className="h-5 w-5" />
                              </button>
                            </>
                          )}
                        </div>
                        
                        {/* Thumbnail navigation - only show if we have multiple images */}
                        {jobImages.length > 1 && (
                          <div className="absolute bottom-0 left-0 md:right-1/3 right-0 h-20 z-10 border-t border-blue-800/30 bg-transparent p-2 overflow-x-auto opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <div className="flex gap-2 h-full justify-center">
                              {jobImages.map((image, index) => (
                                <div 
                                  key={index}
                                  className={`
                                    h-full aspect-square cursor-pointer relative rounded overflow-hidden bg-black/20
                                    ${selectedImageIndex === index 
                                      ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-blue-950/80 shadow-md' 
                                      : 'opacity-70 hover:opacity-100 hover:shadow'}
                                  `}
                                  onClick={() => setSelectedImageIndex(index)}
                                >
                                  <img 
                                    src={image} 
                                    alt={`Thumbnail ${index + 1}`}
                                    className="h-full w-full object-cover"
                                    onError={(e) => {
                                      // If thumbnail fails to load, use a backup image
                                      (e.target as HTMLImageElement).src = "/uploads/jobs/default-job-image.svg";
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
                
                <div className="md:w-1/3 flex flex-col h-full">
                  <Card className="bg-blue-900 border-blue-800 flex flex-col h-full">
                    <CardHeader className="pb-3 border-b border-blue-800 flex-shrink-0">
                      <div className="flex flex-col space-y-1">
                        <CardTitle className="text-xl font-bold text-blue-100 break-words">{selectedJob.title}</CardTitle>
                        {/* Price displayed right after the title */}
                        <div className="flex items-center">
                          {selectedJob.pricingType === "fixed" ? (
                            <span className="text-lg font-semibold text-green-300">${selectedJob.budget?.toFixed(2)}</span>
                          ) : (
                            <span className="text-lg font-semibold text-blue-300">Open Bid</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Location outside scrollable area */}
                      <div className="mt-3 text-blue-300 flex items-center">
                        <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
                        <span>{selectedJob.location?.city}, {selectedJob.location?.state}</span>
                      </div>
                    </CardHeader>
                    
                    {/* Main content in ScrollArea - separate from buttons */}
                    <div className="flex-1 overflow-hidden">
                      <ScrollArea className="h-full job-details-scrollbar">
                        <CardContent className="space-y-4 pt-4">
                          <div>
                            <p className="text-sm font-medium text-blue-400">Description</p>
                            <p className="mt-1 text-blue-200 text-sm">{selectedJob.description}</p>
                          </div>
                          
                          <Separator className="bg-blue-800" />
                          
                          {selectedJob.categoryTags && selectedJob.categoryTags.length > 0 && (
                            <div>
                              <p className="text-sm font-medium text-blue-400">Categories</p>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {selectedJob.categoryTags.map((tag, i) => (
                                  <Badge key={i} variant="outline" className="bg-blue-900 text-blue-200 border-blue-700 flex items-center gap-1">
                                    <CategoryIcon 
                                      category={tag} 
                                      className="h-3 w-3 text-blue-300" 
                                    />
                                    {getCategoryDisplayName(tag)}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Budget information moved to header next to title */}
                          <div>
                            <p className="text-sm font-medium text-blue-400">Start Date</p>
                            <p className="text-blue-200">{selectedJob.startDate 
                              ? new Date(selectedJob.startDate).toLocaleDateString() 
                              : "Flexible"}
                            </p>
                          </div>
                          
                          <div>
                            <p className="text-sm font-medium text-blue-400">Posted</p>
                            <p className="text-blue-200">{new Date(selectedJob.createdAt).toLocaleDateString()}</p>
                          </div>
                          
                          {selectedJob.status === "in_progress" && (
                            <div>
                              <p className="text-sm font-medium text-blue-400">Progress</p>
                              <div className="flex items-center">
                                <Progress value={selectedJob.progress || 0} className="h-2 flex-1 mr-2 bg-blue-950" />
                                <span className="text-sm font-medium text-blue-200">{selectedJob.progress || 0}%</span>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </ScrollArea>
                    </div>
                    
                    {/* Fixed footer with buttons */}
                    <CardFooter className="flex-col space-y-2 bg-blue-900 border-t border-blue-800 pt-4 mt-auto flex-shrink-0 relative overflow-hidden">
                      {/* Main content area */}
                      <div className="w-full" style={{ 
                        height: isChatVisible ? 'calc(80vh - 160px)' : 'auto',
                        maxHeight: isChatVisible ? 'calc(80vh - 160px)' : 'auto',
                        transition: 'height 0.3s ease-in-out'
                      }}>
                        {/* Chat section - conditionally shown and animated */}
                        <div className={`absolute top-0 left-0 right-0 bg-blue-950 border-b border-blue-800 transition-all duration-300 ease-in-out overflow-hidden flex flex-col z-50`}
                          style={{ 
                            height: isChatVisible ? 'calc(100% - 60px)' : '0',
                            maxHeight: isChatVisible ? 'calc(100% - 60px)' : '0',
                            opacity: isChatVisible ? 1 : 0,
                            visibility: isChatVisible ? 'visible' : 'hidden',
                            transform: isChatVisible ? 'translateY(0)' : 'translateY(-20px)',
                            boxShadow: '0 8px 16px -2px rgba(0, 0, 0, 0.2)'
                          }}
                        >
                          <div className="flex justify-between items-center px-4 py-2 bg-blue-900 border-b border-blue-800 shrink-0">
                            <h3 className="text-sm font-medium text-blue-100">Message Landlord</h3>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 w-7 p-0 text-blue-300 hover:text-blue-100 hover:bg-blue-800 z-30"
                              onClick={() => {
                                setIsChatVisible(false);
                                setIsQuoteButtonVisible(true);
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          <div className="flex-grow overflow-y-auto">
                            {/* Use real ChatInterface component for proper messaging */}
                            {selectedJob && authUser && selectedJob.chatRoomId ? (
                              <ChatInterface
                                chatRoomId={selectedJob.chatRoomId} 
                                userId={authUser.id}
                                userName={authUser.fullName || authUser.username || ""}
                                otherUserName={selectedJob.landlordName || "Landlord"}
                                className="h-full"
                                isJobId={false}
                              />
                            ) : selectedJob && authUser ? (
                              <div className="space-y-3 p-3">
                                {/* Demo messages to show the chat interface */}
                                <div className="flex justify-start">
                                  <div className="flex max-w-[80%]">
                                    <Avatar className="h-8 w-8 mr-2 mt-1 flex-shrink-0">
                                      <AvatarFallback>{selectedJob.landlordId ? "LL" : "LO"}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-medium text-blue-200">Landlord</span>
                                        <span className="text-xs text-blue-400">just now</span>
                                      </div>
                                      <div className="rounded-lg px-3 py-2 text-sm bg-blue-800 text-blue-200">
                                        Hi, I'm interested in your services for this job. Could you tell me more about your experience with similar projects?
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex justify-end">
                                  <div className="flex max-w-[80%]">
                                    <div>
                                      <div className="flex items-center gap-2 mb-1 justify-end">
                                        <span className="text-sm font-medium text-blue-200">You</span>
                                        <span className="text-xs text-blue-400">just now</span>
                                      </div>
                                      <div className="rounded-lg px-3 py-2 text-sm bg-blue-700 text-blue-100">
                                        Thanks for reaching out! I've completed several similar projects in the Halifax area. I can provide references if needed.
                                      </div>
                                    </div>
                                    <Avatar className="h-8 w-8 ml-2 mt-1 flex-shrink-0">
                                      <AvatarFallback>{authUser.fullName ? authUser.fullName.charAt(0) : "Y"}</AvatarFallback>
                                    </Avatar>
                                  </div>
                                </div>
                                
                                <div className="flex justify-start">
                                  <div className="flex max-w-[80%]">
                                    <Avatar className="h-8 w-8 mr-2 mt-1 flex-shrink-0">
                                      <AvatarFallback>{selectedJob.landlordId ? "LL" : "LO"}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-medium text-blue-200">Landlord</span>
                                        <span className="text-xs text-blue-400">just now</span>
                                      </div>
                                      <div className="rounded-lg px-3 py-2 text-sm bg-blue-800 text-blue-200">
                                        That sounds great. What's your availability for starting this project?
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-blue-300 mb-2">
                                Start typing to send a message to the landlord about this job.
                              </div>
                            )}
                          </div>
                          
                          <div className="p-3 bg-blue-900 border-t border-blue-800">
                            <div className="flex gap-2">
                              <Input
                                placeholder="Type a message..."
                                value={chatMessage}
                                onChange={(e) => setChatMessage(e.target.value)}
                                className="flex-1 bg-blue-950 border-blue-700 text-blue-100 placeholder:text-blue-400"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey && chatMessage.trim()) {
                                    e.preventDefault();
                                    
                                    // Create chat message
                                    const message = {
                                      content: chatMessage,
                                      senderId: authUser?.id || 0,
                                      chatRoomId: selectedJob.chatRoomId || selectedJob.id,
                                      timestamp: new Date().toISOString(),
                                      type: 'text'
                                    };
                                    
                                    // Clear the message
                                    setChatMessage('');
                                    
                                    // Show a success toast
                                    toast({
                                      title: "Message sent",
                                      description: "Your message has been sent to the landlord.",
                                    });
                                  }
                                }}
                              />
                              <Button 
                                className="bg-blue-700 hover:bg-blue-600 text-white" 
                                size="icon"
                                onClick={() => {
                                  if (chatMessage.trim()) {
                                    // Send message functionality
                                    const sendMessageToLandlord = async () => {
                                      try {
                                        // Create a chat room if one doesn't exist
                                        let chatRoomId = selectedJob.chatRoomId;
                                        
                                        if (!chatRoomId) {
                                          // First try to get a chat room for this job
                                          try {
                                            const jobResponse = await fetch(`/api/chat/job/${selectedJob.id}`);
                                            if (jobResponse.ok) {
                                              const chatRoomData = await jobResponse.json();
                                              chatRoomId = chatRoomData.id;
                                              
                                              // Update the job's chatRoomId locally for future messages
                                              const updatedJob = {...selectedJob, chatRoomId: chatRoomId};
                                              setSelectedJob(updatedJob);
                                              
                                              // Update the jobs query cache to reflect the chat room ID
                                              queryClient.setQueryData(['/api/jobs'], (prevJobs: any[]) => 
                                                prevJobs?.map(job => 
                                                  job.id === selectedJob.id ? {...job, chatRoomId} : job
                                                ) || []
                                              );
                                            }
                                          } catch (e) {
                                            console.error("Error getting chat room:", e);
                                          }
                                          
                                          // If still no chat room, use the job ID as fallback
                                          if (!chatRoomId) {
                                            chatRoomId = selectedJob.id;
                                          }
                                        }
                                        
                                        // Create and send the message
                                        const messageData = {
                                          content: chatMessage,
                                          senderId: authUser?.id,
                                          type: 'text'
                                        };
                                        
                                        const response = await fetch(`/api/chat/room/${chatRoomId}/messages`, {
                                          method: 'POST',
                                          headers: {
                                            'Content-Type': 'application/json'
                                          },
                                          body: JSON.stringify(messageData)
                                        });
                                        
                                        if (!response.ok) {
                                          throw new Error(`Failed to send message: ${response.statusText}`);
                                        }
                                        
                                        // Clear the message input
                                        setChatMessage('');
                                        
                                        // Create a chat bubble for this conversation if it doesn't exist yet
                                        const existingBubble = chatBubbles.find(bubble => 
                                          bubble.jobId === selectedJob.id || bubble.chatRoomId === chatRoomId
                                        );
                                        
                                        if (!existingBubble) {
                                          const newBubble = {
                                            id: Date.now(), // Temporary ID until we refresh
                                            title: selectedJob.title,
                                            jobId: selectedJob.id,
                                            chatRoomId: chatRoomId,
                                            otherUserId: selectedJob.landlordId,
                                            otherUserName: selectedJob.landlordName || "Property Owner",
                                            jobImage: selectedJob.images && selectedJob.images.length > 0 
                                              ? selectedJob.images[0] 
                                              : `/jobs/${selectedJob.category?.toLowerCase()}.jpg`,
                                            lastMessage: chatMessage,
                                            unreadCount: 0,
                                            timestamp: new Date().toISOString()
                                          };
                                          
                                          setChatBubbles(prev => [...prev, newBubble]);
                                        }
                                        
                                        // Show a success toast
                                        toast({
                                          title: "Message sent",
                                          description: "Your message has been sent to the landlord.",
                                        });
                                        
                                        // Refresh unread counts
                                        queryClient.invalidateQueries({ queryKey: ['/api/chat/unread'] });
                                        
                                      } catch (error) {
                                        console.error("Error sending message:", error);
                                        toast({
                                          title: "Error sending message",
                                          description: "There was an error sending your message. Please try again.",
                                          variant: "destructive"
                                        });
                                      }
                                    };
                                    
                                    sendMessageToLandlord();
                                  }
                                }}
                                disabled={!chatMessage.trim()}
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                        
                        {/* Button or input section - conditionally shown when chat is not active */}
                        {!isChatVisible && (selectedJob.status === "open" && !myBids.some((bid: Bid) => bid.jobId === selectedJob.id)) && (
                          <div className="relative">
                            {/* Send Quote button and Message button */}
                            <div 
                              className={`grid grid-cols-12 gap-2 transition-all duration-300 ease-in-out ${
                                isQuoteButtonVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 absolute'
                              }`}
                              style={{ visibility: isQuoteButtonVisible ? 'visible' : 'hidden' }}
                            >
                              <Button 
                                className="col-span-10 bg-blue-700 hover:bg-blue-600 text-white border-blue-600" 
                                onClick={() => {
                                  setIsDetailsModalOpen(false);
                                  createQuoteFromJob(selectedJob);
                                }}
                              >
                                <FileText className="mr-2 h-4 w-4" />
                                Send Quote
                              </Button>

                              {/* Message button - transforms the UI to message input */}
                              <Button 
                                variant="outline" 
                                size="icon"
                                className="col-span-2 bg-blue-800 hover:bg-blue-700 text-blue-200 hover:text-blue-100 border-blue-700"
                                onClick={() => {
                                  setIsQuoteButtonVisible(false);
                                  // Focus the input field after transition
                                  setTimeout(() => {
                                    const inputEl = document.getElementById('message-input');
                                    if (inputEl) inputEl.focus();
                                  }, 10);
                                }}
                              >
                                <MessageCircle className="h-4 w-4" />
                                <span className="sr-only">Message Landlord</span>
                              </Button>
                            </div>
                            
                            {/* Message input and Send button */}
                            <div 
                              className={`flex gap-2 transition-all duration-300 ease-in-out ${
                                !isQuoteButtonVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 absolute'
                              }`}
                              style={{ 
                                visibility: !isQuoteButtonVisible ? 'visible' : 'hidden',
                                width: '100%'
                              }}
                            >
                              <Input
                                id="message-input"
                                placeholder="Type a message to landlord..."
                                value={chatMessage}
                                onChange={(e) => setChatMessage(e.target.value)}
                                className="flex-1 bg-blue-950 border-blue-700 text-blue-100 placeholder:text-blue-400"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey && chatMessage.trim()) {
                                    e.preventDefault();
                                    
                                    // Send the message and open chat panel
                                    const sendMessageToLandlord = async () => {
                                      try {
                                        // Create a chat room if one doesn't exist
                                        let chatRoomId = selectedJob.chatRoomId;
                                        
                                        if (!chatRoomId) {
                                          // First try to get a chat room for this job
                                          try {
                                            const jobResponse = await fetch(`/api/chat/job/${selectedJob.id}`);
                                            if (jobResponse.ok) {
                                              const chatRoomData = await jobResponse.json();
                                              chatRoomId = chatRoomData.id;
                                              
                                              // Update the job's chatRoomId locally for future messages
                                              const updatedJob = {...selectedJob, chatRoomId: chatRoomId};
                                              setSelectedJob(updatedJob);
                                              
                                              // Update the jobs query cache to reflect the chat room ID
                                              queryClient.setQueryData(['/api/jobs'], (prevJobs: any[]) => 
                                                prevJobs?.map(job => 
                                                  job.id === selectedJob.id ? {...job, chatRoomId} : job
                                                ) || []
                                              );
                                            }
                                          } catch (e) {
                                            console.error("Error getting chat room:", e);
                                          }
                                          
                                          // If still no chat room, use the job ID as fallback
                                          if (!chatRoomId) {
                                            chatRoomId = selectedJob.id;
                                          }
                                        }
                                        
                                        // Create and send the message
                                        const messageData = {
                                          content: chatMessage,
                                          senderId: authUser?.id,
                                          type: 'text'
                                        };
                                        
                                        console.log("Sending message to chat room:", chatRoomId, messageData);
                                        
                                        const response = await fetch(`/api/chat/room/${chatRoomId}/messages`, {
                                          method: 'POST',
                                          headers: {
                                            'Content-Type': 'application/json'
                                          },
                                          body: JSON.stringify(messageData)
                                        });
                                        
                                        if (!response.ok) {
                                          throw new Error(`Failed to send message: ${response.statusText}`);
                                        }
                                        
                                        // Clear the message input
                                        setChatMessage('');
                                        
                                        // Create a chat bubble for this conversation if it doesn't exist yet
                                        const existingBubble = chatBubbles.find(bubble => 
                                          bubble.jobId === selectedJob.id || bubble.chatRoomId === chatRoomId
                                        );
                                        
                                        if (!existingBubble) {
                                          const newBubble = {
                                            id: Date.now(), // Temporary ID until we refresh
                                            title: selectedJob.title,
                                            jobId: selectedJob.id,
                                            chatRoomId: chatRoomId,
                                            otherUserId: selectedJob.landlordId,
                                            otherUserName: selectedJob.landlordName || "Property Owner",
                                            jobImage: selectedJob.images && selectedJob.images.length > 0 ? selectedJob.images[0] : `/jobs/${selectedJob.category?.toLowerCase()}.jpg`,
                                            lastMessage: chatMessage,
                                            unreadCount: 0,
                                            timestamp: new Date().toISOString()
                                          };
                                          
                                          console.log("Creating new chat bubble:", newBubble);
                                          setChatBubbles(prev => [...prev, newBubble]);
                                        }
                                        
                                        // Show a success toast
                                        toast({
                                          title: "Message sent",
                                          description: "Your message has been sent to the landlord.",
                                        });
                                        
                                        // Refresh unread counts
                                        queryClient.invalidateQueries({ queryKey: ['/api/chat/unread'] });
                                        
                                        // Open the full chat panel with the message already typed
                                        setIsChatVisible(true);
                                      } catch (error) {
                                        console.error("Error sending message:", error);
                                        toast({
                                          title: "Error sending message",
                                          description: "There was an error sending your message. Please try again.",
                                          variant: "destructive"
                                        });
                                      }
                                    };
                                    
                                    sendMessageToLandlord();
                                  } else if (e.key === 'Escape') {
                                    // Allow canceling with Escape key
                                    setChatMessage('');
                                    setIsQuoteButtonVisible(true);
                                  }
                                }}
                              />
                              <Button 
                                className="bg-blue-700 hover:bg-blue-600 text-white" 
                                size="icon"
                                onClick={() => {
                                  if (chatMessage.trim()) {
                                    // Send the message directly and open chat panel
                                    const sendMessageToLandlord = async () => {
                                      try {
                                        // Create a chat room if one doesn't exist
                                        let chatRoomId = selectedJob.chatRoomId;
                                        
                                        if (!chatRoomId) {
                                          // First try to get a chat room for this job
                                          try {
                                            const jobResponse = await fetch(`/api/chat/job/${selectedJob.id}`);
                                            if (jobResponse.ok) {
                                              const chatRoomData = await jobResponse.json();
                                              chatRoomId = chatRoomData.id;
                                              
                                              // Update the job's chatRoomId locally for future messages
                                              const updatedJob = {...selectedJob, chatRoomId: chatRoomId};
                                              setSelectedJob(updatedJob);
                                              
                                              // Update the jobs query cache to reflect the chat room ID
                                              queryClient.setQueryData(['/api/jobs'], (prevJobs: any[]) => 
                                                prevJobs?.map(job => 
                                                  job.id === selectedJob.id ? {...job, chatRoomId} : job
                                                ) || []
                                              );
                                            }
                                          } catch (e) {
                                            console.error("Error getting chat room:", e);
                                          }
                                          
                                          // If still no chat room, use the job ID as fallback
                                          if (!chatRoomId) {
                                            chatRoomId = selectedJob.id;
                                          }
                                        }
                                        
                                        // Create and send the message
                                        const messageData = {
                                          content: chatMessage,
                                          senderId: authUser?.id,
                                          type: 'text'
                                        };
                                        
                                        console.log("Sending message to chat room:", chatRoomId, messageData);
                                        
                                        const response = await fetch(`/api/chat/room/${chatRoomId}/messages`, {
                                          method: 'POST',
                                          headers: {
                                            'Content-Type': 'application/json'
                                          },
                                          body: JSON.stringify(messageData)
                                        });
                                        
                                        if (!response.ok) {
                                          throw new Error(`Failed to send message: ${response.statusText}`);
                                        }
                                        
                                        // Clear the message input
                                        setChatMessage('');
                                        
                                        // Create a chat bubble for this conversation if it doesn't exist yet
                                        const existingBubble = chatBubbles.find(bubble => 
                                          bubble.jobId === selectedJob.id || bubble.chatRoomId === chatRoomId
                                        );
                                        
                                        if (!existingBubble) {
                                          const newBubble = {
                                            id: Date.now(), // Temporary ID until we refresh
                                            title: selectedJob.title,
                                            jobId: selectedJob.id,
                                            chatRoomId: chatRoomId,
                                            otherUserId: selectedJob.landlordId,
                                            otherUserName: selectedJob.landlordName || "Property Owner",
                                            jobImage: selectedJob.images && selectedJob.images.length > 0 ? selectedJob.images[0] : `/jobs/${selectedJob.category?.toLowerCase()}.jpg`,
                                            lastMessage: chatMessage,
                                            unreadCount: 0,
                                            timestamp: new Date().toISOString()
                                          };
                                          
                                          console.log("Creating new chat bubble:", newBubble);
                                          setChatBubbles(prev => [...prev, newBubble]);
                                        }
                                        
                                        // Show a success toast
                                        toast({
                                          title: "Message sent",
                                          description: "Your message has been sent to the landlord.",
                                        });
                                        
                                        // Refresh unread counts
                                        queryClient.invalidateQueries({ queryKey: ['/api/chat/unread'] });
                                        
                                        // Open chat panel with existing message
                                        setIsChatVisible(true);
                                      } catch (error) {
                                        console.error("Error sending message:", error);
                                        toast({
                                          title: "Error sending message",
                                          description: "There was an error sending your message. Please try again.",
                                          variant: "destructive"
                                        });
                                      }
                                    };
                                    
                                    sendMessageToLandlord();
                                  } else {
                                    // If no message, toggle back to quote button
                                    setIsQuoteButtonVisible(true);
                                  }
                                }}
                              >
                                {chatMessage.trim() ? (
                                  <Send className="h-4 w-4" />
                                ) : (
                                  <X className="h-4 w-4" />
                                )}
                                <span className="sr-only">
                                  {chatMessage.trim() ? "Send Message" : "Cancel"}
                                </span>
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {myBids.some((bid: Bid) => bid.jobId === selectedJob.id) && (
                        <div className="border border-blue-800 bg-blue-800/50 rounded-md p-3 w-full mt-2">
                          <p className="text-sm font-medium text-blue-300">Your Quote</p>
                          <p className="font-bold text-blue-100">${myBids.find((bid: Bid) => bid.jobId === selectedJob.id)?.amount.toFixed(2)}</p>
                          <Badge className="mt-1 bg-blue-700 text-blue-200">
                            {myBids.find((bid: Bid) => bid.jobId === selectedJob.id)?.status}
                          </Badge>
                        </div>
                      )}
                      
                      {selectedJob.chatRoomId && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="icon"
                              className="bg-blue-800 hover:bg-blue-700 text-blue-200 hover:text-blue-100 border-blue-700 mt-2"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent 
                            className="max-w-4xl max-h-[90vh] h-[85vh] p-0 bg-blue-950 border-blue-900 flex flex-col"
                            aria-describedby={`job-detail-chat-${selectedJob.id}`}
                          >
                            <DialogHeader className="px-6 py-4 border-b border-blue-800 shrink-0">
                              <DialogTitle className="text-blue-200">Chat - {selectedJob.title}</DialogTitle>
                              <DialogDescription id={`job-detail-chat-${selectedJob.id}`} className="sr-only">
                                Chat with client for job: {selectedJob.title}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="flex-grow overflow-hidden">
                              <ChatInterface 
                                chatRoomId={selectedJob.chatRoomId || selectedJob.id} 
                                userId={authUser?.id || 0} 
                                userName={authUser?.fullName || authUser?.username || ""} 
                                otherUserName="Landlord"
                                className="h-full"
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
            </div>
          )}
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

      {/* Quote form dialog */}
      <Dialog open={quoteFormOpen} onOpenChange={setQuoteFormOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedQuote ? 'Edit Quote' : 'Create New Quote'}</DialogTitle>
            <DialogDescription>
              {selectedQuote 
                ? `Edit quote #${selectedQuote.quoteNumber}` 
                : 'Create a professional quote for your customer'}
            </DialogDescription>
          </DialogHeader>
          <QuoteForm 
            quote={selectedQuote}
            userId={authUser?.id || 0}
            job={jobToQuote}
            jobId={jobToQuote?.id}
            onSuccess={() => {
              setQuoteFormOpen(false);
              setJobToQuote(null); // Reset job-to-quote state after form submission
              queryClient.invalidateQueries({queryKey: ['/api/quotes']});
              toast({
                title: selectedQuote ? "Quote Updated" : "Quote Created",
                description: selectedQuote
                  ? `Quote #${selectedQuote.quoteNumber} has been updated.`
                  : "Your new quote has been created successfully.",
              });
            }}
            onCancel={() => {
              setQuoteFormOpen(false);
              setJobToQuote(null); // Reset job-to-quote state on cancel
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Quote details dialog */}
      <Dialog open={quoteDetailsOpen} onOpenChange={setQuoteDetailsOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quote Details</DialogTitle>
            <DialogDescription>
              {selectedQuote && `Quote #${selectedQuote.quoteNumber}`}
            </DialogDescription>
          </DialogHeader>
          {selectedQuote && (
            <QuoteDetails 
              quote={selectedQuote}
              onEdit={() => {
                setQuoteDetailsOpen(false);
                setQuoteFormOpen(true);
              }}
              onClose={() => setQuoteDetailsOpen(false)}
              onStatusChange={() => {
                queryClient.invalidateQueries({queryKey: ['/api/quotes']});
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Quote Wizard dialog */}
      <QuoteWizard
        isOpen={quoteWizardOpen}
        onClose={() => setQuoteWizardOpen(false)}
        onSaveAsDraft={(quote) => {
          setQuoteWizardOpen(false);
          setJobToQuote(null); // Reset job-to-quote state after saving
          queryClient.invalidateQueries({queryKey: ['/api/quotes']});
          toast({
            title: "Quote Saved as Draft",
            description: `Your quote has been saved as a draft.`,
          });
        }}
        onSendQuote={(quote) => {
          setQuoteWizardOpen(false);
          setJobToQuote(null); // Reset job-to-quote state after sending
          queryClient.invalidateQueries({queryKey: ['/api/quotes']});
          toast({
            title: "Quote Sent",
            description: `Your quote has been sent to the client.`,
          });
        }}
        userId={authUser?.id || 0}
        job={jobToQuote}
        quote={selectedQuote}
      />
      
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