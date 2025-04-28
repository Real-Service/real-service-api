import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export function AdminTools() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const resetDatabase = async () => {
    try {
      setIsLoading(true);
      setResult(null);
      
      // Make API call to reset database
      const response = await apiRequest('DELETE', '/api/reset-database');
      const data = await response.json();
      
      setResult(data.message);
      toast({
        title: "Database Reset",
        description: data.message,
        variant: "default",
      });
    } catch (error) {
      console.error('Error resetting database:', error);
      setResult('Error resetting database. Check console for details.');
      toast({
        title: "Error",
        description: "Failed to reset database. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Admin Tools
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Admin Tools</DialogTitle>
          <DialogDescription>
            Use these tools carefully. Actions performed here cannot be undone.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <h3 className="font-medium">Database Tools</h3>
            <p className="text-sm text-muted-foreground">Reset the database to remove all jobs and bids.</p>
            <Button 
              variant="destructive" 
              onClick={resetDatabase}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                "Reset Database"
              )}
            </Button>
            
            {result && (
              <div className="mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded text-sm">
                {result}
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}