import { useState } from 'react';

type GeocodeResult = {
  id: string;
  place_name: string;
  center: [number, number]; // [longitude, latitude]
  place_type: string[];
  text: string;
  context?: {
    id: string;
    text: string;
  }[];
};

export function useMapboxGeocoding() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);

  const searchLocation = async (query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Hard-coded Mapbox token for development
      const mapboxToken = 'pk.eyJ1IjoidGFubmVyYm91dCIsImEiOiJjbTgyMDcxZ3oxYXYxMmtwdHlla3E1YjlxIn0.e550t5u2KOcVgJB4GJo13g';

      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query
        )}.json?access_token=${mapboxToken}&autocomplete=true&country=us,ca&types=place,locality,neighborhood,address&limit=5`
      );

      if (!response.ok) {
        throw new Error('Geocoding request failed');
      }

      const data = await response.json();
      setSuggestions(data.features || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during geocoding');
      console.error('Geocoding error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    searchLocation,
    suggestions,
    isLoading,
    error,
    clearSuggestions: () => setSuggestions([])
  };
}