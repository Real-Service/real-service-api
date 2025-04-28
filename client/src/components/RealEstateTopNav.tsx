import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, Menu, Bell, Filter, 
  List, Grid, Map as MapIcon, 
  CalendarDays, SlidersHorizontal
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RealEstateTopNavProps {
  activeViewMode: string;
  onChangeViewMode: (mode: string) => void;
  onToggleSidebar: () => void;
  searchQuery?: string;
  onSearchChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCreateNewQuote?: () => void;
  className?: string;
}

export function RealEstateTopNav({
  activeViewMode,
  onChangeViewMode,
  onToggleSidebar,
  searchQuery = "",
  onSearchChange,
  onCreateNewQuote,
  className
}: RealEstateTopNavProps) {
  return (
    <div className={cn(
      "flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2",
      className
    )}>
      <div className="flex items-center">
        <Button 
          variant="ghost" 
          size="icon"
          className="mr-2 md:hidden text-gray-700"
          onClick={onToggleSidebar}
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        <div className="relative max-w-md hidden md:block">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            type="text"
            placeholder="Search properties..."
            className="w-60 pl-9 bg-gray-50 border-gray-200 focus-visible:ring-blue-500 focus-visible:border-blue-500"
            value={searchQuery}
            onChange={onSearchChange}
          />
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {/* View Modes */}
        <div className="hidden md:flex items-center bg-gray-100 rounded-md p-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "px-2 h-8 text-gray-700 hover:text-gray-900",
              activeViewMode === "grid" && "bg-white shadow-sm text-blue-700"
            )}
            onClick={() => onChangeViewMode("grid")}
          >
            <Grid className="h-4 w-4 mr-1" />
            <span className="text-xs">Grid</span>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "px-2 h-8 text-gray-700 hover:text-gray-900",
              activeViewMode === "list" && "bg-white shadow-sm text-blue-700"
            )}
            onClick={() => onChangeViewMode("list")}
          >
            <List className="h-4 w-4 mr-1" />
            <span className="text-xs">List</span>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "px-2 h-8 text-gray-700 hover:text-gray-900",
              activeViewMode === "map" && "bg-white shadow-sm text-blue-700"
            )}
            onClick={() => onChangeViewMode("map")}
          >
            <MapIcon className="h-4 w-4 mr-1" />
            <span className="text-xs">Map</span>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "px-2 h-8 text-gray-700 hover:text-gray-900",
              activeViewMode === "split" && "bg-white shadow-sm text-blue-700"
            )}
            onClick={() => onChangeViewMode("split")}
          >
            <div className="flex items-center mr-1">
              <List className="h-3 w-3" />
              <MapIcon className="h-3 w-3 -ml-1" />
            </div>
            <span className="text-xs">Split</span>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "px-2 h-8 text-gray-700 hover:text-gray-900",
              activeViewMode === "calendar" && "bg-white shadow-sm text-blue-700"
            )}
            onClick={() => onChangeViewMode("calendar")}
          >
            <CalendarDays className="h-4 w-4 mr-1" />
            <span className="text-xs">Calendar</span>
          </Button>
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          className="text-gray-700 hover:text-gray-900"
        >
          <SlidersHorizontal className="h-5 w-5" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="text-gray-700 hover:text-gray-900"
        >
          <Bell className="h-5 w-5" />
        </Button>
        
        {onCreateNewQuote && (
          <Button
            className="bg-green-600 hover:bg-green-700 text-white ml-2"
            onClick={onCreateNewQuote}
          >
            New Quote
          </Button>
        )}
      </div>
    </div>
  );
}