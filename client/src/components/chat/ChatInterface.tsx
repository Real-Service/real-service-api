import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2, Upload } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { ChatBox } from './ChatBox';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface ChatInterfaceProps {
  jobId: number;
  otherUserId: number;
}

export default function ChatInterface({ jobId, otherUserId }: ChatInterfaceProps) {
  const [chatRoomId, setChatRoomId] = useState<number | null>(null);
  const { toast } = useToast();
  
  // Get current user with type assertion
  const { data: currentUser, isLoading: isUserLoading } = useQuery<any>({
    queryKey: ['/api/user'],
    staleTime: 30000, // Avoid refetching too often
  });
  
  // Type guard for user object (used later)
  const isUserValid = (user: any): user is { id: number; fullName?: string; username?: string } => {
    return user && typeof user === 'object' && 'id' in user;
  };
  
  // Fetch or create chatroom
  const { data: chatRoomData, isLoading: isChatRoomLoading } = useQuery<any>({
    queryKey: ['/api/chat', jobId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/chat/${jobId}`);
      return response.json();
    },
    enabled: !!jobId && isUserValid(currentUser)
  });
  
  // Set chatroom ID when data is available
  useEffect(() => {
    if (chatRoomData && typeof chatRoomData === 'object' && 'id' in chatRoomData) {
      setChatRoomId(chatRoomData.id);
    }
  }, [chatRoomData]);
  
  // Handle errors
  useEffect(() => {
    if (isChatRoomLoading === false && !chatRoomData && !chatRoomId) {
      toast({
        title: 'Error',
        description: 'Failed to load chat. Please try again.',
        variant: 'destructive'
      });
    }
  }, [isChatRoomLoading, chatRoomData, chatRoomId, toast]);
  
  // Upload image mutation
  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!chatRoomId || !currentUser) {
        throw new Error('Missing required data for upload');
      }
      
      const formData = new FormData();
      formData.append('image', file);
      
      // Use fetch directly for multipart/form-data
      const response = await fetch('/api/chat-image/upload', {
        method: 'POST',
        body: formData,
        // No need to set Content-Type as it's automatically set with boundary
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || 'Failed to upload image');
      }
      
      const uploadResult = await response.json();
      
      // Now create a message with the image URL
      const messageResponse = await apiRequest('POST', `/api/chat/${chatRoomId}/messages`, {
        chatRoomId,
        senderId: currentUser.id,
        content: uploadResult.filePath,
        type: 'image',
      });
      
      if (!messageResponse.ok) {
        throw new Error('Failed to send image message');
      }
      
      return messageResponse.json();
    },
    onSuccess: () => {
      // Invalidate chat messages cache to refresh with new image
      queryClient.invalidateQueries({ queryKey: ['/api/chat', jobId, 'messages'] });
      toast({
        title: 'Image Uploaded',
        description: 'Your image was sent successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload image. Please try again.',
        variant: 'destructive'
      });
    }
  });
  
  // Combined loading state
  const isLoading = isUserLoading || isChatRoomLoading;
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary/70" />
      </div>
    );
  }
  
  if (!isUserValid(currentUser)) {
    return (
      <div className="text-center p-6 border rounded-md bg-muted/30">
        <p className="text-muted-foreground">
          You need to be logged in to chat.
        </p>
      </div>
    );
  }
  
  if (!chatRoomId) {
    return (
      <div className="text-center p-6 border rounded-md bg-muted/30">
        <p className="text-muted-foreground mb-4">
          No chat room found for this job.
        </p>
        <Button 
          onClick={async () => {
            try {
              const response = await apiRequest('POST', `/api/chat/${jobId}`, {
                userId: currentUser.id,
                otherUserId: otherUserId
              });
              const data = await response.json();
              if (data && typeof data === 'object' && 'id' in data) {
                setChatRoomId(data.id);
              } else {
                throw new Error('Invalid chat room data');
              }
            } catch (error) {
              toast({
                title: 'Error',
                description: 'Failed to create chat room',
                variant: 'destructive'
              });
            }
          }}
        >
          Start Chat
        </Button>
      </div>
    );
  }
  
  return (
    <div className="h-[500px]">
      <ChatBox 
        chatRoomId={chatRoomId} 
        userId={currentUser.id} 
        userName={currentUser.fullName || currentUser.username || 'User'}
        jobTitle={chatRoomData && typeof chatRoomData === 'object' && 'jobTitle' in chatRoomData 
          ? String(chatRoomData.jobTitle) 
          : undefined}
      />
    </div>
  );
}