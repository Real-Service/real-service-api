import { useState, useEffect, useRef } from 'react';
import { useMapboxGeocoding } from '@/hooks/use-mapbox-geocoding';
import { Input } from '@/components/ui/input';
import { Loader2, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LocationSearchProps {
  onSelectLocation: (location: {
    longitude: number;
    latitude: number;
    placeName: string;
    city: string;
    state: string;
  }) => void;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}

export function LocationSearch({
  onSelectLocation,
  defaultValue = '',
  placeholder = 'Search for a location',
  className = '',
}: LocationSearchProps) {
  const [inputValue, setInputValue] = useState(defaultValue);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const {
    searchLocation,
    suggestions,
    isLoading,
    error,
    clearSuggestions,
  } = useMapboxGeocoding();

  useEffect(() => {
    if (inputValue.length >= 3) {
      const debounceTimeout = setTimeout(() => {
        searchLocation(inputValue);
      }, 300);
      return () => clearTimeout(debounceTimeout);
    }
  }, [inputValue, searchLocation]);

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelectSuggestion = (suggestion: any) => {
    const [longitude, latitude] = suggestion.center;
    
    // Extract city and state from context
    let city = suggestion.text || '';
    let state = '';
    
    if (suggestion.context) {
      const stateItem = suggestion.context.find((ctx: any) => 
        ctx.id.startsWith('region.')
      );
      state = stateItem ? stateItem.text : '';
    }
    
    onSelectLocation({
      longitude,
      latitude,
      placeName: suggestion.place_name,
      city,
      state,
    });
    
    setInputValue(suggestion.place_name);
    setIsFocused(false);
    clearSuggestions();
  };

  return (
    <div className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          className={`pr-8 ${className}`}
        />
        {inputValue && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full w-8 px-0"
            onClick={() => {
              setInputValue('');
              clearSuggestions();
              if (inputRef.current) {
                inputRef.current.focus();
              }
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isFocused && (suggestions.length > 0 || isLoading) && (
        <div
          ref={suggestionsRef}
          style={{ position: 'absolute', zIndex: 200 }}
          className="mt-1 w-full rounded-md border border-border bg-background shadow-md"
          onMouseDown={(e) => {
            // Prevent the blur event on the input
            e.preventDefault();
          }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center p-3">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span>Searching...</span>
            </div>
          ) : (
            <ul className="max-h-60 overflow-auto py-1">
              {suggestions.map((suggestion) => (
                <li
                  key={suggestion.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectSuggestion(suggestion);
                  }}
                  className="cursor-pointer px-3 py-2 hover:bg-muted"
                >
                  <div className="flex items-start">
                    <MapPin className="mr-2 h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">{suggestion.text}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {suggestion.place_name.split(suggestion.text)[1]}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}