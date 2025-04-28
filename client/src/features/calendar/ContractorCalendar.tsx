import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { TimeSlot, JobSchedule, Job } from "@shared/schema";
import { Plus, Calendar, Clock, Filter } from "lucide-react";
import { AvailabilityForm } from "./AvailabilityForm";
import { TimeSlotDetails } from "./TimeSlotDetails";
import { JobScheduleDetails } from "./JobScheduleDetails";
import { cn } from "@/lib/utils";
import { format, isSameDay, isSameMonth, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";

export function ContractorCalendar() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  
  // States for modals
  const [isAvailabilityFormOpen, setIsAvailabilityFormOpen] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
  const [selectedJobSchedule, setSelectedJobSchedule] = useState<JobSchedule | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState("month"); // month, list
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Query parameters for data fetching
  const startDate = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const endDate = format(endOfMonth(currentMonth), "yyyy-MM-dd");
  
  // Fetch time slots
  const { data: timeSlots = [], isLoading: isLoadingTimeSlots, refetch: refetchTimeSlots } = useQuery({
    queryKey: ['/api/calendar/time-slots', startDate, endDate],
    queryFn: async () => {
      try {
        const response = await apiRequest(`/api/calendar/time-slots?startDate=${startDate}&endDate=${endDate}`, {});
        return response?.data || [];
      } catch (error) {
        console.error("Error fetching time slots:", error);
        return [];
      }
    },
  });
  
  // Fetch job schedules
  const { data: jobSchedules = [], isLoading: isLoadingJobSchedules, refetch: refetchJobSchedules } = useQuery({
    queryKey: ['/api/calendar/job-schedules', startDate, endDate],
    queryFn: async () => {
      try {
        const response = await apiRequest(`/api/calendar/job-schedules?startDate=${startDate}&endDate=${endDate}`, {});
        return response?.data || [];
      } catch (error) {
        console.error("Error fetching job schedules:", error);
        return [];
      }
    },
  });
  
  // Fetch jobs for the user (to display job details)
  const { data: jobs = [], isLoading: isLoadingJobs } = useQuery({
    queryKey: ['/api/jobs'],
    queryFn: async () => {
      try {
        const response = await apiRequest('/api/jobs', {});
        return response?.data || [];
      } catch (error) {
        console.error("Error fetching jobs:", error);
        return [];
      }
    },
  });
  
  // Helper function to get date cell information
  const getDateCellInfo = (date: Date) => {
    // Time slots on this date
    const dateSlotsAvailable = timeSlots.filter(slot => 
      isSameDay(new Date(slot.date), date) && slot.status === 'available'
    );
    
    const dateSlotsUnavailable = timeSlots.filter(slot => 
      isSameDay(new Date(slot.date), date) && slot.status === 'unavailable'
    );
    
    const dateSlotsTentative = timeSlots.filter(slot => 
      isSameDay(new Date(slot.date), date) && slot.status === 'tentative'
    );
    
    // Job schedules on this date
    const dateJobSchedules = jobSchedules.filter(schedule => 
      (isSameDay(new Date(schedule.startDate), date) || 
       isSameDay(new Date(schedule.endDate), date) ||
       (new Date(schedule.startDate) <= date && new Date(schedule.endDate) >= date))
    );
    
    return {
      isAvailable: dateSlotsAvailable.length > 0,
      isUnavailable: dateSlotsUnavailable.length > 0,
      isTentative: dateSlotsTentative.length > 0,
      hasJobSchedules: dateJobSchedules.length > 0,
      timeSlots: [...dateSlotsAvailable, ...dateSlotsUnavailable, ...dateSlotsTentative],
      jobSchedules: dateJobSchedules,
    };
  };
  
  // Navigate between months
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  
  // Handle day click
  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    
    // Get time slots and job schedules for the selected date
    const { timeSlots: dateSlotsData, jobSchedules: dateJobSchedulesData } = getDateCellInfo(date);
    
    // If there's only one time slot, show its details directly
    if (dateSlotsData.length === 1 && dateJobSchedulesData.length === 0) {
      setSelectedTimeSlot(dateSlotsData[0]);
    }
    // If there's only one job schedule, show its details directly
    else if (dateJobSchedulesData.length === 1 && dateSlotsData.length === 0) {
      setSelectedJobSchedule(dateJobSchedulesData[0]);
    }
    // Otherwise, just select the date (we'll show a list of items for that date)
  };
  
  // Handle updating the calendar data after changes
  const handleCalendarDataUpdate = () => {
    refetchTimeSlots();
    refetchJobSchedules();
    setSelectedTimeSlot(null);
    setSelectedJobSchedule(null);
    setIsAvailabilityFormOpen(false);
  };
  
  // Filter time slots and job schedules based on status filter
  const filteredTimeSlots = timeSlots.filter(slot => {
    if (statusFilter === 'all') return true;
    return slot.status === statusFilter;
  });
  
  const filteredJobSchedules = jobSchedules.filter(schedule => {
    if (statusFilter === 'all') return true;
    return schedule.status === statusFilter;
  });
  
  // Get selected date's data
  const selectedDateData = selectedDate ? getDateCellInfo(selectedDate) : null;
  
  // Functions to lookup job details using job ID from job schedules
  const getJobForSchedule = (jobId: number) => {
    return jobs.find(job => job.id === jobId);
  };
  
  return (
    <div className="container mx-auto py-6">
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Contractor Calendar</CardTitle>
              <CardDescription>
                Manage your availability and job schedules
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button onClick={() => setIsAvailabilityFormOpen(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" /> Add Availability
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
      
      <Tabs defaultValue="month" value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="month">
              <Calendar className="h-4 w-4 mr-2" /> Month View
            </TabsTrigger>
            <TabsTrigger value="list">
              <Clock className="h-4 w-4 mr-2" /> List View
            </TabsTrigger>
          </TabsList>
          
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="unavailable">Unavailable</SelectItem>
                <SelectItem value="tentative">Tentative</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <TabsContent value="month" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">
                  {format(currentMonth, 'MMMM yyyy')}
                </h3>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={prevMonth}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" onClick={nextMonth}>
                    Next
                  </Button>
                </div>
              </div>
              
              <CalendarUI
                mode="single"
                selected={selectedDate}
                onSelect={handleDayClick}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                className="rounded-md border"
                components={{
                  day: ({ day, ...props }) => {
                    const { 
                      isAvailable, 
                      isUnavailable,
                      isTentative,
                      hasJobSchedules,
                      timeSlots,
                      jobSchedules
                    } = getDateCellInfo(day);
                    
                    // Determine the color class based on availability status
                    let colorClass = '';
                    if (isAvailable) colorClass = 'bg-green-50 hover:bg-green-100';
                    if (isUnavailable) colorClass = 'bg-red-50 hover:bg-red-100';
                    if (isTentative) colorClass = 'bg-yellow-50 hover:bg-yellow-100';
                    
                    return (
                      <div
                        onClick={() => handleDayClick(day)}
                        className={cn(
                          "h-full w-full p-0 font-normal aria-selected:opacity-100",
                          props.className,
                          colorClass,
                          isSameMonth(day, currentMonth) ? "text-primary" : "text-muted-foreground opacity-50",
                          hasJobSchedules && "border-primary border-2" // Highlight days with job schedules
                        )}
                      >
                        <div className="p-2 text-right">
                          {format(day, 'd')}
                        </div>
                        {/* Show indicators for the types of events */}
                        <div className="flex gap-1 p-1 justify-end">
                          {isAvailable && (
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                          )}
                          {isUnavailable && (
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                          )}
                          {isTentative && (
                            <div className="w-2 h-2 rounded-full bg-yellow-500" />
                          )}
                          {hasJobSchedules && (
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                          )}
                        </div>
                      </div>
                    );
                  }
                }}
              />
            </CardContent>
          </Card>
          
          {selectedDate && selectedDateData && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {format(selectedDate, 'MMMM d, yyyy')}
                </CardTitle>
                <CardDescription>
                  {selectedDateData.timeSlots.length > 0 && `${selectedDateData.timeSlots.length} availability slot(s)`}
                  {selectedDateData.timeSlots.length > 0 && selectedDateData.jobSchedules.length > 0 && ' · '}
                  {selectedDateData.jobSchedules.length > 0 && `${selectedDateData.jobSchedules.length} job schedule(s)`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedDateData.timeSlots.length === 0 && selectedDateData.jobSchedules.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground">No events or availability scheduled for this day.</p>
                    <Button onClick={() => setIsAvailabilityFormOpen(true)} className="mt-2">
                      Add Availability
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedDateData.timeSlots.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Availability</h4>
                        <div className="space-y-2">
                          {selectedDateData.timeSlots.map(slot => (
                            <div 
                              key={slot.id} 
                              className={cn(
                                "p-3 rounded-md cursor-pointer hover:bg-gray-50",
                                slot.status === 'available' && "border-l-4 border-green-500",
                                slot.status === 'unavailable' && "border-l-4 border-red-500",
                                slot.status === 'tentative' && "border-l-4 border-yellow-500"
                              )}
                              onClick={() => setSelectedTimeSlot(slot)}
                            >
                              <div className="flex justify-between">
                                <span className="font-medium">
                                  {slot.startTime} - {slot.endTime}
                                </span>
                                <span className={cn(
                                  "text-sm px-2 py-0.5 rounded-full",
                                  slot.status === 'available' && "bg-green-100 text-green-800",
                                  slot.status === 'unavailable' && "bg-red-100 text-red-800",
                                  slot.status === 'tentative' && "bg-yellow-100 text-yellow-800"
                                )}>
                                  {slot.status.charAt(0).toUpperCase() + slot.status.slice(1)}
                                </span>
                              </div>
                              {slot.note && (
                                <p className="text-sm text-gray-500 mt-1">{slot.note}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {selectedDateData.jobSchedules.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Job Schedules</h4>
                        <div className="space-y-2">
                          {selectedDateData.jobSchedules.map(schedule => {
                            const job = getJobForSchedule(schedule.jobId);
                            const jobTitle = job ? job.title : `Job #${schedule.jobId}`;
                            
                            return (
                              <div 
                                key={schedule.id} 
                                className={cn(
                                  "p-3 rounded-md cursor-pointer hover:bg-gray-50",
                                  schedule.status === 'scheduled' && "border-l-4 border-blue-500",
                                  schedule.status === 'in_progress' && "border-l-4 border-indigo-500",
                                  schedule.status === 'completed' && "border-l-4 border-green-500",
                                  schedule.status === 'cancelled' && "border-l-4 border-red-500"
                                )}
                                onClick={() => setSelectedJobSchedule(schedule)}
                              >
                                <div className="flex justify-between">
                                  <span className="font-medium">
                                    {jobTitle}
                                  </span>
                                  <span className={cn(
                                    "text-sm px-2 py-0.5 rounded-full",
                                    schedule.status === 'scheduled' && "bg-blue-100 text-blue-800",
                                    schedule.status === 'in_progress' && "bg-indigo-100 text-indigo-800",
                                    schedule.status === 'completed' && "bg-green-100 text-green-800",
                                    schedule.status === 'cancelled' && "bg-red-100 text-red-800"
                                  )}>
                                    {schedule.status.split('_').map(word => 
                                      word.charAt(0).toUpperCase() + word.slice(1)
                                    ).join(' ')}
                                  </span>
                                </div>
                                <div className="text-sm text-gray-500 mt-1">
                                  {format(new Date(schedule.startDate), 'MMM d')} - {format(new Date(schedule.endDate), 'MMM d')}
                                  {!schedule.isAllDay && schedule.startTime && schedule.endTime && 
                                    ` · ${schedule.startTime} - ${schedule.endTime}`
                                  }
                                </div>
                                {schedule.note && (
                                  <p className="text-sm text-gray-500 mt-1">{schedule.note}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Events</CardTitle>
              <CardDescription>
                All your availability and job schedules
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="availability">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="availability">Availability</TabsTrigger>
                  <TabsTrigger value="jobs">Job Schedules</TabsTrigger>
                </TabsList>
                
                <TabsContent value="availability" className="pt-4">
                  {filteredTimeSlots.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground">No availability time slots found.</p>
                      <Button onClick={() => setIsAvailabilityFormOpen(true)} className="mt-2">
                        Add Availability
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredTimeSlots
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                        .map(slot => (
                          <div 
                            key={slot.id} 
                            className={cn(
                              "p-3 rounded-md cursor-pointer hover:bg-gray-50 border",
                              slot.status === 'available' && "border-l-4 border-green-500",
                              slot.status === 'unavailable' && "border-l-4 border-red-500",
                              slot.status === 'tentative' && "border-l-4 border-yellow-500"
                            )}
                            onClick={() => setSelectedTimeSlot(slot)}
                          >
                            <div className="flex justify-between">
                              <span className="font-medium">
                                {format(new Date(slot.date), 'EEEE, MMMM d, yyyy')}
                              </span>
                              <span className={cn(
                                "text-sm px-2 py-0.5 rounded-full",
                                slot.status === 'available' && "bg-green-100 text-green-800",
                                slot.status === 'unavailable' && "bg-red-100 text-red-800",
                                slot.status === 'tentative' && "bg-yellow-100 text-yellow-800"
                              )}>
                                {slot.status.charAt(0).toUpperCase() + slot.status.slice(1)}
                              </span>
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              {slot.startTime} - {slot.endTime}
                            </div>
                            {slot.note && (
                              <p className="text-sm text-gray-500 mt-1">{slot.note}</p>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="jobs" className="pt-4">
                  {filteredJobSchedules.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground">No job schedules found.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredJobSchedules
                        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                        .map(schedule => {
                          const job = getJobForSchedule(schedule.jobId);
                          const jobTitle = job ? job.title : `Job #${schedule.jobId}`;
                          
                          return (
                            <div 
                              key={schedule.id} 
                              className={cn(
                                "p-3 rounded-md cursor-pointer hover:bg-gray-50 border",
                                schedule.status === 'scheduled' && "border-l-4 border-blue-500",
                                schedule.status === 'in_progress' && "border-l-4 border-indigo-500",
                                schedule.status === 'completed' && "border-l-4 border-green-500",
                                schedule.status === 'cancelled' && "border-l-4 border-red-500"
                              )}
                              onClick={() => setSelectedJobSchedule(schedule)}
                            >
                              <div className="flex justify-between">
                                <span className="font-medium">
                                  {jobTitle}
                                </span>
                                <span className={cn(
                                  "text-sm px-2 py-0.5 rounded-full",
                                  schedule.status === 'scheduled' && "bg-blue-100 text-blue-800",
                                  schedule.status === 'in_progress' && "bg-indigo-100 text-indigo-800",
                                  schedule.status === 'completed' && "bg-green-100 text-green-800",
                                  schedule.status === 'cancelled' && "bg-red-100 text-red-800"
                                )}>
                                  {schedule.status.split('_').map(word => 
                                    word.charAt(0).toUpperCase() + word.slice(1)
                                  ).join(' ')}
                                </span>
                              </div>
                              <div className="text-sm text-gray-500 mt-1">
                                {format(new Date(schedule.startDate), 'MMMM d, yyyy')} - {format(new Date(schedule.endDate), 'MMMM d, yyyy')}
                                {!schedule.isAllDay && schedule.startTime && schedule.endTime && 
                                  ` · ${schedule.startTime} - ${schedule.endTime}`
                                }
                              </div>
                              {schedule.note && (
                                <p className="text-sm text-gray-500 mt-1">{schedule.note}</p>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Dialog for Time Slot Details */}
      <Dialog open={!!selectedTimeSlot} onOpenChange={(open) => !open && setSelectedTimeSlot(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogTitle>Time Slot Details</DialogTitle>
          {selectedTimeSlot && (
            <TimeSlotDetails
              timeSlot={selectedTimeSlot}
              onClose={() => setSelectedTimeSlot(null)}
              onDelete={handleCalendarDataUpdate}
              onUpdate={handleCalendarDataUpdate}
            />
          )}
        </DialogContent>
      </Dialog>
      
      {/* Dialog for Job Schedule Details */}
      <Dialog open={!!selectedJobSchedule} onOpenChange={(open) => !open && setSelectedJobSchedule(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogTitle>Job Schedule Details</DialogTitle>
          {selectedJobSchedule && (
            <JobScheduleDetails
              jobSchedule={selectedJobSchedule}
              job={getJobForSchedule(selectedJobSchedule.jobId)}
              onClose={() => setSelectedJobSchedule(null)}
              onDelete={handleCalendarDataUpdate}
              onUpdate={handleCalendarDataUpdate}
            />
          )}
        </DialogContent>
      </Dialog>
      
      {/* Dialog for Add Availability Form */}
      <Dialog open={isAvailabilityFormOpen} onOpenChange={setIsAvailabilityFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogTitle>Add Availability</DialogTitle>
          <AvailabilityForm
            onClose={() => setIsAvailabilityFormOpen(false)}
            onComplete={handleCalendarDataUpdate}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}