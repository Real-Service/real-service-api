import { Progress } from '@/components/ui';

type ProgressBarProps = {
  value: number;
  showValue?: boolean;
};

export function ProgressBar({ value, showValue = false }: ProgressBarProps) {
  // Ensure value is between 0 and 100
  const safeValue = Math.min(Math.max(0, value), 100);
  
  // Determine color based on progress value
  let progressColor = 'bg-primary';
  
  if (safeValue < 25) {
    progressColor = 'bg-red-500';
  } else if (safeValue < 50) {
    progressColor = 'bg-orange-500';
  } else if (safeValue < 75) {
    progressColor = 'bg-yellow-500';
  } else {
    progressColor = 'bg-green-500';
  }
  
  return (
    <div className="w-full flex items-center gap-2">
      <div className="flex-1">
        <Progress 
          value={safeValue} 
          className="h-2" 
          indicatorClassName={progressColor}
        />
      </div>
      {showValue && (
        <div className="text-xs font-medium w-8 text-right">{Math.round(safeValue)}%</div>
      )}
    </div>
  );
}