/**
 * WebSocket utilities for managing connections and cleanup
 * 
 * This module provides a centralized way to create, manage, and clean up
 * WebSocket connections in the application.
 */

// Track all active WebSocket connections
interface TrackedWebSocket extends WebSocket {
  _id?: string;
  _purpose?: string;
  _authToken?: string;
}

// Active WebSocket registry
const activeWebSockets: Map<string, TrackedWebSocket> = new Map();

/**
 * Check if user is authenticated before establishing a WebSocket connection
 * @returns {boolean} True if authentication is valid, false otherwise
 */
export function isWebSocketAuthValid(): boolean {
  try {
    // Check for user data in session/local storage
    const storedUser = sessionStorage.getItem('auth_user') || localStorage.getItem('auth_user');
    
    // Check for user_id cookie as additional verification
    const cookies = document.cookie.split(';').map(c => c.trim());
    const userIdCookie = cookies.find(c => c.startsWith('user_id='));
    
    if (!storedUser) {
      console.log('WebSocket auth check: No stored user data found');
      return false;
    }
    
    // Parse and verify user data
    const userData = JSON.parse(storedUser);
    
    // Validate required auth fields
    if (!userData || !userData.id) {
      console.log('WebSocket auth check: Invalid user data - missing ID');
      return false;
    }
    
    // Strong validation - we must have a user ID AND either a token or cookie
    return !!(userData.id && (userData.token || userIdCookie));
  } catch (error) {
    console.error('WebSocket auth check failed:', error);
    return false;
  }
}

/**
 * Create a new WebSocket connection with authentication check and tracking
 * @param url The WebSocket URL to connect to
 * @param options Additional options for the connection
 * @returns A tracked WebSocket connection or null if auth check fails
 */
export function createWebSocket(url: string, options: {
  id?: string;
  purpose?: string;
  onOpen?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  protocols?: string | string[];
  skipAuthCheck?: boolean; // Optional flag to bypass auth check
} = {}): WebSocket | null {
  // AUTHENTICATION CHECK - Skip WebSocket creation entirely if not authenticated
  // This is the critical part that prevents unnecessary connection attempts after logout
  if (!options.skipAuthCheck && !isWebSocketAuthValid()) {
    console.log('WebSocket creation blocked - Authentication required');
    
    // If onError callback was provided, call it with auth error
    if (options.onError) {
      const authError = new ErrorEvent('error', { 
        message: 'Authentication required for WebSocket connection',
        error: new Error('Not authenticated')
      });
      options.onError(authError);
    }
    
    return null;
  }
  
  // Generate a unique ID if not provided
  const socketId = options.id || `socket_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const purpose = options.purpose || 'general';
  
  // Handle production vs development WebSocket URLs
  let wsUrl = url;
  const wsEnvUrl = import.meta.env.VITE_WEBSOCKET_URL;
  
  if (wsEnvUrl) {
    // In production, use the absolute WebSocket URL from environment variables
    // If the URL is a relative path like /api/chat-ws, use it with the base URL
    if (url.startsWith('/')) {
      // For absolute paths, strip the leading / since the env var includes the full URL with trailing /
      wsUrl = `${wsEnvUrl}${url.substring(1)}`;
    } else {
      // For non-path URLs, use as-is (likely already a full URL)
      wsUrl = url;
    }
    console.log(`Using production WebSocket URL: ${wsUrl}`);
  } else {
    // In development, construct the WebSocket URL from the current origin
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl = url.startsWith('ws') ? url : `${protocol}//${window.location.host}${url}`;
    console.log(`Using development WebSocket URL: ${wsUrl}`);
  }
  
  // Create WebSocket with protocol if provided
  const socket: TrackedWebSocket = options.protocols 
    ? new WebSocket(wsUrl, options.protocols)
    : new WebSocket(wsUrl);
  
  // Track socket metadata
  socket._id = socketId;
  socket._purpose = purpose;
  
  // Add auth token if available
  try {
    const storedUser = sessionStorage.getItem('auth_user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      if (userData && userData.id) {
        socket._authToken = `user-${userData.id}-${Date.now()}`;
      }
    }
  } catch (err) {
    console.warn('Failed to add auth token to socket:', err);
  }
  
  // Store in active connections
  activeWebSockets.set(socketId, socket);
  
  // Add standard listeners with tracking
  socket.addEventListener('open', (event) => {
    console.log(`WebSocket connected: ${socketId} (${purpose})`);
    if (options.onOpen) options.onOpen(event);
  });
  
  socket.addEventListener('message', (event) => {
    if (options.onMessage) options.onMessage(event);
  });
  
  socket.addEventListener('close', (event) => {
    console.log(`WebSocket closed: ${socketId} (${purpose}) Code: ${event.code}`);
    // Remove from tracking when closed
    activeWebSockets.delete(socketId);
    if (options.onClose) options.onClose(event);
  });
  
  socket.addEventListener('error', (event) => {
    console.error(`WebSocket error: ${socketId} (${purpose})`, event);
    if (options.onError) options.onError(event);
  });
  
  return socket;
}

/**
 * Close a specific WebSocket connection
 * @param socketOrId The WebSocket instance or ID to close
 * @param code The close code (default: 1000 - Normal Closure)
 * @param reason The reason for closing (default: "User initiated closure")
 * @returns True if the socket was found and closed, false otherwise
 */
export function closeWebSocket(
  socketOrId: WebSocket | string,
  code: number = 1000,
  reason: string = "User initiated closure"
): boolean {
  let socket: TrackedWebSocket | undefined;
  
  if (typeof socketOrId === 'string') {
    // Find by ID
    socket = activeWebSockets.get(socketOrId);
  } else {
    // Find the tracked reference if we have a socket instance
    for (const [id, trackedSocket] of activeWebSockets.entries()) {
      if (trackedSocket === socketOrId) {
        socket = trackedSocket;
        break;
      }
    }
  }
  
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.close(code, reason);
    return true;
  }
  
  return false;
}

/**
 * Close all active WebSocket connections
 * @param code The close code (default: 1000 - Normal Closure)
 * @param reason The reason for closing (default: "User logout")
 * @returns Number of connections closed
 */
export function closeAllWebSockets(
  code: number = 1000,
  reason: string = "User logout"
): number {
  let closedCount = 0;
  
  activeWebSockets.forEach((socket, id) => {
    if (socket.readyState === WebSocket.OPEN) {
      console.log(`Closing WebSocket during cleanup: ${id} (${socket._purpose || 'unknown'})`);
      socket.close(code, reason);
      closedCount++;
    }
  });
  
  // Clear the tracking map
  activeWebSockets.clear();
  
  // Also check for any dedicated chat sockets not in our registry
  try {
    // Check for any chat sockets in the global scope
    const anyWindow = window as any;
    if (anyWindow.chatSocket && anyWindow.chatSocket.readyState === WebSocket.OPEN) {
      anyWindow.chatSocket.close(code, reason);
      closedCount++;
    }
  } catch (error) {
    console.error('Error closing chat socket:', error);
  }
  
  return closedCount;
}

/**
 * Get all active WebSocket connections
 * @returns Array of tracked WebSockets
 */
export function getActiveWebSockets(): TrackedWebSocket[] {
  return Array.from(activeWebSockets.values());
}

/**
 * Get a specific WebSocket by ID
 * @param id The WebSocket ID
 * @returns The WebSocket instance or undefined if not found
 */
export function getWebSocketById(id: string): WebSocket | undefined {
  return activeWebSockets.get(id);
}

/**
 * Send a message to all active WebSockets
 * @param data The data to send
 * @param filter Optional filter function to determine which sockets receive the message
 * @returns Number of sockets the message was sent to
 */
export function broadcastToWebSockets(
  data: string | ArrayBufferLike | Blob | ArrayBufferView, 
  filter?: (socket: TrackedWebSocket) => boolean
): number {
  let sentCount = 0;
  
  activeWebSockets.forEach((socket) => {
    if (socket.readyState === WebSocket.OPEN && (!filter || filter(socket))) {
      socket.send(data);
      sentCount++;
    }
  });
  
  return sentCount;
}

// For compatibility with the logout utility
export { closeAllWebSockets as closeAllActiveSockets };