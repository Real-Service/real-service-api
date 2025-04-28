import { useState, useEffect } from "react";
import { addDays, format, startOfWeek, addWeeks, startOfDay, isSameDay, isBefore, isAfter, isWithinInterval } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight, CalendarDays, Sliders, Filter, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Quote, Job } from "@shared/schema";

interface CalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  type: 'quote' | 'job';
  status: string;
}

interface EventConflict {
  event1: CalendarEvent;
  event2: CalendarEvent;
  conflictDays: string[]; // ISO date strings for conflict days
}

interface ScheduleCalendarProps {
  quotes: any[]; // Quotes data
  jobs: any[]; // Jobs data
  selectedDate?: Date;
  setSelectedDate: (date: Date | undefined) => void;
  onCreateQuote: () => void;
  onViewQuote: (quoteId: number) => void;
}

export function ScheduleCalendar({
  quotes = [],
  jobs = [],
  selectedDate,
  setSelectedDate,
  onCreateQuote,
  onViewQuote
}: ScheduleCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [startDate, setStartDate] = useState<Date>(startOfWeek(currentDate));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [conflicts, setConflicts] = useState<EventConflict[]>([]);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('week');
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [hoveredEvent, setHoveredEvent] = useState<CalendarEvent | null>(null);

  // Parse quotes and jobs into calendar events
  useEffect(() => {
    const calendarEvents: CalendarEvent[] = [];
    
    // Process quotes
    quotes.forEach(quote => {
      if (quote.startDate && quote.endDate) {
        calendarEvents.push({
          id: quote.id,
          title: quote.title,
          start: new Date(quote.startDate),
          end: new Date(quote.endDate),
          type: 'quote',
          status: quote.status
        });
      }
    });
    
    // Process jobs with accepted bids
    jobs.forEach(job => {
      if (job.startDate && job.expectedCompletionDate) {
        calendarEvents.push({
          id: job.id,
          title: job.title,
          start: new Date(job.startDate),
          end: new Date(job.expectedCompletionDate),
          type: 'job',
          status: job.status
        });
      }
    });
    
    setEvents(calendarEvents);
  }, [quotes, jobs]);

  // Detect event conflicts
  useEffect(() => {
    const eventConflicts: EventConflict[] = [];
    
    // Check each event against all other events for overlaps
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const event1 = events[i];
        const event2 = events[j];
        
        // Check if date ranges overlap
        if (
          (isWithinInterval(event1.start, { start: event2.start, end: event2.end }) ||
          isWithinInterval(event1.end, { start: event2.start, end: event2.end }) ||
          isWithinInterval(event2.start, { start: event1.start, end: event1.end }) ||
          isWithinInterval(event2.end, { start: event1.start, end: event1.end }))
        ) {
          // Determine which days specifically overlap
          const conflictDays: string[] = [];
          let currentDay = new Date(Math.max(event1.start.getTime(), event2.start.getTime()));
          const lastDay = new Date(Math.min(event1.end.getTime(), event2.end.getTime()));
          
          while (currentDay <= lastDay) {
            conflictDays.push(format(currentDay, 'yyyy-MM-dd'));
            currentDay = addDays(currentDay, 1);
          }
          
          if (conflictDays.length > 0) {
            eventConflicts.push({
              event1,
              event2,
              conflictDays
            });
          }
        }
      }
    }
    
    setConflicts(eventConflicts);
  }, [events]);

  // Generate calendar data
  const generateCalendarDays = () => {
    if (viewMode === 'week') {
      const days = [];
      for (let i = 0; i < 7; i++) {
        days.push(addDays(startDate, i));
      }
      return days;
    } else {
      // Month view (simplified for now - 4 weeks)
      const days = [];
      for (let i = 0; i < 28; i++) {
        days.push(addDays(startDate, i));
      }
      return days;
    }
  };

  // Navigate forward
  const goNext = () => {
    if (viewMode === 'week') {
      setStartDate(addWeeks(startDate, 1));
    } else {
      setStartDate(addDays(startDate, 28));
    }
  };

  // Navigate backward
  const goPrev = () => {
    if (viewMode === 'week') {
      setStartDate(addWeeks(startDate, -1));
    } else {
      setStartDate(addDays(startDate, -28));
    }
  };

  // Filter events
  const filteredEvents = events.filter(event => {
    if (filterStatus !== "all" && event.status !== filterStatus) {
      return false;
    }
    
    if (filterType !== "all" && event.type !== filterType) {
      return false;
    }
    
    return true;
  });

  // Check if a date has events
  const getEventsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return filteredEvents.filter(event => {
      const eventStart = startOfDay(new Date(event.start));
      const eventEnd = startOfDay(new Date(event.end));
      return isWithinInterval(date, { start: eventStart, end: eventEnd });
    });
  };

  // Check if a date has conflicts
  const getConflictsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return conflicts.filter(conflict => conflict.conflictDays.includes(dateStr));
  };

  // Get status color for event
  const getStatusColor = (status: string, type: string) => {
    if (type === 'quote') {
      switch (status) {
        case 'draft': return "bg-blue-100 text-blue-800 border-blue-300";
        case 'sent': return "bg-orange-100 text-orange-800 border-orange-300";
        case 'viewed': return "bg-purple-100 text-purple-800 border-purple-300";
        case 'accepted': return "bg-green-100 text-green-800 border-green-300";
        case 'rejected': return "bg-red-100 text-red-800 border-red-300";
        case 'revised': return "bg-amber-100 text-amber-800 border-amber-300";
        default: return "bg-gray-100 text-gray-800 border-gray-300";
      }
    } else {
      switch (status) {
        case 'open': return "bg-blue-100 text-blue-800 border-blue-300";
        case 'in_progress': return "bg-amber-100 text-amber-800 border-amber-300";
        case 'completed': return "bg-green-100 text-green-800 border-green-300";
        case 'cancelled': return "bg-red-100 text-red-800 border-red-300";
        default: return "bg-gray-100 text-gray-800 border-gray-300";
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 justify-between">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon" onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <CalendarDays className="mr-2 h-4 w-4" />
                {format(startDate, 'MMMM d, yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) {
                    setSelectedDate(date);
                    setStartDate(startOfWeek(date));
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          
          <Button variant="outline" size="icon" onClick={goNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Select defaultValue={viewMode} onValueChange={(value: 'week' | 'month') => setViewMode(value)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="View" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
            </SelectContent>
          </Select>
          
          <Select defaultValue={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          
          <Select defaultValue={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="quote">Quotes</SelectItem>
              <SelectItem value="job">Jobs</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="sm" onClick={onCreateQuote}>
            <Plus className="h-4 w-4 mr-2" /> Add Quote
          </Button>
        </div>
      </div>
      
      <div className="border rounded-md overflow-hidden">
        {/* Calendar Header */}
        <div className="grid grid-cols-7 bg-muted/50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
            <div 
              key={day} 
              className="text-center p-2 font-medium text-sm border-r last:border-r-0 border-b"
            >
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar Grid */}
        <div className={viewMode === 'week' ? 'grid grid-cols-7' : 'grid grid-cols-7 grid-rows-4'}>
          {generateCalendarDays().map((date, index) => {
            const dateEvents = getEventsForDate(date);
            const dateConflicts = getConflictsForDate(date);
            const isToday = isSameDay(date, new Date());
            const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
            
            return (
              <div 
                key={index}
                className={cn(
                  "min-h-[120px] border-r last:border-r-0 border-b last:border-b-0 p-1",
                  isToday && "bg-blue-50",
                  isSelected && "bg-blue-100"
                )}
                onClick={() => setSelectedDate(date)}
              >
                <div className="text-right mb-1">
                  <span 
                    className={cn(
                      "inline-block rounded-full w-7 h-7 text-center leading-7 text-sm",
                      isToday && "bg-blue-500 text-white font-bold",
                      !isToday && "text-gray-600"
                    )}
                  >
                    {format(date, 'd')}
                  </span>
                </div>
                
                <div className="space-y-1">
                  {dateEvents.map(event => (
                    <div 
                      key={`${event.type}-${event.id}`}
                      className={cn(
                        "text-xs p-1 rounded border cursor-pointer truncate transition-colors",
                        getStatusColor(event.status, event.type),
                        hoveredEvent?.id === event.id && hoveredEvent?.type === event.type && "ring-2 ring-offset-1 ring-primary"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (event.type === 'quote') {
                          onViewQuote(event.id);
                        }
                      }}
                      onMouseEnter={() => setHoveredEvent(event)}
                      onMouseLeave={() => setHoveredEvent(null)}
                    >
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <span className="font-medium">{event.title}</span>
                              {isSameDay(date, event.start) && <Badge variant="outline" className="ml-1 text-[9px] p-0 h-3">Start</Badge>}
                              {isSameDay(date, event.end) && <Badge variant="outline" className="ml-1 text-[9px] p-0 h-3">End</Badge>}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1 text-xs">
                              <p className="font-bold">{event.title}</p>
                              <p>Type: {event.type === 'quote' ? 'Quote' : 'Job'}</p>
                              <p>Status: {event.status}</p>
                              <p>Dates: {format(event.start, 'MMM d')} - {format(event.end, 'MMM d, yyyy')}</p>
                              {dateConflicts.length > 0 && dateConflicts.some(
                                c => (c.event1.id === event.id && c.event1.type === event.type) || 
                                     (c.event2.id === event.id && c.event2.type === event.type)
                              ) && (
                                <p className="text-red-500 font-semibold">⚠️ Scheduling conflict</p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  ))}
                  
                  {dateConflicts.length > 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="text-xs p-1 rounded bg-red-100 text-red-800 border border-red-300 cursor-help">
                            ⚠️ {dateConflicts.length} conflict{dateConflicts.length > 1 ? 's' : ''}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="space-y-2 max-w-xs">
                            <p className="font-bold text-red-500">Scheduling Conflicts:</p>
                            {dateConflicts.map((conflict, i) => (
                              <div key={i} className="text-xs space-y-1 border-t pt-1 first:border-t-0 first:pt-0">
                                <p>• {conflict.event1.title} ({conflict.event1.type})</p>
                                <p>• {conflict.event2.title} ({conflict.event2.type})</p>
                              </div>
                            ))}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}