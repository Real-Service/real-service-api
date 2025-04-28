import { AccountSettings } from "@/components/AccountSettings";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

export default function AccountSettingsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  // If no user is logged in, redirect to auth page
  if (!user) {
    setLocation("/auth");
    return null;
  }
  
  return <AccountSettings />;
}