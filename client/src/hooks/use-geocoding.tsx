import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

type GeocodingResult = {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  city: string;
  state: string;
  zipCode: string;
  success: boolean;
};

export function useGeocoding() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  const geocodeAddress = async (address: string): Promise<GeocodingResult | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
      
      if (!mapboxToken) {
        throw new Error('Mapbox token is not configured');
      }
      
      // Format the address for the API call
      const formattedAddress = encodeURIComponent(address);
      
      // Make the API call to Mapbox Geocoding API
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${formattedAddress}.json?access_token=${mapboxToken}&limit=1&country=US`
      );
      
      if (!response.ok) {
        throw new Error('Failed to geocode address');
      }
      
      const data = await response.json();
      
      if (!data.features || data.features.length === 0) {
        throw new Error('No results found for this address');
      }
      
      const location = data.features[0];
      const [longitude, latitude] = location.center;
      
      // Extract address components
      let city = '';
      let state = '';
      let zipCode = '';
      
      if (location.context) {
        // Mapbox context array contains place, region, country, postcode info
        for (const context of location.context) {
          if (context.id.startsWith('place')) {
            city = context.text;
          } else if (context.id.startsWith('region')) {
            state = context.text;
          } else if (context.id.startsWith('postcode')) {
            zipCode = context.text;
          }
        }
      }
      
      return {
        latitude,
        longitude,
        formattedAddress: location.place_name,
        city,
        state,
        zipCode,
        success: true
      };
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to geocode address';
      setError(errorMessage);
      
      toast({
        title: 'Geocoding Error',
        description: errorMessage,
        variant: 'destructive'
      });
      
      return null;
    } finally {
      setIsLoading(false);
    }
  };
  
  return {
    geocodeAddress,
    isLoading,
    error
  };
}