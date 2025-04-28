import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  Input,
  Textarea,
  Alert,
  AlertDescription,
} from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { Job, Bid } from '@shared/schema';
import { useState } from 'react';

// Bid form validation schema
const bidSchema = z.object({
  amount: z.coerce.number().min(1, 'Please enter a valid amount'),
  proposal: z.string().min(10, 'Please enter a more detailed proposal'),
  estimatedDuration: z.string().min(1, 'Please provide an estimated duration'),
});

type BidFormValues = z.infer<typeof bidSchema>;

type BidManagementFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: BidFormValues) => void;
  isLoading: boolean;
  job: Job | null;
  existingBid?: Bid;
  mode: 'create' | 'update';
  onWithdraw?: () => void;
};

export function BidManagementForm({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  job,
  existingBid,
  mode = 'create',
  onWithdraw
}: BidManagementFormProps) {
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);

  const form = useForm<BidFormValues>({
    resolver: zodResolver(bidSchema),
    defaultValues: {
      amount: existingBid?.amount || (job?.budget || 0),
      proposal: existingBid?.proposal || '',
      estimatedDuration: existingBid?.estimatedDuration || ''
    }
  });

  function handleSubmit(data: BidFormValues) {
    onSubmit(data);
  }

  function handleWithdraw() {
    if (showWithdrawConfirm && onWithdraw) {
      onWithdraw();
      setShowWithdrawConfirm(false);
    } else {
      setShowWithdrawConfirm(true);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Place a Bid' : 'Update Your Bid'}
          </DialogTitle>
        </DialogHeader>

        {job && (
          <div className="mb-4">
            <h3 className="text-lg font-semibold">{job.title}</h3>
            {job.budget && (
              <p className="text-sm text-gray-500">
                Client Budget: {formatCurrency(job.budget)}
              </p>
            )}
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Bid Amount ($)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter amount"
                      type="number"
                      step="0.01"
                      min="1"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="estimatedDuration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated Duration</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., 3 days, 2 weeks"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="proposal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Proposal</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Explain how you'll approach this job..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showWithdrawConfirm && (
              <Alert variant="destructive">
                <AlertDescription>
                  Are you sure you want to withdraw your bid? This action cannot be undone.
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter className="flex gap-2 sm:gap-0 flex-row sm:justify-between justify-end">
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onClose}
                >
                  Cancel
                </Button>

                {mode === 'update' && onWithdraw && (
                  <Button
                    type="button"
                    variant={showWithdrawConfirm ? "destructive" : "outline"}
                    onClick={handleWithdraw}
                  >
                    {showWithdrawConfirm ? "Confirm Withdraw" : "Withdraw Bid"}
                  </Button>
                )}
              </div>

              <Button 
                type="submit" 
                disabled={isLoading || showWithdrawConfirm}
              >
                {isLoading ? "Processing..." : mode === 'create' ? "Submit Bid" : "Update Bid"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}