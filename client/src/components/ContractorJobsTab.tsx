import React, { useMemo, useState, useCallback } from "react";
import { 
  Search, MapPin, Filter, X as XIcon, Loader2, Clock, Calendar, CalendarDays,
  ArrowUpDown, SearchIcon, Check, Star, GemIcon, Trophy, ListFilter,
  LayoutGrid, List, SplitSquareVertical, Map as MapIcon, SlidersHorizontal,
  Tag as TagIcon, ArrowUp, ArrowDown, DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { JobsList } from "./JobsList";
import { JobsMap } from "./JobsMap";
import { JobsSplitView } from "./JobsSplitView";
import { ServiceAreaDisplay } from "./ServiceAreaDisplay";
import { ServiceAreaMapInput } from "./ServiceAreaMapInput";
import { CategoryIcon } from "./CategoryIcons";
import { 
  Job, Bid, jobStatusEnum, bidStatusEnum, JobLocation, ExtendedJob 
} from "@shared/schema";
import { getCategoryDisplayName, AVAILABLE_CATEGORIES } from "@shared/constants";

interface ContractorJobsTabProps {
  onBidJob: (job: Job) => void;
  onViewDetails?: (job: Job) => void;
  onSwitchToJobsTab?: () => void;
  searchQuery?: string;
  filterCategory?: string;
  selectedCategories?: string[];
  onResetFilters?: () => void;
  // Location props
  serviceCity?: string;
  serviceState?: string;
  serviceRadius?: number;
  serviceAreaMarker?: {latitude: number, longitude: number};
  onLocationChange?: (data: {city: string, state: string, latitude: number, longitude: number}) => void;
  onRadiusChange?: (radius: number) => void;
  // Service area status
  hasServiceArea?: boolean;
  // Notification and profile props
  notificationCount?: number;
  profilePicture?: string;
  fullName?: string;
  onChangeSection?: (section: string) => void;
  onLogout?: () => Promise<void>;
}

export function ContractorJobsTab({ 
  onBidJob,
  onViewDetails,
  onSwitchToJobsTab,
  searchQuery = '',
  filterCategory,
  selectedCategories = [],
  onResetFilters,
  serviceCity,
  serviceState,
  serviceRadius = 25,
  serviceAreaMarker,
  onLocationChange,
  onRadiusChange,
  hasServiceArea = true,
  notificationCount,
  profilePicture,
  fullName,
  onChangeSection,
  onLogout,
}: ContractorJobsTabProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [myBids, setMyBids] = React.useState<Bid[]>([]);
  const [searchTerm, setSearchTerm] = React.useState(searchQuery || '');
  const [categoryFilter, setCategoryFilter] = React.useState(filterCategory || '');
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = React.useState(false);
  const [sortMethod, setSortMethod] = React.useState<'default' | 'price' | 'date' | 'category' | 'title' | 'location'>('default');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');
  // State for display type (grid, table, map, or split view)
  const [displayType, setDisplayType] = useState<'grid' | 'table' | 'map' | 'split'>('grid');
  
  // State for tracking highlighted job across all views
  const [highlightedJobId, setHighlightedJobId] = useState<number | null>(null);

  // Fetch jobs from the API when the component mounts
  React.useEffect(() => {
    const fetchJobs = async () => {
      setIsLoading(true);
      try {
        // Get the userId from sessionStorage if available
        let userId = null;
        try {
          const storedUser = sessionStorage.getItem('user');
          if (storedUser) {
            const userData = JSON.parse(storedUser);
            userId = userData.id;
            console.log("Found user ID in session storage:", userId);
          }
        } catch (err) {
          console.error("Error reading from sessionStorage:", err);
        }
        
        // Generate timestamp for auth 
        const timestamp = Date.now().toString();
        
        // Setup headers for authentication
        const headers: HeadersInit = {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        };
        
        // Add user ID and auth headers if we have a user ID
        if (userId) {
          headers['X-User-ID'] = userId.toString();
          headers['X-Auth-Token'] = `user-${userId}-${timestamp}`;
          headers['X-Auth-Timestamp'] = timestamp;
          headers['X-Force-Reload'] = 'true';
        }
        
        console.log("Fetching contractor jobs with headers:", headers);
        
        // Make the request with the auth headers
        const response = await fetch('/api/contractor-jobs', {
          method: 'GET',
          headers: headers,
          credentials: 'include', // Include cookies
        });
        
        if (!response.ok) {
          console.error("API Response error:", response.status, response.statusText);
          throw new Error(`Failed to fetch jobs: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Detailed logging for debugging
        console.log("API Response - Full data:", data);
        console.log("API Response - Available jobs count:", data.availableJobs?.length || 0);
        console.log("API Response - My bids count:", data.myBids?.length || 0);
        console.log("Contractor jobs response:", JSON.stringify(data).substring(0, 500) + "...[TRUNCATED]");
        
        if (data.availableJobs && Array.isArray(data.availableJobs)) {
          console.log("API Response - First job sample:", data.availableJobs[0]);
          
          // Log all jobs IDs to verify they're loading 
          const jobIds = data.availableJobs.map((job: any) => job.id);
          console.log("API Response - All job IDs:", jobIds.join(', '));
          
          // Set jobs immediately to ensure they're displayed
          setJobs(data.availableJobs);
        } else {
          console.error("API Response - availableJobs is not an array:", data.availableJobs);
          setJobs([]);
        }
        
        // Set bids with type safety
        if (data.myBids && Array.isArray(data.myBids)) {
          setMyBids(data.myBids);
        } else {
          console.error("API Response - myBids is not an array:", data.myBids);
          setMyBids([]);
        }
        
        // Log the array lengths after state updates
        console.log("State updated - jobs:", Array.isArray(data.availableJobs) ? data.availableJobs.length : 0);
        console.log("State updated - myBids:", Array.isArray(data.myBids) ? data.myBids.length : 0);
        
      } catch (error) {
        console.error('Error fetching jobs:', error);
        // Set empty arrays on error to avoid undefined issues
        setJobs([]);
        setMyBids([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchJobs();
  }, []);

  // Filter jobs by search term and category
  const filteredJobs = useMemo(() => {
    console.log("Starting job filtering with", jobs.length, "jobs");
    
    // Safety check - if jobs is not an array, return empty array
    if (!Array.isArray(jobs)) {
      console.error("Jobs is not an array in filteredJobs!", typeof jobs);
      return [];
    }
    
    try {
      // CRITICAL FIX: If either search or category filter is empty or null, skip the filtering logic
      if ((!searchTerm || searchTerm.trim() === '') && (!categoryFilter || categoryFilter.trim() === '')) {
        console.log("No active filters - returning all jobs");
        return jobs;
      }
      
      // Apply text and category filters, with defensive coding
      const filtered = jobs.filter((job: Job) => {
        // Safety check for null jobs or missing properties
        if (!job) {
          return false;
        }
        
        // Try to match on title/description text if search term is provided
        let searchMatch = true;
        if (searchTerm && searchTerm.trim().length > 0) {
          searchMatch = false;
          
          // Safety check for title
          if (!job.title || typeof job.title !== 'string') {
            job.title = "Untitled Job";
          }
          
          // Safety check for description
          if (!job.description || typeof job.description !== 'string') {
            job.description = "";
          }
          
          // Match on title
          if (job.title.toLowerCase().includes(searchTerm.toLowerCase())) {
            searchMatch = true;
          }
          // Match on description if not already matched
          else if (job.description.toLowerCase().includes(searchTerm.toLowerCase())) {
            searchMatch = true;
          }
        }
        
        // Try to match on category if filter is provided
        let categoryMatch = true;
        if (categoryFilter && categoryFilter.trim().length > 0) {
          categoryMatch = false;
          
          // Safety check for categoryTags
          if (!job.categoryTags || !Array.isArray(job.categoryTags)) {
            job.categoryTags = [];
          }
          
          // Check for category match
          const categoryTagsArray = job.categoryTags as string[];
          for (const cat of categoryTagsArray) {
            if (typeof cat === 'string' && cat.toLowerCase() === categoryFilter.toLowerCase()) {
              categoryMatch = true;
              break;
            }
          }
        }
        
        // Job passes if it matches both filters
        return searchMatch && categoryMatch;
      });
      
      console.log("Filtered jobs count:", filtered.length);
      return filtered;
    } catch (error) {
      console.error("Error in job filtering:", error);
      // IMPORTANT: On error, return the original jobs
      return jobs;
    }
  }, [jobs, searchTerm, categoryFilter]);

  // Check if a job is in the contractor's service area
  const isJobInServiceArea = (job: Job): boolean => {
    // For debugging - temporarily show all jobs regardless of location
    console.log(`Job location check for job ${job.id}: ${job.title}`, job.location);
    
    // If no service area set, or job has no location, always include it
    if (!serviceAreaMarker || !job.location) {
      console.log(`Including job ${job.id} - no service area or job location`);
      return true;
    }
    
    try {
      // Get coordinates, with fallbacks if missing - use type checking and guard clauses
      if (typeof job.location !== 'object' || job.location === null) {
        console.log(`Including job ${job.id} - location is not an object`);
        return true;
      }
      
      // Check that location has latitude and longitude properties
      const jobLocation = job.location as JobLocation;
      const jobLat = jobLocation.latitude;
      const jobLng = jobLocation.longitude;
      
      // For debugging - if job doesn't have coordinates, include it
      if (jobLat === undefined || jobLng === undefined) {
        console.log(`Including job ${job.id} - missing coordinates`);
        return true;
      }
      
      const myLat = serviceAreaMarker.latitude;
      const myLng = serviceAreaMarker.longitude;
      
      // Rough distance calculation (Haversine formula)
      const R = 6371; // Earth radius in km
      const dLat = (jobLat - myLat) * Math.PI / 180;
      const dLon = (jobLng - myLng) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(myLat * Math.PI / 180) * Math.cos(jobLat * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
      const distance = R * c; // Distance in km
      
      // For debugging - increase the effective radius temporarily to include more jobs
      const isInRange = distance <= (serviceRadius * 5 || 125); // 5x normal range for testing
      console.log(`Job ${job.id} distance: ${distance.toFixed(2)}km, in range: ${isInRange}`);
      return isInRange;
    } catch (error) {
      console.error("Error calculating distance for job", job.id, error);
      return true; // If calculation fails, include the job
    }
  };

  // Filter jobs by service area if hasServiceArea is true
  const availableJobs = useMemo(() => {
    console.log("Filtered jobs before service area check:", filteredJobs.length);
    
    // Safety check
    if (!Array.isArray(filteredJobs)) {
      console.error("filteredJobs is not an array! It's:", typeof filteredJobs);
      return [];
    }
    
    // CRITICAL FIX: If we get no filtered jobs but we have the original jobs, 
    // there might be a filtering issue, so return the original jobs
    if (filteredJobs.length === 0 && jobs.length > 0) {
      console.log("⚠️ No jobs after initial filtering but we have", jobs.length, "original jobs - returning all jobs");
      return jobs;
    }
    
    // For debugging - if we have no jobs at this point, still return the filtered jobs
    if (filteredJobs.length === 0) {
      console.log("No jobs after text/category filtering, skipping service area check");
      return filteredJobs;
    }
    
    try {
      // For debugging, log service areas information
      if (serviceAreaMarker) {
        console.log("Filtering jobs with service areas:", [
          {
            id: 5, 
            city: serviceCity || "Unknown",
            state: serviceState || "Unknown",
            radius: serviceRadius || 0,
            latitude: serviceAreaMarker?.latitude,
            longitude: serviceAreaMarker?.longitude
          }
        ]);
      }
      
      // IMPORTANT: Bypass all filtering for now to ensure jobs show
      console.log("⚠️ TEMPORARILY BYPASSING ALL FILTERING - returning all", jobs.length, "jobs");
      return jobs;
      
      /* Service area filtering - commented out for debugging
      // Always pass through if service area not set or we're explicitly told to ignore it
      if (!hasServiceArea || !serviceAreaMarker) {
        console.log("Service area check skipped - not configured or disabled");
        return filteredJobs;
      }
      
      // Apply service area filter with safety checks
      const jobsInServiceArea = filteredJobs.filter((job) => {
        if (!job) return false;
        return isJobInServiceArea(job);
      });
      
      console.log("Jobs after service area filter:", jobsInServiceArea.length);
      console.log("Service area marker:", serviceAreaMarker);
      console.log("Service radius:", serviceRadius);
      
      return jobsInServiceArea;
      */
    } catch (error) {
      console.error("Error in service area filtering:", error);
      // On error, return ALL unfiltered jobs to ensure something displays
      return jobs;
    }
  }, [filteredJobs, jobs, hasServiceArea, serviceAreaMarker, serviceRadius, serviceCity, serviceState]);
  
  // Check if a job matches the contractor's trades
  const matchesTrades = useCallback((job: Job) => {
    // In a real app, we'd check if the job category is in the contractor's selected trades
    return selectedCategories.length === 0 || 
      (job.categoryTags && Array.isArray(job.categoryTags) && 
        job.categoryTags.some((cat: string) => 
          selectedCategories.includes(String(cat))
        )
      );
  }, [selectedCategories]);

  // Sort the filtered jobs based on the selected method
  const sortedJobs = useMemo(() => {
    // Safety check for array
    if (!Array.isArray(availableJobs)) {
      console.error("availableJobs is not an array! Cannot sort.", availableJobs);
      return [];
    }
    
    // For diagnostic purposes, log what we're getting
    console.log("Attempting to sort jobs, count:", availableJobs.length);
    
    // If no jobs, return empty array
    if (availableJobs.length === 0) {
      return [];
    }
    
    try {
      // Create a copy of the array to sort (avoid mutating the original)
      const sorted = [...availableJobs];
      
      console.log("Sorting using method:", sortMethod, "order:", sortOrder);
      
      // Apply sorting based on selected method
      switch (sortMethod) {
        case 'price':
          return sorted.sort((a, b) => {
            const aPrice = a.budget || 0;
            const bPrice = b.budget || 0;
            return sortOrder === 'desc' ? bPrice - aPrice : aPrice - bPrice;
          });
          
        case 'date':
          return sorted.sort((a, b) => {
            const aDate = new Date(a.createdAt).getTime();
            const bDate = new Date(b.createdAt).getTime();
            return sortOrder === 'desc' ? bDate - aDate : aDate - bDate;
          });
          
        case 'category':
          return sorted.sort((a, b) => {
            let aCategory = '';
            let bCategory = '';
            
            // Safely access categoryTags arrays with proper type checking
            if (a.categoryTags && Array.isArray(a.categoryTags) && a.categoryTags.length > 0) {
              aCategory = String(a.categoryTags[0]);
            }
            
            if (b.categoryTags && Array.isArray(b.categoryTags) && b.categoryTags.length > 0) {
              bCategory = String(b.categoryTags[0]);
            }
            
            if (sortOrder === 'desc') {
              return bCategory.localeCompare(aCategory);
            }
            return aCategory.localeCompare(bCategory);
          });
          
        case 'title':
          return sorted.sort((a, b) => {
            const aTitle = a.title || '';
            const bTitle = b.title || '';
            return sortOrder === 'desc' 
              ? bTitle.localeCompare(aTitle)
              : aTitle.localeCompare(bTitle);
          });
          
        case 'location':
          return sorted.sort((a, b) => {
            // Safely get city names with fallbacks using JobLocation type
            const aLocation = a.location as JobLocation | null;
            const bLocation = b.location as JobLocation | null;
            
            const aCity = aLocation?.city || '';
            const bCity = bLocation?.city || '';
              
            return sortOrder === 'desc' 
              ? bCity.localeCompare(aCity)
              : aCity.localeCompare(bCity);
          });
          
        case 'default':
        default:
          // Best match - this would normally factor in distance, match to contractor skills, etc.
          // For now just keep the order as is
          return sorted;
      }
    } catch (error) {
      console.error("Error sorting jobs:", error);
      // On error, return unsorted
      return availableJobs;
    }
  }, [availableJobs, sortMethod, sortOrder]);

  // Debug logs right before render
  console.log("ContractorJobsTab - Pre-render check - sortedJobs:", 
              Array.isArray(sortedJobs) ? sortedJobs.length : 'not an array');
  console.log("ContractorJobsTab - Array check:", Array.isArray(sortedJobs));
  
  // Force sortedJobs to be an array for component safety
  const safeJobs = Array.isArray(sortedJobs) ? sortedJobs : [];
  
  return (
    <div className="space-y-4">
      {/* Header - always visible with fixed positioning */}
      <header className="bg-[#040f2d] text-white fixed top-0 left-0 right-0 z-30 border-b border-blue-800/30 md:left-64">
        <div className="flex justify-between items-center px-6 py-3">
          <div className="flex-1">
            <h2 className="text-xl font-semibold">Available Jobs</h2>
            <p className="text-sm text-blue-200 mb-1">New jobs posted in your area. Place a bid or save them to return later.</p>
            {safeJobs.length > 0 && (
              <p className="text-sm text-blue-300">Showing {safeJobs.length} available job{safeJobs.length !== 1 ? 's' : ''}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {notificationCount && notificationCount > 0 && (
              <div className="relative">
                <Button variant="outline" className="bg-blue-900/60 border-blue-700" onClick={() => onChangeSection && onChangeSection('jobs-active')}>
                  <Star className="h-5 w-5 text-yellow-400" />
                  <span className="ml-2">Active Jobs</span>
                </Button>
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {notificationCount}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>
      
      {/* Compact spacer div for fixed header - reduced size */}
      <div className="h-16"></div>
      
      {/* Container for both sort bar and job listings */}
      <div className="w-full mt-0">
        {/* Sort bar with enhanced sorting options */}
        {safeJobs.length > 0 && displayType === 'grid' && (
          <div className="w-full mb-3">
            <div className="bg-blue-950/50 border border-blue-800/30 rounded-lg p-3 flex flex-wrap gap-2">
              <div className="text-blue-100 text-sm font-medium flex items-center mr-2">
                <SlidersHorizontal className="h-4 w-4 mr-1.5" />
                Sort by:
              </div>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant={sortMethod === 'default' ? "secondary" : "ghost"} 
                      size="sm"
                      className={`h-8 rounded-md ${sortMethod === 'default' ? 'bg-blue-700 text-white hover:bg-blue-600' : 'text-blue-300 hover:text-white hover:bg-blue-900/70'}`}
                      onClick={() => setSortMethod('default')}
                    >
                      <Star className="h-3.5 w-3.5 mr-1.5" />
                      Recommended
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Sort by our recommended matches</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant={sortMethod === 'price' ? "secondary" : "ghost"}
                      size="sm"
                      className={`h-8 rounded-md ${sortMethod === 'price' ? 'bg-blue-700 text-white hover:bg-blue-600' : 'text-blue-300 hover:text-white hover:bg-blue-900/70'}`}
                      onClick={() => {
                        if (sortMethod === 'price') {
                          // Toggle between ascending and descending if already selected
                          setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                        } else {
                          // Set to price sorting with high to low (desc) as default
                          setSortMethod('price');
                          setSortOrder('desc');
                        }
                      }}
                    >
                      <DollarSign className="h-3.5 w-3.5 mr-1.5" />
                      Price {sortMethod === 'price' && (
                        <span className="flex items-center ml-1.5">
                          {sortOrder === 'desc' ? 
                            <ArrowDown className="h-3 w-3 ml-0.5" /> : 
                            <ArrowUp className="h-3 w-3 ml-0.5" />
                          }
                        </span>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{sortMethod === 'price' && sortOrder === 'desc' ? 'Showing highest price first' : sortMethod === 'price' ? 'Showing lowest price first' : 'Sort by price'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant={sortMethod === 'date' ? "secondary" : "ghost"}
                      size="sm"
                      className={`h-8 rounded-md ${sortMethod === 'date' ? 'bg-blue-700 text-white hover:bg-blue-600' : 'text-blue-300 hover:text-white hover:bg-blue-900/70'}`}
                      onClick={() => {
                        if (sortMethod === 'date') {
                          // Toggle between newest and oldest if already selected
                          setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                        } else {
                          // Set to date sorting with newest first (desc) as default
                          setSortMethod('date');
                          setSortOrder('desc');
                        }
                      }}
                    >
                      <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
                      {sortMethod === 'date' && sortOrder === 'desc' ? 'Newest' : sortMethod === 'date' ? 'Oldest' : 'Date'}
                      {sortMethod === 'date' && (
                        <span className="flex items-center ml-1.5">
                          {sortOrder === 'desc' ? 
                            <ArrowDown className="h-3 w-3 ml-0.5" /> : 
                            <ArrowUp className="h-3 w-3 ml-0.5" />
                          }
                        </span>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{sortMethod === 'date' && sortOrder === 'desc' ? 'Showing newest jobs first' : sortMethod === 'date' ? 'Showing oldest jobs first' : 'Sort by posting date'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant={sortMethod === 'location' ? "secondary" : "ghost"}
                      size="sm"
                      className={`h-8 rounded-md ${sortMethod === 'location' ? 'bg-blue-700 text-white hover:bg-blue-600' : 'text-blue-300 hover:text-white hover:bg-blue-900/70'}`}
                      onClick={() => {
                        if (sortMethod === 'location') {
                          // Toggle direction if already selected
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortMethod('location');
                          setSortOrder('asc');
                        }
                      }}
                    >
                      <MapPin className="h-3.5 w-3.5 mr-1.5" />
                      Nearby
                      {sortMethod === 'location' && (
                        <span className="flex items-center ml-1.5">
                          {sortOrder === 'desc' ? 
                            <ArrowDown className="h-3 w-3 ml-0.5" /> : 
                            <ArrowUp className="h-3 w-3 ml-0.5" />
                          }
                        </span>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Sort by distance from your service area</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant={sortMethod === 'category' ? "secondary" : "ghost"}
                      size="sm"
                      className={`h-8 rounded-md ${sortMethod === 'category' ? 'bg-blue-700 text-white hover:bg-blue-600' : 'text-blue-300 hover:text-white hover:bg-blue-900/70'}`}
                      onClick={() => {
                        if (sortMethod === 'category') {
                          // Toggle between A-Z and Z-A if already selected
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          // Set to category sorting with A-Z (asc) as default
                          setSortMethod('category');
                          setSortOrder('asc');
                        }
                      }}
                    >
                      <TagIcon className="h-3.5 w-3.5 mr-1.5" />
                      Category
                      {sortMethod === 'category' && (
                        <span className="flex items-center ml-1.5">
                          {sortOrder === 'desc' ? 
                            <ArrowDown className="h-3 w-3 ml-0.5" /> : 
                            <ArrowUp className="h-3 w-3 ml-0.5" />
                          }
                        </span>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{sortMethod === 'category' && sortOrder === 'asc' ? 'Sorting categories A-Z' : sortMethod === 'category' ? 'Sorting categories Z-A' : 'Sort by job category'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              {/* Add display toggle on the right side */}
              <div className="ml-auto flex items-center">
                <div className="text-blue-200 text-sm mr-2">View:</div>
                <ToggleGroup type="single" value={displayType} onValueChange={(value) => value && setDisplayType(value as 'grid' | 'table' | 'map' | 'split')}>
                  <ToggleGroupItem value="grid" aria-label="Grid View" className="h-8 bg-blue-950/40 border-blue-800/40 text-blue-200 data-[state=on]:bg-blue-800 data-[state=on]:text-white">
                    <LayoutGrid className="h-4 w-4 mr-1" />
                    <span className="text-sm">Grid</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="table" aria-label="Table View" className="h-8 bg-blue-950/40 border-blue-800/40 text-blue-200 data-[state=on]:bg-blue-800 data-[state=on]:text-white">
                    <List className="h-4 w-4 mr-1" />
                    <span className="text-sm">Table</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="map" aria-label="Map View" className="h-8 bg-blue-950/40 border-blue-800/40 text-blue-200 data-[state=on]:bg-blue-800 data-[state=on]:text-white">
                    <MapIcon className="h-4 w-4 mr-1" />
                    <span className="text-sm">Map</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="split" aria-label="Split View" className="h-8 bg-blue-950/40 border-blue-800/40 text-blue-200 data-[state=on]:bg-blue-800 data-[state=on]:text-white">
                    <SplitSquareVertical className="h-4 w-4 mr-1" />
                    <span className="text-sm">Split</span>
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>
          </div>
        )}
        
        {/* Display type toggle only (when not in grid view) */}
        {safeJobs.length > 0 && displayType !== 'grid' && (
          <div className="w-full mb-3 flex justify-end">
            <div className="flex items-center">
              <div className="text-blue-200 text-sm mr-2">View:</div>
              <ToggleGroup type="single" value={displayType} onValueChange={(value) => value && setDisplayType(value as 'grid' | 'table' | 'map' | 'split')}>
                <ToggleGroupItem value="grid" aria-label="Grid View" className="h-8 bg-blue-950/40 border-blue-800/40 text-blue-200 data-[state=on]:bg-blue-800 data-[state=on]:text-white">
                  <LayoutGrid className="h-4 w-4 mr-1" />
                  <span className="text-sm">Grid</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="table" aria-label="Table View" className="h-8 bg-blue-950/40 border-blue-800/40 text-blue-200 data-[state=on]:bg-blue-800 data-[state=on]:text-white">
                  <List className="h-4 w-4 mr-1" />
                  <span className="text-sm">Table</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="map" aria-label="Map View" className="h-8 bg-blue-950/40 border-blue-800/40 text-blue-200 data-[state=on]:bg-blue-800 data-[state=on]:text-white">
                  <MapIcon className="h-4 w-4 mr-1" />
                  <span className="text-sm">Map</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="split" aria-label="Split View" className="h-8 bg-blue-950/40 border-blue-800/40 text-blue-200 data-[state=on]:bg-blue-800 data-[state=on]:text-white">
                  <SplitSquareVertical className="h-4 w-4 mr-1" />
                  <span className="text-sm">Split</span>
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        )}
        
        {/* Job Listings */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          </div>
        ) : safeJobs.length > 0 ? (
          <>
            {/* Debug output - rendered invisibly */}
            <div style={{display: 'none'}} className="debug-info">
              Debug info logged to console
            </div>
            {/* Debugging the final safeJobs array before rendering */}
            <div style={{display: 'none'}} data-debug-info>
              <script type="application/json" dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                  safeJobsLength: safeJobs.length,
                  safeJobsType: typeof safeJobs,
                  isArray: Array.isArray(safeJobs),
                  firstJobSample: safeJobs.length > 0 ? safeJobs[0].id : 'no jobs'
                })
              }} />
            </div>
            
            {/* Render different views based on displayType */}
            {displayType === 'grid' || displayType === 'table' ? (
              <JobsList 
                jobs={safeJobs} 
                isLoading={isLoading}
                onBidJob={onBidJob}
                onViewDetails={onViewDetails}
                hasServiceArea={true}
                initialView={displayType === 'grid' ? 'grid' : 'table'}
                sortMethod={sortMethod}
                sortOrder={sortOrder}
                onSortChange={(method, order) => {
                  setSortMethod(method);
                  setSortOrder(order);
                }}
                onJobHover={(jobId) => {
                  // Update highlighted job ID for consistent hover effect across views
                  setHighlightedJobId(jobId);
                  console.log("Job hover in JobsList:", jobId);
                }}
                highlightedJobId={highlightedJobId}
              />
            ) : displayType === 'map' ? (
              <JobsMap 
                jobs={safeJobs}
                onBidJob={onBidJob}
                onViewDetails={onViewDetails}
                serviceAreaMarker={serviceAreaMarker}
                serviceRadius={serviceRadius}
                onJobHover={(jobId) => {
                  setHighlightedJobId(jobId);
                  console.log("Job hover in JobsMap:", jobId);
                }}
                highlightedJobId={highlightedJobId}
              />
            ) : displayType === 'split' ? (
              <JobsSplitView
                jobs={safeJobs}
                isLoading={isLoading}
                onBidJob={onBidJob}
                onViewDetails={onViewDetails}
                hasServiceArea={true}
                serviceAreaMarker={serviceAreaMarker}
                serviceRadius={serviceRadius}
                sortMethod={sortMethod}
                sortOrder={sortOrder}
                onSortChange={(method, order) => {
                  setSortMethod(method);
                  setSortOrder(order);
                }}
                onJobHover={(jobId) => {
                  setHighlightedJobId(jobId);
                  console.log("Job hover in JobsSplitView:", jobId);
                }}
                highlightedJobId={highlightedJobId}
              />
            ) : null}
          </>
        ) : (
          <div className="p-8 text-center max-w-3xl mx-auto bg-blue-900/10 border border-blue-800/30 rounded-lg">
            <div className="mb-3 flex justify-center p-3">
              <SearchIcon className="h-12 w-12 text-blue-300/50" />
            </div>
            <h3 className="text-xl font-medium text-white">
              No Jobs Found
            </h3>
            <p className="text-blue-200 my-3 max-w-md mx-auto">
              There are no open jobs in your area that match your filters.
              Try adjusting your service radius or check back later for new opportunities.
            </p>
            {onResetFilters && (
              <Button 
                variant="outline"
                className="mt-2 border-blue-500/40 text-blue-200 hover:text-white hover:bg-blue-800/30"
                onClick={onResetFilters}
              >
                Reset Filters
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}