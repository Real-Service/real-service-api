import React, { useEffect, useState, useRef } from 'react';
import { Send, Image, X, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChat } from '@/hooks/use-chat';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogClose,
} from "@/components/ui/dialog";

interface ChatBoxProps {
  chatRoomId: number;
  userId: number;
  userName: string;
  jobTitle?: string;
}

export function ChatBox({ chatRoomId, userId, userName, jobTitle }: ChatBoxProps) {
  const [messageInput, setMessageInput] = useState('');
  const [fileUpload, setFileUpload] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const { messages, sendMessage, isConnected, isLoading } = useChat(
    chatRoomId,
    userId,
    userName
  );
  
  // Image upload mutation
  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      
      // Use fetch directly for multipart/form-data
      const response = await fetch('/api/chat-image/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || 'Failed to upload image');
      }
      
      const uploadResult = await response.json();
      
      // Send the image url as a message
      sendMessage(uploadResult.filePath, 'image');
      
      return uploadResult;
    },
    onSuccess: () => {
      // Clear the file upload and preview after successful upload
      setFileUpload(null);
      setFilePreviewUrl(null);
      
      toast({
        title: 'Image sent',
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
  
  // Always scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollArea = scrollAreaRef.current;
      scrollArea.scrollTop = scrollArea.scrollHeight;
    }
  }, [messages]);
  
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (messageInput.trim()) {
      sendMessage(messageInput, 'text');
      setMessageInput('');
    } else if (fileUpload) {
      uploadImageMutation.mutate(fileUpload);
    }
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFileUpload(file);
      
      // Create a preview URL for the selected image
      const fileUrl = URL.createObjectURL(file);
      setFilePreviewUrl(fileUrl);
      
      // Reset the input value so the same file can be selected again
      e.target.value = '';
    }
  };
  
  const cancelFileUpload = () => {
    setFileUpload(null);
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
      setFilePreviewUrl(null);
    }
  };
  
  return (
    <div className="flex flex-col h-full bg-background border rounded-md shadow-sm overflow-hidden">
      {/* Image preview dialog */}
      <Dialog open={!!enlargedImage} onOpenChange={(open) => !open && setEnlargedImage(null)}>
        <DialogContent className="max-w-[80vw] w-auto p-0 bg-background/95 backdrop-blur">
          <div className="relative">
            <DialogClose className="absolute top-2 right-2 z-10">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-background/80">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
            
            <div className="p-1 max-h-[80vh] overflow-auto flex items-center justify-center">
              {enlargedImage && (
                <img 
                  src={enlargedImage} 
                  alt="Enlarged image" 
                  className="max-w-full max-h-[calc(80vh-2rem)] object-contain"
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Chat header */}
      <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
        <div>
          <h3 className="font-medium">
            {jobTitle ? `Chat: ${jobTitle}` : 'Chat'}
          </h3>
          <p className="text-xs text-muted-foreground">
            {isConnected ? 'Connected' : 'Connecting...'}
          </p>
        </div>
      </div>
      
      {/* Chat messages */}
      <ScrollArea 
        className="flex-1 p-3" 
        ref={scrollAreaRef}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-primary/70" />
          </div>
        ) : messages.length > 0 ? (
          <div className="space-y-4">
            {messages.map((message, index) => {
              const isCurrentUser = message.senderId === userId;
              
              return (
                <div 
                  key={message.id || index} 
                  className={cn(
                    "flex",
                    isCurrentUser ? "justify-end" : "justify-start"
                  )}
                >
                  <div 
                    className={cn(
                      "max-w-[70%] rounded-lg p-3",
                      isCurrentUser 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted"
                    )}
                  >
                    {!isCurrentUser && (
                      <p className="text-xs font-medium mb-1">
                        {message.senderName || 'User'}
                      </p>
                    )}
                    
                    {message.type === 'text' ? (
                      <p className="break-words">{message.content}</p>
                    ) : message.type === 'image' ? (
                      <div className="mt-1">
                        <img 
                          src={message.content}
                          alt="Shared image" 
                          className="rounded max-w-full cursor-pointer hover:opacity-90 transition-opacity" 
                          onClick={() => setEnlargedImage(message.content)}
                        />
                      </div>
                    ) : null}
                    
                    <p className="text-xs opacity-70 text-right mt-1">
                      {new Date(message.timestamp).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <p className="text-muted-foreground mb-2">No messages yet</p>
            <p className="text-sm text-muted-foreground">
              Send a message to start the conversation
            </p>
          </div>
        )}
      </ScrollArea>
      
      {/* Image preview */}
      {filePreviewUrl && (
        <div className="p-3 border-t">
          <div className="relative inline-block">
            <img 
              src={filePreviewUrl} 
              alt="Upload preview" 
              className="max-h-32 rounded border" 
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
              onClick={cancelFileUpload}
            >
              <X className="h-3 w-3" />
              <span className="sr-only">Cancel upload</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Click send to upload this image
          </p>
        </div>
      )}
      
      {/* Chat input */}
      <form 
        onSubmit={handleSendMessage}
        className="p-3 border-t flex items-center space-x-2"
      >
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadImageMutation.isPending}
        >
          <Image className="h-5 w-5" />
          <span className="sr-only">Send image</span>
        </Button>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleFileSelect}
        />
        
        <Input
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          placeholder={uploadImageMutation.isPending ? "Uploading image..." : "Type your message..."}
          className="flex-1"
          disabled={uploadImageMutation.isPending}
        />
        
        <Button 
          type="submit" 
          size="icon" 
          disabled={(!messageInput.trim() && !fileUpload) || uploadImageMutation.isPending}
        >
          {uploadImageMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  );
}