import { cn } from "@/lib/utils";
import { StarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StarRatingProps {
  rating: number | null;
  totalRatings?: number;
  showEmpty?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function StarRating({
  rating,
  totalRatings = 0,
  showEmpty = true,
  size = "md", 
  className
}: StarRatingProps) {
  if (rating === null && !showEmpty) {
    return null;
  }

  // Get star sizes based on the size prop
  const getStarSize = () => {
    switch (size) {
      case "sm": return { star: "h-3.5 w-3.5", badge: "text-xs" };
      case "lg": return { star: "h-5 w-5", badge: "text-base" };
      default: return { star: "h-4 w-4", badge: "text-sm" };
    }
  };

  const { star: starSize, badge: badgeSize } = getStarSize();
  
  // If there are no ratings, show "No reviews yet"
  if (totalRatings === 0) {
    return (
      <div className={cn("flex items-center", className)}>
        <Badge variant="outline" className={cn("font-medium text-muted-foreground", badgeSize)}>
          No reviews yet
        </Badge>
      </div>
    );
  }
  
  // Format the rating - show whole numbers without decimal, otherwise one decimal place
  const fixedRating = rating !== null 
    ? Number.isInteger(rating) ? rating.toString() : rating.toFixed(1)
    : "0.0";
  
  // Calculate whole stars and partial stars
  const stars = [];
  if (rating !== null) {
    const wholePart = Math.floor(rating);
    const decimalPart = rating - wholePart;
    
    // Add filled stars
    for (let i = 0; i < wholePart; i++) {
      stars.push(<StarIcon key={`star-${i}`} className={cn(starSize, "text-yellow-500 fill-yellow-500")} />);
    }
    
    // Add partial star if needed
    if (decimalPart > 0) {
      stars.push(
        <div key="partial-star" className="relative inline-flex">
          <StarIcon className={cn(starSize, "text-muted-foreground")} />
          <div 
            className="absolute inset-0 overflow-hidden" 
            style={{ width: `${decimalPart * 100}%` }}
          >
            <StarIcon className={cn(starSize, "text-yellow-500 fill-yellow-500")} />
          </div>
        </div>
      );
    }
    
    // Add empty stars
    const emptyStars = 5 - wholePart - (decimalPart > 0 ? 1 : 0);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<StarIcon key={`empty-${i}`} className={cn(starSize, "text-muted-foreground")} />);
    }
  } else {
    // Show 5 empty stars
    for (let i = 0; i < 5; i++) {
      stars.push(<StarIcon key={`empty-${i}`} className={cn(starSize, "text-muted-foreground")} />);
    }
  }
  
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="flex">
        {stars}
      </div>
      <Badge variant="secondary" className={cn("font-medium bg-yellow-50 text-yellow-700", badgeSize)}>
        {fixedRating} {totalRatings > 0 && `(${totalRatings} ${totalRatings === 1 ? 'rating' : 'ratings'})`}
      </Badge>
    </div>
  );
}