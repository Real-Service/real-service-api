import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Special handling for unauthorized (401) responses - important for logout
    if (res.status === 401) {
      // Check if we're already on the auth page to avoid redirect loops
      const isAuthPage = window.location.pathname.includes('/auth');
      if (!isAuthPage) {
        console.log('Session expired - Silent redirect to auth page');
        // For 401, we handle this more gracefully - no error thrown
        // This allows API calls after logout to fail silently without red console errors
        window.location.href = '/auth';
        return; // Don't throw error for 401 - just redirect
      } else {
        // On auth page already, just return without error
        console.log('Auth required - already on auth page, no redirect needed');
        return;
      }
    }
    
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  customHeaders?: Record<string, string>,
): Promise<Response> {
  // Use the API URL from environment variables if available, otherwise fallback to relative URL
  const apiBaseUrl = import.meta.env.VITE_API_URL || '';
  console.log("Using API base URL:", apiBaseUrl || '[using relative URL]');
  
  // Determine if we need to construct an absolute URL or use a relative path
  let fullUrl: URL;
  
  if (apiBaseUrl) {
    // In production with absolute URL configuration
    // If the URL starts with /api/, remove it since the env var already includes /api
    const apiPath = url.startsWith('/api/') ? url.substring(5) : url;
    fullUrl = new URL(apiPath, apiBaseUrl);
    console.log(`Using absolute API URL: ${fullUrl.toString()}`);
  } else {
    // In development with relative URL
    fullUrl = new URL(url, window.location.origin);
    console.log(`Using relative API URL: ${fullUrl.toString()}`);
  }
  fullUrl.searchParams.append('_t', Date.now().toString());
  
  // Always try to get auth info from sessionStorage 
  const userData = sessionStorage.getItem('auth_user');
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "X-Requested-With": "XMLHttpRequest"
  };
  
  // Add custom headers if provided
  if (customHeaders) {
    Object.keys(customHeaders).forEach(key => {
      headers[key] = customHeaders[key];
    });
  };
  
  // Always add user ID from session storage for ALL endpoints except login/register
  // This enables a dual auth strategy that works even if cookies aren't persisting
  if (userData && url !== '/api/login' && url !== '/api/register') {
    try {
      const user = JSON.parse(userData);
      if (user && user.id) {
        console.log("Using backup user ID header:", user.id);
        // Add the user ID to all API requests - this is critical for maintaining authentication
        headers["X-User-ID"] = String(user.id);
        headers["X-Auth-Token"] = `user-${user.id}-${Date.now()}`;
        
        // Add force reload flag if needed
        if (url === '/api/user') {
          headers["X-Force-Reload"] = "true";
          headers["X-Auth-Timestamp"] = Date.now().toString();
        }
        
        // Special handling for profile updates
        if (url.includes('/contractor-profile/') || url.includes('/landlord-profile/')) {
          // Add extra authentication for profile updates
          headers["X-Auth-User-ID"] = String(user.id);
          headers["X-Auth-Timestamp"] = Date.now().toString();
          
          // For contractor profile updates, always ensure user ID matches
          if (url.includes('/contractor-profile/')) {
            console.log("Adding special contractor profile headers, user ID:", user.id);
            headers["X-Contractor-ID"] = String(user.id);
            headers["X-User-Type"] = "contractor";
          }
          
          // Special handling for service area updates
          if (data && typeof data === 'object' && (
              'serviceArea' in data || 'serviceRadius' in data
          )) {
            console.log("Adding special headers for service area update");
            headers["X-Service-Area-Update"] = "true";
            headers["X-Map-Auth"] = `user-${user.id}-${Date.now()}`;
          }
        }
        
        // Also set as a query parameter in case headers are stripped
        fullUrl.searchParams.append('user_id', String(user.id));
        
        // Always add X-Request-With header to help identify AJAX requests
        headers["X-Requested-With"] = "XMLHttpRequest";
      }
    } catch (err) {
      console.error("Failed to parse stored user data:", err);
    }
  }
  
  // Enhanced fetch with more explicit cookie handling
  const res = await fetch(fullUrl.toString(), {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", // Always include credentials for cookie-based auth
    cache: "no-store", // Never cache auth requests
  });

  // Check if we're getting any cookies back
  const cookies = res.headers.get('set-cookie');
  console.log(`API Request ${method} ${url} - Response status:`, res.status, 
               "Set-Cookie:", cookies ? 'yes' : 'no');
  
  await throwIfResNotOk(res);
  
  // If this is a login or registration request, handle user data
  if ((url === '/api/login' || url === '/api/register') && res.ok) {
    try {
      // Get user data from response
      const userData = await res.clone().json();
      console.log("Auth operation successful:", userData);
      
      // Always save valid user data to session storage
      if (userData && userData.id) {
        console.log("Saving user data to session storage:", userData.id);
        sessionStorage.setItem('auth_user', JSON.stringify(userData));
        
        // Force a delay to ensure cookies are processed
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log("After auth operation, Document cookies:", document.cookie);
      }
    } catch (err) {
      console.error("Error saving auth state:", err);
    }
  }
  
  // If this is the user endpoint and it was successful, update session storage
  if (url === '/api/user' && res.ok) {
    try {
      const userData = await res.clone().json();
      if (userData && userData.id) {
        console.log("Updating session storage with user data:", userData.id);
        sessionStorage.setItem('auth_user', JSON.stringify(userData));
      }
    } catch (err) {
      console.error("Error updating session storage:", err);
    }
  }
  
  // If this is a logout, clear ALL storage
  if (url === '/api/logout') {
    console.log("Clearing ALL storage after logout");
    // Clear session storage
    sessionStorage.removeItem('auth_user');
    
    // Clear localStorage in case it's also used
    localStorage.removeItem('auth_user');
    localStorage.removeItem('user_token');
    localStorage.removeItem('user_id');
    
    // Clear any remaining auth-related items
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.includes('auth') || key.includes('user') || key.includes('token'))) {
        sessionStorage.removeItem(key);
      }
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('auth') || key.includes('user') || key.includes('token'))) {
        localStorage.removeItem(key);
      }
    }
    
    console.log("Logout succeeded, auth data cleared from all storages");
    
    // Force reload after logout to ensure a clean state
    setTimeout(() => {
      window.location.href = '/auth';
    }, 100);
  }
  
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    console.log('Executing query:', queryKey[0]);
    
    // Use the API URL from environment variables if available, otherwise fallback to relative URL
    const apiBaseUrl = import.meta.env.VITE_API_URL || '';
    console.log("Using API base URL for query:", apiBaseUrl || '[using relative URL]');
    
    // Determine if we need to construct an absolute URL or use a relative path
    let url: URL;
    
    if (apiBaseUrl) {
      // In production with absolute URL configuration
      // If the URL starts with /api/, remove it since the env var already includes /api
      const apiPath = (queryKey[0] as string).startsWith('/api/') 
        ? (queryKey[0] as string).substring(5) 
        : (queryKey[0] as string);
      url = new URL(apiPath, apiBaseUrl);
      console.log(`Using absolute API URL for query: ${url.toString()}`);
    } else {
      // In development with relative URL
      url = new URL(queryKey[0] as string, window.location.origin);
      console.log(`Using relative API URL for query: ${url.toString()}`);
    }
    url.searchParams.append('_t', Date.now().toString());
    
    // List all cookies for debugging
    console.log('Document cookies:', document.cookie);
    
    // Always get auth info from sessionStorage for robust authentication
    const userData = sessionStorage.getItem('auth_user');
    const headers: Record<string, string> = {
      "Accept": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/json"
    };
    
    // Add authentication headers from session storage for all queries
    if (userData) {
      try {
        const user = JSON.parse(userData);
        if (user && user.id) {
          console.log("Using backup user ID header for query:", user.id);
          // Add multiple authentication headers to ensure one gets through
          headers["X-User-ID"] = String(user.id);
          headers["X-Auth-Token"] = `user-${user.id}-${Date.now()}`;
          headers["X-Auth-Timestamp"] = Date.now().toString();
          
          // Add force reload flag for user endpoint
          if (queryKey[0] === '/api/user') {
            headers["X-Force-Reload"] = "true";
          }
          
          // Add user type if available
          if (user.userType) {
            headers["X-User-Type"] = user.userType;
          }
          
          // Also set as query parameters in case headers are stripped
          url.searchParams.append('user_id', String(user.id));
          url.searchParams.append('auth_time', Date.now().toString());
        }
      } catch (err) {
        console.error("Failed to parse stored user data for query:", err);
      }
    }
    
    // Make the request with enhanced authentication
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers,
      credentials: "include", // Always include credentials
      cache: "no-store", // Never cache to ensure fresh data
    });

    console.log(`Query ${queryKey[0]} - Response status:`, res.status);

    // Handle 401 errors based on behavior setting
    if (res.status === 401) {
      // Special case: for /api/user endpoint, try to use cached user data instead of returning null
      if (queryKey[0] === '/api/user' && unauthorizedBehavior === "returnNull" && userData) {
        try {
          console.log('Using cached user data from session storage due to 401');
          const user = JSON.parse(userData);
          if (user && user.id) {
            // Return cached user data as fallback
            return user;
          }
        } catch (err) {
          console.error("Failed to use cached user data:", err);
        }
      }
      
      // Check if we should redirect or return quietly
      const isAuthPage = window.location.pathname.includes('/auth');
      if (!isAuthPage) {
        // Only redirect if we're not already on the auth page
        console.log('Session expired, redirecting to auth page');
        window.location.href = '/auth';
      }
      
      if (unauthorizedBehavior === "returnNull") {
        console.log('User not authenticated, returning null without error');
        return null;
      }
    }

    // Handle other errors
    await throwIfResNotOk(res);
    const data = await res.json();
    
    // For auth-related endpoints, log the state and update session storage
    if (queryKey[0] === '/api/user' && data) {
      // Check if the response is actually a successful auth response with user data
      // or if it's an error or unauthorized message in unusual format
      if (data.id && data.username) {
        console.log('Auth state loaded:', 'Authenticated');
        console.log('User data:', data);
        
        // Always update session storage with latest user data
        sessionStorage.setItem('auth_user', JSON.stringify(data));
      } else {
        // If we got a response but it doesn't have expected user fields,
        // it could be an error message or other non-user data
        console.log('Auth query returned non-user data:', data);
        if (!data.id) {
          console.log('Auth state loaded: Not authenticated (no user ID)');
          sessionStorage.removeItem('auth_user');
        }
      }
    }
    
    return data;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
