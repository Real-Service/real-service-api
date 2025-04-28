import { useState } from 'react';
import { Link } from 'wouter';
import { User } from '@shared/schema';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  Menu, 
  BellRing, 
  LogOut, 
  User as UserIcon,
  ChevronDown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ProfileAvatar } from './ProfileAvatar';

interface MinimalHeaderProps {
  user: User | null;
  pendingCount?: number;
  onLogout: () => Promise<void>;
  onToggleMobileMenu?: () => void;
}

export function MinimalHeader({ 
  user, 
  pendingCount = 0,
  onLogout,
  onToggleMobileMenu 
}: MinimalHeaderProps) {
  const [loading, setLoading] = useState(false);
  
  const handleLogout = async () => {
    setLoading(true);
    try {
      await onLogout();
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <header className="bg-white border-b border-gray-200 py-2 px-4 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center">
        <button 
          className="mr-3 p-1 rounded-md hover:bg-gray-100 md:hidden"
          onClick={onToggleMobileMenu}
        >
          <Menu className="h-5 w-5" />
        </button>
        
        <Link href="/">
          <a className="flex items-center">
            <span className="font-bold text-primary text-lg">Real Service</span>
            <Badge variant="outline" className="ml-2 h-5">
              BETA
            </Badge>
          </a>
        </Link>
      </div>
      
      <div className="flex items-center space-x-3">
        {/* Notification Button */}
        <div className="relative">
          <button className="p-1.5 rounded-full hover:bg-gray-100">
            <BellRing className="h-5 w-5" />
            {pendingCount > 0 && (
              <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </button>
        </div>
        
        {/* User Menu */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center space-x-1 p-1 rounded-md hover:bg-gray-100">
                <ProfileAvatar 
                  user={user} 
                  className="h-7 w-7"
                />
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex items-center space-x-2">
                <ProfileAvatar user={user} className="h-8 w-8" />
                <div className="flex flex-col">
                  <span className="font-medium text-sm">{user.fullName}</span>
                  <span className="text-xs text-muted-foreground">{user.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <UserIcon className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} disabled={loading}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>{loading ? 'Logging out...' : 'Log out'}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        
        {/* Login/Register Buttons for guests */}
        {!user && (
          <div className="flex items-center space-x-2">
            <Link href="/auth">
              <Button variant="default" size="sm">
                Login
              </Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}