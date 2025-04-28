import React, { createContext, ReactNode, useContext, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User, userTypeEnum } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type LoginData = {
  email: string;   // Changed from username to email to match server's login schema
  password: string;
};

type RegisterData = {
  username: string;
  password: string;
  email: string;
  fullName: string;
  userType: typeof userTypeEnum.enumValues[number]; // "landlord" = Service Requestor, "contractor" = Service Provider
  phone?: string;
};

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  logoutMutation: UseMutationResult<void, Error, void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  // Get stored user data (if any) for immediate access
  const getInitialUserData = (): User | null => {
    try {
      const storedUser = sessionStorage.getItem('auth_user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        if (userData && userData.id) {
          console.log('Using initial user data from sessionStorage:', userData.id);
          return userData;
        }
      }
    } catch (error) {
      console.error('Error parsing stored user data:', error);
    }
    return null;
  };

  // Enhanced user authentication query with improved fallback
  const {
    data: user,
    error,
    isLoading,
    refetch,
  } = useQuery<User | null, Error>({
    queryKey: ['/api/user'],
    queryFn: async ({ queryKey }) => {
      console.log('Executing enhanced auth query');
      
      // Add a timestamp parameter to avoid cache issues
      const url = new URL(queryKey[0] as string, window.location.origin);
      url.searchParams.append('_t', Date.now().toString());
      
      // Get stored auth data (if any) - trying both localStorage (persistent) and sessionStorage (temporary)
      const localStorageData = localStorage.getItem('auth_user');
      const sessionStorageData = sessionStorage.getItem('auth_user');
      let storedUser = null;
      
      // Try localStorage first (more persistent), then fall back to sessionStorage
      const storedUserData = localStorageData || sessionStorageData;
      
      if (storedUserData) {
        try {
          storedUser = JSON.parse(storedUserData);
          console.log("Found stored user ID:", storedUser?.id);
        } catch (err) {
          console.error("Failed to parse stored user data:", err);
        }
      }
      
      // Set up headers with authentication information
      const headers: Record<string, string> = {
        "Accept": "application/json",
        "X-Requested-With": "XMLHttpRequest", 
        "Content-Type": "application/json"
      };
      
      // Add authentication headers from stored user data
      if (storedUser && storedUser.id) {
        console.log("Adding explicit user ID header:", storedUser.id);
        headers["X-User-ID"] = String(storedUser.id);
        headers["X-Auth-Token"] = `user-${storedUser.id}-${Date.now()}`;
        headers["X-Auth-Timestamp"] = Date.now().toString();
        headers["X-Force-Reload"] = "true";
        
        // Also add as query parameters as fallback
        url.searchParams.append('user_id', String(storedUser.id));
        url.searchParams.append('auth_time', Date.now().toString());
      }
      
      console.log("Auth query headers:", headers);
      
      // Make the request with enhanced authentication
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers,
        credentials: "include",
        cache: "no-store"
      });
      
      console.log(`Auth query response status:`, res.status);
      
      // If unauthorized but we have cached data, use it
      if (res.status === 401 && storedUser) {
        console.log('Using cached auth data due to 401');
        return storedUser;
      }
      
      // Handle other errors
      if (res.status !== 200) {
        if (storedUser) {
          console.log('Using cached auth data due to error');
          return storedUser;
        }
        return null;
      }
      
      // Process successful response
      const data = await res.json();
      console.log("User data from server:", data);
      
      // Save to session storage
      if (data && data.id) {
        sessionStorage.setItem('auth_user', JSON.stringify(data));
        console.log("Updated session storage with latest user data");
      }
      
      return data;
    },
    initialData: getInitialUserData, // Use stored data immediately
    staleTime: 0, // Consider data stale immediately  
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchOnMount: true, // Always refetch when component mounts
    retry: 2, // Retry twice if there's an error for better reliability
    retryDelay: 1000, // Wait 1 second between retries
  });
  
  // Enhanced authentication restoration from localStorage and sessionStorage
  useEffect(() => {
    // Only run this if we don't have a user yet and we're not currently loading
    if (!user && !isLoading) {
      try {
        // Try to restore from localStorage first (more persistent) or sessionStorage as fallback
        const localStorageUser = localStorage.getItem('auth_user');
        const sessionStorageUser = sessionStorage.getItem('auth_user');
        const storedUser = localStorageUser || sessionStorageUser;
        
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          console.log('Initializing auth from sessionStorage:', parsedUser.id);
          
          // Ensure we have a valid user object
          if (parsedUser && parsedUser.id && parsedUser.username) {
            // Set up the data in the query cache
            queryClient.setQueryData(['/api/user'], parsedUser);
            
            // Always save valid user data to both storage locations (refresh it)
            sessionStorage.setItem('auth_user', JSON.stringify(parsedUser));
            localStorage.setItem('auth_user', JSON.stringify(parsedUser));
            
            // Perform a refresh of the user data in the background to ensure it's current
            setTimeout(() => {
              queryClient.invalidateQueries({
                queryKey: ['/api/user'],
                refetchType: 'all'
              });
            }, 500);
          }
        }
      } catch (err) {
        console.error('Error restoring auth state from storage:', err);
      }
    }
  }, [user, isLoading]);
  
  // Update both storage locations whenever the user data changes
  useEffect(() => {
    if (user) {
      // Save the user data to both storage types for better persistence
      sessionStorage.setItem('auth_user', JSON.stringify(user));
      localStorage.setItem('auth_user', JSON.stringify(user));
      console.log('Updated all storage locations with latest user data');
    }
  }, [user]);
  
  // Log auth state changes
  useEffect(() => {
    console.log('Auth state loaded:', user ? 'Authenticated' : 'Not authenticated');
    if (user) {
      console.log('User data:', { id: user.id, username: user.username, userType: user.userType });
    }
  }, [user]);
  
  const loginMutation = useMutation({
    mutationFn: async (data: LoginData) => {
      const res = await apiRequest('POST', '/api/login', data);
      return res.json();
    },
    onSuccess: (userData: User) => {
      queryClient.setQueryData(['/api/user'], userData);
      toast({
        title: 'Success',
        description: 'You have successfully logged in',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Login Failed',
        description: error.message || 'Invalid credentials. Please try again.',
        variant: 'destructive',
      });
    }
  });
  
  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      const res = await apiRequest('POST', '/api/register', data);
      return res.json();
    },
    onSuccess: (userData: User) => {
      queryClient.setQueryData(['/api/user'], userData);
      toast({
        title: 'Account Created',
        description: 'Your account has been successfully created',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Registration Failed',
        description: error.message || 'Failed to create account. Please try again.',
        variant: 'destructive',
      });
    }
  });
  
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/logout');
    },
    onSuccess: () => {
      queryClient.setQueryData(['/api/user'], null);
      toast({
        title: 'Logged Out',
        description: 'You have been successfully logged out',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Logout Failed',
        description: error.message || 'Failed to log out. Please try again.',
        variant: 'destructive',
      });
    }
  });
  
  // Helper to process successful login from either method
  const handleLoginSuccess = (userData: any, usedCookies: boolean) => {
    if (userData && userData.id) {
      console.log(`Login successful using ${usedCookies ? 'cookies' : 'token-only'} - User ID:`, userData.id);
      
      // Ensure we have an auth token
      if (userData.authToken) {
        console.log(`Auth token received: ${userData.authToken.substring(0, 10)}...`);
        
        // Enhance user data with login timestamp
        userData.loginTimestamp = Date.now();
        userData.loginMethod = usedCookies ? 'cookie' : 'token';
      } else {
        console.warn("No auth token received from server");
      }
      
      // Store in both sessionStorage and localStorage for maximum persistence
      try {
        sessionStorage.setItem('auth_user', JSON.stringify(userData));
        localStorage.setItem('auth_user', JSON.stringify(userData));
        console.log("Auth data saved to both storage types for persistent login");
      } catch (storageErr) {
        console.warn("Could not save to storage:", storageErr);
      }
      
      // Set the user in the React Query cache
      queryClient.setQueryData(['/api/user'], userData);
      
      toast({
        title: 'Login Successful',
        description: `Welcome back, ${userData.fullName || userData.username}!`,
      });
      
      // Force a simple redirect to the correct dashboard page
      setTimeout(() => {
        // 'landlord' = Service Requestor, 'contractor' = Service Provider
        const destination = userData.userType === 'landlord' ? '/landlord/dashboard' : '/contractor/dashboard';
        
        // Preserve the token in the URL for token-based access (without revealing actual token)
        const url = new URL(destination, window.location.origin);
        if (!usedCookies) {
          url.searchParams.append('auth_method', 'token');
          url.searchParams.append('uid', userData.id.toString());
          url.searchParams.append('ts', userData.timestamp?.toString() || Date.now().toString());
        }
        
        window.location.href = url.toString();
      }, 300);
      
      // Return the user data
      return userData;
    } else {
      throw new Error('Invalid response data');
    }
  };
  
  const login = async (data: LoginData) => {
    console.log('Attempting direct login...');
    try {
      // First try without cookies to ensure compatibility with environments where cookies cause issues
      const res = await fetch('/api/direct-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-No-Cookies': 'true',         // Signal server we don't want to rely on cookies
          'X-Timestamp': Date.now().toString(),  // Prevent caching
        },
        body: JSON.stringify(data),
        credentials: 'omit'               // Explicitly omit cookies from request
      });
      
      if (!res.ok) {
        // If first attempt fails, try with cookies as fallback
        console.log('First login attempt failed, trying with cookies...');
        
        const retryRes = await fetch('/api/direct-login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
          credentials: 'include'          // Include cookies on retry
        });
        
        if (!retryRes.ok) {
          const errorText = await retryRes.text();
          throw new Error(errorText || 'Login failed');
        }
        
        // Parse response from cookie-based attempt
        const userData = await retryRes.json();
        return handleLoginSuccess(userData, true);
      }
      
      // Parse response from cookie-less attempt
      const userData = await res.json();
      return handleLoginSuccess(userData, false);
      
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: 'Login Failed',
        description: error instanceof Error ? error.message : 'Invalid credentials',
        variant: 'destructive',
      });
      throw error;
    }
  };
  
  const register = async (data: RegisterData) => {
    console.log('Attempting registration with direct approach...');
    try {
      // First register the user
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Registration failed');
      }
      
      const userData = await res.json();
      
      if (userData && userData.id) {
        console.log("Registration successful - User ID:", userData.id);
        
        // Then perform a direct login to get the auth token
        return login({
          email: data.email, // Use email instead of username to match the loginSchema
          password: data.password
        });
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('Registration error:', err);
      
      toast({
        title: 'Registration Failed',
        description: err instanceof Error ? err.message : 'An error occurred during registration',
        variant: 'destructive',
      });
      
      throw err;
    }
  };
  
  const logout = async () => {
    console.log('Attempting logout...');
    try {
      await logoutMutation.mutateAsync();
      
      // Clear auth data from cache
      queryClient.setQueryData(['/api/user'], null);
      
      // Clear both storage locations
      sessionStorage.removeItem('auth_user');
      localStorage.removeItem('auth_user');
      
      console.log('Logout succeeded, auth data cleared from all storages');
      
      toast({
        title: 'Logged Out',
        description: 'You have been successfully logged out'
      });
      
      // Immediate redirect to the home page
      window.location.href = "/";
    } catch (err) {
      console.error('Logout error:', err);
      // Even if logout had an error, redirect to homepage for better user experience
      window.location.href = "/";
      throw err;
    }
  };
  
  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        error,
        login,
        register,
        logout,
        logoutMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}