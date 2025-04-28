import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Send, MessageCircle, RefreshCcw, AlertCircle, X, Minus } from 'lucide-react';
import { useChat } from '@/hooks/use-chat-fixed';
import { formatDistanceToNow } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ChatInterfaceProps {
  chatRoomId: number;
  userId: number;
  userName: string;
  otherUserName: string;
  className?: string;
  isJobId?: boolean;
  onClose?: (action?: 'minimize' | 'close') => void;
  isTestMode?: boolean; // For testing UI without needing a chat room
}

export function ChatInterface({ 
  chatRoomId, 
  userId, 
  userName, 
  otherUserName, 
  className = '', 
  isJobId = false,
  onClose,
  isTestMode = false
}: ChatInterfaceProps) {
  const [message, setMessage] = useState('');
  const [testMessages, setTestMessages] = useState<Array<{
    id: number;
    chatRoomId: number;
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
  }>>([
    {
      id: 1,
      chatRoomId: chatRoomId,
      senderId: userId === 1 ? 2 : 1, // Make sure it's not the current user
      content: "Hello! I received your job request. When would be a good time to discuss the details?",
      type: "text",
      timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      senderName: otherUserName,
      jobInfo: {
        id: 123,
        title: "Kitchen Sink Repair",
        image: "/uploads/jobs/kitchen-sink.jpg",
        category: "Plumbing"
      }
    }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Use the enhanced chat hook with error handling when not in test mode
  const { 
    messages: realMessages, 
    sendMessage: realSendMessage, 
    isConnected, 
    isLoading: realIsLoading, 
    usingPollingFallback, 
    isError: realIsError,
    errorMessage: realErrorMessage,
    otherUserInfo 
  } = isTestMode ? {
    messages: [],
    sendMessage: () => {},
    isConnected: true,
    isLoading: false,
    usingPollingFallback: false,
    isError: false,
    errorMessage: "",
    otherUserInfo: null
  } : useChat(chatRoomId, userId, userName, isJobId);
  
  // Use real or test data based on mode
  const messages = isTestMode ? testMessages : realMessages;
  const isLoading = isTestMode ? false : realIsLoading;
  const isError = isTestMode ? false : realIsError;
  const errorMessage = isTestMode ? "" : realErrorMessage;
  
  // Custom send handler for test mode
  const sendMessage = (text: string) => {
    if (isTestMode) {
      // Add the user's message
      const newMessage = {
        id: testMessages.length + 1,
        chatRoomId: chatRoomId,
        senderId: userId,
        content: text,
        type: "text",
        timestamp: new Date().toISOString(),
        senderName: userName
      };
      setTestMessages(prev => [...prev, newMessage]);
      
      // Simulate a reply after a short delay
      setTimeout(() => {
        const replyMessage = {
          id: testMessages.length + 2,
          chatRoomId: chatRoomId,
          senderId: userId === 1 ? 2 : 1, // Make sure it's not the current user
          content: "Thanks for your message! I'll get back to you soon.",
          type: "text",
          timestamp: new Date().toISOString(),
          senderName: otherUserName,
          jobInfo: {
            id: 123,
            title: "Kitchen Sink Repair",
            image: "/uploads/jobs/kitchen-sink.jpg", 
            category: "Plumbing"
          }
        };
        setTestMessages(prev => [...prev, replyMessage]);
      }, 2000);
    } else {
      // Use the real send function
      realSendMessage(text);
    }
  };
  
  // Focus the input field when the chat loads
  useEffect(() => {
    if (!isLoading && !isError && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading, isError]);
  
  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (messagesEndRef.current && messagesContainerRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (message.trim()) {
      sendMessage(message);
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Get user initials for avatar fallback
  const getUserInitials = (name: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  // Use other user's name from hook if available (for proper display)
  const displayOtherUserName = otherUserInfo?.name || otherUserName;

  return (
    <div 
      className={`flex flex-col w-full ${className}`} 
      style={{ 
        height: '100%',
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden',
        minHeight: '400px' // Set minimum height to ensure content isn't cut off
      }}
    >
      {/* Chat Header - fixed height */}
      <div 
        className="px-2 py-1.5 border-b border-blue-800 flex items-center gap-1.5 bg-blue-900 text-white shrink-0"
      >
        <div className="flex-1 flex items-center gap-2">
          <Avatar className="h-5 w-5 bg-blue-800 text-white text-xs">
            <AvatarFallback>{getUserInitials(displayOtherUserName)}</AvatarFallback>
          </Avatar>
          <div className="font-medium text-sm text-white">{displayOtherUserName}</div>
        </div>
        <div className="flex items-center gap-1">
          {/* Added minimize button */}
          {onClose && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-5 w-5 text-blue-300 hover:text-white hover:bg-blue-800"
              onClick={() => onClose('minimize')}
            >
              <Minus className="h-3 w-3" />
              <span className="sr-only">Minimize</span>
            </Button>
          )}
          {/* Close button */}
          {onClose && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-5 w-5 text-blue-300 hover:text-white hover:bg-blue-800"
              onClick={() => onClose('close')}
            >
              <X className="h-3 w-3" />
              <span className="sr-only">Close</span>
            </Button>
          )}
        </div>
      </div>
      
      {/* Message Container - flexible height */}
      <div 
        className="flex-grow overflow-y-auto p-3 bg-blue-950" 
        ref={messagesContainerRef}
      >
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-blue-200">Loading conversation...</p>
          </div>
        ) : isError ? (
          <div className="h-full flex flex-col items-center justify-center p-6">
            <div className="max-w-md mb-4 bg-blue-950 p-4 rounded-lg border border-blue-800 text-white">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5 text-amber-400" />
                <p className="font-semibold">Waiting for chat data</p>
              </div>
              <p className="text-sm text-blue-200">
                This chat may not be accessible yet. If this is a job from the dashboard, please try again later.
              </p>
            </div>
            <Button 
              variant="outline" 
              className="mt-2 bg-blue-900 text-white hover:bg-blue-800 border-blue-800"
              onClick={() => window.location.reload()}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center">
            <div className="mb-4">
              <MessageCircle className="h-12 w-12 text-blue-400 mx-auto mb-2" />
              <h3 className="text-lg font-semibold mb-1 text-white">Start a Conversation</h3>
              <p className="text-blue-200 text-sm max-w-md">
                No messages yet. Type in the box below to send your first message to {displayOtherUserName}.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {messages.map((msg, index) => {
              const isSender = msg.senderId === userId;
              const displayName = isSender ? 'You' : displayOtherUserName;
              
              return (
                <div 
                  key={msg.id || index} 
                  className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}
                >
                  <div className="flex max-w-[75%]">
                    {/* Only show avatar for non-sender messages */}
                    {!isSender && (
                      <Avatar className="h-5 w-5 mr-1 mt-1 flex-shrink-0 text-xs bg-blue-800">
                        <AvatarFallback>{getUserInitials(displayOtherUserName)}</AvatarFallback>
                      </Avatar>
                    )}
                    <div>
                      {/* Timestamp only, no redundant name display */}
                      <div className="flex items-center gap-2 mb-0.5 justify-end">
                        <span className="text-xs text-blue-300">
                          {msg.timestamp && !isNaN(new Date(msg.timestamp).getTime()) 
                            ? formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })
                            : 'just now'}
                        </span>
                      </div>
                      <div 
                        className={`rounded-lg px-2 py-1 text-sm ${
                          isSender 
                            ? 'bg-blue-800 text-white' 
                            : 'bg-blue-900 text-white'
                        }`}
                      >
                        {/* Display job info with thumbnail if available */}
                        {msg.jobInfo && (
                          <div className="mb-1.5 border border-blue-900 rounded-md overflow-hidden bg-blue-900">
                            <div className="flex items-start">
                              {msg.jobInfo.image && (
                                <div className="w-8 h-8 flex-shrink-0">
                                  <img 
                                    src={msg.jobInfo.image} 
                                    alt={msg.jobInfo.title || 'Job image'} 
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              <div className="p-0.5 flex-1 min-w-0">
                                <div className="font-medium text-xs truncate text-white mb-0.5">
                                  {msg.jobInfo.title || 'Untitled Job'}
                                </div>
                                <div className="flex items-center justify-between">
                                  <div className="text-xs text-blue-200 truncate">
                                    {msg.jobInfo.category || 'General'}
                                  </div>
                                  <span className="bg-blue-800 px-1 py-0.5 text-[10px] rounded text-white ml-1">
                                    #{msg.jobInfo.id}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        {msg.content}
                      </div>
                    </div>
                    {isSender && (
                      <Avatar className="h-5 w-5 ml-1 mt-1 flex-shrink-0 text-xs bg-blue-800">
                        <AvatarFallback>{getUserInitials(userName)}</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} style={{ marginBottom: '6px' }} />
          </div>
        )}
      </div>
      
      {/* Input Container - fixed height */}
      <div 
        className="p-3 border-t border-blue-900 bg-blue-950 shrink-0"
        style={{ minHeight: '52px' }} /* Smaller min-height for better space utilization */
      >
        <div className="flex gap-2 items-center">
          <Input
            placeholder="Type a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading || isError}
            className="flex-1 py-1.5 px-3 text-sm rounded-full border-none bg-blue-900 text-white placeholder-blue-200 focus:ring-1 focus:ring-blue-700 focus:border-transparent"
            autoComplete="off"
            ref={inputRef}
          />
          <Button 
            size="icon"
            variant={isError ? "secondary" : "default"}
            className="h-8 w-8 rounded-full flex-shrink-0 bg-blue-800 hover:bg-blue-700 border-none"
            onClick={handleSendMessage}
            disabled={isLoading || isError || !message.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Only show critical error message, removed all other status indicators */}
        {isError && (
          <p className="text-xs text-center mt-2 text-red-600">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500 mr-1"></span>
            Unable to send messages. Please try reloading the page.
          </p>
        )}
      </div>
    </div>
  );
}