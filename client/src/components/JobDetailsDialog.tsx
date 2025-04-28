import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Job, Bid } from "@shared/schema";
import { JobDetailsView } from "@/components/JobDetailsView";
import { BidHistory } from "@/components/BidHistory";

interface JobDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedJob: Job | null;
  myBids: Bid[];
  onOpenBidModal: () => void;
  onCreateQuote: () => void;
  onToggleChat: () => void;
  isChatVisible: boolean;
}

export function JobDetailsDialog({
  isOpen,
  onOpenChange,
  selectedJob,
  myBids,
  onOpenBidModal,
  onCreateQuote,
  onToggleChat,
  isChatVisible
}: JobDetailsDialogProps) {
  if (!selectedJob) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex justify-between items-center">
            {selectedJob.title}
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
          <DialogDescription>
            View detailed information about this job
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Job details using our component */}
          <JobDetailsView job={selectedJob} />
          
          {/* Bid history section */}
          <Separator />
          <BidHistory jobId={selectedJob.id} />
          
          {/* My Bid Info */}
          {myBids && myBids.some((bid: Bid) => bid.jobId === selectedJob.id) && (
            <div className="bg-muted p-4 rounded-lg">
              <h3 className="text-lg font-medium mb-2">Your Bid</h3>
              <div className="flex items-center justify-between">
                <p className="font-bold text-xl">
                  ${myBids.find((bid: Bid) => bid.jobId === selectedJob.id)?.amount.toFixed(2)}
                </p>
                <Badge className={`${
                  myBids.find((bid: Bid) => bid.jobId === selectedJob.id)?.status === "accepted" 
                    ? "bg-green-600" 
                    : myBids.find((bid: Bid) => bid.jobId === selectedJob.id)?.status === "rejected"
                      ? "bg-destructive"
                      : "bg-yellow-600"
                }`}>
                  Status: {myBids.find((bid: Bid) => bid.jobId === selectedJob.id)?.status}
                </Badge>
              </div>
            </div>
          )}
          
          {/* Actions */}
          <div className="flex gap-2 justify-end">
            {!isChatVisible && (selectedJob.status === "open" && !myBids.some((bid: Bid) => bid.jobId === selectedJob.id)) && (
              <Button 
                variant="default"
                onClick={() => {
                  onOpenChange(false);
                  onOpenBidModal();
                }}
              >
                Bid on Job
              </Button>
            )}
            
            {myBids.some((bid: Bid) => bid.jobId === selectedJob.id) && (
              <>
                <Button
                  variant="outline"
                  onClick={onToggleChat}
                >
                  {isChatVisible ? 'View Details' : 'Message Landlord'}
                </Button>
                
                {!isChatVisible && (
                  <Button
                    variant="default"
                    onClick={() => {
                      onOpenChange(false);
                      onCreateQuote();
                    }}
                  >
                    Create Quote
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}