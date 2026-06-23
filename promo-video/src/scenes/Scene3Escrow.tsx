import React from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export const Scene3Escrow: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 15], [30, 0], { extrapolateRight: 'clamp' });
  
  const hScale = spring({ frame: frame - 20, fps, config: { damping: 12 } });
  const rScale = spring({ frame: frame - 30, fps, config: { damping: 12 } });
  const hoScale = spring({ frame: frame - 40, fps, config: { damping: 12 } });

  return (
    <AbsoluteFill className="flex flex-col items-center justify-center">
      <h2 
        style={{ opacity: titleOpacity, transform: `translateY(${titleY}px)` }}
        className="text-6xl font-black text-center px-6 mb-16 leading-tight"
      >
        Zero No-Shows. <br/>
        <span className="text-primary text-5xl">Universal Escrow</span>
      </h2>

      <div className="flex flex-col gap-6 w-[80%]">
        <div style={{ transform: `scale(${hScale})` }} className="bg-gradient-to-r from-blue-600 to-blue-400 p-6 rounded-3xl shadow-xl flex items-center">
          <span className="text-4xl mr-4">🏨</span>
          <span className="text-3xl font-bold">Hotels</span>
        </div>

        <div style={{ transform: `scale(${rScale})` }} className="bg-gradient-to-r from-orange-500 to-red-400 p-6 rounded-3xl shadow-xl flex items-center">
          <span className="text-4xl mr-4">🍽️</span>
          <span className="text-3xl font-bold">Restaurants</span>
        </div>

        <div style={{ transform: `scale(${hoScale})` }} className="bg-gradient-to-r from-purple-600 to-pink-500 p-6 rounded-3xl shadow-xl flex items-center">
          <span className="text-4xl mr-4">🏠</span>
          <span className="text-3xl font-bold">Homes</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
