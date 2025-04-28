import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, addDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CalendarDays, PlusCircle, Trash2, Send, ArrowLeft, ArrowRight, MapPin } from "lucide-react";
import { Quote, Job } from "@shared/schema";

// Define JobLocation interface for type safety
interface JobLocation {
  city: string;
  state: string;
  address?: string;
  [key: string]: any;
}

// Extended Job interface with properly typed location
interface ExtendedJob extends Omit<Job, 'location'> {
  location: JobLocation;
}

// Define the schema for quote items
const quoteItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "Quantity must be a positive number",
  }),
  unitPrice: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
    message: "Unit price must be a non-negative number",
  }),
  taxRate: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0 && parseFloat(val) <= 100, {
    message: "Tax rate must be between 0 and 100",
  }),
});

// Define the schema for the quote form
const quoteFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email("Invalid email format").min(1, "Client email is required"),
  clientPhone: z.string().optional(),
  clientAddress: z.string().optional(),
  description: z.string().min(10, "Description should be at least 10 characters"),
  startDate: z.date({
    required_error: "Start date is required",
  }),
  endDate: z.date({
    required_error: "End date is required",
  }),
  items: z.array(quoteItemSchema).min(1, "At least one item is required"),
  notes: z.string().optional(),
  termsAndConditions: z.string().optional(),
  paymentTerms: z.string().min(1, "Payment terms are required"),
  paymentMethods: z.array(z.string()).min(1, "At least one payment method is required"),
});

// Define the type for the form data
type QuoteFormValues = z.infer<typeof quoteFormSchema>;

// Payment method options
const PAYMENT_METHODS = [
  { id: "credit-card", label: "Credit Card" },
  { id: "bank-transfer", label: "Bank Transfer" },
  { id: "paypal", label: "PayPal" },
  { id: "cash", label: "Cash" },
  { id: "check", label: "Check" },
];

// Payment terms options
const PAYMENT_TERMS = [
  { id: "due_on_receipt", label: "Due on Receipt" },
  { id: "net_15", label: "Net 15" },
  { id: "net_30", label: "Net 30" },
  { id: "net_60", label: "Net 60" },
  { id: "custom", label: "Custom" },
];

interface QuoteFormProps {
  quote?: Quote | null;
  job?: ExtendedJob | null;
  contractorId?: number;
  onSave: (data: any) => void;
  onCancel: () => void;
}

export function QuoteForm({ quote, job, contractorId, onSave, onCancel }: QuoteFormProps) {
  const [step, setStep] = useState(1);
  const [totalAmount, setTotalAmount] = useState(0);
  
  // Initialize form with default values or quote data if editing
  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      title: quote?.title || job?.title || "",
      clientName: "",
      clientEmail: "",
      clientPhone: "",
      clientAddress: "",
      description: job?.description || "",
      startDate: new Date(),
      endDate: addDays(new Date(), 7),
      items: [
        {
          description: "",
          quantity: "1",
          unitPrice: "0",
          taxRate: "0"
        }
      ],
      notes: "",
      termsAndConditions: "Standard terms and conditions apply.",
      paymentTerms: "due_on_receipt",
      paymentMethods: ["credit-card"],
    },
  });
  
  // Watch form values to calculate total
  const items = form.watch("items");
  
  // Calculate total amount when items change
  useEffect(() => {
    let total = 0;
    
    items.forEach(item => {
      const quantity = parseFloat(item.quantity) || 0;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      const taxRate = parseFloat(item.taxRate) || 0;
      
      const itemSubtotal = quantity * unitPrice;
      const itemTax = itemSubtotal * (taxRate / 100);
      
      total += itemSubtotal + itemTax;
    });
    
    setTotalAmount(total);
  }, [items]);

  // Add a new item to the form
  const addItem = () => {
    const currentItems = form.getValues("items");
    form.setValue("items", [
      ...currentItems,
      {
        description: "",
        quantity: "1",
        unitPrice: "0",
        taxRate: "0"
      }
    ]);
  };

  // Remove an item from the form
  const removeItem = (index: number) => {
    const currentItems = form.getValues("items");
    if (currentItems.length > 1) {
      form.setValue("items", currentItems.filter((_, i) => i !== index));
    }
  };

  // Handle form submission
  const onSubmit = (data: QuoteFormValues) => {
    // Transform the data for submission
    const transformedItems = data.items.map(item => ({
      description: item.description,
      quantity: parseFloat(item.quantity),
      unitPrice: parseFloat(item.unitPrice),
      taxRate: parseFloat(item.taxRate),
      subtotal: parseFloat(item.quantity) * parseFloat(item.unitPrice),
      tax: (parseFloat(item.quantity) * parseFloat(item.unitPrice)) * (parseFloat(item.taxRate) / 100),
    }));
    
    const formattedData = {
      ...data,
      items: transformedItems,
      totalAmount,
      status: "draft",
      contractorId,
      jobId: job?.id,
    };
    
    onSave(formattedData);
  };

  // Navigation between form steps
  const nextStep = async () => {
    if (step === 1) {
      // Validate first step fields
      const result = await form.trigger(["title", "clientName", "clientEmail", "description", "startDate", "endDate"]);
      if (result) {
        setStep(2);
      }
    } else if (step === 2) {
      // Validate second step fields (items)
      const result = await form.trigger("items");
      if (result) {
        setStep(3);
      }
    }
  };

  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full max-h-[calc(100vh-4rem)]">
      {/* Fixed header with progress bar and tab navigation */}
      <div className="fixed top-0 left-0 right-0 bg-background z-20 border-b shadow-sm">
        <div className="px-6 pt-2">
          <h2 className="text-lg font-semibold pb-2">Create New Quote</h2>
          {/* Top progress indicator */}
          <div className="w-full bg-muted rounded-full h-2 mb-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300 ease-in-out" 
              style={{ width: `${(step / 3) * 100}%` }}
            ></div>
          </div>
        </div>
        
        {/* Simplified step tabs */}
        <div className="flex border-b bg-background">
          <button
            type="button"
            className={`px-6 py-2 font-medium ${step === 1 ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}
            onClick={() => setStep(1)}
          >
            Details
          </button>
          <button
            type="button"
            className={`px-6 py-2 font-medium ${step === 2 ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}
            onClick={() => {
              if (step > 1) setStep(2);
            }}
          >
            Items & Pricing
          </button>
          <button
            type="button"
            className={`px-6 py-2 font-medium ${step === 3 ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}
            onClick={() => {
              if (step > 2) setStep(3);
            }}
          >
            Terms & Review
          </button>
        </div>
      </div>
      
      {/* Main content with extremely minimal top padding */}
      <div className="flex-1 overflow-y-auto pb-20 pr-2 -mr-2 pt-[50px]">
        <div className="px-6">
          
          {/* Step 1: Basic Information - Simplified */}
          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-0">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-base">Quote Title</Label>
                  <Input 
                    id="title"
                    {...form.register("title")}
                    placeholder="e.g. Bathroom Renovation"
                    className="text-lg"
                  />
                  {form.formState.errors.title && (
                    <p className="text-sm text-red-500">{form.formState.errors.title.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-base">Project Description</Label>
                  <Textarea 
                    id="description"
                    {...form.register("description")}
                    placeholder="Describe the project in detail"
                    className="min-h-[120px] text-base"
                  />
                  {form.formState.errors.description && (
                    <p className="text-sm text-red-500">{form.formState.errors.description.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-base">Project Timeline</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Start Date</Label>
                      <Controller 
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal mt-1",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                <CalendarDays className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "MMM d, yyyy") : <span>Start date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        )}
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">End Date</Label>
                      <Controller 
                        control={form.control}
                        name="endDate"
                        render={({ field }) => (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal mt-1",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                <CalendarDays className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "MMM d, yyyy") : <span>End date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                                disabled={(date) => date < form.watch("startDate")}
                              />
                            </PopoverContent>
                          </Popover>
                        )}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="clientName" className="text-base">Client Information</Label>
                  <Card className="p-4 border">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="clientName" className="text-sm text-muted-foreground">Name</Label>
                        <Input 
                          id="clientName"
                          {...form.register("clientName")}
                          placeholder="Client name"
                        />
                        {form.formState.errors.clientName && (
                          <p className="text-sm text-red-500">{form.formState.errors.clientName.message}</p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="clientEmail" className="text-sm text-muted-foreground">Email</Label>
                        <Input 
                          id="clientEmail"
                          {...form.register("clientEmail")}
                          placeholder="client@example.com"
                          type="email"
                        />
                        {form.formState.errors.clientEmail && (
                          <p className="text-sm text-red-500">{form.formState.errors.clientEmail.message}</p>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="clientPhone" className="text-sm text-muted-foreground">Phone (Optional)</Label>
                          <Input 
                            id="clientPhone"
                            {...form.register("clientPhone")}
                            placeholder="(555) 123-4567"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="clientAddress" className="text-sm text-muted-foreground">Location (Optional)</Label>
                          <div className="relative">
                            <Input 
                              id="clientAddress"
                              {...form.register("clientAddress")}
                              placeholder="e.g. Halifax, NS"
                              className="pl-9"
                            />
                            <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
                
                {job && job.location && (
                  <div className="space-y-2">
                    <Label className="text-base">Project Location</Label>
                    <Card className="p-4 border">
                      <div className="flex items-start">
                        <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 mr-2 flex-shrink-0" />
                        <div>
                          <h3 className="font-medium">
                            {job.location.city && job.location.state
                              ? `${job.location.city}, ${job.location.state}` 
                              : 'Location details unavailable'}
                          </h3>
                          {job.location.address && (
                            <p className="text-sm text-muted-foreground">{job.location.address}</p>
                          )}
                        </div>
                      </div>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Step 2: Items and Pricing - Simplified */}
          {step === 2 && (
            <div className="mt-0">
              <div>
                <h3 className="text-base font-medium mb-3">Quote Items</h3>
                <div className="space-y-4 mb-4">
                  {form.watch('items').map((item, index) => (
                    <Card key={index} className="overflow-hidden">
                      <CardHeader className="bg-muted/30 p-4">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-base font-medium">
                            Item {index + 1}{item.description ? `: ${item.description}` : ''}
                          </CardTitle>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => removeItem(index)}
                            disabled={form.watch('items').length <= 1}
                            className="h-8 px-2"
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-sm font-normal">Description</Label>
                            <Input 
                              {...form.register(`items.${index}.description`)}
                              placeholder="Item description"
                            />
                            {form.formState.errors.items?.[index]?.description && (
                              <p className="text-sm text-red-500">
                                {form.formState.errors.items[index]?.description?.message}
                              </p>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label className="text-sm font-normal">Quantity</Label>
                              <Input 
                                {...form.register(`items.${index}.quantity`)}
                                placeholder="0"
                                type="number"
                                min="0"
                                step="1"
                              />
                              {form.formState.errors.items?.[index]?.quantity && (
                                <p className="text-sm text-red-500">
                                  {form.formState.errors.items[index]?.quantity?.message}
                                </p>
                              )}
                            </div>
                            
                            <div className="space-y-2">
                              <Label className="text-sm font-normal">Unit Price ($)</Label>
                              <Input 
                                {...form.register(`items.${index}.unitPrice`)}
                                placeholder="0.00"
                                type="number"
                                min="0"
                                step="0.01"
                              />
                              {form.formState.errors.items?.[index]?.unitPrice && (
                                <p className="text-sm text-red-500">
                                  {form.formState.errors.items[index]?.unitPrice?.message}
                                </p>
                              )}
                            </div>
                            
                            <div className="space-y-2">
                              <Label className="text-sm font-normal">Tax Rate (%)</Label>
                              <Input 
                                {...form.register(`items.${index}.taxRate`)}
                                placeholder="0"
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                              />
                              {form.formState.errors.items?.[index]?.taxRate && (
                                <p className="text-sm text-red-500">
                                  {form.formState.errors.items[index]?.taxRate?.message}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="bg-muted/30 px-4 py-2 flex justify-between border-t">
                        <div className="text-sm text-muted-foreground">
                          Subtotal: ${(
                            (parseFloat(item.quantity) || 0) * 
                            (parseFloat(item.unitPrice) || 0)
                          ).toFixed(2)}
                        </div>
                        <div className="text-sm font-medium">
                          Total: ${(
                            (parseFloat(item.quantity) || 0) * 
                            (parseFloat(item.unitPrice) || 0) * 
                            (1 + (parseFloat(item.taxRate) || 0) / 100)
                          ).toFixed(2)}
                        </div>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
                
                <div className="flex items-center justify-between">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={addItem} 
                    className="flex items-center"
                  >
                    <PlusCircle className="h-4 w-4 mr-2" /> Add Another Item
                  </Button>
                  <div className="text-lg font-bold">
                    Total: <span className="text-primary">${totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Step 3: Terms and Payment */}
          {step === 3 && (
            <div className="px-0 mt-0">  
              {/* Main content with side-by-side layout */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Side (Payment Options and Additional Information) - Takes 2/3 width */}
                <div className="col-span-2">
                  <div className="mb-4">
                    <h3 className="text-base font-medium">Payment Options</h3>
                    <div className="mt-2">
                      <div className="mb-3">
                        <Label htmlFor="paymentTerms" className="text-sm text-muted-foreground block mb-1">Payment Terms</Label>
                        <Controller
                          control={form.control}
                          name="paymentTerms"
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select payment terms" />
                              </SelectTrigger>
                              <SelectContent>
                                {PAYMENT_TERMS.map((term) => (
                                  <SelectItem key={term.id} value={term.id}>
                                    {term.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        {form.formState.errors.paymentTerms && (
                          <p className="text-sm text-red-500 mt-1">{form.formState.errors.paymentTerms.message}</p>
                        )}
                      </div>
                      
                      <div className="mb-3">
                        <Label className="text-sm text-muted-foreground block mb-1">Accepted Payment Methods</Label>
                        <Controller
                          control={form.control}
                          name="paymentMethods"
                          render={({ field }) => (
                            <RadioGroup
                              onValueChange={(value) => field.onChange([value])}
                              defaultValue={field.value[0]}
                              className="grid grid-cols-2 gap-3"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="credit-card" id="credit-card" />
                                <Label htmlFor="credit-card" className="cursor-pointer">Credit Card</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="bank-transfer" id="bank-transfer" />
                                <Label htmlFor="bank-transfer" className="cursor-pointer">Bank Transfer</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="paypal" id="paypal" />
                                <Label htmlFor="paypal" className="cursor-pointer">PayPal</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="cash" id="cash" />
                                <Label htmlFor="cash" className="cursor-pointer">Cash</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="check" id="check" />
                                <Label htmlFor="check" className="cursor-pointer">Check</Label>
                              </div>
                            </RadioGroup>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <h3 className="text-base font-medium mb-2">Additional Information</h3>
                    <div>
                      <div className="mb-3">
                        <Label htmlFor="notes" className="text-sm text-muted-foreground block mb-1">Notes to Client</Label>
                        <Textarea 
                          id="notes"
                          {...form.register("notes")}
                          placeholder="Add any additional notes or comments regarding the quote"
                          className="min-h-[80px]"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="termsAndConditions" className="text-sm text-muted-foreground block mb-1">Terms and Conditions</Label>
                        <Textarea 
                          id="termsAndConditions"
                          {...form.register("termsAndConditions")}
                          placeholder="Add terms and conditions for this quote"
                          className="min-h-[80px]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Right Side (Quote Summary) - Takes 1/3 width */}
                <div className="hidden md:block">
                  <div className="bg-green-50 rounded-lg border border-green-100 sticky top-4">
                    <div className="border-b border-green-100 px-4 py-3">
                      <h2 className="text-lg font-bold">Quote Summary</h2>
                    </div>
                    
                    <div className="p-4 border-b border-green-100">
                      <h3 className="font-semibold mb-3">Quote Details</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span>Title:</span>
                          <span className="font-medium text-right">{form.watch("title")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Client:</span>
                          <span className="font-medium text-right">{form.watch("clientName")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Timeline:</span>
                          <span className="font-medium text-right">
                            {format(form.watch("startDate"), "MMM d, yyyy")} - {format(form.watch("endDate"), "MMM d, yyyy")}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Payment:</span>
                          <span className="font-medium text-right">
                            {PAYMENT_TERMS.find(term => term.id === form.watch("paymentTerms"))?.label || form.watch("paymentTerms")}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 border-b border-green-100">
                      <h3 className="font-semibold mb-3">Items ({form.watch("items").length})</h3>
                      {form.watch("items").map((item, index) => (
                        <div key={index} className="flex justify-between mb-2">
                          <span className="line-clamp-1 flex-1">Item {index + 1}:</span>
                          <span className="font-medium ml-2">
                            ${(parseFloat(item.quantity || "0") * parseFloat(item.unitPrice || "0") * (1 + parseFloat(item.taxRate || "0") / 100)).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="p-4 bg-green-50">
                      <div className="flex justify-between items-center">
                        <span className="font-bold">Total Amount:</span>
                        <span className="font-bold text-lg text-green-700">${totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Mobile-only Quote Summary */}
                <div className="md:hidden w-full col-span-2">
                  <div className="bg-green-50 rounded-lg border border-green-100">
                    <div className="border-b border-green-100 px-4 py-3">
                      <h2 className="text-base font-bold">Quote Summary</h2>
                    </div>
                    
                    <div className="p-4 border-b border-green-100">
                      <h3 className="font-semibold mb-2">Quote Details</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span>Title:</span>
                          <span className="font-medium text-right">{form.watch("title")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Client:</span>
                          <span className="font-medium text-right">{form.watch("clientName")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Timeline:</span>
                          <span className="font-medium text-right">
                            {format(form.watch("startDate"), "MMM d, yyyy")} - {format(form.watch("endDate"), "MMM d, yyyy")}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Payment Terms:</span>
                          <span className="font-medium text-right">
                            {PAYMENT_TERMS.find(term => term.id === form.watch("paymentTerms"))?.label || form.watch("paymentTerms")}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 border-b border-green-100">
                      <h3 className="font-semibold mb-2">Items ({form.watch("items").length})</h3>
                      {form.watch("items").map((item, index) => (
                        <div key={index} className="flex justify-between mb-2">
                          <span className="line-clamp-1 flex-1">
                            Item {index + 1}:
                          </span>
                          <span className="font-medium ml-2">
                            ${(
                              parseFloat(item.quantity || "0") * 
                              parseFloat(item.unitPrice || "0") * 
                              (1 + parseFloat(item.taxRate || "0") / 100)
                            ).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="p-4 bg-green-50">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-lg">Total Amount:</span>
                        <span className="text-xl font-bold text-green-700">${totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Fixed Navigation Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t py-4 px-6 flex justify-between shadow-md z-10">
        {step > 1 ? (
          <Button type="button" variant="outline" onClick={prevStep}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        
        {step < 3 ? (
          <Button type="button" onClick={nextStep}>
            Next <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <div className="space-x-2">
            <Button type="button" variant="outline" onClick={() => onSave({ ...form.getValues(), status: "draft", totalAmount })}>
              Save as Draft
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90">
              <Send className="h-4 w-4 mr-2" /> Save Quote
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}