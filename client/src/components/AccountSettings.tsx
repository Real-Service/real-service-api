import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Separator } from "@/components/ui/separator";
import { Camera, Save, UploadCloud, Bell, CreditCard, Mail, MapPin, ShieldCheck, User, AlertTriangle } from "lucide-react";

// Form schema for profile information
const profileSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email format"),
  phone: z.string().optional(),
  bio: z.string().optional(),
  companyName: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
});

// Form schema for notification preferences
const notificationSchema = z.object({
  emailNotifications: z.boolean().default(true),
  smsNotifications: z.boolean().default(false),
  quotesNotifications: z.boolean().default(true),
  jobsNotifications: z.boolean().default(true),
  messageNotifications: z.boolean().default(true),
  marketingNotifications: z.boolean().default(false),
});

// Form schema for appearance preferences
const appearanceSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).default("system"),
  colorMode: z.enum(["default", "vibrant", "professional"]).default("default"),
  mapPreference: z.enum(["default", "satellite", "terrain"]).default("default"),
  dashboardView: z.enum(["grid", "table", "map", "calendar"]).default("grid"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type NotificationFormValues = z.infer<typeof notificationSchema>;
type AppearanceFormValues = z.infer<typeof appearanceSchema>;

export function AccountSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedTab, setSelectedTab] = useState("profile");
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);
  
  // Fetch user profile data
  const { data: profileData, isLoading: isProfileLoading } = useQuery({
    queryKey: ['/api/contractor-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const res = await fetch(`/api/contractor-profile/${user.id}`);
      if (!res.ok) throw new Error('Failed to fetch profile');
      return res.json();
    },
    enabled: !!user?.id
  });
  
  // Fetch user preferences data (assuming this endpoint exists)
  const { data: preferencesData, isLoading: isPreferencesLoading } = useQuery({
    queryKey: ['/api/user-preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      // This would typically be a fetch to an API endpoint
      // For now, we'll return mock data since we don't have a real endpoint
      return {
        notifications: {
          emailNotifications: true,
          smsNotifications: false,
          quotesNotifications: true,
          jobsNotifications: true,
          messageNotifications: true,
          marketingNotifications: false,
        },
        appearance: {
          theme: "system",
          colorMode: "default",
          mapPreference: "default",
          dashboardView: "grid",
        }
      };
    },
    enabled: !!user?.id
  });
  
  // Profile form
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      email: user?.email || "",
      phone: profileData?.phone || "",
      bio: profileData?.bio || "",
      companyName: profileData?.companyName || "",
      website: profileData?.website || "",
      address: profileData?.address || "",
      city: profileData?.city || "",
      state: profileData?.state || "",
      zipCode: profileData?.zipCode || "",
    },
    values: {
      fullName: user?.fullName || "",
      email: user?.email || "",
      phone: profileData?.phone || "",
      bio: profileData?.bio || "",
      companyName: profileData?.companyName || "",
      website: profileData?.website || "",
      address: profileData?.address || "",
      city: profileData?.city || "",
      state: profileData?.state || "",
      zipCode: profileData?.zipCode || "",
    },
  });
  
  // Notification preferences form
  const notificationForm = useForm<NotificationFormValues>({
    resolver: zodResolver(notificationSchema),
    defaultValues: preferencesData?.notifications || {
      emailNotifications: true,
      smsNotifications: false,
      quotesNotifications: true,
      jobsNotifications: true,
      messageNotifications: true,
      marketingNotifications: false,
    },
    values: preferencesData?.notifications || {
      emailNotifications: true,
      smsNotifications: false,
      quotesNotifications: true,
      jobsNotifications: true,
      messageNotifications: true,
      marketingNotifications: false,
    },
  });
  
  // Appearance preferences form
  const appearanceForm = useForm<AppearanceFormValues>({
    resolver: zodResolver(appearanceSchema),
    defaultValues: preferencesData?.appearance || {
      theme: "system",
      colorMode: "default",
      mapPreference: "default",
      dashboardView: "grid",
    },
    values: preferencesData?.appearance || {
      theme: "system",
      colorMode: "default",
      mapPreference: "default",
      dashboardView: "grid",
    },
  });
  
  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      if (!user?.id) return null;
      
      return apiRequest(`/api/contractor-profile/${user.id}`, 'PATCH', data);
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/contractor-profile', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/user', user?.id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Update notification preferences mutation
  const updateNotificationsMutation = useMutation({
    mutationFn: async (data: NotificationFormValues) => {
      if (!user?.id) return null;
      
      // This would typically be a fetch to an API endpoint
      // For now, we'll mock a successful update
      return new Promise(resolve => setTimeout(() => resolve(data), 500));
    },
    onSuccess: () => {
      toast({
        title: "Notifications Updated",
        description: "Your notification preferences have been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update notification preferences.",
        variant: "destructive",
      });
    }
  });
  
  // Update appearance preferences mutation
  const updateAppearanceMutation = useMutation({
    mutationFn: async (data: AppearanceFormValues) => {
      if (!user?.id) return null;
      
      // This would typically be a fetch to an API endpoint
      // For now, we'll mock a successful update
      return new Promise(resolve => setTimeout(() => resolve(data), 500));
    },
    onSuccess: () => {
      toast({
        title: "Appearance Updated",
        description: "Your appearance preferences have been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update appearance preferences.",
        variant: "destructive",
      });
    }
  });
  
  // Upload profile picture mutation
  const uploadProfilePictureMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id || !file) return null;
      
      const formData = new FormData();
      formData.append('profilePicture', file);
      
      const response = await fetch('/api/profile-picture/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload profile picture');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Profile Picture Updated",
        description: "Your profile picture has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/contractor-profile', user?.id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload profile picture.",
        variant: "destructive",
      });
    }
  });
  
  // Handle profile picture change
  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setProfilePicture(file);
    setProfilePicturePreview(URL.createObjectURL(file));
  };
  
  // Handle profile picture upload
  const handleProfilePictureUpload = () => {
    if (profilePicture) {
      uploadProfilePictureMutation.mutate(profilePicture);
    }
  };
  
  // Handle profile form submission
  const onSubmitProfile = (data: ProfileFormValues) => {
    updateProfileMutation.mutate(data);
  };
  
  // Handle notification preferences form submission
  const onSubmitNotifications = (data: NotificationFormValues) => {
    updateNotificationsMutation.mutate(data);
  };
  
  // Handle appearance preferences form submission
  const onSubmitAppearance = (data: AppearanceFormValues) => {
    updateAppearanceMutation.mutate(data);
  };
  
  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };
  
  return (
    <div className="container mx-auto p-4 max-w-5xl pb-20">
      {/* Main Header with Logo */}
      <div className="flex justify-between items-center py-4 border-b mb-6">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold text-primary">Real Service</h1>
        </div>
        <Link href="/contractor/dashboard">
          <Button variant="outline">
            Back to Dashboard
          </Button>
        </Link>
      </div>
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Account Settings</h1>
      </div>
      
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>Profile</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span>Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            <span>Appearance</span>
          </TabsTrigger>
        </TabsList>
        
        {/* Profile Tab */}
        <TabsContent value="profile">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Profile Picture Card */}
            <Card>
              <CardHeader>
                <CardTitle>Profile Picture</CardTitle>
                <CardDescription>
                  Your profile picture will be shown to clients and other users.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center space-y-4">
                <Avatar className="h-32 w-32">
                  <AvatarImage 
                    src={profilePicturePreview || profileData?.profilePicture || undefined} 
                    alt={user?.fullName || "User"}
                  />
                  <AvatarFallback className="text-3xl">
                    {getInitials(user?.fullName || user?.username || "User")}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex flex-col items-center">
                  <Label 
                    htmlFor="profile-picture" 
                    className="cursor-pointer bg-muted hover:bg-muted/80 text-sm px-4 py-2 rounded-md flex items-center gap-2"
                  >
                    <Camera className="h-4 w-4" />
                    Choose Image
                  </Label>
                  <Input 
                    id="profile-picture" 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleProfilePictureChange}
                  />
                  {profilePicture && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2" 
                      onClick={handleProfilePictureUpload}
                      disabled={uploadProfilePictureMutation.isPending}
                    >
                      <UploadCloud className="h-4 w-4 mr-2" />
                      {uploadProfilePictureMutation.isPending ? "Uploading..." : "Upload"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Profile Information Card */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Update your personal and business information.
                </CardDescription>
              </CardHeader>
              <form onSubmit={profileForm.handleSubmit(onSubmitProfile)}>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Personal Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input
                          id="fullName"
                          {...profileForm.register("fullName")}
                          placeholder="Your full name"
                        />
                        {profileForm.formState.errors.fullName && (
                          <p className="text-sm text-red-500">{profileForm.formState.errors.fullName.message}</p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          {...profileForm.register("email")}
                          placeholder="Your email address"
                        />
                        {profileForm.formState.errors.email && (
                          <p className="text-sm text-red-500">{profileForm.formState.errors.email.message}</p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          {...profileForm.register("phone")}
                          placeholder="Your phone number"
                        />
                      </div>
                      
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="bio">Bio</Label>
                        <Textarea
                          id="bio"
                          {...profileForm.register("bio")}
                          placeholder="Tell clients about yourself and your services"
                          className="min-h-[100px]"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Business Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="companyName">Company Name</Label>
                        <Input
                          id="companyName"
                          {...profileForm.register("companyName")}
                          placeholder="Your company name"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="website">Website</Label>
                        <Input
                          id="website"
                          {...profileForm.register("website")}
                          placeholder="Your website address"
                        />
                      </div>
                      
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="address">Address</Label>
                        <Input
                          id="address"
                          {...profileForm.register("address")}
                          placeholder="Street address"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          {...profileForm.register("city")}
                          placeholder="City"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="state">State</Label>
                          <Input
                            id="state"
                            {...profileForm.register("state")}
                            placeholder="State"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="zipCode">ZIP Code</Label>
                          <Input
                            id="zipCode"
                            {...profileForm.register("zipCode")}
                            placeholder="ZIP Code"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    type="submit" 
                    className="ml-auto"
                    disabled={updateProfileMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        </TabsContent>
        
        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose how and when you would like to be notified.
              </CardDescription>
            </CardHeader>
            <form onSubmit={notificationForm.handleSubmit(onSubmitNotifications)}>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Communication Channels</h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="emailNotifications" className="text-base">Email Notifications</Label>
                        <p className="text-sm text-muted-foreground">Receive notifications via email.</p>
                      </div>
                      <Switch
                        id="emailNotifications"
                        checked={notificationForm.watch("emailNotifications")}
                        onCheckedChange={(checked) => notificationForm.setValue("emailNotifications", checked)}
                      />
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="smsNotifications" className="text-base">SMS Notifications</Label>
                        <p className="text-sm text-muted-foreground">Receive notifications via text message.</p>
                      </div>
                      <Switch
                        id="smsNotifications"
                        checked={notificationForm.watch("smsNotifications")}
                        onCheckedChange={(checked) => notificationForm.setValue("smsNotifications", checked)}
                      />
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Notification Types</h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="quotesNotifications" className="text-base">Quotes</Label>
                        <p className="text-sm text-muted-foreground">Notifications for quote status updates.</p>
                      </div>
                      <Switch
                        id="quotesNotifications"
                        checked={notificationForm.watch("quotesNotifications")}
                        onCheckedChange={(checked) => notificationForm.setValue("quotesNotifications", checked)}
                      />
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="jobsNotifications" className="text-base">Jobs</Label>
                        <p className="text-sm text-muted-foreground">Notifications for job status updates.</p>
                      </div>
                      <Switch
                        id="jobsNotifications"
                        checked={notificationForm.watch("jobsNotifications")}
                        onCheckedChange={(checked) => notificationForm.setValue("jobsNotifications", checked)}
                      />
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="messageNotifications" className="text-base">Messages</Label>
                        <p className="text-sm text-muted-foreground">Notifications for new messages.</p>
                      </div>
                      <Switch
                        id="messageNotifications"
                        checked={notificationForm.watch("messageNotifications")}
                        onCheckedChange={(checked) => notificationForm.setValue("messageNotifications", checked)}
                      />
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="marketingNotifications" className="text-base">Marketing</Label>
                        <p className="text-sm text-muted-foreground">Receive promotional messages and updates.</p>
                      </div>
                      <Switch
                        id="marketingNotifications"
                        checked={notificationForm.watch("marketingNotifications")}
                        onCheckedChange={(checked) => notificationForm.setValue("marketingNotifications", checked)}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  type="submit" 
                  className="ml-auto"
                  disabled={updateNotificationsMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateNotificationsMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
        
        {/* Appearance Tab */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance Settings</CardTitle>
              <CardDescription>
                Customize the look and feel of the application.
              </CardDescription>
            </CardHeader>
            <form onSubmit={appearanceForm.handleSubmit(onSubmitAppearance)}>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Theme</h3>
                  
                  <div className="space-y-4">
                    <Label>Theme Mode</Label>
                    <RadioGroup
                      value={appearanceForm.watch("theme")}
                      onValueChange={(value: "light" | "dark" | "system") => appearanceForm.setValue("theme", value)}
                      className="grid grid-cols-3 gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="light" id="theme-light" />
                        <Label htmlFor="theme-light" className="cursor-pointer">Light</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="dark" id="theme-dark" />
                        <Label htmlFor="theme-dark" className="cursor-pointer">Dark</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="system" id="theme-system" />
                        <Label htmlFor="theme-system" className="cursor-pointer">System</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  
                  <div className="space-y-4">
                    <Label>Color Mode</Label>
                    <RadioGroup
                      value={appearanceForm.watch("colorMode")}
                      onValueChange={(value: "default" | "vibrant" | "professional") => appearanceForm.setValue("colorMode", value)}
                      className="grid grid-cols-3 gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="default" id="color-default" />
                        <Label htmlFor="color-default" className="cursor-pointer">Default</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="vibrant" id="color-vibrant" />
                        <Label htmlFor="color-vibrant" className="cursor-pointer">Vibrant</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="professional" id="color-professional" />
                        <Label htmlFor="color-professional" className="cursor-pointer">Professional</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Display Preferences</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <Label htmlFor="mapPreference">Map Style</Label>
                      <Select
                        value={appearanceForm.watch("mapPreference")}
                        onValueChange={(value: "default" | "satellite" | "terrain") => appearanceForm.setValue("mapPreference", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select map style" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Standard</SelectItem>
                          <SelectItem value="satellite">Satellite</SelectItem>
                          <SelectItem value="terrain">Terrain</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-4">
                      <Label htmlFor="dashboardView">Default Dashboard View</Label>
                      <Select
                        value={appearanceForm.watch("dashboardView")}
                        onValueChange={(value: "grid" | "table" | "map" | "calendar") => appearanceForm.setValue("dashboardView", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select default view" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="grid">Grid</SelectItem>
                          <SelectItem value="table">Table</SelectItem>
                          <SelectItem value="map">Map</SelectItem>
                          <SelectItem value="calendar">Calendar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  type="submit" 
                  className="ml-auto"
                  disabled={updateAppearanceMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateAppearanceMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}