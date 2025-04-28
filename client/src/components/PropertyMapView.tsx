import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Toggle } from "@/components/ui/toggle";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, Filter, MapPin, LayoutGrid, Maximize2, Search, Home, RotateCcw, Settings, Layers, Plus, Minus } from "lucide-react";
import Map, { Marker, Popup, NavigationControl, FullscreenControl, ScaleControl, GeolocateControl } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { cn } from "@/lib/utils";

// Define property types (can be jobs or quotes)
interface Property {
  id: number;
  title: string;
  description?: string;
  price?: number; // budget or quote amount
  status: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  type: 'job' | 'quote';
  imageUrl?: string;
  createdAt: Date;
  categoryTags?: string[];
}

interface PropertyMapViewProps {
  properties: Property[];
  onViewProperty: (property: Property) => void;
  onCreateProperty?: () => void;
  isLoading?: boolean;
  type?: 'job' | 'quote' | 'both';
}

// Default center coordinates (San Francisco)
const DEFAULT_CENTER = { latitude: 37.7749, longitude: -122.4194 };

export function PropertyMapView({
  properties = [],
  onViewProperty,
  onCreateProperty,
  isLoading = false,
  type = 'both',
}: PropertyMapViewProps) {
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [viewport, setViewport] = useState({
    latitude: DEFAULT_CENTER.latitude,
    longitude: DEFAULT_CENTER.longitude,
    zoom: 11,
  });
  const [filteredProperties, setFilteredProperties] = useState<Property[]>(properties);
  const [mapStyle, setMapStyle] = useState<'streets-v11' | 'satellite-v9' | 'light-v10' | 'dark-v10'>('streets-v11');
  const [searchQuery, setSearchQuery] = useState('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [categoryFilters, setStatusCategories] = useState<string[]>([]);
  const [hoveredProperty, setHoveredProperty] = useState<number | null>(null);
  const mapRef = useRef(null);

  // Calculate bounds based on property locations if available
  useEffect(() => {
    if (properties.length > 0 && mapRef.current) {
      const bounds = new mapboxgl.LngLatBounds();
      
      properties.forEach(property => {
        if (property.location && property.location.longitude && property.location.latitude) {
          bounds.extend([property.location.longitude, property.location.latitude]);
        }
      });
      
      if (!bounds.isEmpty()) {
        // @ts-ignore
        mapRef.current.fitBounds(bounds, {
          padding: 50,
          maxZoom: 15,
        });
      }
    }
  }, [properties, mapRef.current]);

  // Filter properties when the filters change
  useEffect(() => {
    let filtered = properties;
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(property => 
        property.title.toLowerCase().includes(query) || 
        property.description?.toLowerCase().includes(query) ||
        property.location.city?.toLowerCase().includes(query) ||
        property.location.state?.toLowerCase().includes(query)
      );
    }
    
    // Filter by price range
    filtered = filtered.filter(property => {
      const price = property.price || 0;
      return price >= priceRange[0] && price <= priceRange[1];
    });
    
    // Filter by status
    if (statusFilters.length > 0) {
      filtered = filtered.filter(property => statusFilters.includes(property.status));
    }
    
    // Filter by category
    if (categoryFilters.length > 0) {
      filtered = filtered.filter(property => 
        property.categoryTags?.some(tag => categoryFilters.includes(tag))
      );
    }
    
    // Filter by type
    if (type !== 'both') {
      filtered = filtered.filter(property => property.type === type);
    }
    
    setFilteredProperties(filtered);
  }, [properties, searchQuery, priceRange, statusFilters, categoryFilters, type]);

  // Get unique statuses for filters
  const allStatuses = [...new Set(properties.map(p => p.status))];
  
  // Get unique categories for filters
  const allCategories = [...new Set(
    properties.flatMap(p => p.categoryTags || [])
  )];
  
  // Maximum price in all properties
  const maxPrice = Math.max(...properties.map(p => p.price || 0), 10000);
  
  // Toggle status filter
  const toggleStatusFilter = (status: string) => {
    setStatusFilters(current => 
      current.includes(status)
        ? current.filter(s => s !== status)
        : [...current, status]
    );
  };
  
  // Toggle category filter
  const toggleCategoryFilter = (category: string) => {
    setStatusCategories(current => 
      current.includes(category)
        ? current.filter(c => c !== category)
        : [...current, category]
    );
  };
  
  // Reset all filters
  const resetFilters = () => {
    setSearchQuery('');
    setPriceRange([0, maxPrice]);
    setStatusFilters([]);
    setStatusCategories([]);
  };
  
  // Get marker color based on property status and type
  const getMarkerColor = (property: Property) => {
    if (property.type === 'job') {
      switch (property.status) {
        case 'open': return 'bg-blue-500';
        case 'in_progress': return 'bg-amber-500';
        case 'completed': return 'bg-green-500';
        default: return 'bg-gray-500';
      }
    } else {
      switch (property.status) {
        case 'draft': return 'bg-blue-500';
        case 'sent': return 'bg-orange-500';
        case 'accepted': return 'bg-green-500';
        case 'rejected': return 'bg-red-500';
        default: return 'bg-gray-500';
      }
    }
  };

  // Handle property click on map
  const handlePropertyClick = (property: Property) => {
    setSelectedProperty(property);
  };
  
  // Format price/budget display
  const formatPrice = (price?: number) => {
    if (!price) return 'No budget';
    
    if (price >= 1000) {
      return `$${(price / 1000).toFixed(0)}K`;
    }
    return `$${price.toFixed(0)}`;
  };
  
  return (
    <div className="h-full flex flex-col">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
        {/* Map Section */}
        <div className="lg:col-span-2 relative">
          <div className="absolute top-4 left-4 right-4 z-10 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search for jobs, quotes, addresses..."
                  className="pl-8 pr-10 bg-white/90 backdrop-blur-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-7 w-7"
                    onClick={() => setSearchQuery('')}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              
              <Popover open={showFilters} onOpenChange={setShowFilters}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="bg-white/90 backdrop-blur-sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                    {(statusFilters.length > 0 || categoryFilters.length > 0) && (
                      <Badge className="ml-2 bg-primary text-primary-foreground h-5 w-5 p-0 flex items-center justify-center rounded-full">
                        {statusFilters.length + categoryFilters.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-medium">Price Range</h4>
                      <div className="pt-4 pb-2">
                        <Slider
                          value={priceRange}
                          min={0}
                          max={maxPrice}
                          step={100}
                          onValueChange={(value: [number, number]) => setPriceRange(value)}
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>${priceRange[0]}</span>
                        <span>${priceRange[1]}</span>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <h4 className="font-medium">Status</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {allStatuses.map(status => (
                          <div key={status} className="flex items-center space-x-2">
                            <Checkbox
                              id={`status-${status}`}
                              checked={statusFilters.includes(status)}
                              onCheckedChange={() => toggleStatusFilter(status)}
                            />
                            <label
                              htmlFor={`status-${status}`}
                              className="text-sm cursor-pointer capitalize"
                            >
                              {status.replace(/_/g, ' ')}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {allCategories.length > 0 && (
                      <>
                        <Separator />
                        
                        <div className="space-y-2">
                          <h4 className="font-medium">Categories</h4>
                          <div className="flex flex-wrap gap-2">
                            {allCategories.map(category => (
                              <Toggle
                                key={category}
                                pressed={categoryFilters.includes(category)}
                                onPressedChange={() => toggleCategoryFilter(category)}
                                className="h-8 text-xs"
                              >
                                {category}
                              </Toggle>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                    
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={resetFilters}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-2" /> Reset Filters
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              
              <Button
                variant="outline"
                size="icon"
                className="bg-white/90 backdrop-blur-sm"
                onClick={() => setMapStyle(style => {
                  switch (style) {
                    case 'streets-v11': return 'satellite-v9';
                    case 'satellite-v9': return 'light-v10';
                    case 'light-v10': return 'dark-v10';
                    case 'dark-v10': return 'streets-v11';
                    default: return 'streets-v11';
                  }
                })}
              >
                <Layers className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Optional: Create new property button */}
            {onCreateProperty && (
              <Button onClick={onCreateProperty} className="self-start bg-white text-primary hover:bg-white/90 shadow">
                <Plus className="h-4 w-4 mr-2" /> 
                {type === 'job' ? 'Post New Job' : type === 'quote' ? 'Create New Quote' : 'Create New'}
              </Button>
            )}
          </div>
          
          {/* Map Controls */}
          <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
            <Button variant="outline" size="icon" className="bg-white/90 backdrop-blur-sm h-8 w-8">
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="bg-white/90 backdrop-blur-sm h-8 w-8">
              <Minus className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Count display */}
          <div className="absolute bottom-4 left-4 z-10">
            <Badge className="bg-white/90 backdrop-blur-sm text-foreground font-normal py-1.5 border">
              {filteredProperties.length} {type === 'job' ? 'Jobs' : type === 'quote' ? 'Quotes' : 'Properties'} Found
            </Badge>
          </div>
          
          {/* Map */}
          {isLoading ? (
            <Skeleton className="w-full h-[650px] rounded-md" />
          ) : (
            <Map
              ref={mapRef}
              mapboxAccessToken="pk.your_mapbox_token"
              initialViewState={viewport}
              mapStyle={`mapbox://styles/mapbox/${mapStyle}`}
              style={{ width: '100%', height: '650px', borderRadius: '0.5rem' }}
              attributionControl={false}
            >
              <GeolocateControl position="top-right" />
              <FullscreenControl position="top-right" />
              <NavigationControl position="top-right" />
              <ScaleControl position="bottom-right" />
              
              {filteredProperties.map(property => (
                <Marker
                  key={`${property.type}-${property.id}`}
                  longitude={property.location.longitude}
                  latitude={property.location.latitude}
                  anchor="bottom"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    handlePropertyClick(property);
                  }}
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div 
                          className={cn(
                            "flex flex-col items-center cursor-pointer transition-all duration-150",
                            hoveredProperty === property.id ? "scale-125" : "scale-100"
                          )}
                          onMouseEnter={() => setHoveredProperty(property.id)}
                          onMouseLeave={() => setHoveredProperty(null)}
                        >
                          <div 
                            className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center text-white font-bold relative shadow-md",
                              getMarkerColor(property),
                              hoveredProperty === property.id ? "ring-2 ring-white" : ""
                            )}
                          >
                            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-2 h-2 rotate-45 bg-inherit"></div>
                            {property.price ? (
                              <span className="text-xs">{formatPrice(property.price)}</span>
                            ) : (
                              <Home className="h-4 w-4" />
                            )}
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <div className="text-xs">
                          <p className="font-bold">{property.title}</p>
                          <p>{property.location.city}, {property.location.state}</p>
                          <p>Status: {property.status}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Marker>
              ))}
              
              {selectedProperty && (
                <Popup
                  longitude={selectedProperty.location.longitude}
                  latitude={selectedProperty.location.latitude}
                  anchor="bottom"
                  closeButton={true}
                  closeOnClick={false}
                  onClose={() => setSelectedProperty(null)}
                  maxWidth="300px"
                >
                  <div className="p-1">
                    <div className="relative mb-2">
                      {selectedProperty.imageUrl ? (
                        <img
                          src={selectedProperty.imageUrl}
                          alt={selectedProperty.title}
                          className="w-full h-32 object-cover rounded-md"
                        />
                      ) : (
                        <div className="w-full h-32 bg-muted flex items-center justify-center rounded-md">
                          <Home className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <Badge 
                        className={cn(
                          "absolute top-2 left-2 capitalize",
                          getMarkerColor(selectedProperty)
                        )}
                      >
                        {selectedProperty.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="font-semibold text-base line-clamp-2">{selectedProperty.title}</h3>
                      
                      <div className="flex justify-between items-center">
                        <div className="flex items-center text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 mr-1" />
                          <span>{selectedProperty.location.city}, {selectedProperty.location.state}</span>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {selectedProperty.type}
                        </Badge>
                      </div>
                      
                      {selectedProperty.price && (
                        <p className="font-semibold text-base">${selectedProperty.price.toFixed(2)}</p>
                      )}
                      
                      <div className="pt-1">
                        <Button 
                          className="w-full"
                          onClick={() => onViewProperty(selectedProperty)}
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                </Popup>
              )}
            </Map>
          )}
        </div>
        
        {/* Properties List Section */}
        <div className="hidden lg:block overflow-auto" style={{ maxHeight: '650px' }}>
          <div className="p-2 mb-2 flex justify-between items-center sticky top-0 bg-background z-10">
            <h3 className="font-semibold text-lg">
              {filteredProperties.length} {type === 'job' ? 'Jobs' : type === 'quote' ? 'Quotes' : 'Properties'}
            </h3>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Sort">
                <Settings className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="View">
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="space-y-3 pr-2">
            {isLoading ? (
              Array(5).fill(0).map((_, index) => (
                <Card key={index} className="overflow-hidden">
                  <Skeleton className="w-full h-28" />
                  <CardContent className="p-3 space-y-2">
                    <Skeleton className="w-2/3 h-4" />
                    <Skeleton className="w-1/2 h-3" />
                    <Skeleton className="w-1/3 h-3" />
                  </CardContent>
                </Card>
              ))
            ) : filteredProperties.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No properties match your search criteria.</p>
                <Button variant="link" onClick={resetFilters}>
                  Reset Filters
                </Button>
              </div>
            ) : (
              filteredProperties.map((property) => (
                <Card 
                  key={`list-${property.type}-${property.id}`}
                  className={cn(
                    "overflow-hidden cursor-pointer hover:shadow-md transition-all",
                    hoveredProperty === property.id ? "ring-2 ring-primary" : ""
                  )}
                  onClick={() => onViewProperty(property)}
                  onMouseEnter={() => setHoveredProperty(property.id)}
                  onMouseLeave={() => setHoveredProperty(null)}
                >
                  <div className="relative w-full h-32">
                    {property.imageUrl ? (
                      <img
                        src={property.imageUrl}
                        alt={property.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <Home className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <Badge 
                      className={cn(
                        "absolute top-2 left-2 capitalize",
                        getMarkerColor(property)
                      )}
                    >
                      {property.status.replace(/_/g, ' ')}
                    </Badge>
                    {property.price && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-1.5">
                        <span className="font-bold">${property.price.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <h3 className="font-semibold text-base line-clamp-1">{property.title}</h3>
                    <div className="flex justify-between items-center mt-1">
                      <div className="flex items-center text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 mr-1" />
                        <span className="line-clamp-1">{property.location.city}, {property.location.state}</span>
                      </div>
                      <Badge variant="outline" className="capitalize text-xs">
                        {property.type}
                      </Badge>
                    </div>
                    {property.description && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {property.description}
                      </p>
                    )}
                    {property.categoryTags && property.categoryTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {property.categoryTags.slice(0, 3).map((tag, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {property.categoryTags.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{property.categoryTags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}