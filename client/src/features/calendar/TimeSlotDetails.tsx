import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TimeSlot } from "@shared/schema";
import { Calendar, Clock, Trash2, Edit } from "lucide-react";
import { EditTimeSlotForm } from "./EditTimeSlotForm";

interface TimeSlotDetailsProps {
  timeSlot: TimeSlot;
  onClose: () => void;
  onDelete: () => void;
  onUpdate: () => void;
}

export function TimeSlotDetails({ timeSlot, onClose, onDelete, onUpdate }: TimeSlotDetailsProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  
  const deleteTimeSlotMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/calendar/time-slots/${timeSlot.id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      toast({
        title: "Time Slot Deleted",
        description: "The time slot has been deleted successfully."
      });
      onDelete();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete time slot. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    deleteTimeSlotMutation.mutate();
  };

  const handleEditComplete = () => {
    setIsEditing(false);
    onUpdate();
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'unavailable':
        return 'bg-red-100 text-red-800 hover:bg-red-200';
      case 'tentative':
        return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };

  if (isEditing) {
    return (
      <div className="space-y-4">
        <EditTimeSlotForm 
          timeSlot={timeSlot}
          onCancel={() => setIsEditing(false)}
          onComplete={handleEditComplete}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-500">Date</div>
          <div className="flex items-center">
            <Calendar className="h-4 w-4 mr-2 text-gray-400" />
            <span>{format(new Date(timeSlot.date), 'PPP')}</span>
          </div>
        </div>
        
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-500">Status</div>
          <Badge className={getStatusBadgeColor(timeSlot.status)}>
            {timeSlot.status.charAt(0).toUpperCase() + timeSlot.status.slice(1)}
          </Badge>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-500">Start Time</div>
          <div className="flex items-center">
            <Clock className="h-4 w-4 mr-2 text-gray-400" />
            <span>{timeSlot.startTime}</span>
          </div>
        </div>
        
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-500">End Time</div>
          <div className="flex items-center">
            <Clock className="h-4 w-4 mr-2 text-gray-400" />
            <span>{timeSlot.endTime}</span>
          </div>
        </div>
      </div>
      
      {timeSlot.note && (
        <div className="space-y-1 mt-2">
          <div className="text-sm font-medium text-gray-500">Note</div>
          <div className="p-3 bg-gray-50 rounded-md text-sm">{timeSlot.note}</div>
        </div>
      )}
      
      <div className="flex justify-end space-x-2 pt-4">
        <Dialog open={isConfirmingDelete} onOpenChange={setIsConfirmingDelete}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Deletion</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this time slot? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setIsConfirmingDelete(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDelete}
                disabled={deleteTimeSlotMutation.isPending}
              >
                {deleteTimeSlotMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
          <Edit className="h-4 w-4 mr-2" /> Edit
        </Button>
        
        <Button size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}