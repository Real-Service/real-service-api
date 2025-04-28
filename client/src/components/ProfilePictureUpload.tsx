import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Upload, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

interface ProfilePictureUploadProps {
  currentImageUrl?: string | null;
  onSuccess?: (imageUrl: string) => void;
  size?: "sm" | "md" | "lg";
}

export function ProfilePictureUpload({ 
  currentImageUrl, 
  onSuccess,
  size = "md"
}: ProfilePictureUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Size mapping
  const sizeClass = {
    sm: "h-12 w-12",
    md: "h-20 w-20",
    lg: "h-28 w-28"
  }[size];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // File type validation
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive"
      });
      return;
    }

    // File size validation (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image under 5MB",
        variant: "destructive"
      });
      return;
    }

    // Create a preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload the file
    uploadProfilePicture(file);
  };

  const uploadProfilePicture = async (file: File) => {
    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append('profilePicture', file);
      
      const response = await fetch('/api/profile-picture/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'X-User-ID': user?.id.toString() || ''
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload profile picture');
      }
      
      const data = await response.json();
      
      // Call the onSuccess callback with the new image URL
      if (onSuccess) {
        onSuccess(data.filePath);
      }
      
      toast({
        title: "Profile picture updated",
        description: "Your profile picture has been updated successfully",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload profile picture",
        variant: "destructive"
      });
      // Reset preview to original if upload fails
      setPreviewUrl(currentImageUrl);
    } finally {
      setUploading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative group">
        <Avatar className={`${sizeClass} cursor-pointer group-hover:opacity-75 transition-opacity`} onClick={triggerFileInput}>
          {previewUrl ? (
            <AvatarImage src={previewUrl} alt="Profile" />
          ) : (
            <AvatarFallback>
              <User className="h-1/2 w-1/2 text-muted-foreground" />
            </AvatarFallback>
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-full">
              <Loader2 className="h-1/2 w-1/2 animate-spin text-primary" />
            </div>
          )}
        </Avatar>
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={triggerFileInput}
        >
          <Upload className="h-1/3 w-1/3 text-white" />
        </div>
      </div>
      
      <input 
        type="file" 
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileSelect}
      />
      
      <Button 
        variant="outline" 
        size="sm" 
        type="button" 
        onClick={triggerFileInput}
        disabled={uploading}
        className="text-xs"
      >
        {uploading ? (
          <>
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            Uploading...
          </>
        ) : (
          <>Change Photo</>
        )}
      </Button>
    </div>
  );
}