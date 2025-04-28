import React, { useState } from 'react';
import { Quote, Job, JobLocation, ExtendedJob } from '@shared/schema';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { Eye, Calendar, FileText, DollarSign, MapPin, CircleDollarSign } from 'lucide-react';
import { QuotesMap } from './QuotesMap';

interface QuotesSplitViewProps {
  quotes: Quote[];
  jobs: Job[];
  isLoading: boolean;
  onViewDetails?: (quote: Quote) => void;
  className?: string;
  highlightedQuoteId?: number | null;
}

export function QuotesSplitView({
  quotes,
  jobs,
  isLoading,
  onViewDetails,
  className = '',
  highlightedQuoteId
}: QuotesSplitViewProps) {
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [defaultLayout, setDefaultLayout] = useState([40, 60]);
  const [hoveredQuoteId, setHoveredQuoteId] = useState<number | null>(null);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    });
  };

  // Get job by ID
  const getJob = (jobId: number): Job | undefined => {
    return jobs.find((job: Job) => job.id === jobId);
  };

  // Custom handler for viewing quote details
  const handleViewQuote = (quote: Quote) => {
    setSelectedQuote(quote);
    // Also call the parent's handler if provided
    if (onViewDetails) {
      onViewDetails(quote);
    }
  };

  // Quote Status Badge Component
  const QuoteStatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case "draft":
        return <Badge variant="outline" className="border-blue-500 text-blue-300">Draft</Badge>;
      case "sent":
        return <Badge className="bg-blue-600 text-white hover:bg-blue-700">Sent</Badge>;
      case "viewed":
        return <Badge className="bg-purple-600 text-white hover:bg-purple-700">Viewed</Badge>;
      case "accepted":
        return <Badge className="bg-green-600 text-white hover:bg-green-700">Accepted</Badge>;
      case "rejected":
        return <Badge className="bg-red-700 text-white hover:bg-red-800">Rejected</Badge>;
      case "revised":
        return <Badge className="bg-amber-600 text-white hover:bg-amber-700">Revised</Badge>;
      default:
        return <Badge variant="outline" className="border-blue-500 text-blue-300">{status}</Badge>;
    }
  };

  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="w-full rounded-lg border border-blue-800/30 bg-blue-950/20 overflow-hidden"
    >
      {/* Left panel - Quote list */}
      <ResizablePanel defaultSize={defaultLayout[0]} minSize={30}>
        <div className="h-[600px] overflow-auto p-4">
          <div className="space-y-3">
            {isLoading ? (
              <div className="flex flex-col justify-center items-center h-48 space-y-4">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-400"></div>
                <p className="text-center text-blue-300">Loading quotes...</p>
              </div>
            ) : quotes.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="mx-auto h-12 w-12 text-blue-400 opacity-70 mb-2" />
                <h3 className="text-lg font-medium text-white">No quotes found</h3>
                <p className="text-blue-300 mb-4">
                  There are no quotes matching the current filter criteria.
                </p>
              </div>
            ) : (
              quotes.map((quote) => {
                const job = getJob(quote.jobId);
                const isNew = quote.status === "sent";
                const isSelected = selectedQuote?.id === quote.id;
                const isHovered = hoveredQuoteId === quote.id;
                
                return (
                  <Card 
                    key={quote.id} 
                    className={`overflow-hidden hover:shadow-md transition-shadow duration-200 bg-blue-900/30 border-blue-800 
                      ${isNew ? 'border-blue-600 shadow-blue-700/20 shadow-md' : ''} 
                      ${isSelected ? 'ring-2 ring-blue-500' : ''} 
                      ${isHovered ? 'shadow-lg shadow-blue-700/30' : ''}`}
                    onMouseEnter={() => setHoveredQuoteId(quote.id)}
                    onMouseLeave={() => setHoveredQuoteId(null)}
                    onClick={() => handleViewQuote(quote)}
                  >
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-medium text-base flex items-center text-white">
                            {quote.title}
                            {isNew && (
                              <Badge className="ml-2 bg-blue-500 text-white text-xs">
                                New
                              </Badge>
                            )}
                          </h3>
                          <p className="text-xs text-blue-300">
                            Quote #{quote.quoteNumber} • {formatDate(quote.createdAt.toString())}
                          </p>
                        </div>
                        <QuoteStatusBadge status={quote.status} />
                      </div>
                      
                      <div className="text-xs space-y-1">
                        <div className="flex items-start">
                          <FileText className="h-3 w-3 text-blue-400 mr-1 mt-0.5" />
                          <p className="text-blue-100">
                            <span className="font-medium">Job:</span>{" "}
                            <span className="text-blue-300">
                              {job?.title || `Job #${quote.jobId}`}
                            </span>
                          </p>
                        </div>
                        
                        <div className="flex items-start">
                          <DollarSign className="h-3 w-3 text-blue-400 mr-1 mt-0.5" />
                          <p className="text-blue-100">
                            <span className="font-medium">Amount:</span>{" "}
                            <span className="font-semibold text-white">{formatCurrency(quote.total)}</span>
                          </p>
                        </div>
                        
                        {job?.location && typeof job.location === 'object' && (
                          <div className="flex items-start">
                            <MapPin className="h-3 w-3 text-blue-400 mr-1 mt-0.5" />
                            <p className="text-blue-100">
                              <span className="font-medium">Location:</span>{" "}
                              {(job.location as JobLocation)?.city}, {(job.location as JobLocation)?.state}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2 border-blue-700 bg-blue-900/50 text-white hover:bg-blue-800 hover:text-white text-xs h-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewQuote(quote);
                        }}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View Details
                      </Button>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </ResizablePanel>
      
      {/* Resizable handle */}
      <ResizableHandle withHandle />
      
      {/* Right panel - Map view */}
      <ResizablePanel defaultSize={defaultLayout[1]} minSize={30}>
        <div className="h-[600px] relative">
          <QuotesMap 
            quotes={quotes} 
            jobs={jobs}
            onViewDetails={handleViewQuote}
            highlightedQuoteId={hoveredQuoteId}
          />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}