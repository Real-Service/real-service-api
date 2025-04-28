import { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  X, 
  Check, 
  Briefcase, 
  Mail, 
  DollarSign, 
  CheckCircle, 
  AlertTriangle,
  MessageSquare,
  Clock
} from 'lucide-react';
import { 
  Button,
  Card,
  Badge,
} from '@/components/ui';
import { formatDistanceToNow } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export type NotificationType = 
  | 'newJob' 
  | 'bidAccepted' 
  | 'bidRejected' 
  | 'newMessage' 
  | 'jobComplete'
  | 'paymentReceived'
  | 'jobMatch'
  | 'bidUpdate';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  date: Date;
  read: boolean;
  jobId?: number;
  bidId?: number;
  actionUrl?: string;
  actionLabel?: string;
}

interface NotificationSystemProps {
  userId?: number;
  userType?: 'contractor' | 'landlord';
  onJobClick?: (jobId: number) => void;
  onBidClick?: (bidId: number) => void;
}

export function NotificationSystem({ 
  userId, 
  userType,
  onJobClick,
  onBidClick
}: NotificationSystemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading, error } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await fetch('/api/notifications');
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }
      const data = await response.json();
      return data.map((notification: any) => ({
        ...notification,
        date: new Date(notification.date)
      }));
    },
    // Only fetch if we're not showing the modal
    enabled: !!userId,
    // Refresh every minute
    refetchInterval: 60000
  });

  const unreadCount = notifications.filter((n: Notification) => !n.read).length;

  // Handle clicks outside of the notification panel to close it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleAction = (notification: Notification) => {
    // Mark as read
    markAsRead(notification.id);
    
    // Handle different actions based on notification type
    if (notification.jobId && onJobClick) {
      onJobClick(notification.jobId);
    } else if (notification.bidId && onBidClick) {
      onBidClick(notification.bidId);
    } else if (notification.actionUrl) {
      window.open(notification.actionUrl, '_blank');
    }
    
    setIsOpen(false);
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notificationIds: [notificationId]
        })
      });
      
      // Update local state - mark notification as read
      queryClient.setQueryData(['notifications'], (oldData: any) => 
        oldData.map((n: Notification) => 
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications
        .filter((n: Notification) => !n.read)
        .map((n: Notification) => n.id);
      
      if (unreadIds.length === 0) return;
      
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notificationIds: unreadIds
        })
      });
      
      // Update local state - mark all notifications as read
      queryClient.setQueryData(['notifications'], (oldData: any) => 
        oldData.map((n: Notification) => ({ ...n, read: true }))
      );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const clearAllNotifications = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'DELETE'
      });
      
      // Update local state - clear all notifications
      queryClient.setQueryData(['notifications'], []);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'newJob':
        return <Briefcase className="h-4 w-4 text-primary" />;
      case 'bidAccepted':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'bidRejected':
        return <X className="h-4 w-4 text-red-500" />;
      case 'newMessage':
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case 'jobComplete':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'paymentReceived':
        return <DollarSign className="h-4 w-4 text-green-500" />;
      case 'jobMatch':
        return <Briefcase className="h-4 w-4 text-primary" />;
      case 'bidUpdate':
        return <Clock className="h-4 w-4 text-orange-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  // Don't render if we don't have a userId
  if (!userId) {
    return null;
  }

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] font-semibold text-white flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <Card className="absolute right-0 mt-2 w-80 sm:w-96 z-50 border shadow-lg">
          <div className="p-3 bg-primary/5 border-b flex items-center justify-between">
            <h3 className="font-medium">Notifications</h3>
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={markAllAsRead}
                className="h-7 text-xs"
              >
                <Check className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearAllNotifications}
                className="h-7 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Clear all
              </Button>
            </div>
          </div>
          
          <div className="max-h-[60vh] overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-gray-500">Loading notifications...</div>
            ) : error ? (
              <div className="p-4 text-center text-red-500">
                <AlertTriangle className="h-5 w-5 mx-auto mb-2" />
                Failed to load notifications
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <Bell className="h-6 w-6 mx-auto mb-2 text-gray-400" />
                No notifications
              </div>
            ) : (
              <div>
                {notifications.map((notification: Notification) => (
                  <div 
                    key={notification.id}
                    className={`p-3 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer
                      ${notification.read ? 'bg-white' : 'bg-blue-50'}
                    `}
                    onClick={() => handleAction(notification)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-sm">{notification.title}</h4>
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                            {formatDistanceToNow(new Date(notification.date), { addSuffix: true })}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                        
                        {notification.actionLabel && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="mt-2 h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction(notification);
                            }}
                          >
                            {notification.actionLabel}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}