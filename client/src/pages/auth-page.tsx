import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Redirect, useLocation } from 'wouter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';

// Login form schema
const loginSchema = z.object({
  email: z.string().min(1, 'Username or email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// Registration form schema
const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  email: z.string().email('Please enter a valid email address'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  userType: z.enum(['landlord', 'contractor']), // 'landlord' = Service Requestor, 'contractor' = Service Provider
  phone: z.string().optional(),
});

// Forgot password form schema
const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

// Reset password form schema
const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Password must be at least 6 characters'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;
type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export default function AuthPage() {
  // Get auth context with all its functions
  const auth = useAuth();
  const { user, logoutMutation } = auth;
  const [activeTab, setActiveTab] = useState<string>('login');
  const [, navigate] = useLocation();
  const [error, setError] = useState('');
  const [userState, setUser] = useState<any>(user);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Form definitions - defined only once before any conditional returns
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      password: '',
      email: '',
      fullName: '',
      userType: 'landlord' as 'landlord' | 'contractor',
      phone: '',
    },
  });

  const forgotPasswordForm = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const resetPasswordForm = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: '',
      password: '',
      confirmPassword: '',
    },
  });

  // Redirect to appropriate dashboard if already logged in
  const handleDashboardRedirect = () => {
    const currentUser = user || userState;
    if (currentUser?.userType === 'contractor') {
      navigate('/contractor/dashboard');
    } else if (currentUser?.userType === 'landlord') {
      navigate('/landlord/dashboard');
    } else {
      navigate('/');
    }
  };

  // Parse URL parameters on mount
  useEffect(() => {
    // Update local loading state based on auth context
    if (auth) {
      setIsLoading(auth.isLoading);
      setUser(auth.user);
    }

    // Get parameters from URL
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const userType = params.get('type');
    const token = params.get('token');
    
    // Set active tab if specified
    if (tab === 'register' || tab === 'login' || tab === 'forgotPassword') {
      setActiveTab(tab);
    }
    
    // If reset token is present, switch to reset password tab
    if (token) {
      setActiveTab('resetPassword');
      resetPasswordForm.setValue('token', token);
    }
    
    // Update register form if user type is specified
    if (userType === 'landlord' || userType === 'contractor') {
      registerForm.setValue('userType', userType);
    }
  }, [auth, resetPasswordForm, registerForm]);

  // Helper function to handle Enter key presses in input fields
  const handleEnterKey = (e: React.KeyboardEvent, submitFn: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitFn();
    }
  };
  
  // Extract auth methods from context (with proper error handling)
  const login = auth?.login || (async (data: any) => console.error("Login not available"));
  const register = auth?.register || (async (data: any) => console.error("Register not available"));

  // Handle login submission
  const onLoginSubmit = async (data: LoginFormValues) => {
    setIsSubmitting(true);
    setError(''); // Clear previous errors
    
    try {
      console.log('Login attempt with:', { email: data.email, passwordLength: data.password.length });
      await login(data);
    } catch (error) {
      console.error('Login error:', error);
      setError(error instanceof Error ? error.message : 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle registration submission
  const onRegisterSubmit = async (data: RegisterFormValues) => {
    // Make sure userType is explicitly set as string literal to match the enum
    const processedData = {
      ...data,
      userType: data.userType === 'contractor' ? 'contractor' : 'landlord'
    };
    
    console.log('Submitting registration with user type:', processedData.userType);
    
    setIsSubmitting(true);
    try {
      // Register the user - this will automatically log in if successful
      await register(processedData);
    } catch (error) {
      console.error('Registration error:', error);
      // Show error to user
      setError("Registration failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle forgot password submission
  const onForgotPasswordSubmit = async (data: ForgotPasswordFormValues) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (response.ok) {
        // Show success message
        alert("If an account with that email exists, a password reset link has been sent.");
        setActiveTab('login');
      } else {
        const errorData = await response.json();
        console.error('Forgot password error:', errorData);
        setError(errorData.message || "Something went wrong. Please try again.");
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle reset password submission
  const onResetPasswordSubmit = async (data: ResetPasswordFormValues) => {
    setIsSubmitting(true);
    try {
      // Verify token first
      const verifyResponse = await fetch(`/api/verify-reset-token/${data.token}`);
      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json();
        setError(errorData.message || "Invalid or expired reset token. Please request a new password reset link.");
        setActiveTab('forgotPassword');
        setIsSubmitting(false);
        return;
      }
      
      // Token is valid, proceed with reset
      const resetResponse = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (resetResponse.ok) {
        alert("Your password has been successfully reset. You can now log in with your new password.");
        setActiveTab('login');
      } else {
        const errorData = await resetResponse.json();
        console.error('Password reset error:', errorData);
        setError(errorData.message || "Failed to reset password. Please try again.");
      }
    } catch (error) {
      console.error('Password reset error:', error);
      setError("An error occurred. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // If user is logged in, show dashboard button instead of auth form
  if (user || userState) {
    const currentUser = user || userState;
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md p-6">
          <CardHeader>
            <CardTitle>Welcome Back!</CardTitle>
            <CardDescription>You are already logged in as {currentUser?.username}</CardDescription>
          </CardHeader>
          <CardFooter className="flex gap-2">
            <Button onClick={handleDashboardRedirect} className="flex-1">
              Go to Dashboard
            </Button>
            <Button 
              variant="destructive" 
              onClick={async () => {
                try {
                  // Use the auth context's logout function
                  if (auth.logoutMutation) {
                    await auth.logoutMutation.mutateAsync();
                  } else if (auth.logout) {
                    await auth.logout();
                  } else {
                    // Fallback if auth context methods are not available
                    await fetch('/api/logout', { 
                      method: 'POST',
                      credentials: 'include'
                    });
                    window.location.href = '/';
                  }
                } catch (error) {
                  console.error('Logout error:', error);
                  window.location.href = '/';
                }
              }} 
              className="flex-1"
            >
              Logout
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Determine if redirection is needed
  if ((user || userState) && !isLoading) {
    const currentUser = user || userState;
    if (currentUser?.userType === 'landlord') {
      // Redirect to Service Requestor dashboard
      return <Redirect to="/landlord/dashboard" />;
    } else if (currentUser?.userType === 'contractor') {
      // Redirect to Service Provider dashboard
      return <Redirect to="/contractor/dashboard" />;
    }
    return <Redirect to="/" />;
  }

  return (
    <div className="flex min-h-screen">
      {/* Left side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:text-left">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-primary mx-auto lg:mx-0 mb-2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <h2 className="text-2xl font-bold text-foreground">
              Join <span className="gradient-text">Real Service</span>
            </h2>
            <p className="text-sm text-muted-foreground">
              Start saving on property maintenance today
            </p>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
              {activeTab === 'resetPassword' ? (
                <TabsTrigger value="resetPassword">New Password</TabsTrigger>
              ) : (
                <TabsTrigger value="forgotPassword">Reset Password</TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="login">
              <Card className="border-primary/10 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl">Welcome Back</CardTitle>
                  <CardDescription>
                    Access your account to manage your service requests and jobs
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...loginForm}>
                    <form 
                      onSubmit={loginForm.handleSubmit(onLoginSubmit)} 
                      className="space-y-4">
                      {error && <div className="text-red-500 mb-2">{error}</div>}
                      <FormField
                        control={loginForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username or Email</FormLabel>
                            <FormControl>
                              <Input 
                                type="text"
                                placeholder="Username or email" 
                                className="input-field" 
                                onKeyDown={(e) => handleEnterKey(e, loginForm.handleSubmit(onLoginSubmit))}
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input 
                                type="password" 
                                placeholder="********" 
                                className="input-field" 
                                onKeyDown={(e) => handleEnterKey(e, loginForm.handleSubmit(onLoginSubmit))}
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end mb-2">
                        <button
                          type="button"
                          className="text-sm text-primary hover:underline"
                          onClick={() => setActiveTab('forgotPassword')}
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="space-y-2">
                        <Button 
                          type="submit" 
                          className="w-full shadow-sm"
                          disabled={loginForm.formState.isSubmitting || isLoading}
                        >
                          {(loginForm.formState.isSubmitting || isLoading) ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                              <polyline points="10 17 15 12 10 7" />
                              <line x1="15" y1="12" x2="3" y2="12" />
                            </svg>
                          )}
                          Sign In
                        </Button>
                        <div className="text-center mt-4 text-sm">
                          <span className="text-muted-foreground">Don't have an account?</span>
                          <button
                            type="button"
                            className="ml-1 text-primary hover:underline"
                            onClick={() => setActiveTab('register')}
                          >
                            Sign up
                          </button>
                        </div>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="register">
              <Card className="border-primary/10 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl">Create an Account</CardTitle>
                  <CardDescription>
                    Join Real Service to start requesting or providing services
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...registerForm}>
                    <form 
                      onSubmit={registerForm.handleSubmit(onRegisterSubmit)} 
                      className="space-y-4">
                      {error && <div className="text-red-500 mb-2">{error}</div>}
                      <FormField
                        control={registerForm.control}
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
                        control={registerForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="john@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input placeholder="johndoe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="********" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone (optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="(123) 456-7890" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="userType"
                        render={({ field }) => (
                          <FormItem className="space-y-3">
                            <FormLabel>Account Type</FormLabel>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="flex flex-col space-y-2"
                            >
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="landlord" />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">
                                  Service Requestor (Landlord/Property Owner)
                                </FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="contractor" />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">
                                  Service Provider (Contractor/Professional)
                                </FormLabel>
                              </FormItem>
                            </RadioGroup>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="space-y-2 pt-2">
                        <Button 
                          type="submit" 
                          className="w-full shadow-sm"
                          disabled={registerForm.formState.isSubmitting || isLoading}
                        >
                          {(registerForm.formState.isSubmitting || isLoading) ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                              <circle cx="8.5" cy="7" r="4"></circle>
                              <line x1="20" y1="8" x2="20" y2="14"></line>
                              <line x1="17" y1="11" x2="23" y2="11"></line>
                            </svg>
                          )}
                          Sign Up
                        </Button>
                        <div className="text-center mt-4 text-sm">
                          <span className="text-muted-foreground">Already have an account?</span>
                          <button
                            type="button"
                            className="ml-1 text-primary hover:underline"
                            onClick={() => setActiveTab('login')}
                          >
                            Sign in
                          </button>
                        </div>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="forgotPassword">
              <Card className="border-primary/10 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl">Forgot Password</CardTitle>
                  <CardDescription>
                    Enter your email to reset your password
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...forgotPasswordForm}>
                    <form 
                      onSubmit={forgotPasswordForm.handleSubmit(onForgotPasswordSubmit)} 
                      className="space-y-4">
                      {error && <div className="text-red-500 mb-2">{error}</div>}
                      <FormField
                        control={forgotPasswordForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="john@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="space-y-2 pt-2">
                        <Button 
                          type="submit" 
                          className="w-full shadow-sm"
                          disabled={forgotPasswordForm.formState.isSubmitting || isLoading}
                        >
                          {(forgotPasswordForm.formState.isSubmitting || isLoading) ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                              <circle cx="12" cy="12" r="10"></circle>
                              <line x1="12" y1="8" x2="12" y2="12"></line>
                              <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                          )}
                          Send Reset Link
                        </Button>
                        <div className="text-center mt-4 text-sm">
                          <span className="text-muted-foreground">Remember your password?</span>
                          <button
                            type="button"
                            className="ml-1 text-primary hover:underline"
                            onClick={() => setActiveTab('login')}
                          >
                            Sign in
                          </button>
                        </div>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="resetPassword">
              <Card className="border-primary/10 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl">Reset Password</CardTitle>
                  <CardDescription>
                    Create a new password for your account
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...resetPasswordForm}>
                    <form 
                      onSubmit={resetPasswordForm.handleSubmit(onResetPasswordSubmit)} 
                      className="space-y-4">
                      {error && <div className="text-red-500 mb-2">{error}</div>}
                      <FormField
                        control={resetPasswordForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>New Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="********" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={resetPasswordForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirm Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="********" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="space-y-2 pt-2">
                        <Button 
                          type="submit" 
                          className="w-full shadow-sm"
                          disabled={resetPasswordForm.formState.isSubmitting || isLoading}
                        >
                          {(resetPasswordForm.formState.isSubmitting || isLoading) ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                          )}
                          Reset Password
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      {/* Right side - Hero */}
      <div className="hidden lg:block lg:w-1/2 bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="h-full flex items-center justify-center text-white p-12">
          <div className="max-w-lg space-y-8">
            <h1 className="text-4xl font-bold">Property Maintenance Made Easy</h1>
            <p className="text-xl font-light text-blue-100">
              Real Service connects property owners with skilled contractors for maintenance projects big and small.
            </p>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-300 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <h3 className="font-medium text-xl">Find Vetted Professionals</h3>
                  <p className="text-blue-200">Connect with verified contractors in your area with proven track records.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-300 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <h3 className="font-medium text-xl">Transparent Pricing</h3>
                  <p className="text-blue-200">Competitive bidding ensures you get the best value for your project.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-300 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <h3 className="font-medium text-xl">Real-Time Management</h3>
                  <p className="text-blue-200">Track project progress, chat directly with contractors, and make payments securely.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}