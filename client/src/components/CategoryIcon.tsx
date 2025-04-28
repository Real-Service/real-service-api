import { 
  Wrench, 
  PaintBucket, 
  LucideIcon,
  Hammer,
  Lightbulb,
  UtilityPole,
  Pipette,
  Thermometer,
  Tractor,
  Shovel,
  PaintRoller,
  Construction,
  Fence,
  Flower2,
  Recycle,
  Waves,
  Home,
  Plug,
  Trash2,
  Snowflake,
  Flame,
  Droplets,
  Hexagon
} from 'lucide-react';

type CategoryIconProps = {
  category: string;
};

export function CategoryIcon({ category }: CategoryIconProps) {
  const normalizedCategory = category.toLowerCase().trim();
  
  // Map of category names to icons
  const categoryIcons: Record<string, LucideIcon> = {
    // General trades
    plumbing: Pipette,
    electrical: Plug,
    painting: PaintBucket,
    handyman: Wrench,
    carpentry: Hammer,
    landscaping: Shovel,
    roofing: Home,
    hvac: Thermometer,
    flooring: Hexagon,
    remodeling: Construction,
    cleaning: Recycle,
    
    // Specific trades and variations
    'general repair': Wrench,
    'general contractor': Construction,
    'home repair': Wrench,
    'tree service': Flower2,
    'tree removal': Flower2,
    'lawn care': Flower2,
    'lawn maintenance': Flower2,
    'gutter cleaning': Droplets,
    'pressure washing': Waves,
    'window cleaning': Recycle,
    'house cleaning': Recycle,
    'carpet cleaning': Recycle,
    'junk removal': Trash2,
    'appliance repair': Wrench,
    'snow removal': Snowflake,
    'heating': Flame,
    'air conditioning': Snowflake,
    'kitchen remodel': Construction,
    'bathroom remodel': Construction,
    'basement remodel': Construction,
    'deck building': Construction,
    'fence installation': Fence,
    'drywall': Construction,
    'insulation': Home,
    'concrete': Construction,
    'masonry': Construction,
    'interior painting': PaintRoller,
    'exterior painting': PaintRoller,
    'cabinet refinishing': PaintBucket,
    'deck staining': PaintBucket,
    'ceiling repair': Construction,
    'outdoor lighting': Lightbulb,
    'indoor lighting': Lightbulb,
    'electrical repair': Plug,
    'electrical installation': Plug,
    'plumbing repair': Pipette,
    'plumbing installation': Pipette,
    'drain cleaning': Pipette,
    'water heater': Pipette,
    'septic': Pipette,
    'gas line': Pipette,
    'excavation': Tractor,
    'hardscaping': Shovel,
    'irrigation': Droplets,
    'tile': Hexagon,
    'flooring installation': Hexagon,
    'garage door': Home,
    'door installation': Home,
    'window installation': Home,
    'siding': Home,
    'power washing': Waves,
    'gutter installation': Home,
  };
  
  // Get the icon for this category
  const IconComponent = getIconForCategory(normalizedCategory, categoryIcons);
  
  return <IconComponent className="h-3.5 w-3.5" />;
}

function getIconForCategory(category: string, iconMap: Record<string, LucideIcon>): LucideIcon {
  // Direct match
  if (iconMap[category]) {
    return iconMap[category];
  }
  
  // Partial match
  for (const [key, icon] of Object.entries(iconMap)) {
    if (category.includes(key) || key.includes(category)) {
      return icon;
    }
  }
  
  // Default fallback
  return Wrench;
}