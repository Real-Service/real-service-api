import React from 'react';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { 
  Briefcase, Inbox, Search, Home, 
  Settings, MapPin, Tag, BarChart2, 
  FileText, Map, MessageCircle, Bell, 
  Plus, CalendarDays, User, LogOut, 
  House, HomeIcon, Building, ClipboardList,
  CheckSquare, DollarSign
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/CategoryIcons";

interface RealEstateSidebarProps {
  activeSection: string;
  onChangeSection: (section: string) => void;
  userName: string;
  userAvatar?: string;
  serviceAreas: Array<{
    id: number;
    city: string;
    state: string;
    radius: number;
  }>;
  selectedCategories: string[];
  onLogout: () => void;
  unreadCount?: number;
  className?: string;
}

const iconMap = {
  jobs: <HomeIcon className="h-5 w-5" />,
  inbox: <Inbox className="h-5 w-5" />,
  quotes: <FileText className="h-5 w-5" />,
  map: <Map className="h-5 w-5" />,
  schedule: <CalendarDays className="h-5 w-5" />,
  settings: <Settings className="h-5 w-5" />
};

export function RealEstateSidebar({
  activeSection,
  onChangeSection,
  userName,
  userAvatar,
  serviceAreas,
  selectedCategories,
  onLogout,
  unreadCount = 0,
  className
}: RealEstateSidebarProps) {
  return (
    <div className={cn(
      "h-screen w-60 bg-white border-r border-gray-200 flex flex-col", 
      className
    )}>
      {/* User profile at top */}
      <div className="p-4 flex items-center">
        <Avatar className="h-10 w-10 mr-3">
          <AvatarImage src={userAvatar} alt={userName} />
          <AvatarFallback className="bg-blue-700 text-white">
            {userName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
          <p className="text-xs text-gray-500">Contractor</p>
        </div>
      </div>
      
      <Separator className="my-1" />
      
      {/* Main navigation */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-2 py-3">
          <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Dashboard
          </h3>
          <nav className="mt-2">
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start text-gray-700 hover:bg-gray-100 rounded-md px-3 py-2 mb-1",
                activeSection === "jobs" && "bg-blue-50 text-blue-700"
              )}
              onClick={() => onChangeSection("jobs")}
            >
              <HomeIcon className="mr-3 h-5 w-5 text-gray-500" />
              <span>Properties</span>
            </Button>
            
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start text-gray-700 hover:bg-gray-100 rounded-md px-3 py-2 mb-1",
                activeSection === "inbox" && "bg-blue-50 text-blue-700"
              )}
              onClick={() => onChangeSection("inbox")}
            >
              <div className="relative mr-3">
                <Inbox className="h-5 w-5 text-gray-500" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              <span>Inbox</span>
            </Button>
            
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start text-gray-700 hover:bg-gray-100 rounded-md px-3 py-2 mb-1",
                activeSection === "map" && "bg-blue-50 text-blue-700"
              )}
              onClick={() => onChangeSection("map")}
            >
              <Map className="mr-3 h-5 w-5 text-gray-500" />
              <span>Map View</span>
            </Button>
            
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start text-gray-700 hover:bg-gray-100 rounded-md px-3 py-2 mb-1",
                activeSection === "schedule" && "bg-blue-50 text-blue-700"
              )}
              onClick={() => onChangeSection("schedule")}
            >
              <CalendarDays className="mr-3 h-5 w-5 text-gray-500" />
              <span>Schedule</span>
            </Button>
          </nav>
        </div>
        
        <Separator className="my-2" />
        
        {/* Service Areas Section */}
        <div className="px-2 py-3">
          <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center justify-between">
            <span>Service Areas</span>
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-gray-500 hover:text-gray-700 hover:bg-transparent">
              <Plus className="h-4 w-4" />
            </Button>
          </h3>
          <div className="mt-2 px-3 space-y-1">
            {serviceAreas.length > 0 ? (
              serviceAreas.map(area => (
                <div key={area.id} className="flex items-center group py-1 text-sm">
                  <MapPin className="h-4 w-4 text-gray-500 mr-2" />
                  <span className="text-gray-700 truncate flex-1">{area.city}</span>
                  <span className="text-gray-500 text-xs">{area.radius}km</span>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500 italic">No service areas defined</div>
            )}
          </div>
        </div>
        
        <Separator className="my-2" />
        
        {/* Categories Section */}
        <div className="px-2 py-3">
          <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Categories
          </h3>
          <div className="mt-2 px-3 space-y-1">
            {selectedCategories.length > 0 ? (
              selectedCategories.map(category => (
                <div key={category} className="flex items-center group py-1 text-sm">
                  <CategoryIcon category={category} className="h-4 w-4 text-gray-500 mr-2" />
                  <span className="text-gray-700 truncate">{category}</span>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500 italic">No categories selected</div>
            )}
          </div>
        </div>
      </div>
      
      {/* Bottom actions */}
      <div className="p-3 border-t border-gray-200">
        <div className="space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-700 hover:bg-gray-100 rounded-md"
            onClick={() => onChangeSection("settings")}
          >
            <Settings className="mr-3 h-5 w-5 text-gray-500" />
            <span>Settings</span>
          </Button>
          
          <Button
            variant="ghost"
            className="w-full justify-start text-red-700 hover:bg-gray-100 rounded-md"
            onClick={onLogout}
          >
            <LogOut className="mr-3 h-5 w-5 text-red-500" />
            <span>Logout</span>
          </Button>
        </div>
      </div>
    </div>
  );
}