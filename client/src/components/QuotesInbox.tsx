import { useState, useCallback } from "react";
import { 
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent
} from "@/components/ui/dialog";
import { 
  Inbox, 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Eye,
  Clock,
  DollarSign,
  Calendar,
  LayoutGrid,
  List,
  Map as MapIcon,
  SplitSquareVertical,
  CalendarDays
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Quote, Job, quoteStatusEnum } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";
import { QuoteDetails } from "./QuoteDetails";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ScheduleCalendar } from "./ScheduleCalendar";
import { QuotesMap } from "./QuotesMap";
import { QuotesSplitView } from "./QuotesSplitView";

// Define the Quote status type from enum
type QuoteStatus = typeof quoteStatusEnum.enumValues[number];

// Status badge component for quotes
export const QuoteStatusBadge = ({ status }: { status: QuoteStatus }) => {
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

interface QuotesInboxProps {
  userId: number;
  userType: "landlord" | "contractor";
  className?: string;
  onViewJob?: (jobId: number) => void;
}

export function QuotesInbox({ userId, userType, className, onViewJob }: QuotesInboxProps) {
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [displayType, setDisplayType] = useState<'list' | 'calendar' | 'map' | 'split'>('list');
  const [hoveredQuoteId, setHoveredQuoteId] = useState<number | null>(null);
  
  // Handle quote hover - for map interactions
  const handleQuoteHover = useCallback((quoteId: number | null) => {
    setHoveredQuoteId(quoteId);
  }, []);

  // Fetch quotes for the user
  const { data: quotes = [], isLoading: isLoadingQuotes } = useQuery<Quote[]>({
    queryKey: ['/api/quotes'],
    select: (data: Quote[]) => {
      if (!Array.isArray(data)) return [];
      if (userType === 'landlord') {
        // For landlords, filter by landlordId
        return data.filter(quote => quote.landlordId === userId);
      } else {
        // For contractors, filter by contractorId
        return data.filter(quote => quote.contractorId === userId);
      }
    }
  });

  // Fetch jobs (for job titles)
  const { data: jobs = [], isLoading: isLoadingJobs } = useQuery<Job[]>({
    queryKey: ['/api/jobs'],
  });

  // Get job by ID
  const getJob = (jobId: number): Job | undefined => {
    if (!Array.isArray(jobs)) return undefined;
    return jobs.find((job: Job) => job.id === jobId);
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    });
  };

  // Filter quotes based on tab
  const filteredQuotes = quotes.filter((quote: Quote) => {
    if (activeTab === "all") return true;
    if (activeTab === "pending") return quote.status === "sent" || quote.status === "viewed" || quote.status === "revised";
    if (activeTab === "accepted") return quote.status === "accepted";
    if (activeTab === "rejected") return quote.status === "rejected";
    return true;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Check if there are pending quotes
  const pendingCount = quotes.filter(
    quote => quote.status === "sent" || quote.status === "viewed" || quote.status === "revised"
  ).length;

  // Check if there are unread quotes
  const unreadCount = quotes.filter(quote => quote.status === "sent").length;

  // View quote details
  const viewQuoteDetails = (quote: Quote) => {
    setSelectedQuote(quote);
    setIsDetailsOpen(true);
  };

  // Close quote details
  const closeQuoteDetails = () => {
    setIsDetailsOpen(false);
    setSelectedQuote(null);
  };

  // Handle quote actions
  const handleQuoteAccepted = () => {
    // Additional logic can be added here
    closeQuoteDetails();
  };

  const handleQuoteRejected = () => {
    // Additional logic can be added here
    closeQuoteDetails();
  };

  // Handle job view
  const handleViewJob = (jobId: number) => {
    if (onViewJob) {
      onViewJob(jobId);
    }
  };

  if (isLoadingQuotes || isLoadingJobs) {
    return (
      <Card className={`${className} shadow-sm bg-blue-900/40 border-blue-800`}>
        <CardContent className="pt-6">
          <div className="flex flex-col justify-center items-center h-48 space-y-4">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-400"></div>
            <p className="text-center text-blue-300">Loading quotes...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={`${className} shadow-sm bg-blue-900/40 border-blue-800`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center text-white">
                {userType === 'landlord' ? 'Quotes Inbox' : 'My Quotes'}
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {unreadCount} new
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-blue-200">
                {userType === 'landlord' 
                  ? 'Manage and respond to quotes from contractors' 
                  : 'Manage quotes sent to property owners'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending" value={activeTab} onValueChange={setActiveTab} className="text-white">
            <TabsList className="grid grid-cols-4 mb-4 bg-blue-950/50">
              <TabsTrigger value="pending" className="relative text-white data-[state=active]:bg-blue-800 data-[state=active]:text-white">
                Pending
                {pendingCount > 0 && (
                  <Badge variant="outline" className="ml-2 bg-blue-700 text-white border-blue-600">
                    {pendingCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="accepted" className="text-white data-[state=active]:bg-blue-800 data-[state=active]:text-white">
                Accepted
                <Badge variant="outline" className="ml-2 bg-blue-700 text-white border-blue-600">
                  {quotes.filter(q => q.status === "accepted").length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="rejected" className="text-white data-[state=active]:bg-blue-800 data-[state=active]:text-white">
                Rejected
                <Badge variant="outline" className="ml-2 bg-blue-700 text-white border-blue-600">
                  {quotes.filter(q => q.status === "rejected").length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="all" className="text-white data-[state=active]:bg-blue-800 data-[state=active]:text-white">All</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              {filteredQuotes.length === 0 ? (
                <div className="text-center py-8">
                  {activeTab === 'pending' ? (
                    <Inbox className="mx-auto h-12 w-12 text-blue-400 opacity-70 mb-2" />
                  ) : activeTab === 'accepted' ? (
                    <CheckCircle className="mx-auto h-12 w-12 text-green-400 opacity-70 mb-2" />
                  ) : activeTab === 'rejected' ? (
                    <XCircle className="mx-auto h-12 w-12 text-red-400 opacity-70 mb-2" />
                  ) : (
                    <FileText className="mx-auto h-12 w-12 text-blue-400 opacity-70 mb-2" />
                  )}
                  <h3 className="text-lg font-medium text-white">No quotes found</h3>
                  <p className="text-blue-300 mb-4">
                    {activeTab === "pending" 
                      ? "You don't have any pending quotes to review." 
                      : activeTab === "all"
                      ? "You haven't received any quotes yet."
                      : `You don't have any ${activeTab} quotes.`}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeTab === "pending" && pendingCount > 0 && (
                    <Alert className="bg-blue-950/70 border-blue-800">
                      <AlertCircle className="h-4 w-4 text-blue-400" />
                      <AlertDescription className="text-blue-200">
                        You have {pendingCount} quote{pendingCount !== 1 ? 's' : ''} pending your review.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {/* View mode selector */}
                  <div className="flex justify-end mb-4">
                    <div className="flex items-center">
                      <div className="text-blue-200 text-sm mr-2">View:</div>
                      <ToggleGroup type="single" value={displayType} onValueChange={(value) => value && setDisplayType(value as 'list' | 'calendar' | 'map' | 'split')}>
                        <ToggleGroupItem value="list" aria-label="List View" className="h-8 bg-blue-950/40 border-blue-800/40 text-blue-200 data-[state=on]:bg-blue-800 data-[state=on]:text-white">
                          <List className="h-4 w-4 mr-1" />
                          <span className="text-sm">List</span>
                        </ToggleGroupItem>
                        <ToggleGroupItem value="calendar" aria-label="Calendar View" className="h-8 bg-blue-950/40 border-blue-800/40 text-blue-200 data-[state=on]:bg-blue-800 data-[state=on]:text-white">
                          <CalendarDays className="h-4 w-4 mr-1" />
                          <span className="text-sm">Calendar</span>
                        </ToggleGroupItem>
                        <ToggleGroupItem value="map" aria-label="Map View" className="h-8 bg-blue-950/40 border-blue-800/40 text-blue-200 data-[state=on]:bg-blue-800 data-[state=on]:text-white">
                          <MapIcon className="h-4 w-4 mr-1" />
                          <span className="text-sm">Map</span>
                        </ToggleGroupItem>
                        <ToggleGroupItem value="split" aria-label="Split View" className="h-8 bg-blue-950/40 border-blue-800/40 text-blue-200 data-[state=on]:bg-blue-800 data-[state=on]:text-white">
                          <SplitSquareVertical className="h-4 w-4 mr-1" />
                          <span className="text-sm">Split</span>
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                  </div>
                  
                  {/* Conditionally render view based on displayType */}
                  {displayType === 'list' && (
                    <div className="grid grid-cols-1 gap-4">
                      {filteredQuotes.map((quote: Quote) => {
                        const job = getJob(quote.jobId);
                        const isNew = quote.status === "sent";
                        
                        return (
                          <Card 
                            key={quote.id} 
                            className={`overflow-hidden hover:shadow-md transition-shadow duration-200 bg-blue-900/30 border-blue-800 ${
                              isNew ? 'border-blue-600 shadow-blue-700/20 shadow-md' : ''
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row">
                              <div className="flex-1 p-5">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <h3 className="font-medium text-lg flex items-center text-white">
                                      {quote.title}
                                      {isNew && (
                                        <Badge className="ml-2 bg-blue-500 text-white">
                                          New
                                        </Badge>
                                      )}
                                    </h3>
                                    <p className="text-sm text-blue-300">
                                      Quote #{quote.quoteNumber} • {formatDate(quote.createdAt.toString())}
                                    </p>
                                  </div>
                                  <QuoteStatusBadge status={quote.status} />
                                </div>
                                
                                <div className="mt-4 space-y-2">
                                  <div className="flex items-start space-x-2">
                                    <FileText className="h-4 w-4 text-blue-400 mt-0.5" />
                                    <p className="text-sm text-blue-100">
                                      <span className="font-medium">Job:</span>{" "}
                                      <button 
                                        className="hover:underline text-blue-300"
                                        onClick={() => handleViewJob(quote.jobId)}
                                      >
                                        {job?.title || `Job #${quote.jobId}`}
                                      </button>
                                    </p>
                                  </div>
                                  
                                  <div className="flex items-start space-x-2">
                                    <DollarSign className="h-4 w-4 text-blue-400 mt-0.5" />
                                    <p className="text-sm text-blue-100">
                                      <span className="font-medium">Amount:</span>{" "}
                                      <span className="font-semibold text-white">{formatCurrency(quote.total)}</span>
                                    </p>
                                  </div>
                                  
                                  {quote.validUntil && (
                                    <div className="flex items-start space-x-2">
                                      <Calendar className="h-4 w-4 text-blue-400 mt-0.5" />
                                      <p className="text-sm text-blue-100">
                                        <span className="font-medium">Valid until:</span>{" "}
                                        {formatDate(quote.validUntil.toString())}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex sm:flex-col justify-end items-center gap-2 p-4 bg-blue-950/50 border-t sm:border-t-0 sm:border-l border-blue-800">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full border-blue-700 bg-blue-900/50 text-white hover:bg-blue-800 hover:text-white"
                                  onClick={() => viewQuoteDetails(quote)}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View
                                </Button>
                                
                                {userType === 'landlord' && (quote.status === "sent" || quote.status === "viewed" || quote.status === "revised") && (
                                  <>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="w-full bg-red-700 hover:bg-red-800"
                                      onClick={() => {
                                        setSelectedQuote(quote);
                                        setIsDetailsOpen(true);
                                      }}
                                    >
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Reject
                                    </Button>
                                    <Button
                                      variant="default"
                                      size="sm"
                                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                                      onClick={() => {
                                        setSelectedQuote(quote);
                                        setIsDetailsOpen(true);
                                      }}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Accept
                                    </Button>
                                  </>
                                )}
                                
                                {userType === 'contractor' && quote.status === "sent" && (
                                  <div className="flex items-center text-sm text-blue-300 mt-2">
                                    <Clock className="h-4 w-4 mr-1" />
                                    Awaiting response
                                  </div>
                                )}
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Calendar View */}
                  {displayType === 'calendar' && (
                    <div className="rounded-md border border-blue-800/30 bg-blue-950/20 overflow-hidden h-[600px]">
                      <ScheduleCalendar 
                        quotes={filteredQuotes}
                        jobs={jobs}
                        userId={userId}
                        userType={userType}
                        onViewQuote={(quoteId) => {
                          const quote = quotes.find(q => q.id === quoteId);
                          if (quote) viewQuoteDetails(quote);
                        }}
                      />
                    </div>
                  )}
                  
                  {/* Map View */}
                  {displayType === 'map' && (
                    <div className="rounded-md border border-blue-800/30 bg-blue-950/20 overflow-hidden h-[600px]">
                      <QuotesMap 
                        quotes={filteredQuotes}
                        jobs={jobs}
                        onViewDetails={viewQuoteDetails}
                        highlightedQuoteId={hoveredQuoteId}
                      />
                    </div>
                  )}
                  
                  {/* Split View */}
                  {displayType === 'split' && (
                    <div className="rounded-md border border-blue-800/30 bg-blue-950/20 overflow-hidden h-[600px]">
                      <QuotesSplitView 
                        quotes={filteredQuotes}
                        jobs={jobs}
                        isLoading={isLoadingQuotes || isLoadingJobs}
                        onViewDetails={viewQuoteDetails}
                      />
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Quote Details Dialog */}
      {selectedQuote && isDetailsOpen && (
        <Dialog open={isDetailsOpen} onOpenChange={(open: boolean) => !open && closeQuoteDetails()}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <QuoteDetails
              quote={selectedQuote}
              onClose={closeQuoteDetails}
              job={getJob(selectedQuote.jobId)}
              userType={userType}
              onAccept={handleQuoteAccepted}
              onReject={handleQuoteRejected}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}