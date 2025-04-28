import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface MapboxSuggestion {
  id: string;
  place_name: string;
  text: string;
  place_type: string[];
  center: [number, number];
  context?: {
    id: string;
    text: string;
    short_code?: string;
  }[];
  properties: {
    address?: string;
    category?: string;
  };
}

interface MapboxAddressAutofillProps {
  onAddressSelect: (address: {
    fullAddress: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    coordinates: [number, number];
  }) => void;
  className?: string;
  error?: string;
  defaultValue?: string;
}

export function MapboxAddressAutofill({
  onAddressSelect,
  className = '',
  error,
  defaultValue = ''
}: MapboxAddressAutofillProps) {
  const [query, setQuery] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  // Hard-coded Mapbox token for development
  const mapboxToken = 'pk.eyJ1IjoidGFubmVyYm91dCIsImEiOiJjbTgyMDcxZ3oxYXYxMmtwdHlla3E1YjlxIn0.e550t5u2KOcVgJB4GJo13g';
  
  useEffect(() => {
    // Close suggestions dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const fetchSuggestions = async (input: string) => {
    if (!input.trim() || !mapboxToken) return;
    
    setIsLoading(true);
    
    try {
      const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        input
      )}.json?access_token=${mapboxToken}&country=ca&types=address&limit=5`;
      
      const response = await fetch(endpoint);
      const data = await response.json();
      
      if (data.features) {
        setSuggestions(data.features);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Error fetching address suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setQuery(input);
    
    // Always update parent component with manual input to ensure form state is updated
    // even when user types directly without selecting from suggestions
    onAddressSelect({
      fullAddress: input,
      address: input,
      city: '',  // Use empty strings for these optional fields
      state: '',
      postalCode: '',
      coordinates: [0, 0]  // Default coordinates
    });
    
    if (input.length > 2) {  // Reduced minimum length for suggestions
      fetchSuggestions(input);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };
  
  const handleSuggestionClick = (suggestion: MapboxSuggestion) => {
    setQuery(suggestion.place_name);
    setShowSuggestions(false);
    
    // Parse address components
    let streetAddress = '';
    let city = '';
    let state = '';
    let postalCode = '';
    
    // Main text is usually the street address
    streetAddress = suggestion.text;
    
    if (suggestion.properties.address) {
      streetAddress = suggestion.properties.address;
    }
    
    // Process context for city, state/province, postal code
    if (suggestion.context && suggestion.context.length > 0) {
      suggestion.context.forEach(item => {
        if (item.id.startsWith('place')) {
          city = item.text;
        } else if (item.id.startsWith('region')) {
          state = item.text;
        } else if (item.id.startsWith('postcode')) {
          postalCode = item.text;
        }
      });
    }
    
    // Notify parent component
    onAddressSelect({
      fullAddress: suggestion.place_name,
      address: streetAddress,
      city,
      state,
      postalCode,
      coordinates: suggestion.center
    });
  };
  
  return (
    <div className="relative w-full">
      <Label htmlFor="address-search">Address</Label>
      <div className="relative">
        <Input
          id="address-search"
          value={query}
          onChange={handleInputChange}
          placeholder="Type an address"
          className={`w-full ${className} ${error ? 'border-red-500' : ''}`}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            } else if (query.length > 2) {
              fetchSuggestions(query);
            }
          }}
          onBlur={(e) => {
            // Delay hiding suggestions to allow click events to process
            setTimeout(() => {
              if (!suggestionsRef.current?.contains(document.activeElement)) {
                setShowSuggestions(false);
              }
            }, 200);
          }}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
      
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-200 mt-1 w-full rounded-md bg-background shadow-lg border border-border max-h-60 overflow-auto"
          style={{ position: "absolute", top: "100%", left: 0, right: 0 }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <ul className="py-1">
            {suggestions.map(suggestion => (
              <li
                key={suggestion.id}
                className="px-4 py-2 hover:bg-accent cursor-pointer text-sm"
                onClick={() => handleSuggestionClick(suggestion)}
                onMouseDown={(e) => e.preventDefault()}
              >
                {suggestion.place_name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}