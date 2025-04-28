import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Bid } from "@shared/schema";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface BidHistoryProps {
  jobId: number;
}

export function BidHistory({ jobId }: BidHistoryProps) {
  // Fetch bids for the job
  const { data: jobBids, isLoading } = useQuery<Bid[]>({
    queryKey: ["/api/jobs", jobId, "bids"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/jobs/${jobId}/bids`);
      if (!res.ok) throw new Error("Failed to fetch bids");
      return res.json();
    },
    enabled: !!jobId,
  });

  const getBidStatusBadge = (status: string) => {
    const statusColors: { [key: string]: string } = {
      pending: "bg-yellow-500",
      accepted: "bg-green-500",
      rejected: "bg-red-500",
    };

    return (
      <Badge className={`${statusColors[status]} text-white`}>
        {status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!jobBids || jobBids.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-muted-foreground">No bids have been placed on this job yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Bid History</h3>
      <div className="space-y-3">
        {jobBids
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .map((bid) => (
            <Card key={bid.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">${bid.amount.toFixed(2)}</span>
                      {getBidStatusBadge(bid.status)}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Completion estimate: {bid.estimatedCompletionDays} days
                    </p>
                    <p className="text-sm">{bid.description}</p>
                  </div>
                  <div className="text-right flex flex-col sm:items-end space-y-1">
                    <span className="text-xs text-muted-foreground">
                      Contractor ID: {bid.contractorId}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Submitted: {format(new Date(bid.createdAt), "MMM d, yyyy")}
                    </span>
                    {bid.updatedAt && bid.updatedAt !== bid.createdAt && (
                      <span className="text-xs text-muted-foreground">
                        Updated: {format(new Date(bid.updatedAt), "MMM d, yyyy")}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  );
}