import React, { useEffect, useState, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { DollarSign, Calendar, FileText, Eye, Star, CircleDollarSign, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QuoteStatusBadge } from './QuotesInbox';
import { Job, Quote } from '@shared/schema';
import { formatCurrency } from '@/lib/utils';
import 'mapbox-gl/dist/mapbox-gl.css';

// Type for a location from a job
interface JobLocation {
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
}

interface QuotesMapProps {
  quotes: Quote[];
  jobs: Job[];
  onViewDetails?: (quote: Quote) => void;
  highlightedQuoteId?: number | null;
  className?: string;
}

export function QuotesMap({
  quotes,
  jobs,
  onViewDetails,
  highlightedQuoteId = null,
  className = ''
}: QuotesMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const markersRef = useRef<{[key: string]: mapboxgl.Marker}>({});
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  
  // Use the Mapbox token directly from environment variables
  const mapboxToken = process.env.NODE_ENV === 'development' 
    ? 'pk.eyJ1IjoidGFubmVyYm91dCIsImEiOiJjbTgyMDcxZ3oxYXYxMmtwdHlla3E1YjlxIn0.e550t5u2KOcVgJB4GJo13g' 
    : import.meta.env.VITE_MAPBOX_TOKEN;
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    });
  };

  // Get job location
  const getJobLocation = useCallback((jobId: number): JobLocation | null => {
    const job = jobs.find(j => j.id === jobId);
    if (!job || !job.location) return null;
    
    const location = job.location as JobLocation;
    if (!location.latitude || !location.longitude) return null;
    
    return {
      latitude: location.latitude,
      longitude: location.longitude,
      city: location.city,
      state: location.state
    };
  }, [jobs]);

  // Get job by ID
  const getJob = (jobId: number): Job | undefined => {
    return jobs.find(job => job.id === jobId);
  };

  // Initialize map when component mounts
  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    
    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-98, 39], // Center of the US
      zoom: 3
    });
    
    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    // Cleanup on unmount
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapboxToken]);

  // Update markers when jobs change or when highlighted job changes
  useEffect(() => {
    if (!map.current) return;
    
    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};
    
    // Bounds for fitting map
    const bounds = new mapboxgl.LngLatBounds();
    let hasValidLocation = false;
    
    // Add markers for each quote with valid job location
    quotes.forEach(quote => {
      const location = getJobLocation(quote.jobId);
      if (!location) return;
      
      hasValidLocation = true;
      const isHighlighted = highlightedQuoteId === quote.id;
      
      // Add location to bounds
      bounds.extend([location.longitude, location.latitude]);
      
      // Create marker element
      const markerElement = document.createElement('div');
      markerElement.className = `quote-marker cursor-pointer transition-all duration-300 ease-in-out 
                                ${isHighlighted ? 'scale-125 z-10' : ''} 
                                ${quote.status === 'accepted' ? 'quote-marker-accepted' : 
                                   quote.status === 'rejected' ? 'quote-marker-rejected' : 
                                   'quote-marker-default'}`;
      
      // Apply styles
      markerElement.style.width = '30px';
      markerElement.style.height = '30px';
      markerElement.style.backgroundImage = 'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23ffffff\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z\'/%3E%3Ccircle cx=\'12\' cy=\'10\' r=\'3\'/%3E%3C/svg%3E")';
      markerElement.style.backgroundSize = 'cover';
      markerElement.style.backgroundPosition = 'center';
      
      // Set marker color based on status
      if (quote.status === 'accepted') {
        markerElement.style.backgroundColor = '#16a34a'; // Green for accepted
        markerElement.style.boxShadow = isHighlighted ? '0 0 0 4px rgba(22, 163, 74, 0.4)' : 'none';
      } else if (quote.status === 'rejected') {
        markerElement.style.backgroundColor = '#dc2626'; // Red for rejected
        markerElement.style.boxShadow = isHighlighted ? '0 0 0 4px rgba(220, 38, 38, 0.4)' : 'none';
      } else if (quote.status === 'sent') {
        markerElement.style.backgroundColor = '#2563eb'; // Blue for sent
        markerElement.style.boxShadow = isHighlighted ? '0 0 0 4px rgba(37, 99, 235, 0.4)' : 'none';
      } else if (quote.status === 'viewed') {
        markerElement.style.backgroundColor = '#7e22ce'; // Purple for viewed
        markerElement.style.boxShadow = isHighlighted ? '0 0 0 4px rgba(126, 34, 206, 0.4)' : 'none';
      } else if (quote.status === 'revised') {
        markerElement.style.backgroundColor = '#eab308'; // Yellow for revised
        markerElement.style.boxShadow = isHighlighted ? '0 0 0 4px rgba(234, 179, 8, 0.4)' : 'none';
      } else {
        markerElement.style.backgroundColor = '#475569'; // Slate for draft or other
        markerElement.style.boxShadow = isHighlighted ? '0 0 0 4px rgba(71, 85, 105, 0.4)' : 'none';
      }
      
      // Pulse animation for highlighted marker
      if (isHighlighted) {
        markerElement.style.animation = 'pulse 2s infinite';
      }
      
      // Create marker
      const marker = new mapboxgl.Marker(markerElement)
        .setLngLat([location.longitude, location.latitude])
        .addTo(map.current!);
      
      // Store marker reference
      markersRef.current[`quote-${quote.id}`] = marker;
      
      // Handle marker click
      markerElement.addEventListener('click', () => {
        // Remove existing popup if any
        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
        }
        
        const job = getJob(quote.jobId);
        
        // Create popup
        const popupHTML = `
          <div class="quote-popup p-2 max-w-[260px]">
            <div class="flex justify-between items-start mb-2">
              <h3 class="font-medium text-base">${quote.title}</h3>
              <div class="quote-status-${quote.status} text-xs font-semibold px-2 py-1 rounded-full uppercase">
                ${quote.status}
              </div>
            </div>
            <div class="text-xs mb-1">Quote #${quote.quoteNumber} • ${formatDate(quote.createdAt.toString())}</div>
            <div class="text-xs mb-1"><strong>Job:</strong> ${job?.title || `Job #${quote.jobId}`}</div>
            <div class="text-xs mb-1"><strong>Amount:</strong> ${formatCurrency(quote.total)}</div>
            ${quote.validUntil ? `<div class="text-xs mb-2"><strong>Valid until:</strong> ${formatDate(quote.validUntil.toString())}</div>` : ''}
            <button class="view-quote-btn bg-blue-600 hover:bg-blue-700 text-white text-xs py-1.5 px-3 rounded-md w-full mt-1 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              View Quote
            </button>
          </div>
        `;
        
        // Create popup
        popupRef.current = new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: false,
          className: 'quote-map-popup bg-blue-900/90 text-white shadow-lg border border-blue-700 rounded-md'
        })
          .setLngLat([location.longitude, location.latitude])
          .setHTML(popupHTML)
          .addTo(map.current!);
        
        // Add event listener to view button
        setTimeout(() => {
          const viewBtn = document.querySelector('.view-quote-btn');
          if (viewBtn) {
            viewBtn.addEventListener('click', () => {
              if (onViewDetails) {
                onViewDetails(quote);
              }
            });
          }
        }, 100);
        
        setSelectedQuote(quote);
      });
    });
    
    // Fit map to bounds if we have valid locations
    if (hasValidLocation && map.current) {
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 15
      });
    }
  }, [quotes, jobs, highlightedQuoteId, getJobLocation, onViewDetails]);

  return (
    <div className={`w-full h-full ${className}`}>
      <style>
        {`
        .quote-marker {
          border-radius: 50%;
          cursor: pointer;
        }
        
        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.8;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        /* Popup styles */
        .quote-map-popup .mapboxgl-popup-content {
          background-color: rgba(30, 41, 59, 0.95);
          color: white;
          border-radius: 8px;
          padding: 8px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        
        .quote-map-popup .mapboxgl-popup-close-button {
          color: white;
          font-size: 16px;
          padding: 4px 8px;
        }
        
        .quote-status-sent {
          background-color: rgba(37, 99, 235, 0.2);
          color: #93c5fd;
        }
        
        .quote-status-viewed {
          background-color: rgba(126, 34, 206, 0.2);
          color: #c4b5fd;
        }
        
        .quote-status-accepted {
          background-color: rgba(22, 163, 74, 0.2);
          color: #86efac;
        }
        
        .quote-status-rejected {
          background-color: rgba(220, 38, 38, 0.2);
          color: #fca5a5;
        }
        
        .quote-status-revised {
          background-color: rgba(234, 179, 8, 0.2);
          color: #fde68a;
        }
        
        .quote-status-draft {
          background-color: rgba(71, 85, 105, 0.2);
          color: #cbd5e1;
        }
        `}
      </style>
      <div className="h-full w-full" ref={mapContainer} />
    </div>
  );
}