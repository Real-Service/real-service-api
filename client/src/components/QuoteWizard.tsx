import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, FormProvider } from "react-hook-form";
import { 
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  PlusCircle,
  Trash2,
  Calendar as CalendarIcon,
  Save,
  Send,
  ArrowRight,
  ArrowLeft,
  Check,
  FileText,
  Clock,
  CreditCard,
  PencilLine,
  FileCheck
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { format, addDays, isBefore, isAfter, isSameDay } from "date-fns";
import { z } from "zod";
import { 
  Quote, 
  QuoteLineItem,
  Job,
  quoteFormSchema
} from "@shared/schema";

// Adapt the shared schema for the form (with client-side specific adjustments)
const quoteSchema = z.object({
  title: z.string(),
  jobId: z.number().nullable(),
  landlordId: z.number(),
  contractorId: z.number(),
  validUntil: z.date().nullable(),
  subtotal: z.number().default(0),
  discount: z.number().default(0),
  tax: z.number().default(0),
  total: z.number().default(0),
  notes: z.string().optional(),
  termsAndConditions: z.string().optional(),
  lineItems: z.array(
    z.object({
      id: z.number().optional(),
      description: z.string(),
      quantity: z.number().default(1),
      unitPrice: z.number().default(0),
      total: z.number().default(0),
      sortOrder: z.number().optional(),
    })
  ),
  preferredStartDate: z.date().optional().nullable(),
  estimatedDuration: z.number().default(1).optional(),
  paymentMethods: z.array(z.string()).default(["cash"]),
  quoteNumber: z.string().optional(),
  status: z.enum(["draft", "sent", "viewed", "accepted", "rejected", "expired", "invoiced"]).default("draft"),
});

type QuoteFormValues = z.infer<typeof quoteSchema>;

// Define the available payment methods
const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash' },
  { id: 'check', label: 'Check' },
  { id: 'credit_card', label: 'Credit Card' },
  { id: 'bank_transfer', label: 'Bank Transfer' },
  { id: 'paypal', label: 'PayPal' },
  { id: 'venmo', label: 'Venmo' },
  { id: 'other', label: 'Other' },
];

// Define the wizard steps
type WizardStep = 'job_details' | 'line_items' | 'timeline' | 'payment' | 'review' | 'send';

interface QuoteWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAsDraft: (quote: Quote) => void;
  onSendQuote: (quote: Quote) => void;
  userId: number;
  job?: Job | null;
  quote?: Quote | null;
}

export function QuoteWizard({
  isOpen,
  onClose,
  onSaveAsDraft,
  onSendQuote,
  userId,
  job,
  quote
}: QuoteWizardProps) {
  console.log("QuoteWizard opened with job:", job);
  console.log("QuoteWizard opened with quote:", quote);
  const [currentStep, setCurrentStep] = useState<WizardStep>('job_details');
  const [isEditing, setIsEditing] = useState(!!quote);
  const [jobToQuote, setJobToQuote] = useState<Job | null>(job || null);
  const [quoteData, setQuoteData] = useState<QuoteFormValues | null>(null);
  const [isTimelineSelectorOpen, setIsTimelineSelectorOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();
  
  // Fetch jobs for dropdown
  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ['/api/jobs'],
  });

  // When opening from a specific job, use its ID, otherwise use the first available job ID
  const jobId = job?.id || (jobs.length > 0 ? jobs[0]?.id : null);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Initialize form with default values
  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteSchema),
    defaultValues: quote ? {
      ...quote,
      jobId: quote.jobId || null,
      validUntil: quote.validUntil ? new Date(quote.validUntil) : null,
      lineItems: Array.isArray(quote.lineItems) ? quote.lineItems : [], 
      preferredStartDate: quote.preferredStartDate ? new Date(quote.preferredStartDate) : null,
      paymentMethods: Array.isArray(quote.paymentMethods) ? quote.paymentMethods : [],
    } : {
      title: job?.title ? `Quote for ${job.title}` : "",
      jobId: jobId,
      landlordId: job?.landlordId || 0,
      subtotal: 0,
      discount: 0,
      tax: 0,
      total: 0,
      notes: "",
      termsAndConditions: "",
      validUntil: addDays(new Date(), 30),
      lineItems: [
        {
          description: "",
          quantity: 1,
          unitPrice: 0,
          total: 0,
          sortOrder: 0
        }
      ],
      preferredStartDate: null,
      estimatedDuration: 1,
      paymentMethods: ["cash"],
    }
  });

  // Set up field array for line items
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems"
  });

  // Fetch calendar events
  const { data: calendarEvents = [] } = useQuery<any[]>({
    queryKey: ['/api/contractor-jobs', userId],
    select: (data: any) => {
      const events: any[] = [];
      
      // Add scheduled jobs
      if (data.scheduledJobs) {
        data.scheduledJobs.forEach((job: any) => {
          if (job.startDate) {
            events.push({
              id: job.id,
              title: job.title,
              startDate: job.startDate,
              endDate: job.completionDate || job.estimatedCompletionDate,
              type: 'job',
              status: job.status,
              color: '#3b82f6'
            });
          }
        });
      }
      
      // Add sent quotes
      if (data.quotes) {
        data.quotes.forEach((quote: any) => {
          if (quote.preferredStartDate && quote.estimatedDuration) {
            const startDate = new Date(quote.preferredStartDate);
            const endDate = addDays(startDate, quote.estimatedDuration);
            
            // Only add if it's not the quote being edited
            if (!isEditing || quote.id !== quote?.id) {
              events.push({
                id: quote.id,
                title: quote.title,
                startDate: startDate,
                endDate: endDate,
                type: 'quote',
                status: quote.status,
                color: '#f59e0b'
              });
            }
          }
        });
      }
      
      return events;
    }
  });

  // Add a new line item
  const addLineItem = () => {
    append({
      description: "",
      quantity: 1,
      unitPrice: 0,
      total: 0
    });
  };

  // Update line item total when quantity or price changes
  const updateLineItemTotal = (index: number) => {
    const lineItems = form.getValues().lineItems;
    if (lineItems[index]) {
      const quantity = lineItems[index].quantity || 1;
      const unitPrice = lineItems[index].unitPrice || 0;
      const total = quantity * unitPrice;
      
      // Just set the total field
      form.setValue(`lineItems.${index}.total`, total);
      
      // Trigger recalculation of subtotal, tax, and total
      form.trigger("lineItems");
    }
  };

  // Format date for display
  const formatDateString = (date: Date) => {
    return format(date, "PPP");
  };

  // Get selected job
  const selectedJob = form.getValues().jobId 
    ? jobs.find((job: Job) => job.id === form.getValues().jobId) 
    : null;

  // Handle step changes
  const goToNextStep = () => {
    // Save form data at the current step
    const formData = form.getValues();
    setQuoteData(formData);
    
    // Move to next step
    switch (currentStep) {
      case 'job_details':
        setCurrentStep('line_items');
        break;
      case 'line_items':
        setCurrentStep('timeline');
        break;
      case 'timeline':
        setCurrentStep('payment');
        break;
      case 'payment':
        setCurrentStep('review');
        break;
      case 'review':
        setCurrentStep('send');
        break;
      default:
        break;
    }
  };

  const goToPreviousStep = () => {
    switch (currentStep) {
      case 'line_items':
        setCurrentStep('job_details');
        break;
      case 'timeline':
        setCurrentStep('line_items');
        break;
      case 'payment':
        setCurrentStep('timeline');
        break;
      case 'review':
        setCurrentStep('payment');
        break;
      case 'send':
        setCurrentStep('review');
        break;
      default:
        break;
    }
  };

  // Save quote as draft
  const saveQuoteAsDraft = async () => {
    console.log("Saving quote as draft");
    
    // Get the form values
    const formData = form.getValues();
    
    // Get first available job if none is selected
    const firstJobId = jobs.length > 0 ? jobs[0].id : null; 
    const selectedJobId = formData.jobId || firstJobId;
    
    // Get the selected job to retrieve the landlord ID
    const selectedJob = selectedJobId ? jobs.find(j => j.id === selectedJobId) : null;
    if (!selectedJob || !selectedJob.landlordId) {
      console.error("No valid job with landlord ID found for the quote");
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a valid job with a landlord to create a quote."
      });
      return;
    }
    
    // Ensure numeric fields are not null and job_id is a valid job ID
    const safeFormData = {
      ...formData,
      contractorId: userId, // Ensure contractor ID is set
      landlordId: selectedJob.landlordId, // Get landlord ID from selected job
      subtotal: formData.subtotal ?? 0,
      discount: formData.discount ?? 0,
      tax: formData.tax ?? 0,
      total: formData.total ?? 0,
      estimatedDuration: formData.estimatedDuration ?? 1,
      // If no jobId is provided, use the first job from the available jobs list
      jobId: formData.jobId || firstJobId,
      paymentMethods: Array.isArray(formData.paymentMethods) ? formData.paymentMethods : ["cash"],
      quoteNumber: formData.quoteNumber || `Q-${Date.now().toString().substring(6)}`, // Generate a quote number if not provided
      // Convert Date objects to strings for API
      validUntil: formData.validUntil ? formData.validUntil.toISOString() : null,
      preferredStartDate: formData.preferredStartDate ? formData.preferredStartDate.toISOString() : null,
    };

    try {
      setSubmitting(true);
      console.log("Quote data being sent:", safeFormData);
      
      let responseData;
      // If editing, update the quote
      if (isEditing && quote) {
        const response = await apiRequest("PATCH", `/api/quotes/${quote.id}`, safeFormData);
        responseData = await response.json();
        toast({
          title: "Quote Updated",
          description: "Quote has been saved as a draft."
        });
      } else {
        // Create a new quote
        const response = await apiRequest("POST", "/api/quotes", safeFormData);
        responseData = await response.json();
        toast({
          title: "Quote Created",
          description: "Quote has been saved as a draft."
        });
      }
      
      // Invalidate quotes query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      
      // Close the dialog
      onClose();
      
      // Call the callback with the response data
      if (typeof onSaveAsDraft === 'function' && responseData) {
        onSaveAsDraft(responseData);
      }
    } catch (error: any) {
      console.error("Error saving quote:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: (error.message || error.toString()) || "Failed to save quote."
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Send quote to landlord
  const sendQuoteToLandlord = async () => {
    console.log("Sending quote to landlord");
    
    // Get the form values
    const formData = form.getValues();
    
    // Get first available job if none is selected
    const firstJobId = jobs.length > 0 ? jobs[0].id : null; 
    const selectedJobId = formData.jobId || firstJobId;
    
    // Get the selected job to retrieve the landlord ID
    const selectedJob = selectedJobId ? jobs.find(j => j.id === selectedJobId) : null;
    if (!selectedJob || !selectedJob.landlordId) {
      console.error("No valid job with landlord ID found for the quote");
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a valid job with a landlord to create a quote."
      });
      return;
    }
    
    // Ensure numeric fields are not null and job_id is a valid job ID
    const safeFormData = {
      ...formData,
      contractorId: userId, // Ensure contractor ID is set
      landlordId: selectedJob.landlordId, // Get landlord ID from selected job
      subtotal: formData.subtotal ?? 0,
      discount: formData.discount ?? 0,
      tax: formData.tax ?? 0,
      total: formData.total ?? 0,
      estimatedDuration: formData.estimatedDuration ?? 1,
      // If no jobId is provided, use the first job from the available jobs list
      jobId: selectedJobId,
      paymentMethods: Array.isArray(formData.paymentMethods) ? formData.paymentMethods : ["cash"],
      quoteNumber: formData.quoteNumber || `Q-${Date.now().toString().substring(6)}`, // Generate a quote number if not provided
      // Convert Date objects to strings for API
      validUntil: formData.validUntil ? formData.validUntil.toISOString() : null,
      preferredStartDate: formData.preferredStartDate ? formData.preferredStartDate.toISOString() : null,
    };

    try {
      setSubmitting(true);
      console.log("Quote data being sent:", safeFormData);
      
      let responseData;
      let quoteId;
      
      // If editing, update the quote first
      if (isEditing && quote) {
        const updateResponse = await apiRequest("PATCH", `/api/quotes/${quote.id}`, safeFormData);
        responseData = await updateResponse.json();
        quoteId = quote.id;
        
        // Then send it
        await apiRequest("POST", `/api/quotes/${quoteId}/send`);
      } else {
        // Create a new quote
        const createResponse = await apiRequest("POST", "/api/quotes", safeFormData);
        responseData = await createResponse.json();
        
        // Then send it
        if (responseData && responseData.id) {
          quoteId = responseData.id;
          await apiRequest("POST", `/api/quotes/${quoteId}/send`);
        } else {
          throw new Error("Failed to create quote: Invalid response format");
        }
      }
      
      toast({
        title: "Quote Sent",
        description: "Your quote has been sent to the landlord."
      });
      
      // Invalidate quotes query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      
      // Close the dialog
      onClose();
      
      // Call the callback with the response data
      if (typeof onSendQuote === 'function' && responseData) {
        onSendQuote(responseData);
      }
    } catch (error: any) {
      console.error("Error sending quote:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: (error.message || error.toString()) || "Failed to send quote."
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate totals when line items change
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name?.startsWith('lineItems')) {
        // Calculate subtotal
        const lineItems = form.getValues().lineItems || [];
        const subtotal = lineItems.reduce((sum, item) => sum + (item.total || 0), 0);
        
        form.setValue("subtotal", subtotal);
        
        // Apply tax (if any)
        const taxRate = 0; // Set your tax rate here
        const tax = subtotal * taxRate;
        form.setValue("tax", tax);
        
        // Apply discount (if any)
        const discount = form.getValues().discount || 0;
        
        // Calculate total
        const total = subtotal + tax - discount;
        form.setValue("total", total);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form]);

  // Handle job selection
  const handleJobChange = (jobId: number) => {
    const selectedJob = jobs.find(job => job.id === jobId);
    if (selectedJob) {
      form.setValue("jobId", jobId);
      form.setValue("landlordId", selectedJob.landlordId);
      form.setValue("title", `Quote for ${selectedJob.title}`);
      setJobToQuote(selectedJob);
    }
  };

  // Progress steps with completion status
  const steps = [
    { id: 'job_details', label: 'Job Details', icon: FileText },
    { id: 'line_items', label: 'Line Items', icon: PencilLine },
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'payment', label: 'Payment', icon: CreditCard },
    { id: 'review', label: 'Review', icon: FileCheck },
  ];

  // Render different content based on current step
  const renderStepContent = () => {
    switch (currentStep) {
      case 'job_details':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-blue-100">Quote Title</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Quote for job..." 
                        className="bg-blue-900/50 border-blue-700 text-white placeholder:text-blue-400"
                        {...field} 
                      />
                    </FormControl>
                    {job && (
                      <FormDescription className="text-blue-300">
                        Title is auto-filled from job information
                      </FormDescription>
                    )}
                    <FormMessage className="text-red-300" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="jobId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-blue-100">Job</FormLabel>
                    <Select
                      onValueChange={(value) => handleJobChange(Number(value))}
                      defaultValue={field.value?.toString()}
                      value={field.value?.toString()}
                      disabled={!!jobId || isEditing}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-blue-900/50 border-blue-700 text-white">
                          <SelectValue placeholder="Select a job" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-blue-900 border-blue-700 text-white">
                        {jobs.map((job: Job) => (
                          <SelectItem key={job.id} value={job.id.toString()} className="focus:bg-blue-800 focus:text-white">
                            {job.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {jobId && (
                      <FormDescription className="text-blue-300">
                        Job is pre-selected from quote request
                      </FormDescription>
                    )}
                    <FormMessage className="text-red-300" />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="validUntil"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-blue-100">Valid Until</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal bg-blue-900/50 border-blue-700 text-white",
                            !field.value && "text-blue-400"
                          )}
                        >
                          {field.value ? (
                            formatDateString(field.value)
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-blue-900 border-blue-700" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value || undefined}
                        onSelect={(date) => field.onChange(date)}
                        initialFocus
                        disabled={(date) => date < new Date()}
                        className="bg-blue-900 text-white"
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription className="text-blue-300">
                    The quote will be valid until this date
                  </FormDescription>
                  <FormMessage className="text-red-300" />
                </FormItem>
              )}
            />
          </div>
        );

      case 'line_items':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-blue-100">Line Items</h3>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={addLineItem}
                className="border-blue-700 bg-blue-900/50 text-white hover:bg-blue-800 hover:text-white"
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>

            {fields.map((field, index) => (
              <div key={field.id} className="p-4 border border-blue-700 rounded-md space-y-4 bg-blue-900/30">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-blue-100">Item {index + 1}</h4>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                      className="hover:bg-blue-800/50 text-blue-300 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4 text-red-400 hover:text-red-300" />
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name={`lineItems.${index}.description`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-blue-100">Description</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Service description..." 
                            className="bg-blue-900/50 border-blue-700 text-white placeholder:text-blue-400"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage className="text-red-300" />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name={`lineItems.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-blue-100">Quantity</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="1" 
                              step="1"
                              className="bg-blue-900/50 border-blue-700 text-white"
                              {...field}
                              onChange={(e) => {
                                const value = parseInt(e.target.value) || 0;
                                field.onChange(value < 0 ? 0 : value);
                                updateLineItemTotal(index);
                              }}
                            />
                          </FormControl>
                          <FormMessage className="text-red-300" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`lineItems.${index}.unitPrice`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-blue-100">Unit Price</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              min="0"
                              step="0.01"
                              className="bg-blue-900/50 border-blue-700 text-white"
                              {...field}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0;
                                field.onChange(value < 0 ? 0 : value);
                                updateLineItemTotal(index);
                              }}
                            />
                          </FormControl>
                          <FormMessage className="text-red-300" />
                        </FormItem>
                      )}
                    />

                    {/* Display field for total */}
                    <FormField
                      control={form.control}
                      name={`lineItems.${index}.total`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-blue-100">Amount</FormLabel>
                          <FormControl>
                            <Input 
                              className="text-right bg-blue-800/50 border-blue-700 text-white" 
                              readOnly 
                              {...field}
                              value={formatCurrency(field.value ?? 0)}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-between p-4 border border-blue-700 rounded-md mt-4 bg-blue-900/30">
              <div className="space-y-2 w-full">
                <div className="flex justify-between gap-8">
                  <span className="text-blue-300">Subtotal:</span>
                  <span className="font-medium text-white">{formatCurrency(form.getValues().subtotal)}</span>
                </div>
                
                <div className="flex justify-between gap-8">
                  <span className="text-blue-300">Discount:</span>
                  <FormField
                    control={form.control}
                    name="discount"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <Input 
                            type="number"
                            min="0"
                            step="0.01"
                            className="w-24 text-right bg-blue-900/50 border-blue-700 text-white"
                            {...field}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              field.onChange(value < 0 ? 0 : value);
                              // Recalculate total
                              const subtotal = form.getValues().subtotal;
                              const tax = form.getValues().tax;
                              form.setValue("total", subtotal + tax - value);
                            }}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="flex justify-between gap-8">
                  <span className="text-blue-300">Tax:</span>
                  <FormField
                    control={form.control}
                    name="tax"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <Input 
                            type="number"
                            min="0"
                            step="0.01"
                            className="w-24 text-right bg-blue-900/50 border-blue-700 text-white"
                            {...field}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              field.onChange(value < 0 ? 0 : value);
                              // Recalculate total
                              const subtotal = form.getValues().subtotal;
                              const discount = form.getValues().discount;
                              form.setValue("total", subtotal + value - discount);
                            }}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="flex justify-between pt-2 border-t border-blue-700 gap-8">
                  <span className="font-bold text-blue-100">Total:</span>
                  <span className="font-bold text-white">{formatCurrency(form.getValues().total)}</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'timeline':
        return (
          <div className="space-y-6">
            <div className="border p-4 rounded-md space-y-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-medium">Job Timeline</h3>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsTimelineSelectorOpen(true)}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  View Schedule
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Preferred Start Date */}
                <FormField
                  control={form.control}
                  name="preferredStartDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Preferred Start Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                formatDateString(field.value)
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
                            selected={field.value || undefined}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        When would you like to start this job?
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Duration Estimate */}
                <FormField
                  control={form.control}
                  name="estimatedDuration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Duration (Days)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1" 
                          step="1"
                          {...field}
                          onChange={(e) => {
                            const value = Math.max(1, parseInt(e.target.value) || 1);
                            field.onChange(value);
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        How many days will this job take to complete?
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="mt-2 p-3 bg-muted rounded-md">
                <div className="text-sm text-muted-foreground">
                  <p>Estimated Timeline: 
                    {(() => {
                      const startDate = form.getValues().preferredStartDate;
                      const duration = form.getValues().estimatedDuration || 1;
                      
                      if (startDate) {
                        return (
                          <span className="font-medium ml-2">
                            {formatDateString(startDate)}
                            {duration > 1 ? 
                              ` - ${formatDateString(addDays(startDate, duration))}` 
                              : ''
                            }
                          </span>
                        );
                      }
                      return <span className="ml-2">Not set</span>;
                    })()}
                  </p>
                </div>
              </div>
              
              {/* Schedule conflict warning - only show if there are overlapping events */}
              {(() => {
                const startDate = form.getValues().preferredStartDate;
                const duration = form.getValues().estimatedDuration || 1;
                if (!startDate) return null;
                
                const endDate = addDays(startDate, duration);
                
                // Find all conflicting events
                const conflictingEvents = calendarEvents.filter((event: any) => {
                  const eventStart = new Date(event.startDate);
                  const eventEnd = event.endDate ? new Date(event.endDate) : eventStart;
                  
                  // Check for overlap
                  return (
                    (isBefore(startDate, eventEnd) && isAfter(endDate, eventStart)) ||
                    isSameDay(startDate, eventStart) || 
                    isSameDay(endDate, eventEnd)
                  );
                });
                
                if (conflictingEvents.length === 0) return null;
                
                return (
                  <div className="mt-2 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-md text-amber-800">
                    <div className="flex items-start gap-2">
                      <CalendarIcon className="h-5 w-5 mt-0.5 text-amber-600 flex-shrink-0" />
                      <div className="space-y-2 w-full">
                        <div className="flex justify-between items-start">
                          <h4 className="font-semibold text-amber-900">Schedule Conflict Detected</h4>
                          <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-300 font-medium">
                            {conflictingEvents.length} {conflictingEvents.length === 1 ? 'conflict' : 'conflicts'}
                          </Badge>
                        </div>
                        <p className="text-sm">
                          The selected dates ({format(startDate, 'MMM d')}-{format(endDate, 'MMM d, yyyy')}) 
                          overlap with your existing quotes or jobs.
                        </p>
                        
                        {/* Show first 2 conflicts */}
                        <div className="mt-2 space-y-1.5">
                          {conflictingEvents.slice(0, 2).map((event: any, idx: number) => (
                            <div key={idx} className="text-xs bg-amber-100 rounded-sm p-1.5 flex items-center justify-between">
                              <span className="font-medium">{event.title}</span>
                              <span>{format(new Date(event.startDate), 'MMM d')}
                                {event.endDate && ` - ${format(new Date(event.endDate), 'MMM d')}`}
                              </span>
                            </div>
                          ))}
                          
                          {conflictingEvents.length > 2 && (
                            <div className="text-xs text-center italic">
                              And {conflictingEvents.length - 2} more conflicts...
                            </div>
                          )}
                        </div>
                        
                        <div className="flex justify-between items-center pt-1">
                          <p className="text-xs text-amber-700">
                            Consider choosing different dates to avoid scheduling conflicts.
                          </p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 text-xs border-amber-300 bg-amber-100 hover:bg-amber-200"
                            onClick={() => setIsTimelineSelectorOpen(true)}
                          >
                            View Full Schedule
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        );

      case 'payment':
        return (
          <div className="space-y-6">
            <div className="border p-4 rounded-md">
              <h3 className="text-lg font-medium mb-4">Payment Methods</h3>
              <FormField
                control={form.control}
                name="paymentMethods"
                render={() => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel className="text-base">
                        Accepted Payment Methods
                      </FormLabel>
                      <FormDescription>
                        Select all payment methods you accept for this quote
                      </FormDescription>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {PAYMENT_METHODS.map((method) => (
                        <FormField
                          key={method.id}
                          control={form.control}
                          name="paymentMethods"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={method.id}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(method.id)}
                                    onCheckedChange={(checked) => {
                                      const current = field.value || [];
                                      return checked
                                        ? field.onChange([...current, method.id])
                                        : field.onChange(
                                            current.filter((value) => value !== method.id)
                                          );
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  {method.label}
                                </FormLabel>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="mt-8 space-y-6">
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Add any additional notes for the landlord..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="termsAndConditions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Terms and Conditions</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Add your terms and conditions..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        These will be included in your quote and define the terms of service
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>
        );

      case 'review':
        return (
          <div className="space-y-6">
            <div className="bg-muted/30 p-6 rounded-md">
              <h3 className="text-xl font-medium mb-6">Quote Summary</h3>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Quote Title</h4>
                    <p className="font-medium">{form.getValues().title}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Job</h4>
                    <p className="font-medium">
                      {selectedJob ? selectedJob.title : 'No job selected'}
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Valid Until</h4>
                    <p className="font-medium">
                      {form.getValues().validUntil 
                        ? formatDateString(form.getValues().validUntil) 
                        : 'Not specified'}
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Total Amount</h4>
                    <p className="font-bold text-lg">
                      {formatCurrency(form.getValues().total)}
                    </p>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Line Items</h4>
                  <div className="bg-white rounded-md border overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left p-2 text-xs">Description</th>
                          <th className="text-right p-2 text-xs">Quantity</th>
                          <th className="text-right p-2 text-xs">Unit Price</th>
                          <th className="text-right p-2 text-xs">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.getValues().lineItems.map((item, index) => (
                          <tr key={index} className="border-t">
                            <td className="p-2 text-sm">{item.description}</td>
                            <td className="p-2 text-sm text-right">{item.quantity}</td>
                            <td className="p-2 text-sm text-right">{formatCurrency(item.unitPrice)}</td>
                            <td className="p-2 text-sm text-right">{formatCurrency(item.total)}</td>
                          </tr>
                        ))}
                        <tr className="border-t">
                          <td colSpan={3} className="p-2 text-right text-sm font-medium">Subtotal</td>
                          <td className="p-2 text-right text-sm">{formatCurrency(form.getValues().subtotal)}</td>
                        </tr>
                        {form.getValues().discount > 0 && (
                          <tr className="border-t">
                            <td colSpan={3} className="p-2 text-right text-sm font-medium">Discount</td>
                            <td className="p-2 text-right text-sm">- {formatCurrency(form.getValues().discount)}</td>
                          </tr>
                        )}
                        {form.getValues().tax > 0 && (
                          <tr className="border-t">
                            <td colSpan={3} className="p-2 text-right text-sm font-medium">Tax</td>
                            <td className="p-2 text-right text-sm">{formatCurrency(form.getValues().tax)}</td>
                          </tr>
                        )}
                        <tr className="border-t">
                          <td colSpan={3} className="p-2 text-right text-sm font-bold">Total</td>
                          <td className="p-2 text-right text-sm font-bold">{formatCurrency(form.getValues().total)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Timeline</h4>
                    <div className="bg-white p-3 rounded-md border">
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-xs text-muted-foreground">Start Date</p>
                            <p className="text-sm font-medium">
                              {form.getValues().preferredStartDate
                                ? formatDateString(form.getValues().preferredStartDate)
                                : 'Not specified'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Duration</p>
                            <p className="text-sm font-medium">
                              {form.getValues().estimatedDuration
                                ? `${form.getValues().estimatedDuration} day${form.getValues().estimatedDuration > 1 ? 's' : ''}`
                                : 'Not specified'}
                            </p>
                          </div>
                        </div>
                        
                        {form.getValues().preferredStartDate && form.getValues().estimatedDuration && (
                          <div className="mt-1 p-2 bg-muted rounded-sm text-xs">
                            <span className="text-muted-foreground">Estimated Timeline: </span>
                            <span className="font-medium">
                              {formatDateString(form.getValues().preferredStartDate)}
                              {form.getValues().estimatedDuration > 1
                                ? ` - ${formatDateString(addDays(form.getValues().preferredStartDate, form.getValues().estimatedDuration))}`
                                : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Payment Methods</h4>
                    <div className="bg-white p-3 rounded-md border">
                      {form.getValues().paymentMethods && form.getValues().paymentMethods.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {form.getValues().paymentMethods.map((method) => (
                            <Badge key={method} variant="outline" className="capitalize text-xs">
                              {method.split('_').join(' ')}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No payment methods specified</p>
                      )}
                    </div>
                  </div>
                </div>
                
                {(form.getValues().notes || form.getValues().termsAndConditions) && (
                  <>
                    <Separator />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {form.getValues().notes && (
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">Notes</h4>
                          <div className="bg-white p-3 rounded-md border text-sm whitespace-pre-line">
                            {form.getValues().notes}
                          </div>
                        </div>
                      )}
                      
                      {form.getValues().termsAndConditions && (
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">Terms and Conditions</h4>
                          <div className="bg-white p-3 rounded-md border text-sm whitespace-pre-line">
                            {form.getValues().termsAndConditions}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );

      case 'send':
        return (
          <div className="space-y-6">
            <div className="bg-green-50 p-6 rounded-md border border-green-100">
              <div className="flex items-center justify-center flex-col text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <Check className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-green-800 mb-2">Quote Ready to Send</h3>
                <p className="text-green-700 mb-6 max-w-md">
                  Your quote is ready to be sent to the client. You can save it as a draft or send it now.
                </p>
                
                <div className="bg-white p-4 rounded-md border max-w-md w-full mb-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Quote Title:</span>
                    <span className="text-sm font-medium">{form.getValues().title}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Total Amount:</span>
                    <span className="text-sm font-bold">{formatCurrency(form.getValues().total)}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Timeline:</span>
                    <span className="text-sm">
                      {form.getValues().preferredStartDate
                        ? formatDateString(form.getValues().preferredStartDate)
                        : 'Not specified'}
                      {form.getValues().preferredStartDate && form.getValues().estimatedDuration > 1
                        ? ` - ${formatDateString(addDays(form.getValues().preferredStartDate, form.getValues().estimatedDuration))}`
                        : ''}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Valid Until:</span>
                    <span className="text-sm">
                      {form.getValues().validUntil
                        ? formatDateString(form.getValues().validUntil)
                        : 'Not specified'}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={saveQuoteAsDraft}
                    disabled={submitting}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save as Draft
                  </Button>
                  
                  <Button
                    type="button"
                    onClick={sendQuoteToLandlord}
                    disabled={submitting}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send Quote
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Handle dialog closing
  const handleCloseDialog = (open: boolean) => {
    console.log("Dialog close requested, open state:", open);
    if (!open && onClose && typeof onClose === 'function') {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCloseDialog}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-blue-950 text-white border-blue-800" onEscapeKeyDown={(e) => { e.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle className="text-white">{isEditing ? "Edit Quote" : "Create New Quote"}</DialogTitle>
        </DialogHeader>

        {/* Progress steps */}
        <div className="relative mb-6">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-blue-800 -translate-y-1/2" />
          <div className="relative flex justify-between">
            {steps.map((step, index) => {
              const isActive = steps.findIndex(s => s.id === currentStep) >= index;
              const isCurrent = step.id === currentStep;
              
              return (
                <div key={step.id} className="flex flex-col items-center z-10">
                  <div 
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center mb-1 border-2",
                      isActive 
                        ? "bg-blue-700 border-blue-600 text-white" 
                        : "bg-blue-900 border-blue-800 text-blue-300"
                    )}
                  >
                    {isCurrent ? (
                      <div className="w-2 h-2 rounded-full bg-blue-200" />
                    ) : (
                      <step.icon className="h-4 w-4" />
                    )}
                  </div>
                  <span 
                    className={cn(
                      "text-xs whitespace-nowrap", 
                      isCurrent ? "font-medium text-blue-300" : "text-blue-400"
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <Form {...form}>
          <form className="space-y-6">
            {renderStepContent()}
          </form>
        </Form>

        {/* Buttons */}
        <div className="flex justify-between mt-6 border-t border-blue-800 pt-6">
          {currentStep !== 'job_details' && (
            <Button
              type="button"
              variant="outline"
              onClick={goToPreviousStep}
              disabled={submitting}
              className="border-blue-700 bg-blue-900/50 text-white hover:bg-blue-800 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}
          
          <div className="flex space-x-2">
            {currentStep !== 'send' && (
              <Button
                type="button"
                variant="outline"
                onClick={saveQuoteAsDraft}
                disabled={submitting}
                className="border-blue-700 bg-blue-900/50 text-white hover:bg-blue-800 hover:text-white"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
            )}
            
            {currentStep !== 'send' && (
              <Button
                type="button"
                onClick={goToNextStep}
                disabled={submitting}
                className="bg-blue-700 hover:bg-blue-600 text-white"
              >
                {currentStep === 'review' ? (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Next
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}