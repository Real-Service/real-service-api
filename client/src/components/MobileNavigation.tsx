import React from 'react';
import { cn } from '@/lib/utils';
import { 
  Inbox, 
  Briefcase, 
  Settings,
  Home,
  Menu
} from 'lucide-react';

type NavItemProps = {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
};

function NavItem({ icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center relative",
        "transition-colors duration-200",
        active 
          ? "text-primary after:absolute after:bottom-0 after:w-full after:h-0.5 after:bg-primary" 
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <div className="h-5 w-5 mb-1 relative">
        {icon}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

type MobileNavigationProps = {
  activeSection: string;
  onChangeSection: (section: string) => void;
  userType: 'landlord' | 'contractor';
  activeJobCategory?: string;
  onChangeJobCategory?: (category: string) => void;
};

export function MobileNavigation({ 
  activeSection, 
  onChangeSection, 
  userType,
  activeJobCategory,
  onChangeJobCategory
}: MobileNavigationProps) {
  // Facebook-style 3-tab system for contractors
  const contractorNavItems = [
    { id: 'jobs', icon: <Briefcase className="h-full w-full" />, label: 'Jobs' },
    { id: 'inbox', icon: <Inbox className="h-full w-full" />, label: 'Inbox' },
    { id: 'settings', icon: <Settings className="h-full w-full" />, label: 'Settings' }
  ];
  
  // Different navigation items for landlords (no Jobs tab)
  const landlordNavItems = [
    { id: 'inbox', icon: <Inbox className="h-full w-full" />, label: 'Inbox' },
    { id: 'settings', icon: <Settings className="h-full w-full" />, label: 'Settings' }
  ];
  
  // Select the appropriate navigation items based on user type
  const navItems = userType === 'contractor' ? contractorNavItems : landlordNavItems;
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 h-12 md:hidden z-50">
      <div className={userType === 'contractor' ? "grid grid-cols-3 h-full" : "grid grid-cols-2 h-full"}>
        {navItems.map((item) => (
          <NavItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={activeSection === item.id}
            onClick={() => onChangeSection(item.id)}
          />
        ))}
      </div>
    </div>
  );
}