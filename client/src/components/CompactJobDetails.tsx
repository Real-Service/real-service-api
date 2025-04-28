import { format } from 'date-fns';
import { Job, Bid } from '@shared/schema';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  Clock, 
  MapPin, 
  DollarSign, 
  Calendar, 
  CheckCircle,
  ArrowRight,
  MessageSquare
} from 'lucide-react';

interface CompactJobDetailsProps {
  job: Job;
  userBid?: Bid | null;
  userType: 'landlord' | 'contractor';
  onBidJob?: (job: Job) => void;
  onCloseJob?: (job: Job) => void;
  onViewMessages?: (jobId: number) => void;
  onMarkComplete?: (jobId: number) => void;
}

export function CompactJobDetails({ 
  job, 
  userBid,
  userType,
  onBidJob,
  onCloseJob,
  onViewMessages,
  onMarkComplete
}: CompactJobDetailsProps) {
  
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'open': return 'bg-blue-500';
      case 'in_progress': return 'bg-amber-500';
      case 'completed': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'open': return 'Open';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return status.replace('_', ' ');
    }
  };

  return (
    <Card className="bg-white border shadow-sm overflow-hidden">
      <CardContent className="p-0">
        {/* Job Header with Status */}
        <div className="p-3 border-b bg-primary/5 flex items-center justify-between">
          <div className="flex items-center">
            <div className={`w-2 h-6 ${getStatusColor(job.status)} rounded-full mr-2`} />
            <div>
              <h3 className="font-medium text-sm">{job.title}</h3>
              <div className="flex items-center text-xs text-muted-foreground">
                <span>{getStatusText(job.status)}</span>
                {job.isUrgent && (
                  <Badge variant="destructive" className="ml-2 text-[8px] h-4 px-1.5">Urgent</Badge>
                )}
              </div>
            </div>
          </div>
          
          {/* Progress indicator for in-progress jobs */}
          {job.status === 'in_progress' && job.progress !== null && (
            <div className="flex flex-col items-end">
              <span className="text-xs mb-1">{job.progress}%</span>
              <Progress value={job.progress} className="w-16 h-1.5" />
            </div>
          )}
        </div>
        
        {/* Job Details */}
        <div className="p-3 space-y-2">
          {/* Date and Time */}
          <div className="flex items-center text-xs">
            <Calendar className="h-3 w-3 mr-1.5 text-primary/70" />
            <span>
              {job.startDate 
                ? format(new Date(job.startDate), 'MMM d, yyyy') 
                : 'No start date'}
            </span>
            {job.startDate && (
              <>
                <Clock className="h-3 w-3 mx-1.5 text-primary/70" />
                <span>{format(new Date(job.startDate), 'h:mm a')}</span>
              </>
            )}
          </div>
          
          {/* Location Info */}
          {job.location && (
            <div className="flex items-start text-xs">
              <MapPin className="h-3 w-3 mr-1.5 mt-0.5 text-primary/70 flex-shrink-0" />
              <span className="line-clamp-1">
                {job.location.city}, {job.location.state}
              </span>
            </div>
          )}
          
          {/* Budget/Bid Info */}
          <div className="flex items-center text-xs">
            <DollarSign className="h-3 w-3 mr-1.5 text-primary/70" />
            {userType === 'contractor' ? (
              <>
                {userBid ? (
                  <span>
                    Your bid: <span className="font-medium">${userBid.amount.toFixed(2)}</span>
                    <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-primary/10">
                      {userBid.status.charAt(0).toUpperCase() + userBid.status.slice(1)}
                    </span>
                  </span>
                ) : (
                  <span>
                    Budget: <span className="font-medium">${job.budget?.toFixed(2) || 'Not specified'}</span>
                  </span>
                )}
              </>
            ) : (
              <span>
                Budget: <span className="font-medium">${job.budget?.toFixed(2) || 'Not specified'}</span>
              </span>
            )}
          </div>
          
          {/* Short Description */}
          <p className="text-xs text-muted-foreground line-clamp-2 pt-1">
            {job.description}
          </p>
          
          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            {userType === 'contractor' && (
              <div className="flex gap-2">
                {job.status === 'open' && !userBid && onBidJob && (
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="h-7 text-[10px]"
                    onClick={() => onBidJob(job)}
                  >
                    Place Bid
                  </Button>
                )}
                
                {job.status === 'in_progress' && onMarkComplete && (
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="h-7 text-[10px]"
                    onClick={() => onMarkComplete(job.id)}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Mark Complete
                  </Button>
                )}
              </div>
            )}
            
            {userType === 'landlord' && job.status === 'open' && onCloseJob && (
              <Button 
                variant="default" 
                size="sm" 
                className="h-7 text-[10px]"
                onClick={() => onCloseJob(job)}
              >
                Close Job
              </Button>
            )}
            
            {job.status !== 'draft' && onViewMessages && (
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 text-[10px] ml-auto"
                onClick={() => onViewMessages(job.id)}
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                Messages
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}