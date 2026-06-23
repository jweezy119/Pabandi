import { AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig, Img, interpolate } from 'remotion';
import React from 'react';

// You can copy the logo from the client assets later, or import it.
// We'll use a placeholder URL for now if it's missing, but we'll point it to your token logo
const LOGO_URL = 'file:///home/jay/.gemini/antigravity-ide/brain/b67af29a-0270-4a07-86e6-fb8c2573efda/pab_token_logo_1781995807447.png'; 

// Scenes
import { Scene1Hook } from './scenes/Scene1Hook';
import { Scene2Reliability } from './scenes/Scene2Reliability';
import { Scene3Escrow } from './scenes/Scene3Escrow';
import { Scene4Staking } from './scenes/Scene4Staking';
import { Scene5Outro } from './scenes/Scene5Outro';

export const PromoVideo: React.FC = () => {
  return (
    <AbsoluteFill className="bg-[#0b1120] text-white font-sans flex items-center justify-center">
      {/* Background Gradient */}
      <AbsoluteFill className="opacity-40">
        <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-primary rounded-full blur-[200px] opacity-30 -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-[1000px] h-[1000px] bg-secondary rounded-full blur-[250px] opacity-20 translate-x-1/3 translate-y-1/3"></div>
      </AbsoluteFill>

      {/* 0 to 2 seconds */}
      <Sequence from={0} durationInFrames={60}>
        <Scene1Hook />
      </Sequence>

      {/* 2 to 6 seconds */}
      <Sequence from={60} durationInFrames={120}>
        <Scene2Reliability />
      </Sequence>

      {/* 6 to 10 seconds */}
      <Sequence from={180} durationInFrames={120}>
        <Scene3Escrow />
      </Sequence>

      {/* 10 to 13 seconds */}
      <Sequence from={300} durationInFrames={90}>
        <Scene4Staking />
      </Sequence>

      {/* 13 to 15 seconds */}
      <Sequence from={390} durationInFrames={60}>
        <Scene5Outro />
      </Sequence>

    </AbsoluteFill>
  );
};
