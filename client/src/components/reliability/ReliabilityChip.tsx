import { useEffect, useState } from 'react';

interface ReliabilityChipProps {
  score: number | null;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const ReliabilityChip: React.FC<ReliabilityChipProps> = ({ 
  score = null, 
  showLabel = true,
  size = 'md'
}) => {
  const [displayScore, setDisplayScore] = useState<number | null>(score);
  
  // Format score for display (handle null/undefined)
  const formattedScore = displayScore !== null ? Math.round(displayScore) : null;
  
  // Determine chip color and label based on score
  const getChipProperties = (score: number | null): { 
    bgColor: string; 
    textColor: string; 
    label: string; 
  } => {
    if (score === null) {
      return {
        bgColor: 'bg-[var(--soft-stone)]/20',
        textColor: 'text-[var(--soft-stone)]',
        label: 'New'
      };
    }
    
    if (score >= 70) {
      return {
        bgColor: 'bg-[var(--sage)]/20',
        textColor: 'text-[var(--sage)]',
        label: 'Reliable'
      };
    }
    
    if (score >= 40) {
      return {
        bgColor: 'bg-[var(--muted-ochre)]/20',
        textColor: 'text-[var(--muted-ochre)]',
        label: 'Mixed'
      };
    }
    
    return {
      bgColor: 'bg-[var(--dusty-rose)]/20',
      textColor: 'text-[var(--dusty-rose)]',
      label: 'At Risk'
    };
  };
  
  const { bgColor, textColor, label } = getChipProperties(displayScore ?? 0);
  
  // Size classes
  const sizeClasses: Record<string, string> = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-2.5 py-1'
  };
  
  const sizeClass = sizeClasses[size] || sizeClasses.md;
  
  return (
    <div className={`${bgColor} ${textColor} rounded-full flex items-center justify-center ${sizeClass}`}>
      {showLabel && (
        <>
          {formattedScore !== null && (
            <>
              <span className="mr-1">{formattedScore}</span>
              <span>{label}</span>
            </>
          )}
          {formattedScore === null && <span>{label}</span>}
        </>
      )}
      {!showLabel && formattedScore !== null && <span className="font-medium">{formattedScore}</span>}
    </div>
  );
};

export default ReliabilityChip;
