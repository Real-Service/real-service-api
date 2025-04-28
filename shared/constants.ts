// Common categories for jobs
export const AVAILABLE_CATEGORIES = [
  "Plumbing",
  "Electrical",
  "Carpentry",
  "Painting",
  "Landscaping",
  "Cleaning",
  "General Maintenance",
  "Roofing",
  "HVAC",
  "Drywall",
  "Flooring",
  "Windows",
  "Pest Control"
];

// Helper function to get lowercase category value for filters
export const getCategoryValue = (category: string): string => {
  return category.toLowerCase().replace(/\s+/g, '_');
};

// Helper function to get display name from value
export const getCategoryDisplayName = (value: string): string => {
  if (value === "all") return "All Categories";
  
  // Find the category that matches this value when converted
  const category = AVAILABLE_CATEGORIES.find(
    cat => getCategoryValue(cat) === value
  );
  
  return category || value.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};