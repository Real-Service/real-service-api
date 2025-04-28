import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProfilePictureUpload } from "./ProfilePictureUpload";
import { StarRating } from "./StarRating";
import { User as UserType } from "@shared/schema";

interface UserProfileCardProps {
  user?: UserType | null;
  allowEdit?: boolean;
  onProfilePictureChange?: (imageUrl: string) => void;
  rating?: number | null;
  totalRatings?: number;
  skills?: string[];
  location?: string;
  showDetails?: boolean;
}

export function UserProfileCard({
  user,
  allowEdit = false,
  onProfilePictureChange,
  rating,
  totalRatings = 0,
  skills = [],
  location,
  showDetails = true
}: UserProfileCardProps) {
  // We're using direct API call for logout, so no need for Auth context
  
  const userInitials = user?.fullName 
    ? user.fullName
        .split(' ')
        .map(name => name[0])
        .join('')
        .toUpperCase()
    : '';

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/30 pb-2">
        <CardTitle className="text-lg font-medium">Profile</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="flex flex-col items-center sm:flex-row sm:items-start gap-4">
          <div className="flex-shrink-0">
            {allowEdit && user ? (
              <ProfilePictureUpload 
                currentImageUrl={user?.profilePicture || undefined}
                onSuccess={onProfilePictureChange}
                size="lg"
              />
            ) : (
              <Avatar className="h-24 w-24">
                {user?.profilePicture ? (
                  <AvatarImage src={user.profilePicture} alt={user?.fullName || ''} />
                ) : (
                  <AvatarFallback className="text-lg font-medium">
                    {userInitials || <User className="h-12 w-12" />}
                  </AvatarFallback>
                )}
              </Avatar>
            )}
          </div>
          
          <div className="flex flex-col text-center sm:text-left">
            <h3 className="text-xl font-bold">{user?.fullName || 'User'}</h3>
            <p className="text-muted-foreground mb-2">{user?.username || 'username'}</p>
            
            <div className="flex items-center justify-center sm:justify-start mb-1">
              <Badge variant="outline" className="capitalize">
                {user?.userType || 'user'}
              </Badge>
            </div>
            
            {/* Profile Rating */}
            <div className="flex items-center justify-center sm:justify-start mb-2">
              <StarRating 
                rating={rating ?? null} 
                totalRatings={totalRatings ?? 0}
                size="md"
              />
            </div>
            
            {location && (
              <p className="text-sm text-muted-foreground">
                📍 {location}
              </p>
            )}
          </div>
        </div>
        
        {showDetails && (
          <div className="mt-6">
            {skills.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">Skills</h4>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((skill, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Contact</h4>
              {user?.email && <p className="text-sm">{user.email}</p>}
              {user?.phone && <p className="text-sm">{user.phone}</p>}
            </div>
            
            <div className="mt-6">
              <Button 
                variant="destructive" 
                onClick={async () => {
                  try {
                    // Try direct API call first
                    await fetch('/api/logout', {
                      method: 'POST',
                      credentials: 'include'
                    });
                    
                    // Clear storage
                    sessionStorage.clear();
                    localStorage.clear();
                    
                    // Redirect to home page
                    window.location.href = "/";
                  } catch (err) {
                    console.error('Logout failed:', err);
                    window.location.href = "/";
                  }
                }}
                className="w-full"
              >
                <div className="flex items-center gap-2">
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </div>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}