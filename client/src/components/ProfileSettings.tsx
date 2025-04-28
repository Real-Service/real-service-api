import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User as UserType } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectTrigger, SelectValue, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { CalendarIcon, ChevronRight, Check, Loader2, MapPin, X, PlusCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProfilePictureUpload } from "./ProfilePictureUpload";

// Constants
const COMMON_LANGUAGES = [
  "English",
  "French",
  "Spanish",
  "Mandarin",
  "Cantonese",
  "Hindi",
  "Arabic",
  "Punjabi",
  "Urdu",
  "Portuguese",
  "Other"
];

const AVAILABLE_TRADES = [
  "Plumbing",
  "Electrical",
  "Carpentry",
  "HVAC",
  "Painting",
  "Landscaping",
  "Roofing",
  "Flooring",
  "General Contracting",
  "Masonry",
  "Cleaning",
  "Appliance Repair",
  "Locksmith",
  "Pest Control",
  "Other"
];

const BUSINESS_TYPE_OPTIONS = [
  "Sole Proprietorship",
  "Partnership",
  "Corporation",
  "LLC",
  "Other"
];

interface FormValues {
  fullName: string;
  email: string;
  phone: string;
  bio: string;
  profilePicture?: string;
  city?: string;
  state?: string;
  serviceRadius?: number;
  serviceZipCodes?: string[];
  newZipCode?: string;
  skills?: string[];
  newSkill?: string;
  languages?: string[];
  newLanguage?: string;
  trades?: string[];
  newTrade?: string;
  experience?: number;
  insurance?: boolean;
  license?: string;
  licenseExpiry?: string | Date | null;
  businessType?: string;
  businessName?: string;
  taxId?: string;
  website?: string;
  portfolio?: {
    title: string;
    image: string;
    description?: string;
  }[];
}

interface ProfileSettingsProps {
  user: UserType;
  onClose?: () => void;
}

export function ProfileSettings({ user, onClose }: ProfileSettingsProps) {
  const { toast } = useToast();
  const { user: authUser, logoutMutation } = useAuth();
  const [activeTab, setActiveTab] = useState("general");
  const [profilePicture, setProfilePicture] = useState(user?.profilePicture || "");
  const [tempZipCode, setTempZipCode] = useState("");
  const [tempSkill, setTempSkill] = useState("");
  const [tempLanguage, setTempLanguage] = useState("");
  const [tempTrade, setTempTrade] = useState("");
  const [portfolioMode, setPortfolioMode] = useState<'view' | 'edit'>('view');
  const [newPortfolioTitle, setNewPortfolioTitle] = useState("");
  const [newPortfolioDescription, setNewPortfolioDescription] = useState("");
  const [newPortfolioImage, setNewPortfolioImage] = useState("");
  
  const isContractor = user?.userType === 'contractor';
  
  // Fetch the appropriate profile data
  const { data: profileData } = useQuery({
    queryKey: [isContractor ? '/api/contractor-profile' : '/api/landlord-profile', user?.id],
    queryFn: async () => {
      const res = await apiRequest(
        'GET', 
        `${isContractor ? '/api/contractor-profile' : '/api/landlord-profile'}/${user?.id}`
      );
      return res.json();
    },
    enabled: !!user?.id,
  });
  
  // Form setup for landlord profile
  const landlordForm = useForm<FormValues>({
    resolver: zodResolver(
      z.object({
        fullName: z.string().min(2, "Name must be at least 2 characters"),
        email: z.string().email("Invalid email address"),
        phone: z.string().optional(),
        bio: z.string().optional(),
        profilePicture: z.string().optional(),
      })
    ),
    defaultValues: {
      fullName: user?.fullName || '',
      email: user?.email || '',
      phone: user?.phone || '',
      bio: profileData?.bio || '',
      profilePicture: user?.profilePicture || '',
    }
  });
  
  // Form setup for contractor profile
  const contractorForm = useForm<FormValues>({
    resolver: zodResolver(
      z.object({
        fullName: z.string().min(2, "Name must be at least 2 characters"),
        email: z.string().email("Invalid email address"),
        phone: z.string().optional(),
        bio: z.string().optional(),
        profilePicture: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        serviceRadius: z.number().positive().optional(),
        serviceZipCodes: z.array(z.string()).optional(),
        newZipCode: z.string().optional(),
        skills: z.array(z.string()).optional(),
        newSkill: z.string().optional(),
        languages: z.array(z.string()).optional(),
        newLanguage: z.string().optional(),
        trades: z.array(z.string()).optional(),
        newTrade: z.string().optional(),
        experience: z.number().positive().optional(),
        insurance: z.boolean().optional(),
        license: z.string().optional(),
        licenseExpiry: z.union([z.string(), z.date(), z.null()]).optional(),
        businessType: z.string().optional(),
        businessName: z.string().optional(),
        taxId: z.string().optional(),
        website: z.string().optional(),
        portfolio: z.array(
          z.object({
            title: z.string(),
            image: z.string(),
            description: z.string().optional(),
          })
        ).optional(),
      })
    ),
    defaultValues: {
      fullName: user?.fullName || '',
      email: user?.email || '',
      phone: user?.phone || '',
      bio: profileData?.bio || '',
      profilePicture: user?.profilePicture || '',
      city: profileData?.city || '',
      state: profileData?.state || '',
      serviceRadius: profileData?.serviceRadius || 25,
      serviceZipCodes: profileData?.serviceZipCodes || [],
      skills: profileData?.skills || [],
      languages: profileData?.languages || [],
      trades: profileData?.trades || [],
      experience: profileData?.experience || 0,
      insurance: profileData?.insurance || false,
      license: profileData?.license || '',
      licenseExpiry: profileData?.licenseExpiry || null,
      businessType: profileData?.businessType || '',
      businessName: profileData?.businessName || '',
      taxId: profileData?.taxId || '',
      website: profileData?.website || '',
      portfolio: profileData?.portfolio || [],
    }
  });
  
  // Update forms when data is loaded
  useEffect(() => {
    if (profileData) {
      if (isContractor) {
        contractorForm.reset({
          ...contractorForm.getValues(),
          bio: profileData.bio || '',
          city: profileData.city || '',
          state: profileData.state || '',
          serviceRadius: profileData.serviceRadius || 25,
          serviceZipCodes: profileData.serviceZipCodes || [],
          skills: profileData.skills || [],
          languages: profileData.languages || [],
          trades: profileData.trades || [],
          experience: profileData.experience || 0,
          insurance: profileData.insurance || false,
          license: profileData.license || '',
          licenseExpiry: profileData.licenseExpiry || null,
          businessType: profileData.businessType || '',
          businessName: profileData.businessName || '',
          taxId: profileData.taxId || '',
          website: profileData.website || '',
          portfolio: profileData.portfolio || [],
        });
      } else {
        landlordForm.reset({
          ...landlordForm.getValues(),
          bio: profileData.bio || '',
        });
      }
    }
  }, [profileData, isContractor]);
  
  // Update mutations
  const updateContractorProfile = useMutation({
    mutationFn: async (data: FormValues) => {
      // Update user info
      await apiRequest('PATCH', `/api/user/${user?.id}`, {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        profilePicture: profilePicture,
      });
      
      // Update contractor profile
      const res = await apiRequest('PATCH', `/api/contractor-profile/${user?.id}`, {
        bio: data.bio,
        city: data.city,
        state: data.state,
        serviceRadius: data.serviceRadius,
        serviceZipCodes: data.serviceZipCodes,
        skills: data.skills,
        languages: data.languages,
        trades: data.trades,
        experience: data.experience,
        insurance: data.insurance,
        license: data.license,
        licenseExpiry: data.licenseExpiry,
        businessType: data.businessType,
        businessName: data.businessName,
        taxId: data.taxId,
        website: data.website,
        portfolio: data.portfolio,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Profile updated",
        description: "Your contractor profile has been successfully updated."
      });
      
      // Force immediate invalidation of all related queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/contractor-profile', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      
      // Also invalidate any query that might use the contractor profile data
      // This ensures dashboard components refresh with the new trade categories
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users', user?.id, 'jobs'] });
      
      if (onClose) onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "There was an error updating your profile",
        variant: "destructive"
      });
    }
  });
  
  const updateLandlordProfile = useMutation({
    mutationFn: async (data: FormValues) => {
      // Update user info
      await apiRequest('PATCH', `/api/user/${user?.id}`, {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        profilePicture: profilePicture,
      });
      
      // Update landlord profile
      const res = await apiRequest('PATCH', `/api/landlord-profile/${user?.id}`, {
        bio: data.bio,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile updated",
        description: "Your landlord profile has been successfully updated."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/landlord-profile', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      if (onClose) onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "There was an error updating your profile",
        variant: "destructive"
      });
    }
  });
  
  // Form submission handlers
  const onSubmitContractorForm = (data: FormValues) => {
    updateContractorProfile.mutate(data);
  };
  
  const onSubmitLandlordForm = (data: FormValues) => {
    updateLandlordProfile.mutate(data);
  };
  
  // Helper functions for array fields
  const addZipCode = () => {
    if (!tempZipCode) return;
    const current = contractorForm.getValues("serviceZipCodes") || [];
    if (!current.includes(tempZipCode)) {
      contractorForm.setValue("serviceZipCodes", [...current, tempZipCode]);
      setTempZipCode("");
    }
  };
  
  const removeZipCode = (zipCode: string) => {
    const current = contractorForm.getValues("serviceZipCodes") || [];
    contractorForm.setValue("serviceZipCodes", current.filter(z => z !== zipCode));
  };
  
  const addSkill = () => {
    if (!tempSkill) return;
    const current = contractorForm.getValues("skills") || [];
    if (!current.includes(tempSkill)) {
      contractorForm.setValue("skills", [...current, tempSkill]);
      setTempSkill("");
    }
  };
  
  const removeSkill = (skill: string) => {
    const current = contractorForm.getValues("skills") || [];
    contractorForm.setValue("skills", current.filter(s => s !== skill));
  };
  
  const addLanguage = () => {
    if (!tempLanguage) return;
    const current = contractorForm.getValues("languages") || [];
    if (!current.includes(tempLanguage)) {
      contractorForm.setValue("languages", [...current, tempLanguage]);
      setTempLanguage("");
    }
  };
  
  const removeLanguage = (language: string) => {
    const current = contractorForm.getValues("languages") || [];
    contractorForm.setValue("languages", current.filter(l => l !== language));
  };
  
  const addTrade = () => {
    if (!tempTrade) return;
    const current = contractorForm.getValues("trades") || [];
    if (!current.includes(tempTrade)) {
      contractorForm.setValue("trades", [...current, tempTrade]);
      setTempTrade("");
    }
  };
  
  const removeTrade = (trade: string) => {
    const current = contractorForm.getValues("trades") || [];
    contractorForm.setValue("trades", current.filter(t => t !== trade));
  };
  
  const addPortfolioItem = () => {
    if (!newPortfolioTitle || !newPortfolioImage) return;
    
    const current = contractorForm.getValues("portfolio") || [];
    contractorForm.setValue("portfolio", [
      ...current, 
      { 
        title: newPortfolioTitle, 
        image: newPortfolioImage,
        description: newPortfolioDescription 
      }
    ]);
    
    // Reset form
    setNewPortfolioTitle("");
    setNewPortfolioImage("");
    setNewPortfolioDescription("");
    setPortfolioMode('view');
  };
  
  const removePortfolioItem = (index: number) => {
    const current = contractorForm.getValues("portfolio") || [];
    contractorForm.setValue(
      "portfolio", 
      current.filter((_, i) => i !== index)
    );
  };
  
  const handleProfilePictureChange = (imageUrl: string) => {
    setProfilePicture(imageUrl);
    if (isContractor) {
      contractorForm.setValue("profilePicture", imageUrl);
    } else {
      landlordForm.setValue("profilePicture", imageUrl);
    }
  };
  
  // Render different forms based on user type
  if (isContractor) {
    return (
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader className="border-b pb-3">
          <div className="flex flex-col space-y-3">
            <CardTitle>Contractor Profile Settings</CardTitle>
          </div>
        </CardHeader>
        <div className="border-b overflow-x-auto">
          <div className="px-6 py-2 flex justify-center">
            <Tabs defaultValue="general" value={activeTab} onValueChange={setActiveTab} className="w-full max-w-3xl mx-auto">
              <div className="flex justify-center w-full">
                <TabsList className="inline-flex h-9 whitespace-nowrap">
                  <TabsTrigger value="general" className="px-3 text-sm">General</TabsTrigger>
                  <TabsTrigger value="trades" className="px-3 text-sm">Public Info</TabsTrigger>
                  <TabsTrigger value="business" className="px-3 text-sm">Business Info</TabsTrigger>
                </TabsList>
              </div>
            </Tabs>
          </div>
        </div>
        <CardContent className="pt-6">
          <Form {...contractorForm}>
            <form onSubmit={contractorForm.handleSubmit(onSubmitContractorForm)} className="space-y-6 max-w-3xl mx-auto">
              <div className="flex flex-col md:flex-row gap-8">
                <div className="flex-shrink-0 flex flex-col items-center">
                  <ProfilePictureUpload
                    currentImageUrl={profilePicture}
                    onSuccess={handleProfilePictureChange}
                    size="lg"
                  />
                </div>
                
                <div className="flex-grow">
                  <Tabs value={activeTab} className="w-full">
                    <TabsContent value="general" className="space-y-4">
                      <FormField
                        control={contractorForm.control}
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
                        control={contractorForm.control}
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
                        control={contractorForm.control}
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
                        control={contractorForm.control}
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
                      

                      
                      <FormField
                        control={contractorForm.control}
                        name="skills"
                        render={() => (
                          <FormItem>
                            <FormLabel>Skills</FormLabel>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {contractorForm.watch("skills")?.map((skill, index) => (
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
                                  contractorForm.setValue("newSkill", e.target.value);
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
                    </TabsContent>
                    
                    <TabsContent value="trades" className="space-y-4">
                      <FormField
                        control={contractorForm.control}
                        name="languages"
                        render={() => (
                          <FormItem>
                            <FormLabel>Languages</FormLabel>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {contractorForm.watch("languages")?.map((language, index) => (
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
                                  contractorForm.setValue("newLanguage", value);
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
                        control={contractorForm.control}
                        name="trades"
                        render={() => (
                          <FormItem>
                            <FormLabel>Trades</FormLabel>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {contractorForm.watch("trades")?.map((trade, index) => (
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
                                  contractorForm.setValue("newTrade", value);
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
                        control={contractorForm.control}
                        name="experience"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Years of Experience</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                placeholder="5" 
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={contractorForm.control}
                        name="insurance"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>I have liability insurance</FormLabel>
                              <FormDescription>
                                Landlords often prefer contractors with liability insurance
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={contractorForm.control}
                        name="license"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>License/Certification Number</FormLabel>
                            <FormControl>
                              <Input placeholder="License/certification number" {...field} />
                            </FormControl>
                            <FormDescription>
                              If applicable to your trade
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <Separator className="my-6" />
                      
                      <div className="border rounded-lg p-4">
                        <h3 className="font-medium mb-2">Portfolio Items</h3>
                        
                        {(contractorForm.watch("portfolio") ?? []).length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            {(contractorForm.watch("portfolio") ?? []).map((item, index) => (
                              <div key={index} className="border rounded-md p-3 flex flex-col">
                                <div className="relative pb-[56.25%] overflow-hidden rounded-md mb-2">
                                  <img 
                                    src={item.image} 
                                    alt={item.title}
                                    className="absolute top-0 left-0 w-full h-full object-cover" 
                                  />
                                </div>
                                <div>
                                  <div className="flex justify-between items-start">
                                    <h4 className="font-medium">{item.title}</h4>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => removePortfolioItem(index)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  {item.description && (
                                    <p className="text-sm text-muted-foreground line-clamp-3 mt-1">
                                      {item.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-muted-foreground">
                            <p>No portfolio items yet</p>
                          </div>
                        )}
                        
                        {portfolioMode === 'view' ? (
                          <Button 
                            type="button" 
                            onClick={() => setPortfolioMode('edit')}
                            className="w-full"
                          >
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Add Portfolio Item
                          </Button>
                        ) : (
                          <div className="border-t pt-4 mt-2">
                            <h4 className="font-medium mb-3">Add New Portfolio Item</h4>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-sm font-medium mb-1">Title</label>
                                <Input 
                                  value={newPortfolioTitle}
                                  onChange={(e) => setNewPortfolioTitle(e.target.value)}
                                  placeholder="Project Title"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium mb-1">Image URL</label>
                                <Input 
                                  value={newPortfolioImage}
                                  onChange={(e) => setNewPortfolioImage(e.target.value)}
                                  placeholder="https://example.com/image.jpg"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium mb-1">Description (Optional)</label>
                                <Textarea 
                                  value={newPortfolioDescription}
                                  onChange={(e) => setNewPortfolioDescription(e.target.value)}
                                  placeholder="Brief description of the project"
                                  rows={3}
                                />
                              </div>
                              
                              <div className="flex justify-center space-x-2">
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    setPortfolioMode('view');
                                    setNewPortfolioTitle("");
                                    setNewPortfolioImage("");
                                    setNewPortfolioDescription("");
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
                    
                    <TabsContent value="business" className="space-y-4">
                      <FormField
                        control={contractorForm.control}
                        name="businessType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Business Type</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select business type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {BUSINESS_TYPE_OPTIONS.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {type}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={contractorForm.control}
                        name="businessName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Business Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Your business name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={contractorForm.control}
                        name="taxId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tax ID / Business Number</FormLabel>
                            <FormControl>
                              <Input placeholder="Tax ID or business number" {...field} />
                            </FormControl>
                            <FormDescription>
                              This information is kept confidential
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={contractorForm.control}
                        name="website"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Website</FormLabel>
                            <FormControl>
                              <Input placeholder="https://example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
              
              <div className="flex justify-center gap-4 pt-4 border-t">
                {onClose && (
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                )}
                <Button type="submit" disabled={updateContractorProfile.isPending}>
                  {updateContractorProfile.isPending && (
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
  } else {
    // Landlord form
    return (
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader className="border-b pb-3">
          <div className="flex flex-col space-y-3">
            <CardTitle>Landlord Profile Settings</CardTitle>
          </div>
        </CardHeader>
        <div className="border-b overflow-x-auto">
          <div className="px-6 py-2 flex justify-center">
            <Tabs defaultValue="general" value="general" className="w-full max-w-3xl mx-auto">
              <div className="flex justify-center w-full">
                <TabsList className="inline-flex h-9 whitespace-nowrap">
                  <TabsTrigger value="general" className="px-3 text-sm">General</TabsTrigger>
                </TabsList>
              </div>
            </Tabs>
          </div>
        </div>
        <CardContent className="pt-6">
          <Form {...landlordForm}>
            <form onSubmit={landlordForm.handleSubmit(onSubmitLandlordForm)} className="space-y-6 max-w-3xl mx-auto">
              <div className="flex flex-col md:flex-row gap-8">
                <div className="flex-shrink-0 flex flex-col items-center">
                  <ProfilePictureUpload
                    currentImageUrl={profilePicture}
                    onSuccess={handleProfilePictureChange}
                    size="lg"
                  />
                </div>
                
                <div className="flex-grow space-y-4">
                  <FormField
                    control={landlordForm.control}
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
                    control={landlordForm.control}
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
                    control={landlordForm.control}
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
                    control={landlordForm.control}
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
                </div>
              </div>
              
              <div className="flex justify-center gap-4 pt-4 border-t">
                {onClose && (
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                )}
                <Button type="submit" disabled={updateLandlordProfile.isPending}>
                  {updateLandlordProfile.isPending && (
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
}