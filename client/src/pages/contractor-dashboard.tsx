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
  Filter, CheckCircle2, ChevronDown, Info, SlidersHorizontal, Menu, Settings, ArrowDown, User, BellRing,
  Eye, CreditCard, Droplet, Fan, Flower2, Hammer, Paintbrush, Sparkles, Wrench, Zap, Plus, Trash, X
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

// Define quote schema with Zod
const quoteSchema = z.object({
  title: z.string().min(3, { message: "Title must be at least 3 characters" }),
  subtotal: z.coerce.number().min(1, { message: "Subtotal must be greater than 0" }),
  taxRate: z.coerce.number().min(0, { message: "Tax rate must be 0 or greater" }).max(100, { message: "Tax rate cannot exceed 100%" }),
  notes: z.string().optional(),
  terms: z.string().optional(),
  lineItems: z.array(
    z.object({
      description: z.string().min(3, { message: "Description required" }),
      quantity: z.coerce.number().min(1, { message: "Quantity must be at least 1" }),
      unitPrice: z.coerce.number().min(0, { message: "Unit price must be 0 or greater" }),
    })
  ).min(1, { message: "At least one line item is required" }),
  validUntil: z.date().optional(),
});

// Profile edit schema
const profileSchema = z.object({
  fullName: z.string().min(2, { message: "Full name must be at least 2 characters" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  phone: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string()
    .min(8, { message: "Password must be at least 8 characters" })
    .optional(),
  confirmPassword: z.string().optional(),
}).refine((data) => {
  // If any password field is filled, then all are required
  if (data.currentPassword || data.newPassword || data.confirmPassword) {
    return !!data.currentPassword && !!data.newPassword && !!data.confirmPassword;
  }
  return true;
}, {
  message: "All password fields are required when changing password",
  path: ["currentPassword"],
}).refine((data) => {
  // If passwords are provided, they must match
  if (data.newPassword && data.confirmPassword) {
    return data.newPassword === data.confirmPassword;
  }
  return true;
}, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

// Business info schema
const businessSchema = z.object({
  businessName: z.string().min(2, { message: "Business name must be at least 2 characters" }),
  bio: z.string().min(10, { message: "Bio must be at least 10 characters" }).max(500, { message: "Bio cannot exceed 500 characters" }),
  skills: z.array(z.string()).min(1, { message: "Please add at least one skill" }),
});

type BidFormValues = z.infer<typeof bidSchema>;
type QuoteFormValues = z.infer<typeof quoteSchema>;
type ProfileFormValues = z.infer<typeof profileSchema>;
type BusinessFormValues = z.infer<typeof businessSchema>;

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
  const [isJobDetailsModalOpen, setIsJobDetailsModalOpen] = useState(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isProfileEditModalOpen, setIsProfileEditModalOpen] = useState(false);
  const [isBusinessInfoModalOpen, setIsBusinessInfoModalOpen] = useState(false);
  const [selectedBid, setSelectedBid] = useState<Bid | null>(null);
  const [mapCenter, setMapCenter] = useState({ latitude: 37.7749, longitude: -122.4194 });
  const [serviceRadius, setServiceRadius] = useState(25);
  const [activeTab, setActiveTab] = useState("available");
  const [lineItems, setLineItems] = useState([{ description: "", quantity: 1, unitPrice: 0 }]);
  // Add state to force re-renders when profile is updated
  const [profileVersion, setProfileVersion] = useState(0);
  const { isAuthenticated, logout } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        console.log("Fetching user data with credentials...");
        const response = await fetch('/api/user', {
          credentials: 'include',
          headers: { 
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
          }
        });
        
        if (response.ok) {
          const userData = await response.json();
          console.log("User data fetched successfully:", userData);
          setUser(userData);
          
          // If user data is loaded successfully, also fetch contractor profile
          if (userData?.id) {
            try {
              console.log("Fetching contractor profile data...");
              const profileResponse = await fetch(`/api/contractor-profile/${userData.id}`, {
                credentials: 'include',
                headers: { 
                  "Cache-Control": "no-cache, no-store, must-revalidate",
                  "Pragma": "no-cache",
                  "Expires": "0"
                }
              });
              
              if (profileResponse.ok) {
                const profileData = await profileResponse.json();
                console.log("Contractor profile data loaded:", profileData);
                setProfile(profileData);
              } else {
                console.error("Failed to fetch contractor profile:", profileResponse.status);
              }
            } catch (profileError) {
              console.error("Error fetching contractor profile:", profileError);
            }
          }
        } else {
          console.error("Failed to fetch user data:", response.status, response.statusText);
          // If we get 401, user is not authenticated - handle accordingly
          if (response.status === 401) {
            console.warn("User is not authenticated");
          }
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      } finally {
        setIsAuthLoading(false);
      }
    };
    
    fetchUserData();
  }, []);
  
  // Fetch contractor profile with forced refetch on every render
  // Try first with our new fix endpoint that creates a profile if it doesn't exist
  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ['/api/contractor-profile-fix', user?.id, profileVersion], // Add profileVersion to force re-fetches
    enabled: Boolean(user?.id),
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: true,
    staleTime: 0, // Always consider data stale
    cacheTime: 0, // Don't cache results
    // Custom fetch function to ensure proper credentials are sent
    queryFn: async ({ queryKey }) => {
      // First try with our fix endpoint that auto-creates profiles
      try {
        const fixResponse = await fetch(`/api/contractor-profile-fix/${user?.id}`, {
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Force-Reload': 'true',
            'X-Timestamp': String(new Date().getTime())
          }
        });
        
        if (fixResponse.ok) {
          console.log("Successfully fetched/created profile using fix endpoint");
          return fixResponse.json();
        }
        
        console.log("Fix endpoint failed, trying direct endpoint...");
        
        // If fix endpoint fails, try the direct endpoint
        const directResponse = await fetch(`/api/direct-contractor-profile/${user?.id}`, {
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Force-Reload': 'true',
            'X-Timestamp': String(new Date().getTime())
          }
        });
        
        if (directResponse.ok) {
          console.log("Successfully fetched/created profile using direct endpoint");
          const data = await directResponse.json();
          return data.profile || data; // Handle both response formats
        }
        
        // Try our new simple profile endpoint that just creates a minimal profile
        try {
          console.log("Trying simple profile creation endpoint...");
          const simpleResponse = await fetch(`/api/simple-profile/${user?.id}`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0',
              'X-Force-Reload': 'true',
              'X-Timestamp': String(new Date().getTime())
            }
          });
          
          if (simpleResponse.ok) {
            console.log("Successfully created basic profile using simple endpoint");
            // After creating a basic profile, try original endpoint again
            console.log("Fetching full profile after simple profile creation");
          }
        } catch (simpleProfileError) {
          console.error("Error with simple profile endpoint:", simpleProfileError);
        }
        
        // If all else fails, try the original endpoint as a last resort
        const response = await fetch(`/api/contractor-profile/${user?.id}`, {
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Force-Reload': 'true',
            'X-Timestamp': String(new Date().getTime())
          }
        });
        
        if (!response.ok) {
          throw new Error(`All profile fetch attempts failed: ${response.status} ${response.statusText}`);
        }
        
        return response.json();
      } catch (error) {
        console.error("Error fetching contractor profile:", error);
        
        // Create a minimal profile from user data if all else fails
        if (user) {
          console.log("Creating minimal profile from user data");
          return {
            userId: user.id,
            businessName: user.fullName ? `${user.fullName}'s Business` : 'New Business',
            trades: ['General Contractor'],
            skills: [],
            bio: 'Professional contractor services',
            isMinimalProfile: true // Flag to indicate this is a minimal profile
          };
        }
        
        throw error;
      }
    }
  });

  // Fetch jobs
  // Use our fixed jobs endpoint to handle snake_case column names
  const { data: jobs = [], refetch: refetchAllJobs } = useQuery({
    queryKey: ['/api/jobs-fix/all-jobs'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/jobs-fix/all-jobs', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(user?.id ? { 'X-User-ID': String(user.id) } : {})
          },
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch jobs: ${response.status} ${response.statusText}`);
        }
        
        console.log('Successfully fetched jobs from fixed endpoint');
        return await response.json();
      } catch (error) {
        console.error("Error fetching jobs from fixed endpoint:", error);
        
        // Fallback to the regular endpoint
        const fallbackResponse = await fetch('/api/jobs', {
          credentials: 'include'
        });
        
        if (!fallbackResponse.ok) {
          throw new Error("Failed to fetch jobs from fallback endpoint");
        }
        
        return await fallbackResponse.json();
      }
    },
    enabled: isAuthenticated,
    staleTime: 30 * 1000, // 30 seconds before data is considered stale
    cacheTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: true, // Refetch when window regains focus
    onError: (error) => {
      console.error("Error fetching jobs:", error);
      toast({
        title: "Error fetching jobs",
        description: "We couldn't load the available jobs. Falling back to regular endpoint.",
        variant: "destructive"
      });
      
      // Fallback to regular endpoint if the fixed one fails
      queryClient.prefetchQuery({
        queryKey: ['/api/jobs'],
        queryFn: () => fetch('/api/jobs').then(res => res.json())
      });
    }
  });

  // Fetch bids with enhanced caching and refresh strategy
  // Use our fixed bids endpoint to handle snake_case column names
  const { 
    data: myBids = [], 
    refetch: refetchMyBids,
    isLoading: isMyBidsLoading
  } = useQuery({
    queryKey: ['/api/jobs-fix/contractor-bids', user?.id],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/jobs-fix/contractor-bids/${user?.id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch bids");
        }
        return await response.json();
      } catch (error) {
        console.error("Error fetching bids from fixed endpoint:", error);
        // Fallback to the regular endpoint
        const fallbackResponse = await fetch('/api/bids/contractor');
        if (!fallbackResponse.ok) {
          throw new Error("Failed to fetch bids from fallback endpoint");
        }
        return await fallbackResponse.json();
      }
    },
    enabled: isAuthenticated && !!user?.id,
    staleTime: 30 * 1000, // 30 seconds before data is considered stale
    cacheTime: 5 * 60 * 1000, // 5 minutes cache 
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchOnMount: true, // Always refetch when component mounts
    onSuccess: (data) => {
      console.log("Successfully fetched bids:", data.length);
    },
    onError: (error) => {
      console.error("Error fetching bids:", error);
    }
  });

  // Fetch my jobs (jobs where I'm the contractor)
  const { data: contractorJobsData = { availableJobs: [], activeJobs: [], myBids: [] }, refetch: refetchMyJobs } = useQuery({
    queryKey: ['/api/jobs-fix/contractor-jobs', user?.id],
    queryFn: async () => {
      try {
        // Try the fixed endpoint first
        if (!user?.id) throw new Error("User ID is required");
        const response = await fetch(`/api/jobs-fix/contractor-jobs/${user.id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch contractor jobs");
        }
        const myJobs = await response.json();
        return { 
          availableJobs: [],
          activeJobs: myJobs, 
          myBids: [] 
        };
      } catch (error) {
        console.error("Error fetching from fixed endpoint:", error);
        
        // Fallback to the regular endpoint
        const fallbackResponse = await fetch('/api/contractor-jobs');
        if (!fallbackResponse.ok) {
          throw new Error("Failed to fetch from fallback endpoint");
        }
        return await fallbackResponse.json();
      }
    },
    enabled: isAuthenticated && !!user?.id,
  });
  
  // Extract activeJobs from the response
  const myJobs = contractorJobsData?.activeJobs || [];

  // Filter jobs based on service areas
  const availableJobs = useMemo(() => {
    if (!Array.isArray(jobs)) return [];
    return jobs;
  }, [jobs]);

  // Mutation for creating a bid
  const createBidMutation = useMutation({
    mutationFn: async (data: BidFormValues) => {
      if (!selectedJob) throw new Error("No job selected");
      if (!user?.id) throw new Error("User not authenticated");
      
      // Note: We need to explicitly send contractorId with the fixed endpoint
      const bidData = {
        ...data,
        jobId: selectedJob.id,
        contractorId: user.id,
        // Convert amount from string to number if it's a string
        amount: typeof data.amount === 'string' ? parseFloat(data.amount) : data.amount
      };
      
      // Log the bid data for debugging
      console.log("Submitting bid data:", bidData);
      
      // First try the fixed endpoint with direct fetch for more control
      try {
        const fixedResponse = await fetch("/api/jobs-fix/create-bid", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-ID": String(user.id) // Include explicit user ID
          },
          body: JSON.stringify(bidData),
          credentials: "include"
        });
        
        if (fixedResponse.ok) {
          console.log("Bid created successfully using fixed endpoint");
          return await fixedResponse.json();
        }
        
        console.error("Fixed endpoint failed, status:", fixedResponse.status);
        const errorText = await fixedResponse.text();
        console.error("Error response:", errorText);
        
        // Fall back to the regular endpoint
        console.log("Falling back to regular endpoint");
        const response = await fetch("/api/bids", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-ID": String(user.id) // Include explicit user ID
          },
          body: JSON.stringify(bidData),
          credentials: "include"
        });
        
        if (!response.ok) {
          throw new Error(`Failed to create bid: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error("Error creating bid with primary endpoint:", error);
        // Final fallback
        return apiRequest("POST", "/api/bids", bidData);
      }
    },
    onSuccess: async () => {
      console.log("Bid submitted successfully!");
      
      // Invalidate all related queries to ensure UI updates everywhere
      // Include both the original and fixed endpoint keys
      await queryClient.invalidateQueries({ queryKey: ['/api/bids/contractor'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/jobs-fix/contractor-bids', user?.id] });
      
      await queryClient.invalidateQueries({ queryKey: ['/api/jobs'] }); // Refresh jobs to reflect new bid count
      await queryClient.invalidateQueries({ queryKey: ['/api/jobs-fix/all-jobs'] }); 
      
      await queryClient.invalidateQueries({ queryKey: ['/api/contractor-jobs'] }); // Refresh contractor's jobs
      await queryClient.invalidateQueries({ queryKey: ['/api/jobs-fix/contractor-jobs', user?.id] }); 
      
      // Immediately refetch bids to ensure the UI is updated
      await refetchMyBids();
      
      // Set active tab to "my-bids" to show the user their new bid
      setActiveTab('my-bids');
      
      // Close the modal
      setIsBidModalOpen(false);
      
      // Notify the user
      toast({
        title: "Bid submitted successfully",
        description: "Your bid has been recorded and is now visible in the 'My Bids' tab.",
        variant: "default"
      });
    },
    onError: (error: Error) => {
      console.error("Bid submission error:", error);
      toast({
        title: "Failed to submit bid",
        description: error.message || "There was an error submitting your bid. Please try again.",
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
  
  // Form for creating a quote
  const quoteForm = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      title: "",
      subtotal: 0,
      taxRate: 0,
      notes: "",
      terms: "",
      lineItems: [
        { description: "", quantity: 1, unitPrice: 0 }
      ]
    },
  });
  
  // Form for editing profile
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      email: user?.email || "",
      phone: user?.phone || "",
    },
  });
  
  // Keep user profile form in sync with user changes
  useEffect(() => {
    if (user && profileForm) {
      console.log("Setting profile form values from user data:", {
        fullName: user.fullName,
        email: user.email,
        phone: user.phone
      });
      
      profileForm.setValue('fullName', user.fullName || "");
      profileForm.setValue('email', user.email || "");
      profileForm.setValue('phone', user.phone || "");
    }
  }, [user, profileForm]);
  
  // Form for editing business info
  const businessForm = useForm<BusinessFormValues>({
    resolver: zodResolver(businessSchema),
    defaultValues: {
      businessName: profile?.businessName || "",
      bio: profile?.bio || "",
      skills: Array.isArray(profile?.skills) ? profile.skills : [],
    },
  });
  
  // Keep form values in sync with profile changes
  useEffect(() => {
    if (profile && businessForm) {
      console.log("Setting business form from profile data:", {
        businessName: profile.businessName,
        bio: profile.bio,
        skills: profile.skills
      });
      
      // Update form values
      businessForm.setValue('businessName', profile.businessName || "");
      businessForm.setValue('bio', profile.bio || "");
      
      if (Array.isArray(profile.skills)) {
        businessForm.setValue('skills', profile.skills);
      }
    }
  }, [profile, businessForm, profileVersion]);
  
  // Mutation for creating a quote
  const createQuoteMutation = useMutation({
    mutationFn: async (data: QuoteFormValues) => {
      if (!selectedJob) throw new Error("No job selected");
      if (!user) throw new Error("User not authenticated");
      
      // Calculate totals for each line item
      const lineItems = data.lineItems.map(item => ({
        ...item,
        total: item.quantity * item.unitPrice
      }));
      
      // Calculate subtotal and tax
      const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
      const taxAmount = subtotal * (data.taxRate / 100);
      const total = subtotal + taxAmount;
      
      const quoteData = {
        ...data,
        jobId: selectedJob.id,
        contractorId: user.id,
        landlordId: selectedJob.landlordId,
        lineItems,
        subtotal,
        taxAmount,
        total
      };
      
      console.log("Creating quote:", quoteData);
      return apiRequest("POST", "/api/quotes", quoteData);
    },
    onSuccess: async (data) => {
      console.log("Quote created successfully:", data);
      
      // Invalidate queries to update UI
      await queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/contractor-jobs'] });
      
      // Close the modal
      setIsQuoteModalOpen(false);
      
      // Send the quote immediately
      const quoteId = (data as any).id;
      if (quoteId) {
        try {
          await apiRequest("POST", `/api/quotes/${quoteId}/send`, {});
          toast({
            title: "Quote sent successfully",
            description: "Your quote has been sent to the client.",
            variant: "default"
          });
        } catch (error) {
          console.error("Error sending quote:", error);
          toast({
            title: "Quote created but not sent",
            description: "Your quote was created but couldn't be sent. You can send it manually later.",
            variant: "warning"
          });
        }
      }
    },
    onError: (error: Error) => {
      console.error("Quote creation error:", error);
      toast({
        title: "Failed to create quote",
        description: error.message || "There was an error creating your quote. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mutation for updating user profile
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      if (!user) throw new Error("User not authenticated");
      
      // Prepare the data for the update
      // Do not include email to prevent changing the login email
      const updateData: any = {
        fullName: data.fullName,
        phone: data.phone
      };
      
      // Only include password fields if the user is changing their password
      if (data.currentPassword && data.newPassword) {
        updateData.currentPassword = data.currentPassword;
        updateData.newPassword = data.newPassword;
      }
      
      return apiRequest("PATCH", `/api/user/${user.id}`, updateData);
    },
    onSuccess: async (response) => {
      console.log("Profile update response:", response);
      
      // Reset password fields
      profileForm.setValue('currentPassword', '');
      profileForm.setValue('newPassword', '');
      profileForm.setValue('confirmPassword', '');
      
      // First, notify the user
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
        variant: "default"
      });
      
      // Update local user state with the new data from response
      if (response && response.user) {
        setUser(response.user);
      }
      
      // Comprehensive approach to update UI:
      // 1. Invalidate all user-related queries
      await queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      
      // 2. Manually fetch updated user data with cache-busting headers
      try {
        const userData = await fetch('/api/user', { 
          credentials: 'include',
          headers: { "Cache-Control": "no-cache, no-store, must-revalidate" } 
        }).then(res => res.json());
        
        console.log("Fetched updated user data:", userData);
        
        // 3. Force update React Query cache and local state
        queryClient.setQueryData(['/api/user'], userData);
        if (userData) {
          setUser(userData);
        }
        
        // 4. Also refresh the contractor profile since it's related
        await refetchProfile();
      } catch (error) {
        console.error('Failed to refresh user data:', error);
      }
      
      // Close modal
      setIsProfileEditModalOpen(false);
      
      // Instead of refreshing the page, we'll manually update the UI data
      // This prevents authentication issues that can happen with page refreshes
      console.log("Profile successfully updated - updating UI directly");
      
      // Set a timeout to allow the toast notification to be seen before refreshing data
      setTimeout(async () => {
        try {
          // Manually refetch the user data with no-cache headers
          const freshUserData = await fetch(`/api/user`, { 
            credentials: 'include',
            headers: { 
              "Cache-Control": "no-cache, no-store, must-revalidate",
              "Pragma": "no-cache",
              "Expires": "0",
              "X-Force-Reload": "true",
              "X-Timestamp": String(new Date().getTime())
            } 
          }).then(res => res.json());
          
          // Force update the user state
          setUser(freshUserData);
          
          // Also get fresh profile data
          const freshProfileData = await fetch(`/api/contractor-profile/${user?.id}`, { 
            credentials: 'include',
            headers: { 
              "Cache-Control": "no-cache, no-store, must-revalidate",
              "Pragma": "no-cache",
              "Expires": "0",
              "X-Force-Reload": "true",
              "X-Timestamp": String(new Date().getTime())
            } 
          }).then(res => res.json());
          
          // Force update the profile state
          setProfile(freshProfileData);
          console.log("User and profile data manually updated");
          
          // Force a state update to trigger a re-render
          setProfileVersion(v => v + 1);
        } catch (error) {
          console.error("Error manually refreshing user data:", error);
        }
      }, 500);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update profile",
        description: error.message || "There was an error updating your profile.",
        variant: "destructive"
      });
    }
  });
  
  // Mutation for updating business info
  const updateBusinessInfoMutation = useMutation({
    mutationFn: async (data: BusinessFormValues) => {
      if (!user) throw new Error("User not authenticated");
      
      console.log("Submitting business info update:", data);
      
      // First try our new simple endpoint that works with actual DB columns
      try {
        console.log("Using simple profile endpoint...");
        const response = await fetch(`/api/simple-profile/${user.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            bio: data.bio,
            skills: data.skills || [],
            business_name: data.businessName || "" // Using snake_case for database compatibility
          }),
          credentials: 'include'
        });
        
        if (response.ok) {
          console.log("Simple profile update successful!");
          return await response.json();
        }
        
        console.warn("Simple profile update failed, falling back to regular endpoint");
      } catch (error) {
        console.error("Error with simple profile update:", error);
      }
      
      // Fall back to the regular endpoint as a backup
      console.log("Falling back to regular endpoint");
      return apiRequest("PATCH", `/api/contractor-profile/${user.id}`, data, {
        headers: {
          "X-User-ID": String(user.id),
          "X-Force-Reload": "true",
          "X-Timestamp": String(new Date().getTime())
        }
      });
    },
    onSuccess: async (response) => {
      console.log("Business info update response:", response);
      
      // First, notify the user
      toast({
        title: "Business info updated",
        description: "Your business information has been updated successfully.",
        variant: "default"
      });
      
      // Comprehensive approach to update UI:
      // 1. Invalidate the queries - marks them as stale and ready for refetch
      await queryClient.invalidateQueries({ queryKey: ['/api/contractor-profile'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/contractor-profile', user?.id] });
      
      // 2. Manually fetch the updated profile data
      try {
        const profileData = await fetch(`/api/contractor-profile/${user?.id}`, { 
          credentials: 'include' 
        }).then(res => res.json());
        
        console.log("Fetched updated profile data:", profileData);
        
        // 3. Force update React Query cache with the fresh data
        queryClient.setQueryData(['/api/contractor-profile', user?.id], profileData);
        
        // 4. Also update the main profile cache entry
        queryClient.setQueryData(['/api/contractor-profile'], profileData);
      } catch (error) {
        console.error('Failed to refresh contractor profile data:', error);
      }
      
      // 5. Increment the profile version to force a complete re-query
      setProfileVersion(prev => prev + 1);
      
      // 6. Make sure we trigger a refetch with the updated query key
      await refetchProfile();
      
      // 7. Force a fresh state update with the latest data from the API
      const freshProfileData = await fetch(`/api/contractor-profile/${user?.id}`, { 
        credentials: 'include',
        headers: { 
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        } 
      }).then(res => res.json());
      
      console.log("FRESH PROFILE DATA:", freshProfileData);
      
      if (freshProfileData) {
        // Debug what fields we're getting in the fresh profile data
        console.log("Profile fields received:", Object.keys(freshProfileData));
        console.log("Business name value:", freshProfileData.businessName);
        
        // Update React Query cache one more time with the latest data
        queryClient.setQueryData(['/api/contractor-profile', user?.id, profileVersion], freshProfileData);
        
        // Also directly update the DOM state if needed
        if (freshProfileData.skills) {
          businessForm.setValue('skills', freshProfileData.skills);
        }
        if (freshProfileData.bio) {
          businessForm.setValue('bio', freshProfileData.bio);
        }
        if (freshProfileData.businessName) {
          businessForm.setValue('businessName', freshProfileData.businessName);
        }
      }
      
      // Close modal
      setIsBusinessInfoModalOpen(false);
      
      // Instead of refreshing the page, we'll manually update the UI data
      // This prevents authentication issues that can happen with page refreshes
      console.log("Business info successfully updated - updating UI directly");
      
      // Set a timeout to allow the toast notification to be seen before refreshing data
      setTimeout(async () => {
        try {
          // Manually refetch with no-cache headers
          const freshProfileData = await fetch(`/api/contractor-profile/${user?.id}`, { 
            credentials: 'include',
            headers: { 
              "Cache-Control": "no-cache, no-store, must-revalidate",
              "Pragma": "no-cache",
              "Expires": "0",
              "X-Force-Reload": "true",
              "X-Timestamp": String(new Date().getTime())
            } 
          }).then(res => res.json());
          
          // Force update the profile state
          setProfile(freshProfileData);
          console.log("Profile data manually updated with:", freshProfileData);
          
          // Force a state update to trigger a re-render
          setProfileVersion(v => v + 1);
        } catch (error) {
          console.error("Error manually refreshing profile data:", error);
        }
      }, 500);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update business info",
        description: error.message || "There was an error updating your business information.",
        variant: "destructive"
      });
    }
  });

  const onSubmitBidForm = (data: BidFormValues) => {
    createBidMutation.mutate(data);
  };
  
  const onSubmitQuoteForm = (data: QuoteFormValues) => {
    createQuoteMutation.mutate(data);
  };
  
  const onSubmitProfileForm = (data: ProfileFormValues) => {
    updateProfileMutation.mutate(data);
  };
  
  const onSubmitBusinessForm = (data: BusinessFormValues) => {
    updateBusinessInfoMutation.mutate(data);
  };

  const openBidModal = (job: Job) => {
    setSelectedJob(job);
    setIsBidModalOpen(true);
    
    // Reset form with default values - ensure amount is a number
    const defaultAmount = job.budget && job.budget > 0 ? job.budget : 100;
    
    bidForm.reset({
      amount: defaultAmount,
      proposal: "",
      timeEstimate: "1-2 days",
    });
    
    console.log("Opened bid modal with default amount:", defaultAmount);
  };
  
  const openQuoteModal = (job: Job) => {
    setSelectedJob(job);
    setIsQuoteModalOpen(true);
    
    // Reset line items
    setLineItems([{ description: "", quantity: 1, unitPrice: 0 }]);
    
    // Reset form with default values
    quoteForm.reset({
      title: `Quote for ${job.title}`,
      subtotal: job.budget || 0,
      taxRate: 0,
      notes: "",
      terms: "Payment due within 30 days",
      lineItems: [
        { description: job.title, quantity: 1, unitPrice: job.budget || 0 }
      ]
    });
    
    console.log("Opened quote modal for job:", job.title);
  };
  
  const addLineItem = () => {
    setLineItems([...lineItems, { description: "", quantity: 1, unitPrice: 0 }]);
    
    // Update form values with new line item
    const currentItems = quoteForm.getValues().lineItems || [];
    quoteForm.setValue('lineItems', [...currentItems, { description: "", quantity: 1, unitPrice: 0 }]);
  };
  
  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return; // Keep at least one line item
    
    const newLineItems = [...lineItems];
    newLineItems.splice(index, 1);
    setLineItems(newLineItems);
    
    // Update form values removing the line item
    const currentItems = quoteForm.getValues().lineItems || [];
    const newItems = [...currentItems];
    newItems.splice(index, 1);
    quoteForm.setValue('lineItems', newItems);
  };
  
  // Auto-calculate subtotal when line items change
  useEffect(() => {
    const watchLineItems = quoteForm.watch("lineItems");
    
    if (watchLineItems && Array.isArray(watchLineItems)) {
      const calculatedSubtotal = watchLineItems.reduce((sum, item) => {
        const quantity = item.quantity || 0;
        const unitPrice = item.unitPrice || 0;
        return sum + (quantity * unitPrice);
      }, 0);
      
      quoteForm.setValue("subtotal", calculatedSubtotal);
    }
  }, [quoteForm.watch("lineItems")]);
  
  // Function to view job details
  const viewJobDetails = (job: Job) => {
    setSelectedJob(job);
    setIsJobDetailsModalOpen(true);
  };
  
  // Function to view bid details 
  const viewBidDetails = (bid: Bid, job: Job) => {
    setSelectedBid(bid);
    setSelectedJob(job);
    setIsJobDetailsModalOpen(true);
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
  
  const getJobCategoryIcon = (category: string) => {
    const icons: { [key: string]: JSX.Element } = {
      "Plumbing": <Droplet className="h-5 w-5 text-blue-500" />,
      "Electrical": <Zap className="h-5 w-5 text-yellow-500" />,
      "Carpentry": <Hammer className="h-5 w-5 text-orange-500" />,
      "Painting": <Paintbrush className="h-5 w-5 text-pink-500" />,
      "Landscaping": <Flower2 className="h-5 w-5 text-green-500" />,
      "General Maintenance": <Wrench className="h-5 w-5 text-gray-500" />,
      "Roofing": <Home className="h-5 w-5 text-brown-500" />,
      "HVAC": <Fan className="h-5 w-5 text-cyan-500" />,
      "Cleaning": <Sparkles className="h-5 w-5 text-purple-500" />,
    };
    
    return icons[category] || <Wrench className="h-5 w-5 text-gray-500" />;
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
      {/* Header section - Enhanced Visibility */}
      <div className="bg-white border-b sticky top-0 z-20 shadow-md">
        <div className="container mx-auto p-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
            <div>
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 text-transparent bg-clip-text">Real Service</h1>
              <p className="text-muted-foreground text-sm">
                Welcome, <span className="font-medium text-foreground capitalize">{user?.fullName || user?.username || 'Contractor'}</span>
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
              <p className="font-semibold text-lg">${typeof profile?.walletBalance === 'number' 
                ? profile.walletBalance.toFixed(2) 
                : typeof profile?.walletBalance === 'string' 
                  ? parseFloat(profile.walletBalance).toFixed(2) 
                  : "0.00"}</p>
            </div>
          </div>
          <div className="bg-white bg-opacity-50 backdrop-blur-sm rounded-md p-3 flex items-center space-x-3 shadow-sm border border-border/30">
            <div className="bg-primary/10 p-2 rounded-full">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Jobs</p>
              <p className="font-semibold text-lg">{Array.isArray(myJobs) ? myJobs.length : 0}</p>
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
        <Tabs 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-4 mb-4 sticky top-0 z-10 bg-background/80 backdrop-blur shadow-sm">
            <TabsTrigger 
              value="available"
              className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-sm data-[state=active]:rounded-t-md transition-all"
            >
              Available Jobs
            </TabsTrigger>
            <TabsTrigger 
              value="my-jobs"
              className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-sm data-[state=active]:rounded-t-md transition-all"
            >
              My Jobs
            </TabsTrigger>
            <TabsTrigger 
              value="my-bids"
              className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-sm data-[state=active]:rounded-t-md transition-all"
            >
              My Bids
              {Array.isArray(myBids) && myBids.length > 0 && (
                <span className="ml-2 bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {myBids.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="profile"
              className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-sm data-[state=active]:rounded-t-md transition-all"
            >
              Profile
            </TabsTrigger>
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
                            <CardFooter className="bg-muted/30 p-3 border-t border-border/20 flex gap-2">
                              <Button 
                                variant="outline"
                                className="w-1/2"
                                onClick={() => viewJobDetails(job)}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                Details
                              </Button>
                              <Button 
                                className="w-1/2 bg-primary hover:bg-primary/90 transition-colors" 
                                onClick={() => openBidModal(job)}
                                disabled={createBidMutation.isPending}
                              >
                                {createBidMutation.isPending && selectedJob?.id === job.id ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Bidding...
                                  </>
                                ) : (
                                  <>
                                    <CreditCard className="mr-2 h-4 w-4" />
                                    Bid
                                  </>
                                )}
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
                        <div className="flex flex-col space-y-2">
                          <Button 
                            className="w-full bg-primary hover:bg-primary/90 transition-colors" 
                            onClick={() => viewJobDetails(job)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </Button>
                          
                          {job.status === "completed" && (
                            <Button 
                              className="w-full bg-green-600 hover:bg-green-700 transition-colors" 
                              onClick={() => openQuoteModal(job)}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              Send Quote
                            </Button>
                          )}
                        </div>
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
              {isMyBidsLoading ? (
                <div className="flex items-center justify-center p-12">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading your bids...</p>
                  </div>
                </div>
              ) : Array.isArray(myBids) && myBids.length > 0 ? (
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
                            onClick={() => viewBidDetails(bid, job)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
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
                      <div>
                        <Label>Password</Label>
                        <div className="font-medium mt-1">••••••••</div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => {
                        // Reset form with current user data
                        profileForm.reset({
                          fullName: user?.fullName || "",
                          email: user?.email || "",
                          phone: user?.phone || "",
                        });
                        setIsProfileEditModalOpen(true);
                      }}
                    >
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
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => {
                        // Reset form with current business data
                        businessForm.reset({
                          businessName: profile?.businessName || "",
                          bio: profile?.bio || "",
                          skills: Array.isArray(profile?.skills) ? profile.skills : [],
                        });
                        setIsBusinessInfoModalOpen(true);
                      }}
                    >
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
                    <p className="font-semibold">${typeof selectedJob.budget === 'number' 
                      ? selectedJob.budget.toFixed(2) 
                      : parseFloat(selectedJob.budget || '0').toFixed(2)}</p>
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

      {/* Quote Modal */}
      <Dialog open={isQuoteModalOpen} onOpenChange={setIsQuoteModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Quote</DialogTitle>
            <DialogDescription>
              Create a professional quote for your completed job.
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
                    <p className="text-sm text-muted-foreground">Job Budget</p>
                    <p className="font-semibold">${typeof selectedJob.budget === 'number' 
                      ? selectedJob.budget.toFixed(2) 
                      : parseFloat(selectedJob.budget || '0').toFixed(2)}</p>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <Form {...quoteForm}>
            <form onSubmit={quoteForm.handleSubmit(onSubmitQuoteForm)} className="space-y-4">
              <FormField
                control={quoteForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quote Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter the quote title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>Line Items</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={addLineItem}
                    className="h-8"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add Item
                  </Button>
                </div>
                
                {lineItems.map((_, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 mb-2 items-start">
                    <div className="col-span-6">
                      <FormField
                        control={quoteForm.control}
                        name={`lineItems.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input placeholder="Description" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="col-span-2">
                      <FormField
                        control={quoteForm.control}
                        name={`lineItems.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="1" 
                                step="1" 
                                placeholder="Qty" 
                                {...field}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value);
                                  field.onChange(isNaN(value) ? 1 : value);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="col-span-3">
                      <FormField
                        control={quoteForm.control}
                        name={`lineItems.${index}.unitPrice`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="0" 
                                step="0.01" 
                                placeholder="Unit Price" 
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
                    </div>
                    <div className="col-span-1 flex items-center justify-center">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => removeLineItem(index)}
                        disabled={lineItems.length <= 1}
                        className="h-8 w-8 p-0"
                      >
                        <Trash className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={quoteForm.control}
                  name="subtotal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subtotal ($)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          min="0"
                          placeholder="Enter subtotal" 
                          {...field} 
                          onChange={(e) => {
                            const value = parseFloat(e.target.value);
                            field.onChange(isNaN(value) ? 0 : value);
                          }}
                          disabled
                        />
                      </FormControl>
                      <FormDescription>Calculated automatically from line items</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={quoteForm.control}
                  name="taxRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax Rate (%)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.1" 
                          min="0" 
                          max="100"
                          placeholder="Enter tax rate" 
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
              </div>
              
              <FormField
                control={quoteForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter any additional notes for the client" 
                        className="h-20" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={quoteForm.control}
                name="terms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Terms & Conditions</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter terms and conditions" 
                        className="h-20" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="submit" disabled={createQuoteMutation.isPending}>
                  {createQuoteMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Quote...
                    </>
                  ) : (
                    'Create & Send Quote'
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
      
      {/* Job Details Dialog */}
      <Dialog open={isJobDetailsModalOpen} onOpenChange={setIsJobDetailsModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          {selectedJob && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl flex items-center gap-2">
                  {getJobCategoryIcon(selectedJob.category || "General Maintenance")}
                  {selectedJob.title}
                  <span className="ml-2">{getStatusBadge(selectedJob.status)}</span>
                </DialogTitle>
                <DialogDescription>
                  Posted on {new Date(selectedJob.createdAt).toLocaleDateString()}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Budget</p>
                  <p className="font-semibold">${selectedJob.budget?.toFixed(2) || "No budget specified"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Location</p>
                  <p className="font-semibold">
                    {selectedJob.location?.city}, {selectedJob.location?.state}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Category</p>
                  <p className="font-semibold">{selectedJob.category || "General"}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <h3 className="font-medium text-lg">Job Description</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{selectedJob.description}</p>
              </div>
              
              {/* Display images if available */}
              {selectedJob.images && selectedJob.images.length > 0 && (
                <div className="space-y-3 mt-4">
                  <h3 className="font-medium text-lg">Job Images</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {selectedJob.images.map((image, index) => (
                      <div 
                        key={index} 
                        className="aspect-square rounded-md overflow-hidden bg-muted/30 border"
                      >
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
              
              {/* If we're viewing specific bid details or there's a bid from this contractor, show it */}
              {(selectedBid || (Array.isArray(myBids) && myBids.some(bid => bid.jobId === selectedJob.id))) && (
                <div className="space-y-3 mt-4 border-t pt-4">
                  <h3 className="font-medium text-lg flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    {selectedBid ? "Bid Details" : "Your Bid"}
                  </h3>
                  <div className="bg-muted/20 p-4 rounded-md border">
                    {(() => {
                      const bid = selectedBid || (Array.isArray(myBids) ? myBids.find(bid => bid.jobId === selectedJob.id) : null);
                      return bid ? (
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="font-medium">Bid Amount:</span>
                            <span className="font-semibold">${bid.amount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium">Status:</span>
                            <span>{getBidStatusBadge(bid.status || "pending")}</span>
                          </div>
                          <div className="pt-2">
                            <p className="font-medium mb-1">Proposal:</p>
                            <p className="text-sm text-muted-foreground bg-white p-3 rounded border">{bid.proposal}</p>
                          </div>
                          <div>
                            <p className="font-medium mb-1">Time Estimate:</p>
                            <p className="text-sm text-muted-foreground">{bid.timeEstimate}</p>
                          </div>
                          <div>
                            <p className="font-medium mb-1">Submitted On:</p>
                            <p className="text-sm text-muted-foreground">{new Date(bid.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                      ) : (
                        <p>No bid details available</p>
                      );
                    })()}
                  </div>
                </div>
              )}
              
              <DialogFooter className="gap-2 flex-wrap">
                <Button variant="outline" onClick={() => setIsJobDetailsModalOpen(false)}>Close</Button>
                
                {selectedJob.status === "open" && Array.isArray(myBids) && !myBids.some(bid => bid.jobId === selectedJob.id) && (
                  <Button onClick={() => {
                    setIsJobDetailsModalOpen(false);
                    openBidModal(selectedJob);
                  }}>
                    <CreditCard className="w-4 h-4 mr-2" />
                    Submit Bid
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    
      {/* Profile Edit Modal */}
      <Dialog open={isProfileEditModalOpen} onOpenChange={setIsProfileEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>
              Update your personal information.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(onSubmitProfileForm)} className="space-y-4">
              <FormField
                control={profileForm.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={profileForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Your email address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={profileForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Your phone number" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Separator className="my-4" />
              
              <div className="space-y-2 mb-4">
                <h3 className="text-lg font-medium">Change Password</h3>
                <p className="text-sm text-muted-foreground">
                  Leave these fields blank if you don't want to change your password.
                </p>
              </div>
              
              <FormField
                control={profileForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Enter your current password" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={profileForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Enter your new password" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={profileForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Confirm your new password" 
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
                  onClick={() => setIsProfileEditModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                >
                  {updateProfileMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Business Info Edit Modal */}
      <Dialog open={isBusinessInfoModalOpen} onOpenChange={setIsBusinessInfoModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Business Information</DialogTitle>
            <DialogDescription>
              Update your business details and skills.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...businessForm}>
            <form onSubmit={businessForm.handleSubmit(onSubmitBusinessForm)} className="space-y-4">
              <FormField
                control={businessForm.control}
                name="businessName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your business name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={businessForm.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Tell clients about your business and experience" 
                        className="h-24" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={businessForm.control}
                name="skills"
                render={({ field }) => {
                  // Create a list of common skills
                  const skillOptions = [
                    "Plumbing", "Electrical", "Carpentry", "Painting", 
                    "Landscaping", "General Maintenance", "HVAC", 
                    "Roofing", "Flooring", "Tiling", "Drywall",
                    "Masonry", "Concrete", "Cleaning", "Moving"
                  ];
                  
                  // Get currently selected skills
                  const selectedSkills = field.value || [];
                  
                  // Function to toggle a skill
                  const toggleSkill = (skill: string) => {
                    const isSelected = selectedSkills.includes(skill);
                    
                    if (isSelected) {
                      // Remove the skill
                      const newSkills = selectedSkills.filter(s => s !== skill);
                      field.onChange(newSkills);
                    } else {
                      // Add the skill
                      field.onChange([...selectedSkills, skill]);
                    }
                  };
                  
                  // Function to add a custom skill
                  const [customSkill, setCustomSkill] = useState("");
                  const addCustomSkill = () => {
                    if (customSkill.trim() !== "" && !selectedSkills.includes(customSkill)) {
                      field.onChange([...selectedSkills, customSkill]);
                      setCustomSkill("");
                    }
                  };
                  
                  return (
                    <FormItem>
                      <FormLabel>Skills</FormLabel>
                      <FormControl>
                        <div className="space-y-4">
                          <div className="flex flex-wrap gap-2">
                            {skillOptions.map((skill) => (
                              <Badge 
                                key={skill}
                                variant={selectedSkills.includes(skill) ? "default" : "outline"}
                                className="cursor-pointer"
                                onClick={() => toggleSkill(skill)}
                              >
                                {skill}
                                {selectedSkills.includes(skill) && (
                                  <span className="ml-1">✓</span>
                                )}
                              </Badge>
                            ))}
                          </div>
                          
                          <div className="flex gap-2">
                            <Input 
                              placeholder="Add custom skill" 
                              value={customSkill}
                              onChange={(e) => setCustomSkill(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addCustomSkill();
                                }
                              }}
                            />
                            <Button type="button" size="sm" onClick={addCustomSkill}>Add</Button>
                          </div>
                          
                          {selectedSkills.length > 0 && (
                            <div className="mt-2">
                              <p className="text-sm font-medium mb-1">Selected Skills:</p>
                              <div className="flex flex-wrap gap-1">
                                {selectedSkills.map((skill) => (
                                  <Badge key={skill} className="bg-primary text-white">
                                    {skill}
                                    <X 
                                      className="ml-1 h-3 w-3 cursor-pointer"
                                      onClick={() => toggleSkill(skill)}
                                    />
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsBusinessInfoModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={updateBusinessInfoMutation.isPending}
                >
                  {updateBusinessInfoMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}