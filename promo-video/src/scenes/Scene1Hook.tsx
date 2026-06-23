import React from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig, Img, interpolate } from 'remotion';

import { staticFile } from 'remotion';

const logoUrl = staticFile('pab-logo.png');
export const Scene1Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animations
  const logoScale = spring({ frame, fps, config: { damping: 12 } });
  const textOpacity = interpolate(frame, [15, 30], [0, 1], { extrapolateRight: 'clamp' });
  const textY = interpolate(frame, [15, 30], [50, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill className="flex items-center justify-center flex-col">
      <div style={{ transform: `scale(${logoScale})` }} className="mb-12">
        <Img src={logoUrl} className="w-64 h-64 object-contain" />
      </div>
      
      <h1 
        style={{ opacity: textOpacity, transform: `translateY(${textY}px)` }}
        className="text-6xl font-black text-center leading-tight tracking-tight px-10"
      >
        The Future of <br/>
        <span className="text-primary">Halal Bookings</span>
      </h1>
    </AbsoluteFill>
  );
};
