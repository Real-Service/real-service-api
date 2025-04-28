import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { ReactNode, useState } from "react";
import { ProfileSettings } from "./ProfileSettings-new";
import { User } from "@shared/schema";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/use-auth";

interface ProfileEditDialogProps {
  trigger?: ReactNode;
  user?: User;
}

export function ProfileEditDialog({ trigger, user }: ProfileEditDialogProps) {
  const [open, setOpen] = useState(false);
  const { user: authUser } = useAuth();
  
  // Use provided user or the authenticated user
  const userToEdit = user || authUser;
  
  if (!userToEdit) {
    return null;
  }
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">Edit Profile</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] md:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        <ProfileSettings 
          user={userToEdit} 
          onClose={() => setOpen(false)} 
        />
        <DialogClose className="hidden" />
      </DialogContent>
    </Dialog>
  );
}