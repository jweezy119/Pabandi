import React from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export const Scene5Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleScale = spring({ frame, fps, config: { damping: 12 } });
  const ctaOpacity = interpolate(frame, [15, 30], [0, 1], { extrapolateRight: 'clamp' });
  const ctaY = interpolate(frame, [15, 30], [20, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill className="flex flex-col items-center justify-center">
      <div style={{ transform: `scale(${titleScale})` }} className="text-center mb-16">
        <h2 className="text-5xl font-black text-white mb-4">Secure.</h2>
        <h2 className="text-5xl font-black text-primary mb-4">Sharia-Compliant.</h2>
        <h2 className="text-5xl font-black text-secondary">Scalable.</h2>
      </div>

      <div 
        style={{ opacity: ctaOpacity, transform: `translateY(${ctaY}px)` }}
        className="flex flex-col items-center"
      >
        <div className="bg-white text-dark font-black text-3xl px-10 py-5 rounded-full mb-6 shadow-[0_0_30px_rgba(255,255,255,0.3)]">
          pabandi.com
        </div>
        <p className="text-white/80 text-xl font-medium tracking-wide">
          Buy $PAB on Raydium today.
        </p>
      </div>
    </AbsoluteFill>
  );
};
