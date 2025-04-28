import { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface ServiceAreaMapInputProps {
  longitude: number;
  latitude: number;
  radius: number; // in kilometers
  onMarkerChange?: (marker: { longitude: number; latitude: number }) => void;
  interactive?: boolean;
  height?: string;
}

export function ServiceAreaMapInput({
  longitude,
  latitude,
  radius,
  onMarkerChange,
  interactive = true,
  height = '250px'
}: ServiceAreaMapInputProps) {
  const { user } = useAuth();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const radiusCircle = useRef<mapboxgl.GeoJSONSource | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Generate authentication token for map
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
  
  // Create transform request function for Mapbox authentication 
  const transformMapboxRequest = useCallback((url: string, resourceType?: string): any => {
    // Only add auth for our own API endpoints using Mapbox
    if (url.includes('api.mapbox.com') && authToken && user?.id) {
      return {
        url,
        headers: {
          // Add our custom auth token to the headers
          'X-Map-Auth': authToken,
          'X-User-ID': String(user.id),
          'X-Auth-Timestamp': Date.now().toString()
        }
      };
    }
    return { url }; // Return unmodified for other resources
  }, [authToken, user]);

  useEffect(() => {
    // Set Mapbox token directly
    const mapboxToken = 'pk.eyJ1IjoidGFubmVyYm91dCIsImEiOiJjbTgyMDcxZ3oxYXYxMmtwdHlla3E1YjlxIn0.e550t5u2KOcVgJB4GJo13g';
    mapboxgl.accessToken = mapboxToken;

    if (!map.current && mapContainer.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [longitude, latitude],
        zoom: 9,
        interactive: interactive,
        transformRequest: transformMapboxRequest
      });

      map.current.on('load', () => {
        setIsMapLoaded(true);
        
        if (map.current) {
          // Add circle layer for service radius
          const circleGeoJSON = createGeoJSONCircle([longitude, latitude], radius);
          map.current.addSource('service-radius', {
            type: 'geojson',
            data: circleGeoJSON as any
          });

          radiusCircle.current = map.current.getSource('service-radius') as mapboxgl.GeoJSONSource;

          map.current.addLayer({
            id: 'service-radius-fill',
            type: 'fill',
            source: 'service-radius',
            paint: {
              'fill-color': '#4096ff',
              'fill-opacity': 0.1
            }
          });

          map.current.addLayer({
            id: 'service-radius-border',
            type: 'line',
            source: 'service-radius',
            paint: {
              'line-color': '#4096ff',
              'line-width': 2,
              'line-opacity': 0.6
            }
          });

          // Add draggable marker if interactive
          if (interactive) {
            marker.current = new mapboxgl.Marker({ draggable: true })
              .setLngLat([longitude, latitude])
              .addTo(map.current);

            marker.current.on('dragend', () => {
              if (marker.current && radiusCircle.current) {
                const lngLat = marker.current.getLngLat();
                
                // Update circle position
                radiusCircle.current.setData(
                  createGeoJSONCircle([lngLat.lng, lngLat.lat], radius)
                );

                // Notify parent component about marker change
                if (onMarkerChange) {
                  onMarkerChange({
                    longitude: lngLat.lng,
                    latitude: lngLat.lat
                  });
                }
              }
            });
          } else {
            // Add non-draggable marker
            marker.current = new mapboxgl.Marker()
              .setLngLat([longitude, latitude])
              .addTo(map.current);
          }
        }
      });

      // Clean up
      return () => {
        if (map.current) {
          map.current.remove();
          map.current = null;
        }
      };
    }
  }, [longitude, latitude, radius, interactive, onMarkerChange, transformMapboxRequest]);

  // Update circle when radius changes
  useEffect(() => {
    if (isMapLoaded && radiusCircle.current && marker.current) {
      const lngLat = marker.current.getLngLat();
      radiusCircle.current.setData(
        createGeoJSONCircle([lngLat.lng, lngLat.lat], radius)
      );
    }
  }, [radius, isMapLoaded]);

  // Update marker position if longitude/latitude props change
  useEffect(() => {
    if (isMapLoaded && marker.current && map.current) {
      marker.current.setLngLat([longitude, latitude]);
      map.current.flyTo({ center: [longitude, latitude], zoom: 9 });
      
      if (radiusCircle.current) {
        radiusCircle.current.setData(
          createGeoJSONCircle([longitude, latitude], radius)
        );
      }
    }
  }, [longitude, latitude, radius, isMapLoaded]);

  // Create a GeoJSON circle with given center and radius in kilometers
  function createGeoJSONCircle(center: [number, number], radiusKm: number): any {
    const points = 64;
    const earthRadiusKm = 6371;  // Earth's radius in kilometers
    
    // Convert kilometers to radians
    const radiusRadians = radiusKm / earthRadiusKm;
    
    // Convert center point to radians
    const centerLngRad = (center[0] * Math.PI) / 180;
    const centerLatRad = (center[1] * Math.PI) / 180;
    
    let coords: [number, number][] = [];
    
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * (2 * Math.PI);
      
      // Calculate point on the circle
      const pointLatRad = Math.asin(
        Math.sin(centerLatRad) * Math.cos(radiusRadians) +
        Math.cos(centerLatRad) * Math.sin(radiusRadians) * Math.cos(angle)
      );
      
      const pointLngRad = centerLngRad + Math.atan2(
        Math.sin(angle) * Math.sin(radiusRadians) * Math.cos(centerLatRad),
        Math.cos(radiusRadians) - Math.sin(centerLatRad) * Math.sin(pointLatRad)
      );
      
      // Convert back to degrees
      const pointLng = (pointLngRad * 180) / Math.PI;
      const pointLat = (pointLatRad * 180) / Math.PI;
      
      coords.push([pointLng, pointLat]);
    }
    
    // Close the polygon
    coords.push(coords[0]);
    
    return {
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [coords]
      },
      properties: {}
    };
  }

  return (
    <div style={{ width: '100%', height: height }} className="rounded-md overflow-hidden border border-border">
      {!isMapLoaded && (
        <div className="flex items-center justify-center h-full bg-muted/20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Development-only debug info (hidden from UI) */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{ display: 'none' }} 
          data-auth-token={authToken} 
          data-user-id={user?.id}
          data-map-auth-enabled="true" 
        />
      )}
    </div>
  );
}