import { useState, useEffect, useCallback, useRef } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { createWebSocket } from '@/lib/websocket-utils';

type ChatMessage = {
  id?: number;
  chatRoomId: number | null;
  senderId: number;
  content: string;
  type: string;
  timestamp: string;
  senderName?: string;
  jobInfo?: {
    id: number;
    title: string;
    image?: string;
    category?: string;
  };
};

type WebSocketMessage = {
  type: string;
  id?: number;
  message?: string;
  chatRoomId?: number;
  content?: string;
  senderId?: number;
  messageType?: string;
  timestamp?: string;
  senderName?: string;
  jobInfo?: {
    id: number;
    title: string;
    image?: string;
    category?: string;
  };
};

// Enhanced chat hook with better error handling
export function useChat(roomIdOrJobId: number, senderId: number, senderName: string, isJobId = false) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatRoomId, setChatRoomId] = useState<number | null>(null);
  const [otherUserInfo, setOtherUserInfo] = useState<{id: number, name: string} | null>(null);

  // Start with polling mode as it's more reliable in most environments
  const [usingPollingFallback, setUsingPollingFallback] = useState(true);
  const { toast } = useToast();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const pollingIntervalRef = useRef<NodeJS.Timeout>();
  const retryAttemptsRef = useRef(0);
  const maxRetryAttempts = 3;
  
  // Keep track of whether we've already loaded messages
  const hasLoadedMessages = useRef(false);
  const lastMessageTimestampRef = useRef<string | null>(null);
  
  // Store all seen message IDs to prevent duplicates
  const seenMessageIds = useRef<Set<number | string>>(new Set());
  
  // Track connection attempts
  const connectionAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  
  // First, get the chatRoomId if we were given a jobId
  useEffect(() => {
    const fetchChatRoomId = async () => {
      // Reset states when fetching a new chat room
      setIsLoading(true);
      setIsError(false);
      setErrorMessage(null);
      
      if (isJobId) {
        try {
          // Get or create a chat room for this job
          const response = await apiRequest('GET', `/api/chat/job/${roomIdOrJobId}`);
          
          // Check if response is OK
          if (!response.ok) {
            // Handle specific HTTP error statuses
            if (response.status === 404) {
              setIsError(true);
              setErrorMessage(`No chat room found for job #${roomIdOrJobId}. The job might not exist or you may not have access to it.`);
              setIsLoading(false);
              return;
            } else if (response.status === 403) {
              setIsError(true);
              setErrorMessage('You do not have permission to access this chat room.');
              setIsLoading(false);
              return;
            } else {
              // For other errors, try to get the error message from the response
              const errorData = await response.json().catch(() => null);
              const errorMsg = errorData?.message || `Error ${response.status}: Failed to load chat`;
              setIsError(true);
              setErrorMessage(errorMsg);
              setIsLoading(false);
              return;
            }
          }
          
          const data = await response.json();
          
          // Handle both response formats for backward compatibility
          if (data) {
            // If data is the chat room object directly
            if (data.id) {
              console.log(`Found chat room ${data.id} for job ${roomIdOrJobId}`);
              setChatRoomId(data.id);
              
              // Set other user info if available
              if (data.participants) {
                const otherParticipant = data.participants.find((p: any) => p.userId !== senderId);
                if (otherParticipant) {
                  setOtherUserInfo({
                    id: otherParticipant.userId,
                    name: otherParticipant.name || 'Unknown User'
                  });
                }
              }
            } 
            // If data contains a chatRoom property (older format)
            else if (data.chatRoom && data.chatRoom.id) {
              console.log(`Found chat room ${data.chatRoom.id} for job ${roomIdOrJobId}`);
              setChatRoomId(data.chatRoom.id);
              
              // Set other user info if available
              if (data.chatRoom.participants) {
                const otherParticipant = data.chatRoom.participants.find((p: any) => p.userId !== senderId);
                if (otherParticipant) {
                  setOtherUserInfo({
                    id: otherParticipant.userId,
                    name: otherParticipant.name || 'Unknown User'
                  });
                }
              }
            } 
            // No valid chat room found
            else {
              console.error('Failed to get chat room ID for job', roomIdOrJobId);
              setIsError(true);
              setErrorMessage('No valid chat room found for this job. The contractor may not have been assigned yet.');
            }
          } else {
            console.error('Failed to get chat room data for job', roomIdOrJobId);
            setIsError(true);
            setErrorMessage('Failed to load chat data. Please try again.');
          }
        } catch (error) {
          console.error('Error fetching chat room for job:', error);
          setIsError(true);
          setErrorMessage('Could not connect to chat service. Please check your internet connection and try again.');
        } finally {
          setIsLoading(false);
        }
      } else {
        // If we were given a chatRoomId directly, use that
        setChatRoomId(roomIdOrJobId);
        setIsLoading(false);
      }
    };
    
    fetchChatRoomId();
    
    // Cleanup function to clear any intervals or timeouts
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [roomIdOrJobId, isJobId, senderId, toast]);
  
  // Load messages for the current chat room
  useEffect(() => {
    // Don't try to fetch messages until we have a valid chat room ID
    if (!chatRoomId || isError) return;
    
    const fetchMessages = async () => {
      // Reset loading state when changing chat rooms
      setIsLoading(true);
      hasLoadedMessages.current = false;
      
      try {
        // Retry a few times if the chat room is not found
        // This is helpful when a chat room was just created and might not be immediately available
        let response;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts) {
          response = await apiRequest('GET', `/api/chat/room/${chatRoomId}`);
          
          if (response.ok) break;
          
          // If we get a 404, the chat room might be newly created, so we'll wait a bit and try again
          if (response.status === 404 && attempts < maxAttempts - 1) {
            attempts++;
            // Exponential backoff - wait longer between each retry
            await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempts)));
            continue;
          }
          
          // For other errors, or if we've reached max retries, handle the error and stop
          if (response.status === 404) {
            setIsError(true);
            setErrorMessage(`Chat room #${chatRoomId} not found. It may have been deleted.`);
            setIsLoading(false);
            return;
          } else {
            const errorData = await response.json().catch(() => null);
            const errorMsg = errorData?.message || `Error ${response.status}: Failed to load chat messages`;
            setIsError(true);
            setErrorMessage(errorMsg);
            setIsLoading(false);
            return;
          }
        }
        
        const data = await response!.json();
        
        // Set messages and mark as loaded
        setMessages(data.messages || []);
        
        // Mark all messages as seen for deduplication
        (data.messages || []).forEach((msg: ChatMessage) => {
          const messageId = msg.id || `${msg.senderId}-${msg.content}-${msg.timestamp}`;
          seenMessageIds.current.add(messageId);
        });
        
        hasLoadedMessages.current = true;
        
        // If we need to start polling, do so now
        if (usingPollingFallback) {
          startPollingFallback();
        }
      } catch (error) {
        console.error('Failed to fetch messages:', error);
        setIsError(true);
        setErrorMessage('Failed to load chat history. Please try refreshing the page.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMessages();
    
    // Clean up any existing polling when the chat room changes
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = undefined;
      }
    };
  }, [chatRoomId, usingPollingFallback, isError]);

  // Polling fallback implementation for when WebSockets aren't working
  const startPollingFallback = () => {
    console.log('Starting polling fallback for messages');
    
    // Set as connected since we can send and receive messages in polling mode
    setIsConnected(true);
    
    // Stop any existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    // Start polling for new messages every 3 seconds
    pollingIntervalRef.current = setInterval(async () => {
      try {
        if (!chatRoomId || isError) return; // Safety check
        
        const response = await apiRequest('GET', `/api/chat/room/${chatRoomId}`);
        if (!response.ok) {
          // If we get a 404 after previously successful connections, 
          // it likely means the chat room was deleted
          if (response.status === 404 && hasLoadedMessages.current) {
            console.error('Chat room not found during polling, may have been deleted');
            // Increment retry attempts
            retryAttemptsRef.current++;
            
            // If we've retried too many times, show an error
            if (retryAttemptsRef.current > maxRetryAttempts) {
              setIsError(true);
              setErrorMessage('This chat room appears to be unavailable. It may have been deleted.');
              // Stop polling
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
              }
            }
            return;
          }
          
          console.error('Error polling for messages:', response.statusText);
          return;
        }
        
        // Reset retry attempts on successful response
        retryAttemptsRef.current = 0;
        
        const data = await response.json();
        if (!data.messages || !data.messages.length) return;
        
        // Instead of filtering and adding, completely replace the messages
        // But keep track of seen messages for deduplication on send
        data.messages.forEach((msg: ChatMessage) => {
          // Generate unique ID for deduplication
          const messageId = msg.id || `${msg.senderId}-${msg.content}-${msg.timestamp}`;
          // Add to seen messages for future deduplication
          seenMessageIds.current.add(messageId);
        });
        
        // Replace all messages instead of appending
        setMessages(data.messages || []);
      } catch (error) {
        console.error('Error in polling fallback:', error);
        
        // Increment retry attempts
        retryAttemptsRef.current++;
        
        // If we've retried too many times, show an error
        if (retryAttemptsRef.current > maxRetryAttempts) {
          setIsError(true);
          setErrorMessage('Unable to connect to chat service. Please check your internet connection.');
          // Stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
        }
      }
    }, 3000);
  };
    
  // Connect to WebSocket only if user is authenticated
  useEffect(() => {
    // Don't attempt to connect if we don't have a valid chat room ID
    if (!chatRoomId) return;
    
    // **CRITICAL AUTH GUARD**: Only attempt WebSocket connection if we have valid authentication
    // Must check for user token before any WebSocket connection is attempted
    let isAuthenticated = false;
    let userToken = null;
    
    try {
      // First check for valid auth token in sessionStorage (primary) or localStorage (backup)
      const storedUser = sessionStorage.getItem('auth_user') || localStorage.getItem('auth_user');
      
      // ALSO check if we have a user_id cookie as another verification
      const cookies = document.cookie.split(';').map(c => c.trim());
      const userIdCookie = cookies.find(c => c.startsWith('user_id='));
      
      // Only proceed if we have explicit user data
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          // We must have a valid user ID AND either an internal token or user_id cookie
          isAuthenticated = !!(userData && userData.id && (userData.token || userIdCookie));
          
          if (userData && userData.id) {
            userToken = `user-${userData.id}-${Date.now()}`;
          }
          
          if (!isAuthenticated) {
            console.log('WebSocket connection SKIPPED - No authenticated user or token');
            // Set an informative error without showing a destructive message
            setIsError(true);
            setErrorMessage('Authentication required for chat. Please sign in to your account.');
            return;
          }
        } catch (parseError) {
          console.log('WebSocket skipped - Invalid user data format');
          return;
        }
      } else {
        console.log('WebSocket connection SKIPPED - No user data in storage');
        setIsError(true);
        setErrorMessage('Session expired. Please sign in to continue.');
        return;
      }
    } catch (err) {
      console.log('WebSocket connection SKIPPED - Auth check failed', err);
      setIsError(true);
      setErrorMessage('Authentication error. Please sign in again.');
      return;
    }
    
    // Additional guard - if we made it here but don't have a token, don't connect
    if (!userToken) {
      console.log('WebSocket connection SKIPPED - Missing user token');
      setIsError(true);
      setErrorMessage('Authentication token required. Please sign in again.');
      return;
    }
    
    // Reset seen messages when changing chat rooms
    seenMessageIds.current = new Set();
    // Reset connection attempts when intentionally changing rooms
    connectionAttemptsRef.current = 0;
    
    const connectWebSocket = () => {
      try {
        // Don't attempt to connect if we don't have a valid chat room ID
        if (!chatRoomId) return;
        
        // If we already have a socket and it's open, no need to reconnect
        if (socket && socket.readyState === WebSocket.OPEN) {
          // Make sure to join the chat room even if already connected
          socket.send(JSON.stringify({ 
            type: 'join', 
            chatRoomId: chatRoomId, // Safe because we check for chatRoomId above
            senderId
          }));
          setIsConnected(true);
          return;
        }
        
        // Close existing socket if it exists but is not in OPEN state
        if (socket) {
          try {
            socket.close();
          } catch (e) {
            console.error("Error closing existing socket:", e);
          }
        }
        
        // Limit reconnection attempts
        if (connectionAttemptsRef.current >= maxReconnectAttempts) {
          console.warn(`Maximum reconnection attempts (${maxReconnectAttempts}) reached`);
          setUsingPollingFallback(true);
          startPollingFallback();
          return;
        }
        
        connectionAttemptsRef.current++;
        console.log(`WebSocket connection attempt ${connectionAttemptsRef.current} of ${maxReconnectAttempts}`);
        
        // For Replit environment:
        // To ensure compatibility with Replit's proxy setup, we need a robust WebSocket URL
        // that works with their subdomain structure
        const isSecure = window.location.protocol === 'https:';
        const wsProtocol = isSecure ? 'wss:' : 'ws:';
        
        // Use direct access to port 80 (which is externally mapped from 5000)
        // with explicit path to avoid conflicts with Vite's WebSocket
        const wsUrl = `${wsProtocol}//${window.location.host}/api/chat-ws`;
        
        console.log(`Attempting to connect to WebSocket at: ${wsUrl} (try ${connectionAttemptsRef.current} of ${maxReconnectAttempts})`);
        
        // Create socket using the centralized WebSocket utility with authentication guard
        // This will only create a socket if the user is authenticated
        const newSocket = createWebSocket(wsUrl, {
          id: `chat_${chatRoomId}_${senderId}`,
          purpose: `Chat for room ${chatRoomId}`,
          onError: (error) => {
            console.error('WebSocket connection error:', error);
            setIsConnected(false);
            
            // If error is related to authentication, show a friendly message
            const errorMessage = error instanceof ErrorEvent ? error.message : String(error);
            if (errorMessage.includes('auth') || errorMessage.includes('Not authenticated')) {
              setIsError(true);
              setErrorMessage('Authentication required. Please sign in to continue.');
              setUsingPollingFallback(false); // Don't use polling if not authenticated
            }
          },
          onOpen: () => {
            console.log('WebSocket connection established');
            setIsConnected(true);
            setUsingPollingFallback(false); // Disable polling if WebSocket works
            
            // Join the specific chat room - only if chatRoomId is available and socket exists
            // This should be safe because onOpen is only called if socket creation succeeded
            if (chatRoomId !== null && socket) {
              socket.send(JSON.stringify({ 
                type: 'join', 
                chatRoomId: chatRoomId,
                senderId
              }));
            }
            
            // Reset connection attempts on successful connection
            connectionAttemptsRef.current = 0;
          }
        });
        
        // If we didn't get a socket back due to auth issues, handle gracefully
        if (!newSocket) {
          console.log('No WebSocket was created - likely due to authentication failure');
          setIsConnected(false);
          setIsError(true);
          setErrorMessage('Please sign in to use chat features.');
          return;
        }
        
        // Important: Set socket state BEFORE adding event handlers
        // This ensures the socket reference is available in the onOpen handler
        setSocket(newSocket);
        
        // Add connection timeout for the successfully created socket
        const connectionTimeout = setTimeout(() => {
          if (newSocket && newSocket.readyState !== WebSocket.OPEN) {
            console.error("WebSocket connection timeout");
            newSocket.close();
          }
        }, 5000); // Shorter timeout for faster feedback
        
        // Now we can safely add additional event handlers
        // At this point we're guaranteed newSocket is not null
        newSocket.onclose = (event) => {
          console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
          setIsConnected(false);
          
          // Automatic reconnection with backoff
          if (!usingPollingFallback) {
            // Clear any existing reconnect timeout
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }
            
            // Calculate backoff time (exponential backoff with maximum time)
            const backoffTime = Math.min(1000 * Math.pow(1.5, connectionAttemptsRef.current), 10000);
            console.log(`Attempting to reconnect in ${backoffTime}ms...`);
            
            // Schedule reconnection attempt
            reconnectTimeoutRef.current = setTimeout(() => {
              // Only reconnect if we're not using polling fallback
              if (!usingPollingFallback) {
                connectWebSocket();
              }
            }, backoffTime);
          }
        };
        
        newSocket.onmessage = (event) => {
          try {
            // Basic validation
            if (!event.data) {
              console.error('Received empty WebSocket message');
              return;
            }
            
            // Handle different message types
            if (typeof event.data === 'string') {
              try {
                // Try to parse as JSON
                const data: WebSocketMessage = JSON.parse(event.data);
                
                // Handle "ping" messages from server
                if (data.type === 'ping') {
                  console.log('Ping received, sending pong');
                  // Respond with a pong to keep the connection alive
                  if (newSocket && newSocket.readyState === WebSocket.OPEN) {
                    newSocket.send(JSON.stringify({ type: 'pong' }));
                  }
                  return;
                }
                
                // Handle join acknowledgement
                if (data.type === 'join_ack') {
                  console.log(`Successfully joined chat room ${data.chatRoomId}`);
                  // If the server sent us a different chat room ID than what we requested,
                  // update our state to match
                  if (data.chatRoomId && data.chatRoomId !== chatRoomId) {
                    console.log(`Server assigned chat room ${data.chatRoomId} instead of ${chatRoomId}`);
                    setChatRoomId(data.chatRoomId); 
                  }
                  return;
                }
                
                // Handle new messages
                if (data.type === 'message') {
                  // Extract message data
                  const messageId = data.id || `${data.senderId}-${data.content}-${data.timestamp}`;
                  
                  // Skip if we've already seen this message
                  if (seenMessageIds.current.has(messageId)) {
                    return;
                  }
                  
                  // Mark as seen
                  seenMessageIds.current.add(messageId);
                  
                  // Create message object
                  const newMessage: ChatMessage = {
                    id: data.id,
                    chatRoomId: data.chatRoomId || chatRoomId || 0, // Fix for type error
                    senderId: data.senderId || 0,
                    content: data.content || '',
                    type: data.messageType || 'text',
                    timestamp: data.timestamp || new Date().toISOString(),
                    senderName: data.senderName,
                    jobInfo: data.jobInfo
                  };
                  
                  // Append to messages state
                  setMessages(prev => {
                    // Check if this is a duplicate (shouldn't happen due to seenMessageIds check, but just in case)
                    const isDuplicate = prev.some(msg => 
                      (msg.id === newMessage.id) || 
                      (msg.senderId === newMessage.senderId && 
                       msg.content === newMessage.content && 
                       Math.abs(new Date(msg.timestamp).getTime() - new Date(newMessage.timestamp).getTime()) < 2000)
                    );
                    
                    return isDuplicate ? prev : [...prev, newMessage];
                  });
                }
              } catch (error) {
                console.error('Error parsing WebSocket message:', error, event.data);
              }
            }
          } catch (error) {
            console.error('Error handling WebSocket message:', error);
          }
        };
        
        setSocket(newSocket);
      } catch (error) {
        console.error('Error connecting to WebSocket:', error);
        // Fall back to polling on connection error
        setUsingPollingFallback(true);
        startPollingFallback();
      }
    };
    
    // Initial connection
    connectWebSocket();
    
    // Cleanup function
    return () => {
      // Clear timeouts and intervals
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Import and close socket using the WebSocket utility if possible
      try {
        import('@/lib/websocket-utils').then(({ closeWebSocket }) => {
          // Close socket using the centralized manager with a clean shutdown reason
          if (socket) {
            closeWebSocket(socket, 1000, 'Component unmounted');
            console.log('WebSocket closed via utility during component cleanup');
          }
        }).catch(err => {
          console.error('Failed to import WebSocket utilities:', err);
          // Fallback to direct closing
          if (socket) {
            socket.close(1000, 'Component unmounted');
          }
        });
      } catch (error) {
        console.error('Error closing WebSocket:', error);
        // Fallback to direct closing
        if (socket) {
          socket.close(1000, 'Component unmounted');
        }
      }
      
      // Clear socket reference
      setSocket(null);
    };
  }, [chatRoomId, senderId, senderName, socket, usingPollingFallback]);
  
  // For the fallback method (API based sending)
  const sendMessageFallback = async (content: string, type: string = 'text') => {
    if (!content.trim()) {
      return; // Don't send empty messages
    }
    
    const timestamp = new Date().toISOString();
    const clientMessageId = Date.now();
    
    try {
      // Generate a tracking signature for this message
      const messageSignature = `${senderId}-${content}-${timestamp}`;
      
      // Add to our seen messages to prevent duplication when it comes back from API
      seenMessageIds.current.add(clientMessageId);
      seenMessageIds.current.add(messageSignature);
      
      // Optimistically add to UI
      const newMessage: ChatMessage = {
        id: clientMessageId,
        chatRoomId: chatRoomId, // Safe due to null check below
        senderId,
        content,
        type,
        timestamp,
        senderName,
        jobInfo: undefined // Will get updated when job info is returned from the server
      };
      
      // Check if this is a duplicate before adding
      setMessages(prev => {
        const isDuplicate = prev.some(msg => 
          (msg.senderId === senderId && 
           msg.content === content && 
           // Allow small time differences (within 2 seconds)
           Math.abs(new Date(msg.timestamp).getTime() - new Date(timestamp).getTime()) < 2000)
        );
        
        return isDuplicate ? prev : [...prev, newMessage];
      });
      
      // Verify chat room ID before sending
      if (!chatRoomId) {
        toast({
          title: 'Cannot send message',
          description: 'Chat room not available',
          variant: 'destructive'
        });
        return;
      }
      
      // Send via API for persistence
      const response = await apiRequest('POST', `/api/chat/room/${chatRoomId}/messages`, {
        content,
        type,
        senderId,
        senderName
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      // The API will return the created message with a real ID
      const savedMessage = await response.json();
      
      // Replace our temporary client message with the saved one from the server (if not already done by polling)
      if (savedMessage && savedMessage.id) {
        seenMessageIds.current.add(savedMessage.id);
        
        // Update the message in our list with the server-generated ID
        setMessages(prev => {
          return prev.map(msg => {
            if (msg.id === clientMessageId) {
              return { ...msg, id: savedMessage.id };
            }
            return msg;
          });
        });
      }
    } catch (error) {
      console.error('Error sending message via API:', error);
      toast({
        title: 'Failed to send message',
        description: 'Please try again',
        variant: 'destructive'
      });
    }
  };
  
  // Main function to send a message
  const sendMessage = useCallback(async (content: string, type: string = 'text') => {
    // If we're using the polling fallback or WebSocket is not connected, use fallback
    if (usingPollingFallback || !socket || socket.readyState !== WebSocket.OPEN) {
      await sendMessageFallback(content, type);
      return;
    }
    
    if (!content.trim()) {
      return; // Don't send empty messages
    }
    
    const timestamp = new Date().toISOString();
    // Generate a unique ID for this message for deduplication
    const clientMessageId = Date.now();
    
    // First try to verify if the chat room exists and create if needed
    try {
      // Generate a tracking signature for this message
      const messageSignature = `${senderId}-${content}-${timestamp}`;
      
      // Add to our seen messages to prevent duplication when it comes back via websocket
      seenMessageIds.current.add(clientMessageId);
      seenMessageIds.current.add(messageSignature);
      
      // Optimistically add to UI
      const newMessage: ChatMessage = {
        id: clientMessageId,
        chatRoomId: chatRoomId, // Safe because we check below
        senderId,
        content,
        type,
        timestamp,
        senderName,
        jobInfo: undefined // Will get updated when job info is returned from the server
      };
      
      // Check if this is a duplicate before adding
      setMessages(prev => {
        const isDuplicate = prev.some(msg => 
          (msg.senderId === senderId && 
           msg.content === content && 
           // Allow small time differences (within 2 seconds)
           Math.abs(new Date(msg.timestamp).getTime() - new Date(timestamp).getTime()) < 2000)
        );
        
        return isDuplicate ? prev : [...prev, newMessage];
      });
      
      // Only send via WebSocket if we have a valid chat room ID
      if (chatRoomId) {
        socket.send(JSON.stringify({
          type: 'message',
          chatRoomId: chatRoomId, // Safe because of the if check
          senderId,
          senderName,
          content,
          messageType: type,
          timestamp
        }));
      } else {
        console.error('Cannot send message: No valid chat room ID');
        toast({
          title: 'Cannot send message',
          description: 'Chat room not available',
          variant: 'destructive'
        });
        // Fallback to API method
        await sendMessageFallback(content, type);
      }
    } catch (error) {
      console.error('Error sending message via WebSocket:', error);
      toast({
        title: 'Message sending failed',
        description: 'Trying alternative method...',
        variant: 'destructive'
      });
      
      // Fallback to API method
      await sendMessageFallback(content, type);
    }
  }, [socket, chatRoomId, senderId, senderName, toast, seenMessageIds, usingPollingFallback]);
  
  // Return all the properties with appropriate types
  return {
    messages,
    sendMessage,
    isConnected,
    isLoading,
    usingPollingFallback,
    isError,
    errorMessage,
    otherUserInfo
  } as {
    messages: ChatMessage[];
    sendMessage: (content: string, type?: string) => Promise<void>;
    isConnected: boolean;
    isLoading: boolean;
    usingPollingFallback: boolean;
    isError: boolean;
    errorMessage: string | null;
    otherUserInfo: { id: number; name: string } | null;
  };
}