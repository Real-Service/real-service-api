import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileAvatarProps {
  src?: string | null;
  alt?: string;
  initials?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

export function ProfileAvatar({
  src,
  alt = "User",
  initials,
  size = "md",
  className
}: ProfileAvatarProps) {
  // Calculate size classes
  const sizeClass = {
    xs: "h-6 w-6",
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-14 w-14"
  }[size];

  // Calculate initials
  const displayInitials = initials || (alt 
    ? alt.split(' ').map(n => n[0]).join('').toUpperCase()
    : undefined);

  // Determine fallback font size
  const fallbackTextSize = {
    xs: "text-[10px]",
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base"
  }[size];

  return (
    <Avatar className={cn(sizeClass, className)}>
      {src ? (
        <AvatarImage src={src} alt={alt} />
      ) : (
        <AvatarFallback className={fallbackTextSize}>
          {displayInitials || <User className="h-3/5 w-3/5" />}
        </AvatarFallback>
      )}
    </Avatar>
  );
}