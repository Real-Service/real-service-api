import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User as UserType } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ProfilePictureUpload } from "./ProfilePictureUpload";
import { Loader2, PlusCircle, X } from "lucide-react";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface ProfileSettingsProps {
  user: UserType;
  onClose?: () => void;
}

// Portfolio item schema
const portfolioItemSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  imageUrl: z.string(),
});

// Define the schema for contractor profile form
const contractorProfileFormSchema = z.object({
  // User basic info
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().optional(),
  bio: z.string().optional(),
  
  // Contractor specific fields
  skills: z.array(z.string()).optional(),
  newSkill: z.string().optional(),
  trades: z.array(z.string()).optional(),
  newTrade: z.string().optional(),
  experience: z.string().optional(),
  hourlyRate: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
  hasLiabilityInsurance: z.boolean().optional(),
  insuranceCoverage: z.string().optional(),
  paymentMethods: z.array(z.string()).optional(),
  newPaymentMethod: z.string().optional(),
  warranty: z.string().optional(),
  languages: z.array(z.string()).optional(),
  newLanguage: z.string().optional(),
  portfolio: z.array(portfolioItemSchema).optional(),
});

// Define the schema for landlord profile form
const landlordProfileFormSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().optional(),
  bio: z.string().optional(),
});

// Trade options for contractors
const AVAILABLE_TRADES = [
  "Plumbing", 
  "Electrical", 
  "Carpentry", 
  "Painting", 
  "Landscaping", 
  "General Maintenance", 
  "Roofing", 
  "HVAC", 
  "Cleaning",
  "Drywall",
  "Flooring",
  "Windows",
  "Pest Control",
  "Appliances"
];

// Common payment methods
const PAYMENT_METHODS = [
  "Credit Card",
  "Debit Card",
  "Cash",
  "Cheque",
  "E-Transfer",
  "PayPal",
  "Direct Deposit"
];

// Common languages in Canada
const COMMON_LANGUAGES = [
  "English",
  "French",
  "Spanish",
  "Mandarin",
  "Cantonese",
  "Arabic",
  "Punjabi",
  "Tagalog",
  "Italian",
  "German",
  "Portuguese"
];

export function ProfileSettings({ user, onClose }: ProfileSettingsProps) {
  const [profilePicture, setProfilePicture] = useState<string | null>(user.profilePicture);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("general");
  const [tempSkill, setTempSkill] = useState("");
  const [tempTrade, setTempTrade] = useState("");
  const [tempPaymentMethod, setTempPaymentMethod] = useState("");
  const [tempLanguage, setTempLanguage] = useState("");
  
  // Portfolio management state
  const [isAddingPortfolio, setIsAddingPortfolio] = useState(false);
  const [newPortfolioTitle, setNewPortfolioTitle] = useState("");
  const [newPortfolioDescription, setNewPortfolioDescription] = useState("");
  const [newPortfolioImage, setNewPortfolioImage] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Type for form values based on user type
  type ProfileFormValues = z.infer<typeof contractorProfileFormSchema> | z.infer<typeof landlordProfileFormSchema>;
  
  // Select schema based on user type
  const profileSchema = user.userType === "contractor" 
    ? contractorProfileFormSchema 
    : landlordProfileFormSchema;

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user.fullName,
      email: user.email,
      phone: user.phone || "",
      bio: "",
      // Only filled for contractor profiles
      ...(user.userType === "contractor" ? {
        skills: [],
        trades: [],
        experience: "",
        hourlyRate: undefined,
        hasLiabilityInsurance: false,
        insuranceCoverage: "",
        paymentMethods: [],
        warranty: "",
        languages: [],
        portfolio: [],
      } : {})
    } as any, // Cast to any to satisfy TypeScript
  });

  // Load contractor or landlord profile 
  useEffect(() => {
    const loadProfile = async () => {
      setIsLoading(true);
      try {
        if (user.userType === "contractor") {
          const response = await fetch(`/api/contractor-profile/${user.id}`);
          if (response.ok) {
            const profileData = await response.json();
            setProfile(profileData);
            
            // Update form with profile data - basic fields
            form.setValue("bio", profileData.bio || "");
            
            // Update form with contractor-specific fields
            if (profileData.skills && Array.isArray(profileData.skills)) {
              form.setValue("skills", profileData.skills);
            }
            
            if (profileData.trades && Array.isArray(profileData.trades)) {
              form.setValue("trades", profileData.trades);
            }
            
            if (profileData.experience) {
              form.setValue("experience", profileData.experience);
            }
            
            if (profileData.hourlyRate !== undefined) {
              form.setValue("hourlyRate", profileData.hourlyRate.toString());
            }
            
            if (profileData.hasLiabilityInsurance !== undefined) {
              form.setValue("hasLiabilityInsurance", profileData.hasLiabilityInsurance);
            }
            
            if (profileData.insuranceCoverage) {
              form.setValue("insuranceCoverage", profileData.insuranceCoverage);
            }
            
            if (profileData.paymentMethods && Array.isArray(profileData.paymentMethods)) {
              form.setValue("paymentMethods", profileData.paymentMethods);
            }
            
            if (profileData.warranty) {
              form.setValue("warranty", profileData.warranty);
            }
            
            if (profileData.languages && Array.isArray(profileData.languages)) {
              form.setValue("languages", profileData.languages);
            }
            
            if (profileData.portfolio && Array.isArray(profileData.portfolio)) {
              form.setValue("portfolio", profileData.portfolio);
            }
          }
        } else if (user.userType === "landlord") {
          // Similar implementation for landlord profiles
          const response = await fetch(`/api/landlord-profile/${user.id}`);
          if (response.ok) {
            const profileData = await response.json();
            setProfile(profileData);
            form.setValue("bio", profileData.bio || "");
          }
        }
      } catch (error) {
        console.error("Error loading profile data", error);
        toast({
          title: "Failed to load profile",
          description: "Could not retrieve your profile information",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [user.id, user.userType, form, toast]);

  const updateMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      // Update basic user info
      const res = await apiRequest("PATCH", `/api/user/${user.id}`, {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone || null,
        profilePicture: profilePicture,
      });
      
      // Also update the profile if there's profile-specific data
      if (user.userType === "contractor") {
        // Extract contractor-specific data
        const contractorData = data as z.infer<typeof contractorProfileFormSchema>;
        const contractorProfileData = {
          bio: contractorData.bio,
          skills: contractorData.skills,
          trades: contractorData.trades,
          experience: contractorData.experience,
          hourlyRate: contractorData.hourlyRate,
          hasLiabilityInsurance: contractorData.hasLiabilityInsurance,
          insuranceCoverage: contractorData.insuranceCoverage,
          paymentMethods: contractorData.paymentMethods,
          warranty: contractorData.warranty,
          languages: contractorData.languages,
          portfolio: contractorData.portfolio,
        };
        
        await apiRequest("PATCH", `/api/contractor-profile/${user.id}`, contractorProfileData);
      } else if (user.userType === "landlord" && data.bio !== undefined) {
        await apiRequest("PATCH", `/api/landlord-profile/${user.id}`, {
          bio: data.bio,
        });
      }
      
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully",
      });
      
      // Invalidate queries to refetch user data
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      // Also invalidate profile data
      if (user.userType === "contractor") {
        queryClient.invalidateQueries({ queryKey: ['/api/contractor-profile', user.id] });
      } else if (user.userType === "landlord") {
        queryClient.invalidateQueries({ queryKey: ['/api/landlord-profile', user.id] });
      }
      
      if (onClose) {
        onClose();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update profile",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProfileFormValues) => {
    // Remove temporary fields that are used for UI only
    const cleanedData = { ...data };
    if (user.userType === "contractor") {
      const contractorData = cleanedData as z.infer<typeof contractorProfileFormSchema>;
      delete contractorData.newSkill;
      delete contractorData.newTrade;
      delete contractorData.newPaymentMethod;
      delete contractorData.newLanguage;
    }
    
    updateMutation.mutate(cleanedData);
  };

  const handleProfilePictureChange = (imageUrl: string) => {
    setProfilePicture(imageUrl);
  };

  // Handlers for adding array items (skills, trades, etc.) - only for contractor profiles
  const addSkill = () => {
    if (user.userType !== "contractor") return;
    
    const currentSkills = form.getValues("skills") as string[] || [];
    const skill = form.getValues("newSkill") as string;
    
    if (skill && !currentSkills.includes(skill)) {
      form.setValue("skills", [...currentSkills, skill]);
      form.setValue("newSkill", "");
      setTempSkill("");
    }
  };
  
  const removeSkill = (skillToRemove: string) => {
    if (user.userType !== "contractor") return;
    
    const currentSkills = form.getValues("skills") as string[] || [];
    form.setValue("skills", currentSkills.filter((skill: string) => skill !== skillToRemove));
  };
  
  const addTrade = () => {
    if (user.userType !== "contractor") return;
    
    const currentTrades = form.getValues("trades") as string[] || [];
    const trade = form.getValues("newTrade") as string;
    
    if (trade && !currentTrades.includes(trade)) {
      form.setValue("trades", [...currentTrades, trade]);
      form.setValue("newTrade", "");
      setTempTrade("");
    }
  };
  
  const removeTrade = (tradeToRemove: string) => {
    if (user.userType !== "contractor") return;
    
    const currentTrades = form.getValues("trades") as string[] || [];
    form.setValue("trades", currentTrades.filter((trade: string) => trade !== tradeToRemove));
  };
  
  const addPaymentMethod = () => {
    if (user.userType !== "contractor") return;
    
    const currentMethods = form.getValues("paymentMethods") as string[] || [];
    const method = form.getValues("newPaymentMethod") as string;
    
    if (method && !currentMethods.includes(method)) {
      form.setValue("paymentMethods", [...currentMethods, method]);
      form.setValue("newPaymentMethod", "");
      setTempPaymentMethod("");
    }
  };
  
  const removePaymentMethod = (methodToRemove: string) => {
    if (user.userType !== "contractor") return;
    
    const currentMethods = form.getValues("paymentMethods") as string[] || [];
    form.setValue("paymentMethods", currentMethods.filter((method: string) => method !== methodToRemove));
  };
  
  const addLanguage = () => {
    if (user.userType !== "contractor") return;
    
    const currentLanguages = form.getValues("languages") as string[] || [];
    const language = form.getValues("newLanguage") as string;
    
    if (language && !currentLanguages.includes(language)) {
      form.setValue("languages", [...currentLanguages, language]);
      form.setValue("newLanguage", "");
      setTempLanguage("");
    }
  };
  
  const removeLanguage = (languageToRemove: string) => {
    if (user.userType !== "contractor") return;
    
    const currentLanguages = form.getValues("languages") as string[] || [];
    form.setValue("languages", currentLanguages.filter((language: string) => language !== languageToRemove));
  };
  
  // Portfolio management
  const addPortfolioItem = () => {
    if (user.userType !== "contractor") return;
    if (!newPortfolioTitle || !newPortfolioImage) return;
    
    const currentPortfolio = form.getValues("portfolio") as Array<typeof portfolioItemSchema._type> || [];
    const newItem = {
      title: newPortfolioTitle,
      description: newPortfolioDescription,
      imageUrl: newPortfolioImage
    };
    
    form.setValue("portfolio", [...currentPortfolio, newItem]);
    
    // Reset form
    setNewPortfolioTitle("");
    setNewPortfolioDescription("");
    setNewPortfolioImage("");
    setIsAddingPortfolio(false);
  };
  
  const removePortfolioItem = (index: number) => {
    if (user.userType !== "contractor") return;
    
    const currentPortfolio = form.getValues("portfolio") as Array<typeof portfolioItemSchema._type> || [];
    const updatedPortfolio = [...currentPortfolio];
    updatedPortfolio.splice(index, 1);
    form.setValue("portfolio", updatedPortfolio);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader className="border-b">
        <CardTitle>Profile Settings</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex flex-col md:flex-row gap-8">
              <div className="flex-shrink-0 flex flex-col items-center">
                <ProfilePictureUpload
                  currentImageUrl={profilePicture}
                  onSuccess={handleProfilePictureChange}
                  size="lg"
                />
              </div>
              
              <div className="flex-grow">
                <Tabs defaultValue="general" value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="mb-6">
                    <TabsTrigger value="general">General</TabsTrigger>
                    {user.userType === "contractor" && (
                      <>
                        <TabsTrigger value="trades">Trade Details</TabsTrigger>
                        <TabsTrigger value="business">Business Info</TabsTrigger>
                        <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
                      </>
                    )}
                  </TabsList>
                  
                  <TabsContent value="general" className="space-y-4">
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="email@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="(555) 123-4567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="bio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bio</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Tell us a bit about yourself" 
                              className="resize-none" 
                              rows={4}
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {user.userType === "contractor" && (
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="skills"
                          render={() => (
                            <FormItem>
                              <FormLabel>Skills</FormLabel>
                              <div className="flex flex-wrap gap-2 mb-2">
                                {(form.watch("skills") as string[] || []).map((skill: string, index: number) => (
                                  <Badge key={index} variant="secondary" className="p-1.5">
                                    {skill}
                                    <button type="button" className="ml-2" onClick={() => removeSkill(skill)}>
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <Input 
                                  value={tempSkill} 
                                  onChange={(e) => {
                                    setTempSkill(e.target.value);
                                    form.setValue("newSkill", e.target.value);
                                  }} 
                                  placeholder="Add a skill" 
                                  className="flex-grow"
                                />
                                <Button type="button" size="sm" onClick={addSkill}>
                                  <PlusCircle className="h-4 w-4 mr-1" />
                                  Add
                                </Button>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </TabsContent>
                  
                  {user.userType === "contractor" && (
                    <>
                      <TabsContent value="trades" className="space-y-4">
                        <FormField
                          control={form.control}
                          name="languages"
                          render={() => (
                            <FormItem>
                              <FormLabel>Languages</FormLabel>
                              <div className="flex flex-wrap gap-2 mb-2">
                                {(form.watch("languages") as string[] || []).map((language: string, index: number) => (
                                  <Badge key={index} variant="secondary" className="p-1.5">
                                    {language}
                                    <button type="button" className="ml-2" onClick={() => removeLanguage(language)}>
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <Select 
                                  onValueChange={(value) => {
                                    setTempLanguage(value);
                                    form.setValue("newLanguage", value);
                                  }}
                                  value={tempLanguage}
                                >
                                  <SelectTrigger className="flex-grow">
                                    <SelectValue placeholder="Select a language" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {COMMON_LANGUAGES.map((language) => (
                                      <SelectItem key={language} value={language}>
                                        {language}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button type="button" size="sm" onClick={addLanguage}>
                                  <PlusCircle className="h-4 w-4 mr-1" />
                                  Add
                                </Button>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="trades"
                          render={() => (
                            <FormItem>
                              <FormLabel>Trades</FormLabel>
                              <div className="flex flex-wrap gap-2 mb-2">
                                {(form.watch("trades") as string[] || []).map((trade: string, index: number) => (
                                  <Badge key={index} variant="secondary" className="p-1.5">
                                    {trade}
                                    <button type="button" className="ml-2" onClick={() => removeTrade(trade)}>
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <Select 
                                  onValueChange={(value) => {
                                    setTempTrade(value);
                                    form.setValue("newTrade", value);
                                  }}
                                  value={tempTrade}
                                >
                                  <SelectTrigger className="flex-grow">
                                    <SelectValue placeholder="Select a trade" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {AVAILABLE_TRADES.map((trade) => (
                                      <SelectItem key={trade} value={trade}>
                                        {trade}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button type="button" size="sm" onClick={addTrade}>
                                  <PlusCircle className="h-4 w-4 mr-1" />
                                  Add
                                </Button>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="experience"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Years of Experience</FormLabel>
                              <Select 
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select experience" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="<1">Less than 1 year</SelectItem>
                                  <SelectItem value="1-3">1-3 years</SelectItem>
                                  <SelectItem value="3-5">3-5 years</SelectItem>
                                  <SelectItem value="5-10">5-10 years</SelectItem>
                                  <SelectItem value="10+">10+ years</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="hourlyRate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Hourly Rate ($)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  placeholder="80" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormDescription>
                                The hourly rate you charge for your services
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TabsContent>
                      
                      <TabsContent value="business" className="space-y-4">
                        <FormField
                          control={form.control}
                          name="hasLiabilityInsurance"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">
                                  Liability Insurance
                                </FormLabel>
                                <FormDescription>
                                  Do you have liability insurance for your work?
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
                        
                        <FormField
                          control={form.control}
                          name="insuranceCoverage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Insurance Coverage</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="e.g., $2 million general liability" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="warranty"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Warranty Information</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="e.g., 1 year warranty on all labor and materials" 
                                  className="resize-none" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="paymentMethods"
                          render={() => (
                            <FormItem>
                              <FormLabel>Payment Methods Accepted</FormLabel>
                              <div className="flex flex-wrap gap-2 mb-2">
                                {(form.watch("paymentMethods") as string[] || []).map((method: string, index: number) => (
                                  <Badge key={index} variant="secondary" className="p-1.5">
                                    {method}
                                    <button type="button" className="ml-2" onClick={() => removePaymentMethod(method)}>
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <Select 
                                  onValueChange={(value) => {
                                    setTempPaymentMethod(value);
                                    form.setValue("newPaymentMethod", value);
                                  }}
                                  value={tempPaymentMethod}
                                >
                                  <SelectTrigger className="flex-grow">
                                    <SelectValue placeholder="Select payment method" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PAYMENT_METHODS.map((method) => (
                                      <SelectItem key={method} value={method}>
                                        {method}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button type="button" size="sm" onClick={addPaymentMethod}>
                                  <PlusCircle className="h-4 w-4 mr-1" />
                                  Add
                                </Button>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TabsContent>
                      
                      <TabsContent value="portfolio" className="space-y-4">
                        <div className="flex flex-col gap-4">
                          {(form.watch("portfolio") as Array<{
                            title: string;
                            description?: string;
                            imageUrl: string;
                          }> || []).map((item, index) => (
                            <div key={index} className="border rounded-lg p-4 relative">
                              <Button 
                                type="button" 
                                variant="destructive" 
                                size="icon" 
                                className="absolute top-2 right-2 h-6 w-6"
                                onClick={() => removePortfolioItem(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              <div className="flex flex-col sm:flex-row gap-4">
                                <div className="h-40 w-40 rounded-md overflow-hidden flex-shrink-0">
                                  <img 
                                    src={item.imageUrl} 
                                    alt={item.title} 
                                    className="h-full w-full object-cover" 
                                  />
                                </div>
                                <div className="flex-grow">
                                  <h3 className="font-semibold text-lg">{item.title}</h3>
                                  <p className="text-muted-foreground mt-1">
                                    {item.description || "No description provided"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          {!isAddingPortfolio ? (
                            <Button 
                              type="button"
                              variant="outline"
                              className="flex items-center justify-center gap-2"
                              onClick={() => setIsAddingPortfolio(true)}
                            >
                              <PlusCircle className="h-4 w-4" />
                              Add Portfolio Item
                            </Button>
                          ) : (
                            <div className="border rounded-lg p-4">
                              <h3 className="font-semibold mb-4">Add New Portfolio Item</h3>
                              <div className="space-y-4">
                                <div>
                                  <FormLabel>Title</FormLabel>
                                  <Input 
                                    value={newPortfolioTitle} 
                                    onChange={(e) => setNewPortfolioTitle(e.target.value)}
                                    placeholder="Kitchen Renovation"
                                  />
                                </div>
                                
                                <div>
                                  <FormLabel>Description</FormLabel>
                                  <Textarea 
                                    value={newPortfolioDescription} 
                                    onChange={(e) => setNewPortfolioDescription(e.target.value)}
                                    placeholder="Complete kitchen renovation including cabinets, countertops, and appliances"
                                    className="resize-none"
                                    rows={3}
                                  />
                                </div>
                                
                                <div>
                                  <FormLabel>Image URL</FormLabel>
                                  <Input 
                                    value={newPortfolioImage} 
                                    onChange={(e) => setNewPortfolioImage(e.target.value)}
                                    placeholder="https://example.com/my-work.jpg"
                                  />
                                </div>
                                
                                <div className="flex justify-end gap-2 mt-4">
                                  <Button 
                                    type="button" 
                                    variant="outline" 
                                    onClick={() => {
                                      setIsAddingPortfolio(false);
                                      setNewPortfolioTitle("");
                                      setNewPortfolioDescription("");
                                      setNewPortfolioImage("");
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                  <Button 
                                    type="button"
                                    onClick={addPortfolioItem}
                                    disabled={!newPortfolioTitle || !newPortfolioImage}
                                  >
                                    Add Item
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </TabsContent>
                    </>
                  )}
                </Tabs>
              </div>
            </div>
            
            <div className="flex justify-end gap-4 pt-4 border-t">
              {onClose && (
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}