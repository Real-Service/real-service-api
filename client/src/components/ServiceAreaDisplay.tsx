import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Loader2 } from 'lucide-react';

interface ServiceAreaDisplayProps {
  longitude: number;
  latitude: number;
  radius: number; // in kilometers
  height?: string;
  width?: string;
}

export function ServiceAreaDisplay({
  longitude,
  latitude,
  radius,
  height = '150px',
  width = '100%'
}: ServiceAreaDisplayProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  useEffect(() => {
    // Set Mapbox token directly
    const mapboxToken = 'pk.eyJ1IjoidGFubmVyYm91dCIsImEiOiJjbTgyMDcxZ3oxYXYxMmtwdHlla3E1YjlxIn0.e550t5u2KOcVgJB4GJo13g';
    mapboxgl.accessToken = mapboxToken;

    if (!map.current && mapContainer.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [longitude, latitude],
        zoom: 10,
        interactive: false // Make the map non-interactive for display purposes
      });

      map.current.on('load', () => {
        setIsMapLoaded(true);
        
        if (!map.current) return;

        // Add circle layer
        map.current.addSource('service-area', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [longitude, latitude]
            },
            properties: {}
          }
        });

        map.current.addLayer({
          id: 'service-area-circle',
          type: 'circle',
          source: 'service-area',
          paint: {
            'circle-radius': {
              stops: [
                [0, 0],
                [20, radius * 1000] // Convert kilometers to meters at max zoom
              ],
              base: 2
            },
            'circle-color': 'rgba(76, 175, 80, 0.2)',
            'circle-stroke-width': 1,
            'circle-stroke-color': '#4CAF50'
          }
        });

        // Add a marker at the center point
        new mapboxgl.Marker({ color: '#4CAF50' })
          .setLngLat([longitude, latitude])
          .addTo(map.current);
      });
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [longitude, latitude, radius]);

  return (
    <div style={{ width, height }} className="rounded-md overflow-hidden border border-border">
      {!isMapLoaded && (
        <div className="flex items-center justify-center h-full bg-muted/20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}