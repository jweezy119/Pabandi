import React from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export const Scene2Reliability: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 15], [30, 0], { extrapolateRight: 'clamp' });
  
  const uiScale = spring({ frame: frame - 15, fps, config: { damping: 14 } });
  
  return (
    <AbsoluteFill className="flex flex-col items-center justify-center pt-20">
      <h2 
        style={{ opacity: titleOpacity, transform: `translateY(${titleY}px)` }}
        className="text-5xl font-bold text-center px-8 mb-16"
      >
        The Engine Behind <br/>
        <span className="text-secondary">Zero-Knowledge Trust</span>
      </h2>

      {/* Mock UI for Trust Matrix */}
      <div 
        style={{ transform: `scale(${uiScale})` }}
        className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 w-[80%] shadow-2xl"
      >
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-gradient-to-tr from-primary to-green-300 rounded-full flex items-center justify-center">
            <span className="text-2xl font-black">98</span>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white">Trust Score</h3>
            <p className="text-lg text-white/70">Top 2% Reliability</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="h-12 bg-white/5 rounded-xl border border-white/10 flex items-center px-4">
             <span className="text-lg font-medium text-white/80">GB/Z 185.3 Hybrid PKI</span>
             <span className="ml-auto text-primary font-bold">Bound</span>
          </div>
          <div className="h-12 bg-white/5 rounded-xl border border-white/10 flex items-center px-4">
             <span className="text-lg font-medium text-white/80">On-Chain Oracle History</span>
             <span className="ml-auto text-secondary font-bold">Immutable</span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
