/**
 * Comprehensive logout utilities for secure user session termination
 * 
 * This module provides functions to completely terminate a user session,
 * including closing any active websockets, clearing all storage types,
 * and performing a clean navigation to the login screen.
 */

import { queryClient } from './queryClient';

interface LogoutOptions {
  /** Custom redirect URL after logout (defaults to /auth) */
  redirectUrl?: string;
  /** Force a full browser reload after logout */
  forceReload?: boolean;
  /** Disable automatic redirect after logout */
  noRedirect?: boolean;
  /** Callback to execute after all cleanup is complete but before redirect */
  onLogoutComplete?: () => void;
  /** Custom message to display on successful logout */
  successMessage?: string;
}

/**
 * Close all active WebSocket connections
 */
export function closeAllWebSockets() {
  console.log('Closing all active WebSocket connections');
  
  try {
    // Import and use the dedicated WebSocket utility if available
    import('./websocket-utils').then(({ closeAllWebSockets: closeAll }) => {
      const closedCount = closeAll(1000, 'User logged out');
      console.log(`Closed ${closedCount} WebSocket connections via WebSocket utilities`);
    }).catch(err => {
      console.error('Failed to import WebSocket utilities:', err);
      fallbackCloseWebSockets();
    });
  } catch (error) {
    console.error('Error using WebSocket utilities:', error);
    fallbackCloseWebSockets();
  }
}

/**
 * Fallback method to close WebSockets if the utility module isn't available
 */
function fallbackCloseWebSockets() {
  console.log('Using fallback WebSocket closing method');
  
  // Find any WebSocket instances in the global window scope
  const webSocketKeys = Object.keys(window).filter(key => {
    try {
      return window[key as keyof Window] instanceof WebSocket;
    } catch (e) {
      return false;
    }
  });

  // Close all found WebSocket connections with a clean logout code
  webSocketKeys.forEach(key => {
    try {
      const socket = window[key as keyof Window] as WebSocket;
      if (socket && socket.readyState === WebSocket.OPEN) {
        console.log(`Closing WebSocket: ${key}`);
        socket.close(1000, 'User logged out');
      }
    } catch (error) {
      console.error(`Failed to close WebSocket ${key}:`, error);
    }
  });

  // Also check for any WebSockets stored in the chat module
  try {
    // Check for any dedicated chat sockets
    const anyWindow = window as any;
    if (anyWindow.chatSocket && anyWindow.chatSocket.readyState === WebSocket.OPEN) {
      console.log('Closing chat WebSocket connection');
      anyWindow.chatSocket.close(1000, 'User logged out');
    }
  } catch (error) {
    console.error('Error closing chat socket:', error);
  }
}

/**
 * Clear all authentication data from browser storage
 */
export function clearAuthStorage() {
  console.log('Clearing ALL auth storage');
  
  // Clear localStorage
  try {
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('auth_timestamp');
    // Clear any additional auth data in localStorage
    const localStorageKeys = Object.keys(localStorage);
    localStorageKeys.forEach(key => {
      if (key.includes('auth_') || key.includes('user_') || key.includes('token')) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Error clearing localStorage:', error);
  }

  // Clear sessionStorage
  try {
    sessionStorage.removeItem('auth_user');
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('user_id');
    sessionStorage.removeItem('auth_timestamp');
    // Clear any additional auth data in sessionStorage
    const sessionStorageKeys = Object.keys(sessionStorage);
    sessionStorageKeys.forEach(key => {
      if (key.includes('auth_') || key.includes('user_') || key.includes('token')) {
        sessionStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Error clearing sessionStorage:', error);
  }

  // Clear cookies (can only clear those not marked HttpOnly)
  try {
    document.cookie = 'user_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'auth_timestamp=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'sid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'connect.sid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  } catch (error) {
    console.error('Error clearing cookies:', error);
  }
}

/**
 * Clear all auth-related query cache
 */
export function clearQueryCache() {
  try {
    // Invalidate all auth-related queries
    queryClient.removeQueries({ queryKey: ['/api/user'] });
    queryClient.removeQueries({ queryKey: ['/api/auth'] });
    queryClient.removeQueries({ queryKey: ['/api/me'] });
    
    // Clear contractor-specific data
    queryClient.removeQueries({ queryKey: ['/api/contractor-profile'] });
    queryClient.removeQueries({ queryKey: ['/api/bids'] });
    
    // Clear landlord-specific data
    queryClient.removeQueries({ queryKey: ['/api/landlord-profile'] });
    queryClient.removeQueries({ queryKey: ['/api/properties'] });
    
    // Clear job-related data
    queryClient.removeQueries({ queryKey: ['/api/jobs'] });
    
    // Set auth-related data to null
    queryClient.setQueryData(['/api/user'], null);
    
    // Optional: clear entire cache if needed
    // queryClient.clear();
  } catch (error) {
    console.error('Error clearing query cache:', error);
  }
}

/**
 * Call the server's logout endpoint
 * This is important to invalidate the session on the server
 */
export async function serverLogout(): Promise<boolean> {
  try {
    // Get the base URL from environment or use a relative path
    const baseUrl = import.meta.env.VITE_API_URL || '';
    const logoutUrl = `${baseUrl}/api/logout`;
    
    console.log(`Calling server logout endpoint: ${logoutUrl}`);
    
    const response = await fetch(logoutUrl, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': localStorage.getItem('user_id') || '',
        'X-Force-Logout': 'true'
      }
    });
    
    if (response.ok) {
      console.log('Server logout successful');
      return true;
    } else {
      console.error('Server logout failed:', response.status);
      // Even if server logout fails, we should still clear client-side storage
      return false;
    }
  } catch (error) {
    console.error('Error during server logout:', error);
    return false;
  }
}

/**
 * Comprehensive logout function that:
 * 1. Closes any open WebSockets
 * 2. Calls the server logout endpoint
 * 3. Clears all auth data from client storage
 * 4. Clears relevant query cache
 * 5. Redirects to login page or performs a page reload
 */
export async function performFullLogout(options: LogoutOptions = {}): Promise<void> {
  console.log('Starting full logout process...');
  
  // Close all WebSocket connections
  closeAllWebSockets();
  
  try {
    // Call server logout endpoint
    await serverLogout();
  } catch (error) {
    console.error('Server logout failed, continuing with client logout:', error);
  }
  
  // Clear all auth storage (both session and local)
  clearAuthStorage();
  
  // Clear query cache
  clearQueryCache();
  
  // Clear any in-memory auth state
  try {
    // Clear any custom auth state properties that might exist
    const anyWindow = window as any;
    if (anyWindow.__AUTH_STATE) {
      anyWindow.__AUTH_STATE = null;
    }
  } catch (error) {
    console.error('Error clearing in-memory auth state:', error);
  }
  
  // Execute the completion callback if provided
  if (options.onLogoutComplete) {
    try {
      options.onLogoutComplete();
    } catch (error) {
      console.error('Error in logout completion callback:', error);
    }
  }
  
  // Handle redirect or reload
  if (!options.noRedirect) {
    const redirectUrl = options.redirectUrl || '/auth';
    
    if (options.forceReload) {
      // Force a full page reload to clear everything
      console.log('Performing full page reload for complete state reset');
      window.location.href = redirectUrl;
      setTimeout(() => {
        window.location.reload();
      }, 100);
    } else {
      // Use regular navigation
      console.log(`Redirecting to ${redirectUrl}`);
      window.location.href = redirectUrl;
    }
  }
}

// Expose a window-level logout function for emergency use
// This allows manual logout from browser console: window.emergencyLogout()
try {
  const anyWindow = window as any;
  anyWindow.emergencyLogout = performFullLogout;
} catch (error) {
  console.error('Error setting emergency logout function:', error);
}