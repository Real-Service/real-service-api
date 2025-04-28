import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { JobSchedule, Job } from "@shared/schema";
import { CalendarIcon, Clock } from "lucide-react";

interface EditJobScheduleFormProps {
  jobSchedule: JobSchedule;
  job?: Job;
  onCancel: () => void;
  onComplete: () => void;
}

const formSchema = z.object({
  jobId: z.number({
    required_error: "Job is required",
  }),
  startDate: z.date({
    required_error: "Start date is required",
  }),
  endDate: z.date({
    required_error: "End date is required",
  }),
  startTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "Start time must be in 24-hour format (HH:MM)",
  }).optional().nullable(),
  endTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "End time must be in 24-hour format (HH:MM)",
  }).optional().nullable(),
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"], {
    required_error: "Status is required",
  }),
  isAllDay: z.boolean().default(false),
  note: z.string().optional(),
}).refine(data => {
  return data.startDate <= data.endDate;
}, {
  message: "End date must be on or after start date",
  path: ["endDate"],
}).refine(data => {
  if (data.isAllDay) return true;
  if (!data.startTime || !data.endTime) return true;
  
  // Convert HH:MM times to minutes for comparison
  const [startHour, startMinute] = data.startTime.split(':').map(Number);
  const [endHour, endMinute] = data.endTime.split(':').map(Number);
  
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  startDate.setHours(startHour, startMinute, 0, 0);
  endDate.setHours(endHour, endMinute, 0, 0);
  
  return endDate > startDate;
}, {
  message: "End time must be after start time",
  path: ["endTime"],
});

type FormValues = z.infer<typeof formSchema>;

export function EditJobScheduleForm({ jobSchedule, job, onCancel, onComplete }: EditJobScheduleFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { data: jobs = [] } = useQuery({
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
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jobId: jobSchedule.jobId,
      startDate: new Date(jobSchedule.startDate),
      endDate: new Date(jobSchedule.endDate),
      startTime: jobSchedule.startTime || null,
      endTime: jobSchedule.endTime || null,
      status: jobSchedule.status as "scheduled" | "in_progress" | "completed" | "cancelled",
      isAllDay: jobSchedule.isAllDay,
      note: jobSchedule.note || "",
    },
  });
  
  const isAllDay = form.watch("isAllDay");

  const updateJobScheduleMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return apiRequest(`/api/calendar/job-schedules/${jobSchedule.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          jobId: data.jobId,
          startDate: data.startDate.toISOString(),
          endDate: data.endDate.toISOString(),
          startTime: data.isAllDay ? null : data.startTime,
          endTime: data.isAllDay ? null : data.endTime,
          status: data.status,
          isAllDay: data.isAllDay,
          note: data.note || null,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Schedule Updated",
        description: "The job schedule has been updated successfully.",
      });
      onComplete();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update job schedule. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const onSubmit = (data: FormValues) => {
    setIsSubmitting(true);
    updateJobScheduleMutation.mutate(data);
  };

  // Get job title
  const getJobTitle = (jobId: number) => {
    const foundJob = jobs.find(job => job.id === jobId);
    return foundJob ? foundJob.title : `Job #${jobId}`;
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="jobId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Job</FormLabel>
              <Select 
                onValueChange={(value) => field.onChange(parseInt(value))} 
                defaultValue={field.value.toString()}
                disabled={true} // Don't allow changing the job
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a job" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {jobs.map((job) => (
                    <SelectItem key={job.id} value={job.id.toString()}>
                      {job.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                This schedule is for {getJobTitle(field.value)}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Start Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>End Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={form.control}
          name="isAllDay"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>All Day</FormLabel>
                <FormDescription>
                  This schedule applies to the entire day(s)
                </FormDescription>
              </div>
            </FormItem>
          )}
        />
        
        {!isAllDay && (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="startTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Time (24h)</FormLabel>
                  <FormControl>
                    <div className="flex items-center">
                      <Clock className="mr-2 h-4 w-4 text-gray-400" />
                      <Input 
                        placeholder="HH:MM" 
                        {...field} 
                        value={field.value || ""}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="endTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End Time (24h)</FormLabel>
                  <FormControl>
                    <div className="flex items-center">
                      <Clock className="mr-2 h-4 w-4 text-gray-400" />
                      <Input 
                        placeholder="HH:MM" 
                        {...field} 
                        value={field.value || ""}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}
        
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Note (Optional)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Add any notes about this schedule..."
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="flex justify-end space-x-2">
          <Button variant="outline" type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Updating..." : "Update Schedule"}
          </Button>
        </div>
      </form>
    </Form>
  );
}