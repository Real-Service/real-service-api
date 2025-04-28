import { useState, useEffect, useCallback, useRef } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

type ChatMessage = {
  id?: number;
  chatRoomId: number | null;
  senderId: number;
  content: string;
  type: string;
  timestamp: string;
  senderName?: string;
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
  
  // Connect to WebSocket
  useEffect(() => {
    // Don't attempt to connect if we don't have a valid chat room ID
    if (!chatRoomId) return;
    
    // Reset seen messages when changing chat rooms
    seenMessageIds.current = new Set();
    // Reset connection attempts when intentionally changing rooms
    connectionAttemptsRef.current = 0;
    
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
    
    const connectWebSocket = () => {
      try {
        // Don't attempt to connect if we don't have a valid chat room ID
        if (!chatRoomId) return;
        
        // If we already have a socket and it's open, no need to reconnect
        if (socket && socket.readyState === WebSocket.OPEN) {
          // Make sure to join the chat room even if already connected
          socket.send(JSON.stringify({ 
            type: 'join', 
            chatRoomId: chatRoomId,
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
        
        // Connect to the WebSocket server with explicit URL construction
        // IMPORTANT: For WebSockets in a Replit environment, we need to handle connections differently
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        
        // For Replit environment:
        // To ensure compatibility with Replit's proxy setup, we need a robust WebSocket URL
        // that works with their subdomain structure
        const isSecure = window.location.protocol === 'https:';
        const wsProtocol = isSecure ? 'wss:' : 'ws:';
        
        // Use direct access to port 80 (which is externally mapped from 5000)
        // with explicit path to avoid conflicts with Vite's WebSocket
        const wsUrl = `${wsProtocol}//${window.location.host}/api/chat-ws`;
        
        console.log('WebSocket URL constructed for Replit environment:', wsUrl, 
                    'Current path:', window.location.pathname,
                    'Protocol:', protocol);
        
        console.log(`Attempting to connect to WebSocket at: ${wsUrl} (try ${connectionAttemptsRef.current} of ${maxReconnectAttempts})`);
        
        // Create socket with explicit error handler
        const newSocket = new WebSocket(wsUrl);
        
        // Immediately register onerror for better debugging
        newSocket.onerror = (error) => {
          console.error('WebSocket connection error:', error);
          setIsConnected(false);
        };
        
        // Add connection timeout
        const connectionTimeout = setTimeout(() => {
          if (newSocket && newSocket.readyState !== WebSocket.OPEN) {
            console.error("WebSocket connection timeout");
            newSocket.close();
          }
        }, 5000); // Shorter timeout for faster feedback
        
        newSocket.onopen = () => {
          // Clear connection timeout when successfully connected
          clearTimeout(connectionTimeout);
          
          // Reset connection attempts on successful connection
          connectionAttemptsRef.current = 0;
          setIsConnected(true);
          
          console.log("WebSocket connected successfully");
          
          // Join the specific chat room
          newSocket.send(JSON.stringify({ 
            type: 'join', 
            chatRoomId: chatRoomId,
            senderId
          }));
        };
        
        newSocket.onclose = (event) => {
          console.log(`WebSocket closed with code: ${event.code}, reason: ${event.reason}`);
          setIsConnected(false);
          
          // Attempt to reconnect after 3 seconds if we haven't reached max attempts
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          
          if (connectionAttemptsRef.current < maxReconnectAttempts) {
            reconnectTimeoutRef.current = setTimeout(() => {
              connectWebSocket();
            }, 3000);
          } else {
            // Switch to polling fallback if WebSocket connection fails repeatedly
            console.log('Switching to polling fallback due to WebSocket connection failures');
            setUsingPollingFallback(true);
            startPollingFallback();
          }
        };
        
        newSocket.onmessage = (event) => {
          try {
            const data: WebSocketMessage = JSON.parse(event.data);
            
            // Handle various message types
            switch (data.type) {
              case 'ping':
                // Respond to ping with pong to keep connection alive
                console.log('Received ping from server, sending pong...');
                if (newSocket.readyState === WebSocket.OPEN) {
                  newSocket.send(JSON.stringify({ type: 'pong' }));
                }
                return;
              
              case 'joined':
                console.log(`Successfully joined chat room ${data.chatRoomId}`);
                return;
                
              case 'connected':
                console.log('Connected to WebSocket server with client ID:', data.id || 'unknown');
                
                // Send join message to register for this chat room
                if (newSocket.readyState === WebSocket.OPEN) {
                  newSocket.send(JSON.stringify({ 
                    type: 'join', 
                    chatRoomId: chatRoomId,
                    senderId 
                  }));
                }
                return;
                
              case 'message':
                if (data.chatRoomId === chatRoomId) {
                  // Generate a unique ID for message deduplication
                  const messageId = data.id || `${data.senderId}-${data.content}-${data.timestamp}`;
                  
                  // Skip if we've already seen this message
                  if (seenMessageIds.current.has(messageId)) {
                    return;
                  }
                  
                  // Mark as seen
                  seenMessageIds.current.add(messageId);
                  
                  const newMessage: ChatMessage = {
                    id: data.id || Date.now(), // Use server ID if available
                    chatRoomId: data.chatRoomId || chatRoomId,
                    senderId: data.senderId || 0,
                    content: data.content || '',
                    type: data.messageType || 'text',
                    timestamp: data.timestamp || new Date().toISOString(),
                    senderName: data.senderId === senderId ? senderName : undefined
                  };
                  
                  console.log('Processing image/message:', newMessage);
                  
                  // Check for duplicates
                  setMessages(prev => {
                    // Prevent duplicate messages
                    const isDuplicate = prev.some(msg => 
                      (msg.id && msg.id === newMessage.id) || 
                      (msg.senderId === newMessage.senderId && 
                       msg.content === newMessage.content && 
                       msg.timestamp === newMessage.timestamp)
                    );
                    
                    return isDuplicate ? prev : [...prev, newMessage];
                  });
                }
                break;
                
              default:
                console.log('Unhandled message type:', data.type);
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };
        
        setSocket(newSocket);
        
        return () => {
          // Clear the connection timeout if the socket is closed during timeout period
          clearTimeout(connectionTimeout);
          
          if (newSocket.readyState === WebSocket.OPEN || 
              newSocket.readyState === WebSocket.CONNECTING) {
            newSocket.close();
          }
        };
      } catch (error) {
        console.error('Failed to connect to WebSocket:', error);
        
        // Attempt to reconnect after 3 seconds
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      }
    };
    
    // Initial connection
    if (!usingPollingFallback) {
      connectWebSocket();
    } else {
      startPollingFallback();
    }
    
    return () => {
      if (socket) {
        socket.close();
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [chatRoomId, senderId, senderName, socket, usingPollingFallback]);
  
  // Add a special fallback send functionality for when WebSocket isn't available
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
        chatRoomId,
        senderId,
        content,
        type,
        timestamp,
        senderName
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
        timestamp
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error saving message:', errorData);
        
        toast({
          title: 'Message Not Saved',
          description: 'Your message might not be delivered to other users.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      toast({
        title: 'Message Not Sent',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive'
      });
    }
  };
  
  // Send a message
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
        chatRoomId,
        senderId,
        content,
        type,
        timestamp,
        senderName
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
          chatRoomId: chatRoomId,
          senderId,
          senderName,
          content,
          messageType: type,
          timestamp,
          id: clientMessageId // Include client ID to help with deduplication
        }));
      }
      
      // Also send to server API for persistence
      const response = await apiRequest('POST', `/api/chat/room/${chatRoomId}/messages`, {
        content,
        type,
        senderId,
        timestamp
      });
      
      if (!response.ok) {
        // If there's an error, we show a toast but keep the message in the UI
        // as the websocket may have delivered it to other participants
        const errorData = await response.json();
        console.error('Server error saving message:', errorData);
        
        toast({
          title: 'Message Sent',
          description: 'Your message was delivered but might not be saved permanently.',
          variant: 'default'
        });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      toast({
        title: 'Message Not Saved',
        description: 'Your message was sent but not saved permanently. The chat system may be experiencing issues.',
        variant: 'destructive'
      });
    }
  }, [socket, chatRoomId, senderId, senderName, toast, seenMessageIds, usingPollingFallback]);
  
  return {
    messages,
    sendMessage,
    isConnected,
    isLoading,
    usingPollingFallback
  };
}