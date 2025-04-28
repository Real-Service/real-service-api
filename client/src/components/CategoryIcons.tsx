import React from 'react';
import {
  Paintbrush, Wrench, Hammer, Zap, Droplet, Home, Flower2, Thermometer,
  Square, Package, Briefcase, ClipboardCheck, Sun, Wifi, Smartphone, CheckCircle,
  Wind, Star, Shield, User, Settings, Scissors, Radio, Umbrella, 
  Map, Globe, Truck, Timer, Monitor, CloudRain, Camera, Box, Headphones, Loader
} from 'lucide-react';

// Define the props type for the CategoryIcon component
type CategoryIconProps = {
  category: string;
  className?: string;
};

// Component to return the appropriate icon based on category
export const CategoryIcon: React.FC<CategoryIconProps> = ({ category, className = "h-6 w-6 text-white" }) => {
  // Create a mapping of category names to their corresponding icons
  const categoryIcons: Record<string, React.ReactNode> = {
    'plumbing': <Droplet className={className} />,
    'electrical': <Zap className={className} />,
    'carpentry': <Hammer className={className} />,
    'painting': <Paintbrush className={className} />,
    'hvac': <Thermometer className={className} />,
    'flooring': <Square className={className} />,
    'landscaping': <Flower2 className={className} />,
    'general': <Wrench className={className} />,
    'handyman': <Wrench className={className} />,
    'roofing': <Home className={className} />,
    'cleaning': <CheckCircle className={className} />,
    'moving': <Package className={className} />,
    'appliance': <Briefcase className={className} />,
    'inspection': <ClipboardCheck className={className} />,
    'installation': <Settings className={className} />,
    'solar': <Sun className={className} />,
    'internet': <Wifi className={className} />,
    'phone': <Smartphone className={className} />,
    'security': <Shield className={className} />,
    'windows': <Square className={className} />,
    'gardening': <Flower2 className={className} />,
    'pest control': <Bug className={className} />,
    'walls': <Square className={className} />,
    'furniture': <Package className={className} />,
    'maintenance': <Wrench className={className} />,
    'lawn': <Wind className={className} />,
    'decoration': <Star className={className} />,
    'renovation': <Hammer className={className} />,
    'bathroom': <Droplet className={className} />,
    'kitchen': <Knife className={className} />,
    'hairdressing': <Scissors className={className} />,
    'electronics': <Radio className={className} />,
    'outdoor': <Umbrella className={className} />,
    'delivery': <Truck className={className} />,
    'emergency': <Timer className={className} />,
    'computer': <Monitor className={className} />,
    'lighting': <Zap className={className} />,
    'drainage': <CloudRain className={className} />,
    'photography': <Camera className={className} />,
    'storage': <Box className={className} />,
    'audio': <Headphones className={className} />,
    'insulation': <Thermometer className={className} />,
    'default': <Loader className={className} />,
  };

  // Normalize the category name for lookup
  const normalizedCategory = category.toLowerCase().trim();
  
  // Return the icon if it exists, or the default icon
  return categoryIcons[normalizedCategory] || categoryIcons['default'];
};

// Component for a category icon with background
export const CategoryIconWithBackground: React.FC<CategoryIconProps & { size?: 'sm' | 'md' | 'lg' }> = ({ 
  category, 
  className,
  size = 'md'
}) => {
  // Determine size classes
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  };
  
  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-7 w-7'
  };
  
  return (
    <div className={`${sizeClasses[size]} rounded-full bg-primary flex items-center justify-center`}>
      <CategoryIcon category={category} className={`${iconSizes[size]} text-white ${className || ''}`} />
    </div>
  );
};

// Fix for missing icons referenced in CategoryIcon
const Bug: React.FC<{className?: string}> = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}>
    <path d="M8 2l1.88 1.88"></path>
    <path d="M14.12 3.88L16 2"></path>
    <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"></path>
    <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6z"></path>
    <path d="M12 20v-9"></path>
    <path d="M6.53 9C4.6 8.8 3 7.1 3 5"></path>
    <path d="M6 13H2"></path>
    <path d="M3 21c0-2.1 1.7-3.9 3.8-4"></path>
    <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"></path>
    <path d="M22 13h-4"></path>
    <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"></path>
  </svg>
);

const Knife: React.FC<{className?: string}> = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}>
    <path d="M2 22l10-10"></path>
    <path d="M14.5 9.5L18 6c.5-.5 2-2.5 0-4.5s-4 .5-4.5 1L6 10"></path>
    <path d="M8 14l-5 5 3 3 5-5"></path>
    <path d="M14 4l6 6"></path>
    <path d="M14.5 10.5L18 7"></path>
  </svg>
);