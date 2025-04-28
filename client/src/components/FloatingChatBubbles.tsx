import React, { useState, useMemo, useEffect } from "react";
import { X, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ChatInterface } from "./ChatInterface";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProfileAvatar } from "./ProfileAvatar";
import { useUnreadMessages } from "../hooks/use-unread-messages";
import { motion, AnimatePresence } from "framer-motion";

// Helper function to get image based on category/title
const getCategoryImage = (title: string): string => {
  const titleLower = title.toLowerCase();
  if (titleLower.includes('plumbing')) return 'plumbing.svg';
  if (titleLower.includes('electrical')) return 'electrical.svg';
  if (titleLower.includes('painting')) return 'painting.svg';
  if (titleLower.includes('flooring')) return 'flooring.svg';
  if (titleLower.includes('kitchen')) return 'kitchen-sink.svg';
  if (titleLower.includes('bathroom')) return 'bathroom-light.svg';
  if (titleLower.includes('hvac') || titleLower.includes('heat')) return 'smart-thermostat.svg';
  if (titleLower.includes('ceiling')) return 'ceiling-fan.svg';
  return 'default-job-image.svg';
};

// Import the UnreadData type from the hook
type UnreadData = {
  chatRoomId: number;
  unreadCount: number;
  lastRead: string;
  jobDetails: {
    id: number;
    title: string;
    otherParticipantId: number;
    otherParticipantName: string;
  } | null;
};

interface ChatBubble {
  id: number;
  title: string;
  jobId?: number;
  chatRoomId: number;
  otherUserId: number;
  otherUserName: string;
  otherUserAvatar?: string;
  jobImage?: string;  // Added job image property
  lastMessage?: string;
  unreadCount?: number;
  timestamp?: string;
}

interface FloatingChatBubblesProps {
  userId: number;
  userName: string;
  userAvatar?: string;
  chatBubbles: ChatBubble[];
  onCloseBubble?: (bubbleId: number) => void;
  useTestBubbles?: boolean; // Flag to enable test bubbles
}

export function FloatingChatBubbles({
  userId,
  userName,
  userAvatar,
  chatBubbles: providedChatBubbles,
  onCloseBubble,
  useTestBubbles = false // Set to false in production
}: FloatingChatBubblesProps) {
  // Create some test chat bubbles if needed
  const testBubbles: ChatBubble[] = [
    {
      id: 1001,
      title: "Kitchen Faucet Installation",
      chatRoomId: 2001,
      otherUserId: 1001,
      otherUserName: "John Smith",
      unreadCount: 2,
      lastMessage: "When can you come by?",
      timestamp: new Date().toISOString()
    },
    {
      id: 1002,
      title: "Bathroom Remodel",
      chatRoomId: 2002,
      otherUserId: 1002,
      otherUserName: "Sarah Johnson",
      unreadCount: 0,
      lastMessage: "The tiles look great!",
      timestamp: new Date().toISOString()
    },
    {
      id: 1003,
      title: "Flooring Project",
      chatRoomId: 2003,
      otherUserId: 1003,
      otherUserName: "Mike Davis",
      unreadCount: 3,
      lastMessage: "Do you need any additional materials?",
      timestamp: new Date().toISOString()
    }
  ];
  
  // Fetch unread message counts
  const { 
    unreadCounts, 
    totalUnreadCount, 
    markAsRead 
  } = useUnreadMessages(userId);
  
  // Use test bubbles if flag is set, otherwise use provided bubbles with enhanced unread counts
  const chatBubbles = useMemo(() => {
    if (useTestBubbles) return testBubbles;
    
    // Enhance provided chat bubbles with unread counts from the server
    return providedChatBubbles.map(bubble => {
      // Find matching unread count data for this chat room
      const unreadData = unreadCounts.find((data: UnreadData) => data.chatRoomId === bubble.chatRoomId);
      
      if (unreadData) {
        // Update the bubble with the server-provided unread count
        return {
          ...bubble,
          unreadCount: unreadData.unreadCount
        };
      }
      
      return bubble;
    });
  }, [useTestBubbles, providedChatBubbles, unreadCounts]);
  
  // Initialize states from session storage for persistence
  const [expandedBubbles, setExpandedBubbles] = useState<number[]>(() => {
    try {
      const stored = sessionStorage.getItem('expandedChats');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Error loading expanded chats from session storage:', e);
      return [];
    }
  });
  
  const [minimizedBubbles, setMinimizedBubbles] = useState<number[]>(() => {
    try {
      const stored = sessionStorage.getItem('minimizedChats');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Error loading minimized chats from session storage:', e);
      return [];
    }
  });
  
  // State for contact selector and chat UI behavior
  const [isContactSelectorOpen, setIsContactSelectorOpen] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [isBubblesExpanded, setIsBubblesExpanded] = useState(false);
  
  // Save state to session storage when it changes
  useEffect(() => {
    try {
      sessionStorage.setItem('expandedChats', JSON.stringify(expandedBubbles));
      sessionStorage.setItem('minimizedChats', JSON.stringify(minimizedBubbles));
    } catch (e) {
      console.error('Error saving chat state to session storage:', e);
    }
  }, [expandedBubbles, minimizedBubbles]);
  
  // Separate chat bubbles into expanded, minimized, and neither
  const expandedChatBubbles = useMemo(() => {
    // Only use chat bubbles that have valid data and match our expanded IDs
    return chatBubbles.filter(bubble => 
      expandedBubbles.includes(bubble.chatRoomId) && 
      bubble.title && 
      bubble.chatRoomId
    );
  }, [chatBubbles, expandedBubbles]);
  
  const minimizedChatBubbles = useMemo(() => {
    // Only use chat bubbles that have valid data and match our minimized IDs
    return chatBubbles.filter(bubble => 
      minimizedBubbles.includes(bubble.chatRoomId) && 
      bubble.title && 
      bubble.chatRoomId
    );
  }, [chatBubbles, minimizedBubbles]);
  
  const ongoingChats = useMemo(() => {
    // Only use chat bubbles that have valid data and aren't in expanded or minimized states
    return chatBubbles.filter(bubble => 
      !expandedBubbles.includes(bubble.chatRoomId) && 
      !minimizedBubbles.includes(bubble.chatRoomId) &&
      bubble.title && 
      bubble.chatRoomId
    );
  }, [chatBubbles, expandedBubbles, minimizedBubbles]);
  
  // Filtered contacts for search - also ensure we only use valid data
  const filteredContacts = useMemo(() => {
    // First filter for valid data
    const validBubbles = chatBubbles.filter(bubble => 
      bubble.title && 
      bubble.chatRoomId &&
      bubble.otherUserName
    );
    
    // Then apply search filter if needed
    if (!contactSearchQuery) return validBubbles;
    
    const query = contactSearchQuery.toLowerCase();
    return validBubbles.filter(bubble => 
      bubble.title.toLowerCase().includes(query) || 
      bubble.otherUserName.toLowerCase().includes(query)
    );
  }, [chatBubbles, contactSearchQuery]);
  
  // Calculate positions for chat bubbles and windows - positioned VERTICALLY along the right side
  // Position minimized chat bubbles VERTICALLY along the right side
  // With reduced spacing between bubbles for better compactness
  const getBubblePosition = (index: number) => {
    return {
      bottom: `${(index + 1) * 40 + 60}px`,  // Position vertically from bottom to top with further reduced spacing
      right: '1rem' // Fixed distance from right edge
    };
  };
  
  // Position chat windows HORIZONTALLY along the bottom from right to left
  // Starting from the main chat button (not pushed up off screen)
  const getChatWindowPosition = (index: number) => {
    const margins = 16; // Margin in pixels
    const chatWidth = 384; // Width of chat window in pixels (w-96 = 384px)
    const mainButtonWidth = 48; // Width of main chat button (40px) + some spacing
    
    return {
      // Fixed position at bottom, aligned with bottom chat buttons
      bottom: '1rem',
      // Stack windows horizontally from right to left starting from main chat button
      right: `${(index * (chatWidth + margins)) + mainButtonWidth + margins}px`
    };
  };
  
  // Toggle a bubble's expanded state
  const toggleBubbleExpand = (chatRoomId: number) => {
    // If already expanded, minimize it
    if (expandedBubbles.includes(chatRoomId)) {
      setExpandedBubbles(expandedBubbles.filter(id => id !== chatRoomId));
      setMinimizedBubbles([...minimizedBubbles, chatRoomId]);
    } 
    // If minimized, expand it and hide the minimized bubbles view
    else if (minimizedBubbles.includes(chatRoomId)) {
      setMinimizedBubbles(minimizedBubbles.filter(id => id !== chatRoomId));
      setExpandedBubbles([...expandedBubbles, chatRoomId]);
      // Hide the bubbles menu by toggling it off
      setIsBubblesExpanded(false);
      
      // Mark messages as read when expanding
      const bubble = chatBubbles.find(b => b.chatRoomId === chatRoomId);
      if (bubble && bubble.unreadCount && bubble.unreadCount > 0) {
        markAsRead(chatRoomId);
      }
    } 
    // Otherwise, expand it from the ongoing list
    else {
      setExpandedBubbles([...expandedBubbles, chatRoomId]);
      // Hide the bubbles menu after selecting a conversation
      setIsBubblesExpanded(false);
      
      // Mark messages as read when first opening
      const bubble = chatBubbles.find(b => b.chatRoomId === chatRoomId);
      if (bubble && bubble.unreadCount && bubble.unreadCount > 0) {
        markAsRead(chatRoomId);
      }
    }
  };
  
  // Handle closing a chat bubble
  const closeBubble = (e: React.MouseEvent, chatRoomId: number) => {
    e.stopPropagation();
    
    // If it's expanded, minimize it instead of closing
    if (expandedBubbles.includes(chatRoomId)) {
      setExpandedBubbles(expandedBubbles.filter(id => id !== chatRoomId));
      setMinimizedBubbles([...minimizedBubbles, chatRoomId]);
      // Collapse the bubbles view
      setIsBubblesExpanded(false);
    } else if (minimizedBubbles.includes(chatRoomId)) {
      // Remove from minimized
      setMinimizedBubbles(minimizedBubbles.filter(id => id !== chatRoomId));
      // Collapse the bubbles view
      setIsBubblesExpanded(false);
    }
    
    // Call the onCloseBubble callback if provided
    if (onCloseBubble) {
      onCloseBubble(chatRoomId);
    }
  };
  
  // Clean up invalid chat bubble IDs from storage on mount or when chatBubbles change
  useEffect(() => {
    // Get valid chatRoomIds from actual bubble data
    const validChatRoomIds = chatBubbles
      .filter(bubble => bubble.title && bubble.chatRoomId)
      .map(bubble => bubble.chatRoomId);
    
    // Filter out any expandedBubbles that don't have corresponding data
    if (expandedBubbles.length > 0) {
      const validExpandedBubbles = expandedBubbles.filter(id => 
        validChatRoomIds.includes(id)
      );
      
      // Update state only if something changed
      if (validExpandedBubbles.length !== expandedBubbles.length) {
        setExpandedBubbles(validExpandedBubbles);
      }
    }
    
    // Filter out any minimizedBubbles that don't have corresponding data
    if (minimizedBubbles.length > 0) {
      const validMinimizedBubbles = minimizedBubbles.filter(id => 
        validChatRoomIds.includes(id)
      );
      
      // Update state only if something changed
      if (validMinimizedBubbles.length !== minimizedBubbles.length) {
        setMinimizedBubbles(validMinimizedBubbles);
      }
    }
  }, [chatBubbles]);
  
  // Debug logging - remove in production
  console.log('Chat bubbles data:', { 
    expandedBubbles, 
    minimizedBubbles, 
    chatBubbles: chatBubbles.map(b => ({ 
      id: b.id, 
      chatRoomId: b.chatRoomId, 
      title: b.title 
    })) 
  });

  return (
    <div className="fixed bottom-0 right-0 z-50 p-4 space-y-4 max-h-full overflow-visible pointer-events-none">
      {/* Expanded chat windows */}
      <AnimatePresence>
        {expandedChatBubbles.map((bubble, index) => {
          const bubble_id = bubble.chatRoomId;
          const position = getChatWindowPosition(index);
          return (
            <motion.div 
              key={`expanded-${bubble_id}`} 
              className="pointer-events-auto w-80 h-[400px] bg-blue-950 rounded-lg overflow-hidden relative"
              style={{
                position: 'absolute',
                ...position
              }}
              initial={{ y: 100, opacity: 0, scale: 0.9 }}
              animate={{ 
                y: 0, 
                opacity: 1, 
                scale: 1,
                transition: { 
                  type: "spring", 
                  stiffness: 300, 
                  damping: 25 
                }
              }}
              exit={{ 
                y: 100, 
                opacity: 0, 
                scale: 0.9,
                transition: { duration: 0.2 } 
              }}
            >
              <div className="flex justify-between items-center py-2 px-3 border-b border-blue-800 bg-blue-900 text-white">
                <div className="flex items-center gap-2 overflow-hidden">
                  <img 
                    src={bubble.jobImage || `/uploads/jobs/${getCategoryImage(bubble.title)}`} 
                    alt={bubble.title}
                    className="w-6 h-6 rounded-full object-cover" 
                  />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{bubble.otherUserName}</p>
                    <p className="text-xs text-blue-200 truncate">{bubble.title}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    className="p-1 hover:bg-blue-800 rounded-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleBubbleExpand(bubble_id);
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-minus"><path d="M5 12h14"/></svg>
                  </button>
                  <button 
                    className="p-1 hover:bg-blue-800 rounded-full"
                    onClick={(e) => closeBubble(e, bubble_id)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <ChatInterface 
                chatRoomId={bubble_id}
                userId={userId}
                userName={userName}
                otherUserName={bubble.otherUserName}
                className="h-[calc(100%-42px)]"
                isJobId={!!bubble.jobId}
                onClose={(action) => {
                  if (action === 'minimize') {
                    toggleBubbleExpand(bubble_id);
                  } else if (action === 'close') {
                    // We handle this case differently when called from the ChatInterface's onClose
                    setExpandedBubbles(expandedBubbles.filter(id => id !== bubble_id));
                    setMinimizedBubbles([...minimizedBubbles, bubble_id]);
                    setIsBubblesExpanded(false);
                    
                    // Call the onCloseBubble callback if provided
                    if (onCloseBubble) {
                      onCloseBubble(bubble_id);
                    }
                  }
                }}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
      
      {/* Minimized chat bubbles - only visible when isBubblesExpanded is true */}
      <AnimatePresence>
        {isBubblesExpanded && minimizedChatBubbles.map((bubble, index) => {
          const bubble_id = bubble.chatRoomId;
          const position = getBubblePosition(index);
          return (
            <div
              key={`minimized-container-${bubble_id}`}
              className="relative group"
              style={{
                position: 'absolute',
                ...position
              }}
            >
              {/* Job title positioned beside the bubble (to the left) - only visible on hover */}
              <div className="absolute right-12 top-0 bg-transparent rounded-lg py-1 px-3 text-white whitespace-nowrap z-10 min-w-[180px] text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 font-medium text-right">
                {bubble.title}
              </div>
              
              {/* Just the circular bubble with image */}
              <motion.div 
                key={`minimized-${bubble_id}`} 
                className="pointer-events-auto h-9 w-9 bg-blue-900 hover:bg-blue-800 text-white rounded-full relative flex items-center justify-center"
                onClick={() => toggleBubbleExpand(bubble_id)}
                title={bubble.title}
                initial={{ y: 100, opacity: 0 }}
                animate={{ 
                  y: 0, 
                  opacity: 1,
                  transition: { 
                    type: "spring", 
                    stiffness: 300, 
                    damping: 25
                  }
                }}
                exit={{ 
                  y: 100, 
                  opacity: 0, 
                  transition: { 
                    duration: 0.3 
                  }
                }}
              >
                {/* Job image centered in bubble */}
                <div className="w-5 h-5 rounded-full overflow-hidden">
                  <img 
                    src={bubble.jobImage || `/uploads/jobs/${getCategoryImage(bubble.title)}`} 
                    alt={bubble.title}
                    className="w-full h-full object-cover" 
                  />
                </div>
                
                {(bubble.unreadCount ?? 0) > 0 && (
                  <div className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center z-10 shadow-sm transform translate-x-1 translate-y-0">
                    {bubble.unreadCount}
                  </div>
                )}
              </motion.div>
            </div>
          );
        })}
      </AnimatePresence>
      
      {/* Chat buttons with animation - ALWAYS VISIBLE */}
      <div className="absolute bottom-4 right-4 flex flex-col-reverse items-end gap-3 pointer-events-auto">
        {/* STACK OF CHAT BUTTONS - Main chat button and hidden bubbles */}
        <div className="relative w-9 h-9">
          {/* Main chat button - ALWAYS visible, on top of stack */}
          <motion.button
            className="absolute bottom-0 right-0 h-9 w-9 rounded-full bg-blue-950 hover:bg-blue-900 shadow-lg flex items-center justify-center relative z-50 overflow-visible"
            onClick={() => {
              // Toggle the contacts slide out effect
              setIsBubblesExpanded(!isBubblesExpanded);
              // Don't open the selector popup anymore
              setIsContactSelectorOpen(false);
            }}
            whileTap={{ scale: 0.95 }}
          >
            <MessageCircle className="h-5 w-5 text-white" />
            {!isBubblesExpanded && chatBubbles.filter(bubble => 
              bubble.title && bubble.chatRoomId && (bubble.unreadCount ?? 0) > 0
            ).length > 0 && (
              <div className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center z-50 shadow-sm transform translate-x-1 translate-y-0">
                {chatBubbles
                  .filter(bubble => bubble.title && bubble.chatRoomId)
                  .reduce((total, bubble) => total + (bubble.unreadCount ?? 0), 0)}
              </div>
            )}
          </motion.button>

          {/* Ongoing chats bubbles - STACKED BEHIND the main button, slide out when clicked */}
          <AnimatePresence>
            {isBubblesExpanded && ongoingChats.map((bubble, index) => (
              <motion.button
                key={`ongoing-${bubble.id}`}
                className="absolute bottom-0 right-0 h-9 w-9 rounded-full bg-blue-900 hover:bg-blue-800 shadow-lg flex items-center justify-center overflow-visible"
                initial={{ y: 100, opacity: 0, scale: 0.8, zIndex: 40 - index }}
                animate={{ 
                  y: isBubblesExpanded ? -((index + 1) * 35) : 0, // Slide up when expanded, down when collapsed
                  opacity: isBubblesExpanded ? 1 : 0,
                  scale: 1,
                  zIndex: isBubblesExpanded ? (40 - index) : (10 - index),
                  transition: { 
                    delay: index * 0.05, 
                    type: "spring",
                    stiffness: 300,
                    damping: 25
                  }
                }}
                exit={{
                  y: 100,
                  opacity: 0,
                  transition: { duration: 0.3 }
                }}
                onClick={() => {
                  if (isBubblesExpanded) {
                    toggleBubbleExpand(bubble.chatRoomId);
                    setIsBubblesExpanded(false); // Collapse the stack after selecting
                  }
                }}
                title={`${bubble.otherUserName} - ${bubble.title}`}
              >
                <img 
                  src={bubble.jobImage || `/uploads/jobs/${getCategoryImage(bubble.title)}`} 
                  alt={bubble.title}
                  className="w-5 h-5 rounded-full object-cover" 
                  style={{ opacity: isBubblesExpanded ? 1 : 0 }}
                />
                {(bubble.unreadCount ?? 0) > 0 && isBubblesExpanded && (
                  <div className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center shadow-sm transform translate-x-1 translate-y-0">
                    {bubble.unreadCount}
                  </div>
                )}
              </motion.button>
            ))}
          </AnimatePresence>
        
          {/* Additional available chat bubbles - also slide out when expanded */}
          <AnimatePresence>
            {isBubblesExpanded && filteredContacts
              .filter(bubble => 
                !ongoingChats.some(ongoing => ongoing.chatRoomId === bubble.chatRoomId) &&
                !minimizedBubbles.includes(bubble.chatRoomId) &&
                !expandedBubbles.includes(bubble.chatRoomId)
              )
              .slice(0, 5) // Limit to 5 additional contacts
              .map((bubble, index) => (
                <motion.button
                  key={`contact-${bubble.id}`}
                  className="absolute bottom-0 right-0 h-9 w-9 rounded-full bg-blue-800 hover:bg-blue-700 shadow-lg flex items-center justify-center overflow-visible"
                  initial={{ y: 100, opacity: 0, scale: 0.8, zIndex: 5 - index }}
                  animate={{ 
                    y: isBubblesExpanded ? -((index + ongoingChats.length + 1) * 35) : 100, // Slide up when expanded, down when collapsed
                    opacity: isBubblesExpanded ? 1 : 0,
                    scale: isBubblesExpanded ? 1 : 0.8,
                    zIndex: 5 - index,
                    transition: { 
                      delay: (index + ongoingChats.length) * 0.05, 
                      type: "spring",
                      stiffness: 300,
                      damping: 25
                    }
                  }}
                  exit={{
                    y: 100,
                    opacity: 0,
                    transition: { duration: 0.3 }
                  }}
                  onClick={() => {
                    if (isBubblesExpanded) {
                      toggleBubbleExpand(bubble.chatRoomId);
                      setIsBubblesExpanded(false); // Collapse the stack after selecting
                    }
                  }}
                  title={`${bubble.otherUserName} - ${bubble.title}`}
                >
                  <img 
                    src={bubble.jobImage || `/uploads/jobs/${getCategoryImage(bubble.title)}`} 
                    alt={bubble.title}
                    className="w-5 h-5 rounded-full object-cover" 
                  />
                </motion.button>
              ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}