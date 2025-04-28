import React, { useState } from 'react';
import { Job } from '@shared/schema';
import { JobsList } from './JobsList';
import { JobsMap } from './JobsMap';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';

interface JobsSplitViewProps {
  jobs: Job[];
  isLoading: boolean;
  onBidJob?: (job: Job) => void;
  onViewDetails?: (job: Job) => void;
  hasServiceArea?: boolean;
  serviceAreaMarker?: {latitude: number, longitude: number};
  serviceRadius?: number;
  sortMethod?: 'default' | 'price' | 'date' | 'category' | 'title' | 'location';
  sortOrder?: 'asc' | 'desc';
  onSortChange?: (method: 'default' | 'price' | 'date' | 'category' | 'title' | 'location', order: 'asc' | 'desc') => void;
  onJobHover?: (jobId: number | null) => void; // Callback when a job is hovered
  highlightedJobId?: number | null; // The job ID that should be highlighted (set from parent)
}

export function JobsSplitView({
  jobs,
  isLoading,
  onBidJob,
  onViewDetails,
  hasServiceArea = true,
  serviceAreaMarker,
  serviceRadius = 25,
  sortMethod = 'default',
  sortOrder = 'desc',
  onSortChange,
  onJobHover,
  highlightedJobId
}: JobsSplitViewProps) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [defaultLayout, setDefaultLayout] = useState([40, 60]);
  const [hoveredJobId, setHoveredJobId] = useState<number | null>(null);

  // Custom handler for viewing job details
  const handleViewJob = (job: Job) => {
    setSelectedJob(job);
    // Also call the parent's handler if provided
    if (onViewDetails) {
      onViewDetails(job);
    } else if (onBidJob) {
      onBidJob(job);
    }
  };

  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="w-full rounded-lg border border-blue-800/30 bg-blue-950/20 overflow-hidden"
    >
      {/* Left panel - Job list */}
      <ResizablePanel defaultSize={defaultLayout[0]} minSize={30}>
        <div className="h-[600px] overflow-auto p-4">
          <JobsList 
            jobs={jobs}
            isLoading={isLoading}
            onViewDetails={handleViewJob}
            hasServiceArea={hasServiceArea}
            initialView="grid"
            sortMethod={sortMethod}
            sortOrder={sortOrder}
            onSortChange={onSortChange}
            onJobHover={setHoveredJobId}
            highlightedJobId={highlightedJobId}
          />
        </div>
      </ResizablePanel>
      
      {/* Resizable handle */}
      <ResizableHandle withHandle />
      
      {/* Right panel - Map view */}
      <ResizablePanel defaultSize={defaultLayout[1]} minSize={30}>
        <div className="h-[600px] relative">
          <JobsMap 
            jobs={jobs} 
            onViewDetails={handleViewJob}
            serviceAreaMarker={serviceAreaMarker}
            serviceRadius={serviceRadius}
            highlightedJobId={hoveredJobId || highlightedJobId}
          />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}