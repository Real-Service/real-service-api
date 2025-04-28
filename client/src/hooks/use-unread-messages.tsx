import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

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

interface UnreadResponseData {
  unreadCounts: UnreadData[];
}

export function useUnreadMessages(userId: number | null | undefined) {
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  
  const { 
    data: unreadData, 
    isLoading, 
    error,
    refetch 
  } = useQuery<UnreadResponseData>({
    queryKey: ['/api/chat/unread', userId],
    enabled: !!userId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
  
  useEffect(() => {
    if (unreadData?.unreadCounts) {
      // Calculate total unread count
      const total = unreadData.unreadCounts.reduce(
        (sum: number, item: UnreadData) => sum + item.unreadCount, 
        0
      );
      setTotalUnreadCount(total);
    }
  }, [unreadData]);
  
  // Function to mark a chat room as read
  const markAsRead = async (chatRoomId: number) => {
    try {
      const response = await fetch(`/api/chat/room/${chatRoomId}/mark-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        // Refetch unread counts after marking as read
        refetch();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error marking messages as read:', error);
      return false;
    }
  };
  
  return {
    unreadCounts: unreadData?.unreadCounts || [],
    totalUnreadCount,
    isLoading,
    error,
    refetch,
    markAsRead
  };
}