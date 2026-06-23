import React from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export const Scene4Staking: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 15], [30, 0], { extrapolateRight: 'clamp' });
  
  const uiScale = spring({ frame: frame - 15, fps, config: { damping: 14 } });
  
  // Animate the balance going up
  const balance = interpolate(frame, [20, 60], [0, 999998], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  return (
    <AbsoluteFill className="flex flex-col items-center justify-center pt-20">
      <h2 
        style={{ opacity: titleOpacity, transform: `translateY(${titleY}px)` }}
        className="text-5xl font-bold text-center px-8 mb-16"
      >
        Earn <br/>
        <span className="text-secondary">Mudarabah Profit-Share</span>
      </h2>

      {/* Mock UI for Halal Staking Pool */}
      <div 
        style={{ transform: `scale(${uiScale})` }}
        className="bg-[#0f172a] border border-primary/30 rounded-3xl p-8 w-[85%] shadow-[0_0_50px_rgba(16,185,129,0.2)]"
      >
        <div className="flex items-center gap-3 mb-4">
          <span className="px-4 py-1.5 rounded-full bg-primary text-white text-sm font-bold uppercase tracking-widest shadow-[0_0_15px_var(--color-primary)]">Halal Yield Staking Pool</span>
        </div>
        
        <div className="mb-6">
          <span className="text-6xl font-black text-white">{Math.floor(balance).toLocaleString()}</span>
          <span className="text-2xl font-bold text-white/60 ml-2">$PAB</span>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex justify-between items-center">
           <span className="text-white/80 font-medium">Estimated Platform Yield</span>
           <span className="text-secondary font-bold text-xl">15.5% APY</span>
        </div>

        <div className="mt-6 flex gap-4">
           <div className="h-14 flex-1 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-xl">
             Stake Now
           </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
