import { useMemo } from 'react';
import { format } from 'date-fns';
import { Job, Bid } from '@shared/schema';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Calendar } from 'lucide-react';

interface TodayJobsOverviewProps {
  jobs: Job[];
  bids?: Bid[];
  userType: 'landlord' | 'contractor'; // 'landlord' = Service Requestor, 'contractor' = Service Provider
  onViewJob?: (job: Job) => void;
  onBidJob?: (job: Job) => void;
}

export function TodayJobsOverview({ 
  jobs = [], 
  bids = [], 
  userType, 
  onViewJob, 
  onBidJob 
}: TodayJobsOverviewProps) {
  const today = new Date();
  const todayString = format(today, 'yyyy-MM-dd');

  // Filter jobs for today only - ultra minimal view
  const todayJobs = useMemo(() => {
    console.log("TodayJobsOverview received jobs:", jobs.length);
    
    // Temporarily show all jobs for debugging purposes 
    // until we confirm jobs are being properly filtered
    return jobs
      // Uncomment the filter below to only show today's jobs
      /*
      .filter(job => {
        // Convert job start date to YYYY-MM-DD format for comparison
        const jobStartDate = job.startDate ? format(new Date(job.startDate), 'yyyy-MM-dd') : null;
        const matches = jobStartDate === todayString;
        if (!matches) console.log(`Job ${job.id} filtered out: not today's date (${jobStartDate} vs ${todayString})`);
        return matches;
      })
      */
      .sort((a, b) => {
        // Sort by urgent first, then by start time if available
        if (a.isUrgent && !b.isUrgent) return -1;
        if (!a.isUrgent && b.isUrgent) return 1;
        if (a.startDate && b.startDate) {
          return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        }
        return 0;
      });
  }, [jobs, todayString]);

  // Get contractor's accepted bids
  const acceptedBids = useMemo(() => {
    return bids.filter(bid => bid.status === 'accepted');
  }, [bids]);

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'open': return 'bg-blue-500';
      case 'in_progress': return 'bg-amber-500';
      case 'completed': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (todayJobs.length === 0) {
    return (
      <Card className="bg-white border shadow-sm">
        <CardContent className="p-3 text-center text-muted-foreground">
          <Calendar className="mx-auto h-5 w-5 mb-1 opacity-50" />
          <p className="text-xs">No jobs today</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border shadow-sm overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-center justify-between p-2 bg-primary/5 border-b">
          <span className="text-xs font-medium flex items-center">
            <Calendar className="h-3 w-3 mr-1" />
            Today's Jobs ({todayJobs.length})
          </span>
        </div>
        <div className="divide-y divide-gray-100">
          {todayJobs.map(job => (
            <div 
              key={job.id}
              className="flex items-center p-2 hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => onViewJob && onViewJob(job)}
            >
              <div className={`w-1.5 h-full min-h-[30px] ${getStatusColor(job.status)} rounded-full mr-2`} />
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <h4 className="font-medium text-xs truncate mr-1">{job.title}</h4>
                  {job.isUrgent && <Badge variant="destructive" className="text-[8px] h-4 px-1">!</Badge>}
                </div>
                
                <div className="flex items-center justify-between mt-0.5">
                  <div className="flex items-center text-[10px] text-muted-foreground">
                    <Clock className="h-2.5 w-2.5 mr-0.5" />
                    <span>
                      {job.startDate 
                        ? format(new Date(job.startDate), 'h:mm a') 
                        : '—'}
                    </span>
                  </div>
                  
                  {/* Only Service Providers (contractors) can bid on jobs */}
                  {userType === 'contractor' && job.status === 'open' && !acceptedBids.some(bid => bid.jobId === job.id) && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-5 text-[10px] px-1.5 py-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onBidJob && onBidJob(job);
                      }}
                    >
                      Bid
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}