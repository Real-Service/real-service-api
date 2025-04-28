import React, { useEffect, useState, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { MapPin, CircleDollarSign, Clock, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getCategoryDisplayName } from '@shared/constants';
import { CategoryIcon } from './CategoryIcons';
import { Job } from '@shared/schema';
import 'mapbox-gl/dist/mapbox-gl.css';

// Utility type for job location
interface JobLocation {
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
}

interface JobsMapProps {
  jobs: Job[];
  onViewDetails?: (job: Job) => void;
  onBidJob?: (job: Job) => void;
  className?: string;
  serviceAreaMarker?: {latitude: number, longitude: number};
  serviceRadius?: number;
  highlightedJobId?: number | null;
  onJobHover?: (jobId: number | null) => void; // Callback when a job is hovered
}

export function JobsMap({ 
  jobs, 
  onViewDetails, 
  onBidJob, 
  className = '',
  serviceAreaMarker,
  serviceRadius = 25,
  highlightedJobId = null,
  onJobHover
}: JobsMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const markersRef = useRef<{[key: string]: mapboxgl.Marker}>({});
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  
  // Use the Mapbox token directly from environment variables
  const mapboxToken = process.env.NODE_ENV === 'development' 
    ? 'pk.eyJ1IjoidGFubmVyYm91dCIsImEiOiJjbTgyMDcxZ3oxYXYxMmtwdHlla3E1YjlxIn0.e550t5u2KOcVgJB4GJo13g' 
    : import.meta.env.VITE_MAPBOX_TOKEN;
  
  // Color for map markers based on job category
  const getMarkerColor = (job: Job): string => {
    if (!job.categoryTags || !Array.isArray(job.categoryTags) || job.categoryTags.length === 0) {
      return '#627BFF'; // Default blue
    }
    
    const category = String(job.categoryTags[0]).toLowerCase();
    
    // Define colors for different categories
    switch (category) {
      case 'plumbing':
        return '#3B82F6'; // Blue
      case 'electrical':
        return '#F59E0B'; // Amber
      case 'carpentry':
        return '#8B5CF6'; // Purple
      case 'painting':
        return '#10B981'; // Green
      case 'roofing':
        return '#EF4444'; // Red
      case 'flooring':
        return '#EC4899'; // Pink
      case 'landscaping':
        return '#22C55E'; // Green
      default:
        return '#627BFF'; // Default blue
    }
  };

  // Initialize map
  useEffect(() => {
    if (!mapboxToken || !mapContainer.current || map.current) return;
    
    // Set mapbox token
    mapboxgl.accessToken = mapboxToken;
    
    // Create map
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11', // Light style for better readability
      center: [serviceAreaMarker?.longitude || -63.57, serviceAreaMarker?.latitude || 44.64],
      zoom: 9
    });
    
    // Add navigation control
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    // Clean up
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapboxToken]);
  
  // Update map center if service area changes
  useEffect(() => {
    if (!map.current || !serviceAreaMarker) return;
    
    map.current.flyTo({
      center: [serviceAreaMarker.longitude, serviceAreaMarker.latitude]
    });
    
    // Add service area marker
    const el = document.createElement('div');
    el.className = 'service-area-marker';
    
    if (map.current) {
      new mapboxgl.Marker(el)
        .setLngLat([serviceAreaMarker.longitude, serviceAreaMarker.latitude])
        .addTo(map.current);
    }
  }, [serviceAreaMarker]);
  
  // Add job markers to map
  useEffect(() => {
    if (!map.current) return;
    
    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};
    
    // Add markers for jobs with valid locations
    jobs.forEach(job => {
      const jobLocation = job.location as JobLocation | null;
      
      if (!jobLocation || !jobLocation.latitude || !jobLocation.longitude) return;
      
      // Create marker element
      const markerEl = document.createElement('div');
      markerEl.className = 'job-marker';
      markerEl.setAttribute('data-job-id', String(job.id));
      markerEl.innerHTML = `
        <div class="marker-container">
          <div class="pin-container">
            <svg viewBox="0 0 24 24" class="marker-icon" fill="${getMarkerColor(job)}" stroke="white" stroke-width="1.5">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            ${job.isUrgent ? '<span class="urgent-indicator"></span>' : ''}
          </div>
          <div class="price-tag">$${job.budget || 0}</div>
        </div>
      `;
      
      // Create and store marker
      if (map.current) {
        const marker = new mapboxgl.Marker(markerEl)
          .setLngLat([jobLocation.longitude, jobLocation.latitude])
          .addTo(map.current);
        
        // Add hover events if the callback is provided
        if (onJobHover) {
          markerEl.addEventListener('mouseenter', () => {
            onJobHover(job.id);
          });
          
          markerEl.addEventListener('mouseleave', () => {
            onJobHover(null);
          });
        }
        
        // Add click event
        markerEl.addEventListener('click', () => {
          setSelectedJob(job);
          
          // Create popup
          if (popupRef.current) popupRef.current.remove();
          
          const popupContent = document.createElement('div');
          popupContent.className = 'job-popup';
          
          // Calculate days since posting
          const daysAgo = Math.floor((Date.now() - new Date(job.createdAt).getTime()) / (1000 * 60 * 60 * 24));
          const timePosted = daysAgo === 0 ? 'TODAY' : daysAgo === 1 ? 'YESTERDAY' : `${daysAgo} DAYS AGO`;
          
          // Generate placeholder image path based on job category
          const categoryName = job.categoryTags && Array.isArray(job.categoryTags) && job.categoryTags.length > 0 
            ? String(job.categoryTags[0]).toLowerCase() 
            : 'general';
          
          // Format job details for display - using optional properties or appropriate fallbacks
          const roomCount = '1 room'; // Fallback value since roomCount property doesn't exist in our schema
          const sqFt = job.budget ? `${Math.round(job.budget * 10)}` : ''; // Placeholder calculation
          const propertyType = job.isUrgent ? 'Urgent' : 'Standard'; // Use existing properties
          
          popupContent.innerHTML = `
            <div class="popup-content">
              <!-- New job status badge that appears on top of the image -->
              <div class="job-status-badge">NEW ${timePosted}</div>
              
              <!-- Job image -->
              <div class="job-image">
                <!-- Placeholder for now, in real app we'd use job.imageUrls -->
                <div class="job-image-placeholder ${categoryName}-background"></div>
                <div class="close-button">×</div>
              </div>
              
              <!-- Job information -->
              <div class="job-info-container">
                <!-- Price section -->
                <div class="job-price">$${job.budget?.toLocaleString() || 0}</div>
                
                <!-- Key details with icons -->
                <div class="job-key-details">
                  <div class="detail-item">
                    <span class="detail-value">${roomCount}</span>
                  </div>
                  ${sqFt ? `
                  <div class="detail-item">
                    <span class="detail-value">${sqFt} sq ft</span>
                  </div>
                  ` : ''}
                  ${propertyType ? `
                  <div class="detail-item">
                    <span class="detail-value">${propertyType}</span>
                  </div>
                  ` : ''}
                </div>
                
                <!-- Additional details section -->
                <div class="job-additional-details">
                  <div class="job-location">
                    <span>${jobLocation.city || ''}, ${jobLocation.state || ''}</span>
                  </div>
                    <div class="job-timeframe">
                    <span>Available now</span>
                  </div>
                </div>
                
                <!-- Action buttons -->
                <div class="popup-actions">
                  <button class="share-button">
                    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                      <polyline points="16 6 12 2 8 6"></polyline>
                      <line x1="12" y1="2" x2="12" y2="15"></line>
                    </svg>
                  </button>
                  <button class="save-button">
                    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                  </button>
                  <button class="view-details-btn">View Details</button>
                </div>
              </div>
            </div>
          `;
          
          if (map.current) {
            popupRef.current = new mapboxgl.Popup({ 
              closeButton: false, 
              maxWidth: '400px',
              className: 'custom-popup'
            })
              .setLngLat([jobLocation.longitude, jobLocation.latitude])
              .setDOMContent(popupContent)
              .addTo(map.current);
            
            // Add click event to view details button
            const detailsBtn = popupContent.querySelector('.view-details-btn');
            if (detailsBtn) {
              detailsBtn.addEventListener('click', () => {
                if (popupRef.current) popupRef.current.remove();
                if (onViewDetails) onViewDetails(job);
                else if (onBidJob) onBidJob(job);
              });
            }
            
            // Add click event to close button
            const closeBtn = popupContent.querySelector('.close-button');
            if (closeBtn) {
              closeBtn.addEventListener('click', () => {
                if (popupRef.current) popupRef.current.remove();
              });
            }
          }
        });
        
        markersRef.current[job.id] = marker;
      }
    });
    
  }, [jobs, onViewDetails, onBidJob, onJobHover]);
  
  // Handle job highlight effect
  useEffect(() => {
    if (!map.current) return;
    
    // Update marker styles based on highlightedJobId
    Object.entries(markersRef.current).forEach(([jobId, marker]) => {
      const markerElement = marker.getElement();
      const markerSvg = markerElement.querySelector('.marker-icon') as SVGElement;
      
      if (highlightedJobId === null) {
        // Reset all markers to their original style
        if (markerSvg) {
          const job = jobs.find(j => j.id === Number(jobId));
          if (job) {
            markerSvg.style.fill = getMarkerColor(job);
            markerSvg.style.opacity = '1';
            markerSvg.style.transform = 'scale(1)';
            markerSvg.style.filter = 'none';
            markerSvg.style.transition = 'all 0.3s ease';
            markerSvg.style.animation = 'none';
          }
        }
      } else if (highlightedJobId === Number(jobId)) {
        // Highlight the selected marker
        if (markerSvg) {
          const job = jobs.find(j => j.id === Number(jobId));
          markerSvg.style.fill = job ? getMarkerColor(job) : '#10B981';
          markerSvg.style.opacity = '1';
          // Make it more noticeably larger with a pulse effect
          markerSvg.style.transform = 'scale(1.2)';
          markerSvg.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
          markerSvg.style.filter = 'drop-shadow(0 0 4px rgba(255,255,255,0.6))';
          markerSvg.style.animation = 'pulseMarker 1.5s infinite';
          
          // Fly to this marker
          if (map.current && job && job.location) {
            const location = job.location as JobLocation;
            if (location.latitude && location.longitude) {
              map.current.flyTo({
                center: [location.longitude, location.latitude],
                zoom: 12,
                speed: 0.8,
                essential: true
              });
            }
          }
        }
      } else {
        // Dim other markers
        if (markerSvg) {
          markerSvg.style.fill = '#15803D'; // Dark green color for non-highlighted pins
          markerSvg.style.opacity = '0.6';
          markerSvg.style.transform = 'scale(1)';
          markerSvg.style.filter = 'none';
          markerSvg.style.transition = 'all 0.3s ease';
          markerSvg.style.animation = 'none';
        }
      }
    });
  }, [highlightedJobId, jobs]);
  
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
  
  return (
    <div className={`w-full h-[600px] rounded-lg overflow-hidden bg-blue-950/20 border border-blue-800/30 ${className}`}>
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Custom CSS for map elements */}
      <style>
        {`
          .service-area-marker {
            width: 20px;
            height: 20px;
            background-color: #3b82f6;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 0 0 rgba(66, 133, 244, 0.4);
            animation: pulse 2s infinite;
          }
          
          @keyframes pulse {
            0% {
              box-shadow: 0 0 0 0 rgba(66, 133, 244, 0.4);
            }
            70% {
              box-shadow: 0 0 0 10px rgba(66, 133, 244, 0);
            }
            100% {
              box-shadow: 0 0 0 0 rgba(66, 133, 244, 0);
            }
          }
          
          @keyframes pulseMarker {
            0% {
              filter: drop-shadow(0 0 3px rgba(255,255,255,0.6));
              transform: scale(1.15);
            }
            50% {
              filter: drop-shadow(0 0 7px rgba(255,255,255,0.8));
              transform: scale(1.25);
            }
            100% {
              filter: drop-shadow(0 0 3px rgba(255,255,255,0.6));
              transform: scale(1.15);
            }
          }
          
          .job-marker {
            cursor: pointer;
          }
          
          .marker-container {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          
          .pin-container {
            position: relative;
          }
          
          .marker-icon {
            width: 32px;
            height: 32px;
            margin-bottom: -8px;
          }
          
          .urgent-indicator {
            position: absolute;
            top: -4px;
            right: -4px;
            width: 12px;
            height: 12px;
            background-color: #ef4444;
            border-radius: 50%;
            border: 1px solid white;
          }
          
          .price-tag {
            background-color: #1e40af;
            color: white;
            font-size: 12px;
            font-weight: 500;
            padding: 2px 8px;
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            white-space: nowrap;
          }
          
          /* Custom popup styles to match the reference image */
          .custom-popup .mapboxgl-popup-content {
            background-color: white;
            color: #333;
            padding: 0;
            border-radius: 12px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
            border: none;
            overflow: hidden;
            width: 280px;
            max-width: 80vw;
          }
          
          .custom-popup .mapboxgl-popup-tip {
            display: none; /* Hide the tip */
          }
          
          .popup-content {
            padding: 0;
            position: relative;
          }
          
          /* Job status badge */
          .job-status-badge {
            position: absolute;
            top: 10px;
            left: 10px;
            background-color: #2B9348;
            color: white;
            font-size: 12px;
            font-weight: bold;
            padding: 4px 12px;
            border-radius: 100px;
            z-index: 10;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          }
          
          /* Job image container */
          .job-image {
            position: relative;
            height: 160px;
            width: 100%;
            overflow: hidden;
          }
          
          /* Close button */
          .close-button {
            position: absolute;
            top: 10px;
            right: 10px;
            width: 30px;
            height: 30px;
            background-color: rgba(255, 255, 255, 0.8);
            color: #333;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            cursor: pointer;
            z-index: 10;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          }
          
          /* Job image placeholder */
          .job-image-placeholder {
            height: 100%;
            width: 100%;
            background-size: cover;
            background-position: center;
          }
          
          /* Category-specific background colors */
          .plumbing-background {
            background-image: linear-gradient(135deg, #3B82F6, #1E40AF);
          }
          
          .electrical-background {
            background-image: linear-gradient(135deg, #F59E0B, #B45309);
          }
          
          .carpentry-background {
            background-image: linear-gradient(135deg, #8B5CF6, #5B21B6);
          }
          
          .painting-background {
            background-image: linear-gradient(135deg, #10B981, #065F46);
          }
          
          .roofing-background {
            background-image: linear-gradient(135deg, #EF4444, #991B1B);
          }
          
          .flooring-background {
            background-image: linear-gradient(135deg, #EC4899, #9D174D);
          }
          
          .landscaping-background {
            background-image: linear-gradient(135deg, #22C55E, #15803D);
          }
          
          .general-background {
            background-image: linear-gradient(135deg, #6B7280, #374151);
          }
          
          /* Job information container */
          .job-info-container {
            padding: 12px;
            background-color: white;
          }
          
          /* Price */
          .job-price {
            font-size: 20px;
            font-weight: 700;
            color: #333;
            margin-bottom: 10px;
          }
          
          /* Key details with icons */
          .job-key-details {
            display: flex;
            gap: 12px;
            margin-bottom: 10px;
            border-bottom: 1px solid rgba(0, 0, 0, 0.1);
            padding-bottom: 10px;
          }
          
          .detail-item {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
          }
          
          .detail-value {
            font-size: 13px;
            font-weight: 500;
            color: #333;
          }
          
          /* Additional details section */
          .job-additional-details {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-bottom: 12px;
          }
          
          .job-location, .job-timeframe {
            font-size: 12px;
            color: #666;
          }
          
          /* Action buttons */
          .popup-actions {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 8px;
          }
          
          .share-button, .save-button {
            width: 36px;
            height: 36px;
            background-color: rgba(0, 0, 0, 0.05);
            border: none;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }
          
          .share-button svg, .save-button svg {
            width: 18px;
            height: 18px;
            color: #666;
          }
          
          .view-details-btn {
            font-size: 13px;
            font-weight: 600;
            padding: 6px 14px;
            background-color: #2563EB;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
          }
          
          .view-details-btn:hover {
            background-color: #1D4ED8;
          }
        `}
      </style>
    </div>
  );
}