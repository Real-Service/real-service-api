import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { JobSchedule, Job } from "@shared/schema";
import { Calendar, Clock, Trash2, Edit, ExternalLink } from "lucide-react";
import { EditJobScheduleForm } from "./EditJobScheduleForm";

interface JobScheduleDetailsProps {
  jobSchedule: JobSchedule;
  job?: Job;
  onClose: () => void;
  onDelete: () => void;
  onUpdate: () => void;
}

export function JobScheduleDetails({ jobSchedule, job, onClose, onDelete, onUpdate }: JobScheduleDetailsProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  
  const deleteJobScheduleMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/calendar/job-schedules/${jobSchedule.id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      toast({
        title: "Schedule Deleted",
        description: "The job schedule has been deleted successfully."
      });
      onDelete();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete job schedule. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    deleteJobScheduleMutation.mutate();
  };

  const handleEditComplete = () => {
    setIsEditing(false);
    onUpdate();
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
      case 'in_progress':
        return 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200';
      case 'completed':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 hover:bg-red-200';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };

  const formatStatus = (status: string) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (isEditing) {
    return (
      <div className="space-y-4">
        <EditJobScheduleForm 
          jobSchedule={jobSchedule}
          job={job}
          onCancel={() => setIsEditing(false)}
          onComplete={handleEditComplete}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {job && (
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-500">Job</div>
          <div className="flex items-center justify-between">
            <div className="font-medium">{job.title}</div>
            <Button 
              variant="ghost" 
              size="sm" 
              asChild
              className="h-8 w-8 p-0"
            >
              <a href={`/jobs/${job.id}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-500">Start Date</div>
          <div className="flex items-center">
            <Calendar className="h-4 w-4 mr-2 text-gray-400" />
            <span>{format(new Date(jobSchedule.startDate), 'PPP')}</span>
          </div>
        </div>
        
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-500">End Date</div>
          <div className="flex items-center">
            <Calendar className="h-4 w-4 mr-2 text-gray-400" />
            <span>{format(new Date(jobSchedule.endDate), 'PPP')}</span>
          </div>
        </div>
      </div>
      
      {!jobSchedule.isAllDay && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-sm font-medium text-gray-500">Start Time</div>
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-2 text-gray-400" />
              <span>{jobSchedule.startTime || 'N/A'}</span>
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="text-sm font-medium text-gray-500">End Time</div>
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-2 text-gray-400" />
              <span>{jobSchedule.endTime || 'N/A'}</span>
            </div>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-500">Status</div>
          <Badge className={getStatusBadgeColor(jobSchedule.status)}>
            {formatStatus(jobSchedule.status)}
          </Badge>
        </div>
        
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-500">All Day</div>
          <div>{jobSchedule.isAllDay ? 'Yes' : 'No'}</div>
        </div>
      </div>
      
      {jobSchedule.note && (
        <div className="space-y-1 mt-2">
          <div className="text-sm font-medium text-gray-500">Note</div>
          <div className="p-3 bg-gray-50 rounded-md text-sm">{jobSchedule.note}</div>
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
                Are you sure you want to delete this job schedule? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setIsConfirmingDelete(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDelete}
                disabled={deleteJobScheduleMutation.isPending}
              >
                {deleteJobScheduleMutation.isPending ? "Deleting..." : "Delete"}
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