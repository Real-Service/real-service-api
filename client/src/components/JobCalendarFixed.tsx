import React, { useState, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Job, Bid } from '@shared/schema';
import { format, isValid, isSameDay } from 'date-fns';
import { 
  MapPin, 
  Clock, 
  Calendar as CalendarIcon, 
  DollarSign, 
  User, 
  Info, 
  ChevronRight, 
  AlertCircle, 
  CheckCircle2,
  MessageSquare
} from 'lucide-react';

interface JobCalendarProps {
  jobs: Job[];
  bids?: Bid[];
  userType: 'landlord' | 'contractor';
  onViewJobDetails?: (job: Job) => void;
  onViewBidDetails?: (bid: Bid) => void;
}

export function JobCalendar({ jobs, bids = [], userType, onViewJobDetails, onViewBidDetails }: JobCalendarProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isJobDetailsOpen, setIsJobDetailsOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [openPopoverDate, setOpenPopoverDate] = useState<Date | null>(null);

  // Filter jobs with valid dates 
  const getJobsWithDates = () => {
    return jobs.filter(job => {
      // Check various date fields
      const startDateValid = job.startDate && isValid(new Date(job.startDate as string));
      const deadlineValid = job.deadline && isValid(new Date(job.deadline as string));
      
      return startDateValid || deadlineValid;
    });
  };

  // Filter bids with valid dates
  const getBidsWithDates = () => {
    return bids.filter(bid => {
      const proposedStartDateValid = bid.proposedStartDate && isValid(new Date(bid.proposedStartDate as string));
      return proposedStartDateValid;
    });
  };

  // Group jobs and bids by date
  const buildDateToItemsMap = () => {
    const dateMap: Record<string, { jobs: Job[], bids: Bid[] }> = {};
    
    // Initialize with empty arrays
    const initializeDate = (dateStr: string) => {
      if (!dateMap[dateStr]) {
        dateMap[dateStr] = { jobs: [], bids: [] };
      }
    };

    // Add jobs to map
    getJobsWithDates().forEach(job => {
      // Helper function to safely process dates
      const addJobToDate = (dateValue: any) => {
        if (!dateValue) return;
        
        try {
          const date = new Date(dateValue);
          if (isValid(date)) {
            const dateStr = format(date, 'yyyy-MM-dd');
            initializeDate(dateStr);
            dateMap[dateStr].jobs.push(job);
          }
        } catch (e) {
          console.log('Invalid date:', dateValue);
        }
      };
      
      // Add job to all relevant dates
      addJobToDate(job.startDate);
      addJobToDate(job.deadline);
    });

    // Add bids to map
    getBidsWithDates().forEach(bid => {
      // Helper function to safely process proposed start dates
      const addBidToDate = (dateValue: any) => {
        if (!dateValue) return;
        
        try {
          const date = new Date(dateValue);
          if (isValid(date)) {
            const dateStr = format(date, 'yyyy-MM-dd');
            initializeDate(dateStr);
            dateMap[dateStr].bids.push(bid);
          }
        } catch (e) {
          console.log('Invalid bid date:', dateValue);
        }
      };
      
      // Add bid to the proposed start date
      addBidToDate(bid.proposedStartDate);
    });
    
    return dateMap;
  };

  const dateItemsMap = buildDateToItemsMap();

  // Get jobs and bids for a specific date
  const getItemsForDate = (date: Date | null): { jobs: Job[], bids: Bid[] } => {
    if (!date) return { jobs: [], bids: [] };
    const dateStr = format(date, 'yyyy-MM-dd');
    return dateItemsMap[dateStr] || { jobs: [], bids: [] };
  };

  // Handle view job details
  const handleViewJob = (job: Job) => {
    setSelectedJob(job);
    setIsJobDetailsOpen(true);
    
    if (onViewJobDetails) {
      onViewJobDetails(job);
    }
  };

  // Handle view bid details
  const handleViewBid = (bid: Bid) => {
    if (onViewBidDetails) {
      onViewBidDetails(bid);
    }
  };

  // Get status badge for a job
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { bg: string; text: string }> = {
      draft: { bg: 'bg-gray-100', text: 'text-gray-800' },
      open: { bg: 'bg-blue-100', text: 'text-blue-800' },
      in_progress: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
      completed: { bg: 'bg-green-100', text: 'text-green-800' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-800' },
      // Bid statuses
      pending: { bg: 'bg-orange-100', text: 'text-orange-800' },
      accepted: { bg: 'bg-green-100', text: 'text-green-800' },
      rejected: { bg: 'bg-red-100', text: 'text-red-800' },
    };

    const style = statusMap[status] || { bg: 'bg-gray-100', text: 'text-gray-800' };

    return (
      <Badge className={`${style.bg} ${style.text} border-0`}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  // Enhanced date class names
  const getDateClassNames = (date: Date): string => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const items = dateItemsMap[dateStr] || { jobs: [], bids: [] };
    const { jobs: jobsOnDay, bids: bidsOnDay } = items;
    
    // If no jobs or bids on this day, return empty string (default styling)
    if (jobsOnDay.length === 0 && bidsOnDay.length === 0) return "";
    
    // Check for different types of items on this day
    const hasOngoingJobs = jobsOnDay.some(job => job.status === 'in_progress');
    const hasDeadlines = jobsOnDay.some(job => {
      if (!job.deadline) return false;
      try {
        const deadlineDate = new Date(job.deadline.toString());
        return isValid(deadlineDate) && isSameDay(deadlineDate, date);
      } catch (e) {
        return false;
      }
    });
    
    const hasStartDates = jobsOnDay.some(job => {
      if (!job.startDate) return false;
      try {
        const startDate = new Date(job.startDate.toString());
        return isValid(startDate) && isSameDay(startDate, date);
      } catch (e) {
        return false;
      }
    });
    
    const hasPendingBids = bidsOnDay.some(bid => bid.status === 'pending');
    
    // Custom classes for different item types
    if (hasOngoingJobs) {
      return "bg-blue-100 text-blue-700 font-medium hover:bg-blue-200 hover:text-blue-800";
    } else if (hasDeadlines) {
      return "bg-red-50 text-red-700 font-medium hover:bg-red-100 hover:text-red-800";
    } else if (hasStartDates) {
      return "bg-green-50 text-green-700 font-medium hover:bg-green-100 hover:text-green-800";
    } else if (hasPendingBids) {
      return "bg-orange-50 text-orange-700 font-medium hover:bg-orange-100 hover:text-orange-800";
    } else {
      return "bg-gray-50 font-medium hover:bg-gray-100";
    }
  };

  // Enhanced day content - add indicators without custom rendering
  const getDayContent = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const items = dateItemsMap[dateStr] || { jobs: [], bids: [] };
    const { jobs: jobsOnDay, bids: bidsOnDay } = items;
    
    if (jobsOnDay.length === 0 && bidsOnDay.length === 0) return null;
    
    // Check for different types of items on this day
    const hasOngoingJobs = jobsOnDay.some(job => job.status === 'in_progress');
    const hasDeadlines = jobsOnDay.some(job => {
      if (!job.deadline) return false;
      try {
        const deadlineDate = new Date(job.deadline as string);
        return isValid(deadlineDate) && isSameDay(deadlineDate, day);
      } catch (e) {
        return false;
      }
    });
    
    const hasStartDates = jobsOnDay.some(job => {
      if (!job.startDate) return false;
      try {
        const startDate = new Date(job.startDate as string);
        return isValid(startDate) && isSameDay(startDate, day);
      } catch (e) {
        return false;
      }
    });
    
    const hasPendingBids = bidsOnDay.some(bid => bid.status === 'pending');
    
    return (
      <div className="flex gap-[2px]">
        {hasDeadlines && (
          <span className="block h-[6px] w-[6px] rounded-full bg-red-500 shadow-sm" aria-hidden="true"></span>
        )}
        {hasOngoingJobs && (
          <span className="block h-[6px] w-[6px] rounded-full bg-blue-500 shadow-sm" aria-hidden="true"></span>
        )}
        {hasStartDates && !hasOngoingJobs && (
          <span className="block h-[6px] w-[6px] rounded-full bg-green-500 shadow-sm" aria-hidden="true"></span>
        )}
        {hasPendingBids && (
          <span className="block h-[6px] w-[6px] rounded-full bg-orange-500 shadow-sm" aria-hidden="true"></span>
        )}
      </div>
    );
  };

  // Date click handler
  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    
    setDate(date);
    const items = getItemsForDate(date);
    if (items.jobs.length > 0 || items.bids.length > 0) {
      setOpenPopoverDate(date);
    }
  };
  
  // Popover for showing jobs and bids on a specific date
  const DatePopover = () => {
    if (!openPopoverDate) return null;
    
    const items = getItemsForDate(openPopoverDate);
    const { jobs: jobsOnDay, bids: bidsOnDay } = items;
    const hasItems = jobsOnDay.length > 0 || bidsOnDay.length > 0;
    
    if (!hasItems) return null;
    
    return (
      <Popover open={openPopoverDate !== null}>
        <PopoverContent 
          className="w-[400px] p-0 drop-shadow-xl" 
          side="top" 
          align="center"
          sideOffset={5}
          onInteractOutside={() => setOpenPopoverDate(null)}
        >
          <div className="p-4 border-b bg-gradient-to-r from-primary/20 to-primary/5">
            <h3 className="font-medium text-lg flex items-center">
              <CalendarIcon className="h-4 w-4 mr-2 text-primary" />
              {format(openPopoverDate, 'EEEE, MMMM d, yyyy')}
            </h3>
            <div className="flex items-center mt-1">
              <p className="text-sm text-muted-foreground">
                {jobsOnDay.length > 0 && `${jobsOnDay.length} ${jobsOnDay.length === 1 ? 'job' : 'jobs'}`}
                {jobsOnDay.length > 0 && bidsOnDay.length > 0 && ' and '}
                {bidsOnDay.length > 0 && `${bidsOnDay.length} ${bidsOnDay.length === 1 ? 'bid' : 'bids'}`}
              </p>
            </div>
          </div>
          <div className="max-h-[350px] overflow-y-auto divide-y">
            {/* Jobs section */}
            {jobsOnDay.length > 0 && (
              <div className="p-2 bg-muted/30">
                <h4 className="font-medium text-sm text-muted-foreground px-2">
                  Jobs
                </h4>
              </div>
            )}
            {jobsOnDay.map(job => (
              <div 
                key={`job-${job.id}`}
                className="p-4 hover:bg-muted cursor-pointer transition-all duration-200 border-l-4 border-transparent hover:border-l-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenPopoverDate(null);
                  handleViewJob(job);
                }}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="font-medium">{job.title}</h4>
                      {getStatusBadge(job.status)}
                    </div>
                    
                    {/* Status indicators for current date */}
                    <div className="flex flex-wrap items-center text-xs mt-1.5 gap-2">
                      {/* Show deadline indicator if this date matches the deadline */}
                      {job.deadline && isSameDay(new Date(job.deadline as string), openPopoverDate) && (
                        <div className="flex items-center text-red-600 font-medium">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Due today
                        </div>
                      )}
                      
                      {/* Show start date indicator if this date matches the start date */}
                      {job.startDate && isSameDay(new Date(job.startDate as string), openPopoverDate) && (
                        <div className="flex items-center text-green-600 font-medium">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Starts today
                        </div>
                      )}
                    </div>
                    
                    {/* Job details */}
                    <div className="flex flex-wrap items-center text-xs text-muted-foreground mt-2 gap-3">
                      {job.city && job.state && (
                        <div className="flex items-center">
                          <MapPin className="h-3 w-3 mr-1" />
                          {job.city}, {job.state}
                        </div>
                      )}
                      
                      {job.budget && (
                        <div className="flex items-center">
                          <DollarSign className="h-3 w-3 mr-1" />
                          ${job.budget.toFixed(2)}
                        </div>
                      )}
                    </div>
                    
                    {/* Description preview */}
                    {job.description && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        {job.description}
                      </p>
                    )}
                    
                    {/* Category tags */}
                    {job.categoryTags && job.categoryTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {job.categoryTags.slice(0, 2).map((tag, i) => (
                          <Badge key={i} variant="outline" className="text-xs px-1.5 py-0">
                            {tag}
                          </Badge>
                        ))}
                        {job.categoryTags.length > 2 && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0">
                            +{job.categoryTags.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full hover:bg-muted-foreground/10"
                    aria-label="View job details"
                  >
                    <ChevronRight className="h-4 w-4 text-primary/70" />
                  </Button>
                </div>
              </div>
            ))}
            
            {/* Bids section */}
            {bidsOnDay.length > 0 && (
              <div className="p-2 bg-muted/30">
                <h4 className="font-medium text-sm text-muted-foreground px-2">
                  Bids
                </h4>
              </div>
            )}
            {bidsOnDay.map(bid => (
              <div 
                key={`bid-${bid.id}`}
                className="p-4 hover:bg-muted cursor-pointer transition-all duration-200 border-l-4 border-transparent hover:border-l-orange-500"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenPopoverDate(null);
                  handleViewBid(bid);
                }}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="font-medium">Bid #{bid.id}</h4>
                      {getStatusBadge(bid.status)}
                    </div>
                    
                    {/* Bid details */}
                    <div className="flex flex-wrap items-center text-xs text-muted-foreground mt-2 gap-3">
                      <div className="flex items-center">
                        <DollarSign className="h-3 w-3 mr-1" />
                        ${bid.amount.toFixed(2)}
                      </div>
                      
                      {bid.proposedStartDate && (
                        <div className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          Start: {format(new Date(bid.proposedStartDate), 'MMM d, yyyy')}
                        </div>
                      )}
                    </div>
                    
                    {/* Bid proposal preview */}
                    {bid.proposal && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        {bid.proposal}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full hover:bg-muted-foreground/10"
                    aria-label="View bid details"
                  >
                    <ChevronRight className="h-4 w-4 text-primary/70" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="p-2 border-t bg-muted/10 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setOpenPopoverDate(null)}
            >
              Close
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  // Group cards for easier viewing
  const ongoingProjects = jobs.filter(job => job.status === 'in_progress');
  
  const pendingBids = bids.filter(bid => bid.status === 'pending');
  
  const upcomingDeadlines = jobs.filter(job => {
    if (!job.deadline) return false;
    try {
      const deadlineDate = new Date(job.deadline as string);
      return isValid(deadlineDate) && deadlineDate > new Date();
    } catch (e) {
      console.log('Invalid deadline date in filter:', job.deadline);
      return false;
    }
  }).sort((a, b) => {
    try {
      const aDate = a.deadline ? new Date(a.deadline as string) : new Date();
      const bDate = b.deadline ? new Date(b.deadline as string) : new Date();
      return aDate.getTime() - bDate.getTime();
    } catch (e) {
      console.log('Error sorting deadlines:', e);
      return 0;
    }
  }).slice(0, 5);

  return (
    <div className="space-y-4 w-full overflow-hidden">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Project Calendar</CardTitle>
          <CardDescription>
            Click on highlighted dates to see what's happening that day
          </CardDescription>
        </CardHeader>
        
        <div className="p-3 sm:p-4">
          <div className="mx-auto max-w-[800px]">
            <div className="flex mb-3 items-center justify-center text-xs sm:text-sm flex-wrap gap-2">
              <div className="flex items-center mr-2 sm:mr-3">
                <span className="block h-2.5 sm:h-3 w-2.5 sm:w-3 rounded-full bg-blue-500 mr-1 sm:mr-1.5"></span>
                <span>In Progress</span>
              </div>
              <div className="flex items-center mr-2 sm:mr-3">
                <span className="block h-2.5 sm:h-3 w-2.5 sm:w-3 rounded-full bg-red-500 mr-1 sm:mr-1.5"></span>
                <span>Deadline</span>
              </div>
              <div className="flex items-center mr-2 sm:mr-3">
                <span className="block h-2.5 sm:h-3 w-2.5 sm:w-3 rounded-full bg-green-500 mr-1 sm:mr-1.5"></span>
                <span>Start Date</span>
              </div>
              <div className="flex items-center">
                <span className="block h-2.5 sm:h-3 w-2.5 sm:w-3 rounded-full bg-orange-500 mr-1 sm:mr-1.5"></span>
                <span>Pending Bid</span>
              </div>
            </div>
            <Calendar
              mode="single"
              selected={date}
              onSelect={handleDateSelect}
              className="rounded-md border w-full shadow-sm"
              modifiers={{
                highlighted: (date) => {
                  const items = getItemsForDate(date);
                  return items.jobs.length > 0 || items.bids.length > 0;
                }
              }}
              modifiersClassNames={{
                highlighted: "font-medium"
              }}
              classNames={{
                day_highlighted: (date) => getDateClassNames(date),
                table: "w-full border-collapse",
                head_row: "flex",
                head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] md:text-xs",
                row: "flex w-full mt-2",
                cell: "h-9 w-9 md:h-10 md:w-10 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                day: "h-9 w-9 md:h-10 md:w-10 p-0 aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground rounded-md"
              }}
              components={{
                DayContent: (props) => (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <span>{props.date.getDate()}</span>
                    <div className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2">
                      {getDayContent(props.date)}
                    </div>
                  </div>
                )
              }}
            />
            <DatePopover />
          </div>
        </div>
      </Card>
    </div>
  );
}