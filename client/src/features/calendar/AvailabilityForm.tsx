import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Clock } from "lucide-react";

interface AvailabilityFormProps {
  onClose: () => void;
  onComplete: () => void;
}

const formSchema = z.object({
  date: z.date({
    required_error: "Date is required",
  }),
  startTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "Start time must be in 24-hour format (HH:MM)",
  }),
  endTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "End time must be in 24-hour format (HH:MM)",
  }),
  status: z.enum(["available", "unavailable", "tentative"], {
    required_error: "Status is required",
  }),
  repeatWeekly: z.boolean().default(false),
  repeatCount: z.number().min(1).max(12).optional(),
  note: z.string().optional(),
}).refine(data => {
  // Convert HH:MM times to minutes for comparison
  const [startHour, startMinute] = data.startTime.split(':').map(Number);
  const [endHour, endMinute] = data.endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  
  return endMinutes > startMinutes;
}, {
  message: "End time must be after start time",
  path: ["endTime"],
}).refine(data => {
  // If repeatWeekly is true, repeatCount must be provided
  if (data.repeatWeekly && !data.repeatCount) {
    return false;
  }
  return true;
}, {
  message: "Number of weeks to repeat is required",
  path: ["repeatCount"],
});

type FormValues = z.infer<typeof formSchema>;

export function AvailabilityForm({ onClose, onComplete }: AvailabilityFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      startTime: "09:00",
      endTime: "17:00",
      status: "available",
      repeatWeekly: false,
      note: "",
    },
  });

  const createTimeSlotMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return apiRequest('/api/calendar/time-slots', {
        method: 'POST',
        body: JSON.stringify({
          date: data.date.toISOString(),
          startTime: data.startTime,
          endTime: data.endTime,
          status: data.status,
          repeatWeekly: data.repeatWeekly,
          repeatCount: data.repeatWeekly ? data.repeatCount : null,
          note: data.note || null,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Availability Added",
        description: "Your availability has been added successfully.",
      });
      onComplete();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add availability. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const onSubmit = (data: FormValues) => {
    setIsSubmitting(true);
    createTimeSlotMutation.mutate(data);
  };

  const repeatWeekly = form.watch("repeatWeekly");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Date</FormLabel>
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
        
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Time</FormLabel>
                <FormControl>
                  <div className="flex items-center">
                    <Clock className="mr-2 h-4 w-4 text-gray-400" />
                    <Input placeholder="HH:MM" {...field} />
                  </div>
                </FormControl>
                <FormDescription>
                  24-hour format (e.g., 09:00)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="endTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Time</FormLabel>
                <FormControl>
                  <div className="flex items-center">
                    <Clock className="mr-2 h-4 w-4 text-gray-400" />
                    <Input placeholder="HH:MM" {...field} />
                  </div>
                </FormControl>
                <FormDescription>
                  24-hour format (e.g., 17:00)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
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
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="unavailable">Unavailable</SelectItem>
                  <SelectItem value="tentative">Tentative</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="repeatWeekly"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Repeat Weekly</FormLabel>
                <FormDescription>
                  Create this time slot for multiple weeks
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
        
        {repeatWeekly && (
          <FormField
            control={form.control}
            name="repeatCount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Repeat for how many weeks?</FormLabel>
                <FormControl>
                  <div className="flex items-center">
                    <Input 
                      type="number" 
                      min={1} 
                      max={12} 
                      {...field} 
                      onChange={e => field.onChange(parseInt(e.target.value) || undefined)}
                      value={field.value || ""}
                    />
                  </div>
                </FormControl>
                <FormDescription>
                  Maximum 12 weeks
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        
        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Note (Optional)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Add any notes about this availability..."
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="flex justify-end space-x-2">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Adding..." : "Add Availability"}
          </Button>
        </div>
      </form>
    </Form>
  );
}