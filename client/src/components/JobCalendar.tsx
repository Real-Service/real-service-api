import React, { useState, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Job, JobLocation, ExtendedJob } from '@shared/schema';
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
  CheckCircle2 
} from 'lucide-react';

interface JobCalendarProps {
  jobs: Job[];
  userType: 'landlord' | 'contractor';
  onViewJobDetails?: (job: Job) => void;
}

export function JobCalendar({ jobs, userType, onViewJobDetails }: JobCalendarProps) {
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
      const proposedStartDateValid = job.proposedStartDate && isValid(new Date(job.proposedStartDate as string));
      
      return startDateValid || deadlineValid || proposedStartDateValid;
    });
  };

  // Group jobs by date
  const buildDateToJobsMap = () => {
    const jobsMap: Record<string, Job[]> = {};
    
    getJobsWithDates().forEach(job => {
      // Helper function to safely process dates
      const addJobToDate = (dateValue: any) => {
        if (!dateValue) return;
        
        try {
          const date = new Date(dateValue);
          if (isValid(date)) {
            const dateStr = format(date, 'yyyy-MM-dd');
            jobsMap[dateStr] = [...(jobsMap[dateStr] || []), job];
          }
        } catch (e) {
          console.log('Invalid date:', dateValue);
        }
      };
      
      // Add job to all relevant dates
      addJobToDate(job.startDate);
      addJobToDate(job.deadline);
      
      // Only add to proposedStartDate if neither startDate nor deadline exists
      if (!job.startDate && !job.deadline) {
        addJobToDate(job.proposedStartDate);
      }
    });
    
    return jobsMap;
  };

  const jobsByDate = buildDateToJobsMap();

  // Get jobs for a specific date
  const getJobsForDate = (date: Date | null): Job[] => {
    if (!date) return [];
    const dateStr = format(date, 'yyyy-MM-dd');
    return jobsByDate[dateStr] || [];
  };

  // Handle view job details
  const handleViewJob = (job: Job) => {
    setSelectedJob(job);
    setIsJobDetailsOpen(true);
    
    if (onViewJobDetails) {
      onViewJobDetails(job);
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
    };

    const style = statusMap[status] || { bg: 'bg-gray-100', text: 'text-gray-800' };

    return (
      <Badge className={`${style.bg} ${style.text} border-0`}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  // Enhanced date content renderer - instead of replacing the day component
  const getDateClassNames = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const jobsOnDay = jobsByDate[dateStr] || [];
    
    if (jobsOnDay.length === 0) return "";
    
    // Safely check each job's dates
    const hasOngoingJobs = jobsOnDay.some(job => job.status === 'in_progress');
    const hasDeadlines = jobsOnDay.some(job => {
      if (!job.deadline) return false;
      try {
        const deadlineDate = new Date(job.deadline as string);
        return isValid(deadlineDate) && isSameDay(deadlineDate, date);
      } catch (e) {
        return false;
      }
    });
    
    const hasStartDates = jobsOnDay.some(job => {
      if (!job.startDate) return false;
      try {
        const startDate = new Date(job.startDate as string);
        return isValid(startDate) && isSameDay(startDate, date);
      } catch (e) {
        return false;
      }
    });
    
    // Custom classes for different job types
    if (hasOngoingJobs) {
      return "bg-blue-100 text-blue-700 font-medium hover:bg-blue-200 hover:text-blue-800";
    } else if (hasDeadlines) {
      return "bg-red-50 text-red-700 font-medium hover:bg-red-100 hover:text-red-800";
    } else if (hasStartDates) {
      return "bg-green-50 text-green-700 font-medium hover:bg-green-100 hover:text-green-800";
    } else {
      return "bg-gray-50 font-medium hover:bg-gray-100";
    }
  };

  // Enhanced day content - add indicators without custom rendering
  const getDayContent = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const jobsOnDay = jobsByDate[dateStr] || [];
    if (jobsOnDay.length === 0) return null;
    
    // Safely check each job's dates
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
    
    return (
      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 flex gap-1">
        {hasDeadlines && (
          <span className="block h-2 w-2 rounded-full bg-red-500 shadow-sm" aria-hidden="true"></span>
        )}
        {hasOngoingJobs && (
          <span className="block h-2 w-2 rounded-full bg-blue-500 shadow-sm" aria-hidden="true"></span>
        )}
        {hasStartDates && !hasOngoingJobs && (
          <span className="block h-2 w-2 rounded-full bg-green-500 shadow-sm" aria-hidden="true"></span>
        )}
      </div>
    );
  };

  // Date click handler
  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    
    setDate(date);
    const selectedJobs = getJobsForDate(date);
    if (selectedJobs.length > 0) {
      setOpenPopoverDate(date);
    }
  };
  
  // Popover for showing jobs on a specific date
  const DatePopover = () => {
    if (!openPopoverDate) return null;
    
    const jobsOnDay = getJobsForDate(openPopoverDate);
    const day = openPopoverDate; // Define the day variable
    
    return (
      <Popover open={openPopoverDate !== null}>
        <PopoverContent 
          className="w-[400px] p-0 drop-shadow-xl" 
          side="top" 
          align="center"
          sideOffset={5}
          onInteractOutside={() => setOpenPopoverDate(null)}
        >
        {jobsOnDay.length > 0 && (
          <div className="w-full">
            <div className="p-4 border-b bg-gradient-to-r from-primary/20 to-primary/5">
              <h3 className="font-medium text-lg flex items-center">
                <CalendarIcon className="h-4 w-4 mr-2 text-primary" />
                {format(day, 'EEEE, MMMM d, yyyy')}
              </h3>
              <div className="flex items-center mt-1">
                <p className="text-sm text-muted-foreground">
                  {jobsOnDay.length} {jobsOnDay.length === 1 ? 'job' : 'jobs'} scheduled
                </p>
              </div>
            </div>
            <div className="max-h-[350px] overflow-y-auto divide-y">
              {jobsOnDay.map(job => (
                <div 
                  key={job.id} 
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
                        {job.deadline && isSameDay(new Date(job.deadline as string), day) && (
                          <div className="flex items-center text-red-600 font-medium">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Due today
                          </div>
                        )}
                        
                        {/* Show start date indicator if this date matches the start date */}
                        {job.startDate && isSameDay(new Date(job.startDate as string), day) && (
                          <div className="flex items-center text-green-600 font-medium">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Starts today
                          </div>
                        )}
                      </div>
                      
                      {/* Job details */}
                      <div className="flex flex-wrap items-center text-xs text-muted-foreground mt-2 gap-3">
                        {job.location && job.location.city && job.location.state && (
                          <div className="flex items-center">
                            <MapPin className="h-3 w-3 mr-1" />
                            {job.location.city}, {job.location.state}
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
          </div>
        )}
        </PopoverContent>
      </Popover>
    );
  };

  // Get ongoing and upcoming jobs
  const ongoingProjects = jobs.filter(job => job.status === 'in_progress');
  
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
      if (!isValid(aDate) || !isValid(bDate)) return 0;
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
        
        <div className="p-4">
          <div className="mx-auto max-w-[800px]">
            <div className="flex mb-2 items-center justify-center text-sm">
              <div className="flex items-center mr-3">
                <span className="block h-3 w-3 rounded-full bg-blue-500 mr-1.5"></span>
                <span>In Progress</span>
              </div>
              <div className="flex items-center mr-3">
                <span className="block h-3 w-3 rounded-full bg-red-500 mr-1.5"></span>
                <span>Deadline</span>
              </div>
              <div className="flex items-center">
                <span className="block h-3 w-3 rounded-full bg-green-500 mr-1.5"></span>
                <span>Start Date</span>
              </div>
            </div>
            <Calendar
              mode="single"
              selected={date}
              onSelect={(selectedDate) => {
                setDate(selectedDate);
                if (selectedDate) {
                  const selectedJobs = getJobsForDate(selectedDate);
                  if (selectedJobs.length > 0) {
                    setOpenPopoverDate(selectedDate);
                  }
                }
              }}
              className="rounded-md border w-full shadow-sm"
              modifiers={{
                highlighted: (date) => getJobsForDate(date).length > 0
              }}
              modifiersClassNames={{
                highlighted: "font-medium"
              }}
              disabled={{
                before: new Date(2020, 0, 1) // Allow all dates after 2020
              }}
              styles={{
                month: { width: '100%' },
                caption: { width: '100%' },
                caption_label: { fontSize: '1rem', fontWeight: 'bold' },
                table: { width: '100%' },
                head_cell: { 
                  padding: '0.5rem 0', 
                  fontSize: '0.85rem',
                  fontWeight: 'bold' 
                },
                cell: { 
                  padding: '0.25rem',
                },
                nav_button: { padding: '0.25rem' },
                root: { maxWidth: '100%' }
              }}
/>
            <p className="text-center text-sm text-muted-foreground mt-2">
              Click on a highlighted date to see project details
            </p>
            
            {/* Add date popover for showing events on a date */}
            <DatePopover />
          </div>
        </div>
      </Card>

      {/* Job details dialog */}
      <Dialog open={isJobDetailsOpen} onOpenChange={setIsJobDetailsOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[650px] p-0">
          {selectedJob && (
            <>
              <div className="sticky top-0 z-10 bg-white border-b p-6 pb-4">
                <DialogHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
                    <DialogTitle className="text-xl md:text-2xl font-bold">
                      {selectedJob.title}
                    </DialogTitle>
                    {getStatusBadge(selectedJob.status)}
                  </div>
                  <DialogDescription className="mt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedJob.startDate && (
                        <div className="flex items-center text-green-600">
                          <CalendarIcon className="h-4 w-4 mr-1.5" />
                          Start: {(() => {
                            try {
                              const date = new Date(selectedJob.startDate as string);
                              return isValid(date) ? format(date, 'MMM d, yyyy') : 'Invalid date';
                            } catch (e) {
                              return 'Invalid date';
                            }
                          })()}
                        </div>
                      )}
                      {selectedJob.deadline && (
                        <div className="flex items-center text-red-600">
                          <Clock className="h-4 w-4 mr-1.5" />
                          Due: {(() => {
                            try {
                              const date = new Date(selectedJob.deadline as string);
                              return isValid(date) ? format(date, 'MMM d, yyyy') : 'Invalid date';
                            } catch (e) {
                              return 'Invalid date';
                            }
                          })()}
                        </div>
                      )}
                    </div>
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="p-6 pt-4">
                {/* Key details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-4">
                    {/* Location */}
                    <div className="bg-muted/30 p-4 rounded-lg">
                      <div className="flex items-center mb-2">
                        <MapPin className="h-4 w-4 mr-2 text-primary" />
                        <h3 className="font-medium">Location</h3>
                      </div>
                      <p className="text-sm">
                        {selectedJob.location?.address && (
                          <>
                            {selectedJob.location.address},<br />
                          </>
                        )}
                        {selectedJob.location?.city || "No location"}, {selectedJob.location?.state} {selectedJob.location?.zip}
                      </p>
                    </div>
                    
                    {/* Budget */}
                    <div className="bg-muted/30 p-4 rounded-lg">
                      <div className="flex items-center mb-2">
                        <DollarSign className="h-4 w-4 mr-2 text-primary" />
                        <h3 className="font-medium">Budget</h3>
                      </div>
                      <p className="text-2xl font-bold">
                        {selectedJob.budget ? `$${selectedJob.budget.toFixed(2)}` : 'Open Budget'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Time Estimate */}
                    <div className="bg-muted/30 p-4 rounded-lg">
                      <div className="flex items-center mb-2">
                        <Clock className="h-4 w-4 mr-2 text-primary" />
                        <h3 className="font-medium">Time Estimate</h3>
                      </div>
                      <p className="text-sm font-medium">
                        {selectedJob.timeEstimate || 'Not specified'}
                      </p>
                    </div>

                    {/* Progress */}
                    {selectedJob.progress !== null && selectedJob.progress !== undefined && (
                      <div className="bg-muted/30 p-4 rounded-lg">
                        <div className="flex items-center mb-2">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-primary" />
                          <h3 className="font-medium">Progress</h3>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="h-2.5 flex-1 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 rounded-full" 
                              style={{ width: `${selectedJob.progress}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-semibold min-w-[40px] text-right">{selectedJob.progress}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div className="mb-6">
                  <h3 className="font-medium flex items-center mb-3 text-primary">
                    <Info className="h-4 w-4 mr-2" />
                    Project Description
                  </h3>
                  <div className="p-4 bg-muted/20 rounded-lg text-sm whitespace-pre-wrap">
                    {selectedJob.description}
                  </div>
                </div>

                {/* Categories */}
                {selectedJob.categoryTags && (selectedJob.categoryTags as string[]).length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-medium mb-3 text-primary flex items-center">
                      <User className="h-4 w-4 mr-2" />
                      Categories
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {(selectedJob.categoryTags as string[]).map((tag: string, i: number) => (
                        <Badge key={i} variant="outline" className="px-3 py-1 bg-muted/30">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="px-6 py-4 border-t bg-muted/10">
                <Button 
                  className="w-full sm:w-auto"
                  onClick={() => setIsJobDetailsOpen(false)}
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}