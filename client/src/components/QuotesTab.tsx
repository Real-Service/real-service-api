import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Quote } from "@shared/schema";
import { Search, FileText, Grid, List, MapPin, Eye, Edit, Send, Plus } from "lucide-react";

interface QuotesTabProps {
  quotes: any[];
  viewMode: string;
  onChangeViewMode: (mode: "grid" | "table" | "map" | "calendar" | "split") => void;
  onCreateQuote: () => void;
  onViewQuote: (quote: Quote) => void;
  onEditQuote: (quote: Quote) => void;
}

export function QuotesTab({
  quotes = [],
  viewMode,
  onChangeViewMode,
  onCreateQuote,
  onViewQuote,
  onEditQuote,
}: QuotesTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  // Filter quotes based on search query and active tab
  const filteredQuotes = quotes.filter((quote) => {
    // Filter by search query
    if (
      searchQuery &&
      !quote.title.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }

    // Filter by status
    if (activeTab !== "all" && quote.status !== activeTab) {
      return false;
    }

    return true;
  });

  // Count quotes by status
  const draftCount = quotes.filter((quote) => quote.status === "draft").length;
  const sentCount = quotes.filter((quote) => quote.status === "sent").length;
  const acceptedCount = quotes.filter((quote) => quote.status === "accepted").length;
  const rejectedCount = quotes.filter((quote) => quote.status === "rejected").length;

  // Render the quotes in a card-based grid view
  const renderGridView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredQuotes.map((quote) => (
        <Card
          key={quote.id}
          className={cn(
            "overflow-hidden cursor-pointer hover:shadow-md transition-shadow",
            quote.status === "draft" && "border-blue-200",
            quote.status === "sent" && "border-orange-200",
            quote.status === "accepted" && "border-green-200",
            quote.status === "rejected" && "border-red-200"
          )}
          onClick={() => onViewQuote(quote)}
        >
          <CardHeader className="p-4 pb-2 bg-gray-50">
            <div className="flex justify-between items-start">
              <CardTitle className="text-lg font-semibold line-clamp-1">
                {quote.title}
              </CardTitle>
              <Badge
                className={cn(
                  quote.status === "draft" && "bg-blue-500",
                  quote.status === "sent" && "bg-orange-500",
                  quote.status === "accepted" && "bg-green-500",
                  quote.status === "rejected" && "bg-red-500"
                )}
              >
                {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
              </Badge>
            </div>
            <div className="flex items-center mt-1 text-sm text-muted-foreground">
              <FileText className="h-3.5 w-3.5 mr-1" />
              <span>Quote #{quote.id.toString().padStart(7, '0')}</span>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Created:</span>
              <span>{format(new Date(quote.createdAt), "MMM d, yyyy")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount:</span>
              <span className="font-semibold">
                ${quote.totalAmount ? quote.totalAmount.toFixed(2) : "0.00"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Client:</span>
              <span>{quote.clientName || "Not specified"}</span>
            </div>
            <div className="flex gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewQuote(quote);
                }}
              >
                <Eye className="h-3.5 w-3.5 mr-1.5" /> View
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditQuote(quote);
                }}
              >
                <Edit className="h-3.5 w-3.5 mr-1.5" /> Edit
              </Button>
              {quote.status === "draft" && (
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Implement send quote functionality
                  }}
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" /> Send
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Add Quote Card */}
      <Card
        className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow border-dashed border-2 flex items-center justify-center"
        onClick={onCreateQuote}
      >
        <CardContent className="p-8 text-center">
          <div className="rounded-full bg-primary/10 p-3 mx-auto mb-4 w-fit">
            <Plus className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-medium text-lg mb-1">Create New Quote</h3>
          <p className="text-sm text-muted-foreground">
            Generate a new quote for a client
          </p>
        </CardContent>
      </Card>
    </div>
  );

  // Render the quotes in a table view
  const renderTableView = () => (
    <div className="rounded-md border overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Quote #
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Title
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Client
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Date
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Amount
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Status
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {filteredQuotes.map((quote) => (
            <tr
              key={quote.id}
              className="hover:bg-gray-50 cursor-pointer"
              onClick={() => onViewQuote(quote)}
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">
                  {quote.id.toString().padStart(7, '0')}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {quote.title}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-500">
                  {quote.clientName || "Not specified"}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-500">
                  {format(new Date(quote.createdAt), "MMM d, yyyy")}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  ${quote.totalAmount ? quote.totalAmount.toFixed(2) : "0.00"}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <Badge
                  className={cn(
                    quote.status === "draft" && "bg-blue-500",
                    quote.status === "sent" && "bg-orange-500",
                    quote.status === "accepted" && "bg-green-500",
                    quote.status === "rejected" && "bg-red-500"
                  )}
                >
                  {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
                </Badge>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewQuote(quote);
                  }}
                >
                  <Eye className="h-3.5 w-3.5 mr-1.5" /> View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditQuote(quote);
                  }}
                >
                  <Edit className="h-3.5 w-3.5 mr-1.5" /> Edit
                </Button>
                {quote.status === "draft" && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Implement send quote functionality
                    }}
                  >
                    <Send className="h-3.5 w-3.5 mr-1.5" /> Send
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 justify-between mb-4">
        <div className="relative w-full md:w-[300px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search quotes..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChangeViewMode("grid")}
            className={cn(
              viewMode === "grid" ? "bg-primary text-primary-foreground" : ""
            )}
          >
            <Grid className="h-4 w-4 mr-1" />
            Grid
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChangeViewMode("table")}
            className={cn(
              viewMode === "table" ? "bg-primary text-primary-foreground" : ""
            )}
          >
            <List className="h-4 w-4 mr-1" />
            Table
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">
            All ({quotes.length})
          </TabsTrigger>
          <TabsTrigger value="draft">
            Drafts ({draftCount})
          </TabsTrigger>
          <TabsTrigger value="sent">
            Sent ({sentCount})
          </TabsTrigger>
          <TabsTrigger value="accepted">
            Accepted ({acceptedCount})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected ({rejectedCount})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4">
        {filteredQuotes.length === 0 ? (
          <Card className="p-8">
            <div className="text-center text-muted-foreground space-y-2">
              <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-lg font-medium">No quotes found</p>
              <p>
                {searchQuery
                  ? "No quotes match your search. Try a different query."
                  : activeTab === "all"
                  ? "You haven't created any quotes yet."
                  : `You don't have any ${activeTab} quotes.`}
              </p>
              <Button onClick={onCreateQuote} className="mt-2">
                <Plus className="h-4 w-4 mr-2" /> Create New Quote
              </Button>
            </div>
          </Card>
        ) : viewMode === "grid" ? (
          renderGridView()
        ) : (
          renderTableView()
        )}
      </div>
    </div>
  );
}