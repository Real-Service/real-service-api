import { useEffect, useState, useCallback } from 'react';
import Map, { Marker, NavigationControl, Source, Layer, ViewStateChangeEvent } from 'react-map-gl';
import { Circle, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/hooks/use-auth';
import 'mapbox-gl/dist/mapbox-gl.css';

// GeoJSON types
interface GeoJSONFeature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
}

interface CircleLayer {
  id: string;
  type: 'circle';
  paint: {
    'circle-radius': {
      stops: [number, number][];
      base: number;
    };
    'circle-color': string;
    'circle-stroke-width': number;
    'circle-stroke-color': string;
  };
}

interface ServiceAreaMapProps {
  longitude: number;
  latitude: number;
  radius: number; // in miles
  zipCodes?: string[];
  interactive?: boolean;
  height?: string;
}

export default function ServiceAreaMap({
  longitude, 
  latitude, 
  radius,
  zipCodes,
  interactive = true,
  height = '400px'
}: ServiceAreaMapProps) {
  interface ViewState {
    longitude: number;
    latitude: number;
    zoom: number;
    [key: string]: any;
  }

  const { user } = useAuth();
  const [viewState, setViewState] = useState<ViewState>({
    longitude,
    latitude,
    zoom: 9
  });
  
  // Use the Mapbox token directly from environment variables
  // This approach ensures the token is available
  const mapboxToken = process.env.NODE_ENV === 'development' 
    ? 'pk.eyJ1IjoidGFubmVyYm91dCIsImEiOiJjbTgyMDcxZ3oxYXYxMmtwdHlla3E1YjlxIn0.e550t5u2KOcVgJB4GJo13g' 
    : import.meta.env.VITE_MAPBOX_TOKEN;
  
  // Create authentication token for map operations
  const [authToken, setAuthToken] = useState<string | null>(null);
  
  // Generate map authentication token when user data is available
  useEffect(() => {
    if (user && user.id) {
      const timestamp = Date.now();
      const token = `map-auth-${user.id}-${timestamp}`;
      console.log("Generated map authentication token for user:", user.id);
      setAuthToken(token);
      
      // Store auth token in sessionStorage as a backup
      sessionStorage.setItem('map_auth_token', token);
    }
  }, [user]);
  
  // Generate GeoJSON for the service area circle
  const serviceAreaData: GeoJSONFeature = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Point',
      coordinates: [longitude, latitude]
    }
  };
  
  // Circle layer style with new color theme (teal/green)
  const circleLayer: CircleLayer = {
    id: 'service-area',
    type: 'circle',
    paint: {
      'circle-radius': {
        stops: [
          [0, 0],
          [20, radius * 1609.34] // Convert miles to meters at max zoom
        ],
        base: 2
      },
      'circle-color': 'rgba(16, 185, 129, 0.1)', // Light green with transparency
      'circle-stroke-width': 2,
      'circle-stroke-color': 'rgba(16, 185, 129, 0.8)' // More solid green for border
    }
  };
  
  useEffect(() => {
    // Update viewState if props change
    setViewState(prev => ({
      ...prev,
      longitude,
      latitude
    }));
  }, [longitude, latitude]);
  
  if (!mapboxToken) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Missing Mapbox Token</AlertTitle>
        <AlertDescription>
          Please provide a Mapbox access token as VITE_MAPBOX_TOKEN to display maps.
        </AlertDescription>
      </Alert>
    );
  }
  
  // Authorization header transformer for Mapbox requests
  const transformMapboxRequest = useCallback((url: string, resourceType: string) => {
    // Only add auth for our own API endpoints using Mapbox
    if (url.includes('api.mapbox.com') && authToken) {
      // Return a modified Request object
      return {
        url,
        headers: {
          // Add our custom auth token to the headers
          'X-Map-Auth': authToken,
          'X-User-ID': user?.id ? String(user.id) : '',
          'X-Auth-Timestamp': Date.now().toString()
        }
      };
    }
    return { url }; // Return unmodified for other resources
  }, [authToken, user]);
  
  return (
    <div style={{ height, width: '100%' }}>
      <Map
        {...viewState}
        onMove={(evt: ViewStateChangeEvent) => interactive && setViewState(evt.viewState)}
        mapStyle="mapbox://styles/mapbox/light-v11" // Light style to match our new theme
        mapboxAccessToken={mapboxToken}
        attributionControl={true}
        transformRequest={transformMapboxRequest}
        style={{ borderRadius: '0.75rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}
      >
        <Source id="service-area-source" type="geojson" data={serviceAreaData}>
          <Layer {...circleLayer} />
        </Source>
        
        <Marker 
          longitude={longitude} 
          latitude={latitude}
          anchor="center"
        >
          <Circle className="h-6 w-6 text-primary stroke-[3px] fill-white" />
        </Marker>
        
        {interactive && <NavigationControl position="top-right" />}
      </Map>
      
      {/* Invisible authentication info for debugging */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{ display: 'none' }} data-auth-token={authToken} data-user-id={user?.id} />
      )}
    </div>
  );
}