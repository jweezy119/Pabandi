import React from 'react';

export interface ClaySkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export function ClaySkeleton({ width = '100%', height = '20px', borderRadius = '8px', className = '', style: styleProp }: ClaySkeletonProps) {
  return (
    <div
      className={`clay-skeleton ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
        background: 'linear-gradient(90deg, rgba(232,217,197,0.3) 25%, rgba(245,239,230,0.6) 50%, rgba(232,217,197,0.3) 75%)',
        backgroundSize: '200% 100%',
        animation: 'clay-skeleton-pulse 1.5s ease-in-out infinite',
        ...styleProp,
      }}
    />
  );
}

export function ClaySkeletonText({ lines = 3, lastLineWidth = '60%' }: { lines?: number; lastLineWidth?: string }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <ClaySkeleton key={i} height="14px" />
      ))}
      <ClaySkeleton height="14px" width={lastLineWidth} />
    </div>
  );
}

export function ClaySkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`clay-skeleton-card rounded-[24px] p-5 ${className}`} style={{ backgroundColor: 'white', border: '1px solid rgba(191,179,163,0.15)' }}>
      <div className="flex items-center gap-3 mb-4">
        <ClaySkeleton width="48px" height="48px" borderRadius="16px" />
        <div className="flex-1">
          <ClaySkeleton width="60%" height="16px" />
          <ClaySkeleton width="40%" height="12px" style={{ marginTop: '6px' }} />
        </div>
      </div>
      <ClaySkeletonText lines={3} />
    </div>
  );
}
