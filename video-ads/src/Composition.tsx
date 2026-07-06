import { AbsoluteFill, staticFile, Audio, Sequence, useCurrentFrame, interpolate, Img } from "remotion";
import React from "react";

const CinematicScene: React.FC<{ name: string, subtitle: string, audioFile: string, startFrame: number, durationFrames: number, imageFile: string }> = ({ name, subtitle, audioFile, startFrame, durationFrames, imageFile }) => {
  const frame = useCurrentFrame();
  
  // Opacity fade in and fade out (15 frames each)
  const opacity = interpolate(frame - startFrame, [0, 15, durationFrames - 15, durationFrames], [0, 1, 1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp"
  });

  // Slow continuous camera push on the image container
  const cameraZoom = interpolate(frame - startFrame, [0, durationFrames], [1, 1.15], {
    extrapolateRight: "clamp"
  });
  
  // Parse words for dynamic highlighting
  const words = subtitle.split(" ");
  // Space out words based on duration
  const framesPerWord = durationFrames / words.length;

  return (
    <Sequence from={startFrame} durationInFrames={durationFrames}>
      <AbsoluteFill style={{ backgroundColor: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', padding: '50px', textAlign: 'center', opacity }}>
        <AbsoluteFill style={{ opacity: 0.3, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, #0A0A0A 70%)' }} />
        
        <div style={{ transform: `scale(${cameraZoom})`, marginBottom: '50px', zIndex: 1, filter: 'drop-shadow(0 0 50px rgba(251, 192, 45, 0.15))' }}>
          <Img src={staticFile(imageFile)} style={{ width: '550px', height: '550px', objectFit: 'cover', borderRadius: '30px', border: '3px solid rgba(255,255,255,0.1)' }} />
        </div>
        
        <h1 style={{ fontSize: '60px', margin: 0, fontWeight: 'bold', zIndex: 1, letterSpacing: '8px', textTransform: 'uppercase', color: '#FBC02D' }}>{name}</h1>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '850px', marginTop: '30px', zIndex: 1 }}>
          {words.map((word, i) => {
             const wordStart = i * framesPerWord;
             const wordOpacity = interpolate(frame - startFrame, [wordStart, wordStart + 5], [0.2, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
             const wordScale = interpolate(frame - startFrame, [wordStart, wordStart + 5], [0.95, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
             
             return (
               <span key={i} style={{ fontSize: '45px', margin: '0 8px', opacity: wordOpacity, transform: `scale(${wordScale})`, display: 'inline-block', lineHeight: '1.5', fontWeight: 'bold', textShadow: '0 5px 20px rgba(0,0,0,1)' }}>
                 {word}
               </span>
             );
          })}
        </div>
        <Audio src={staticFile(audioFile)} />
      </AbsoluteFill>
    </Sequence>
  );
};

export const LiveSellingAd = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <CinematicScene 
        name="SELLER SAM"
        subtitle="Buy my live-streamed limited-edition socks! I have to sell fifty pairs just to cover the Web2 platform fees! Please, my children are barefoot!"
        audioFile="seller_sam.wav"
        imageFile="seller_sam.png"
        startFrame={0}
        durationFrames={260}
      />
      
      {/* Start 15 frames earlier to overlap fade */}
      <CinematicScene 
        name="BUYER BETTY"
        subtitle="I'd buy them, but bridging my crypto to your chain takes 45 minutes. By the time the transaction clears, feet will be out of style."
        audioFile="buyer_betty.wav"
        imageFile="buyer_betty.png"
        startFrame={245}
        durationFrames={280}
      />
      
      <CinematicScene 
        name="YIELD YUSEF"
        subtitle="Why is everyone yelling? I'm just watching this stream while my stablecoins earn Treasury Yield. I'm literally making money off your foot tragedy."
        audioFile="yield_yusef.wav"
        imageFile="yield_yusef.png"
        startFrame={510}
        durationFrames={280}
      />
      
      <CinematicScene 
        name="PABANDI PAM"
        subtitle="Stop the madness. Just use Pabandi. Instant cross-chain checkouts for Betty, zero middleman fees for Sam's socks, and passive yield for Yusef."
        audioFile="pabandi_pam.wav"
        imageFile="pabandi_pam.png"
        startFrame={775}
        durationFrames={270}
      />

      <Sequence from={1030} durationInFrames={120}>
        <AbsoluteFill style={{ backgroundColor: '#000000', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '50px' }}>
           <AbsoluteFill style={{ opacity: 0.5, backgroundImage: 'radial-gradient(circle, rgba(251, 192, 45, 0.2) 0%, #000 70%)' }} />
           <h1 style={{ fontSize: '110px', fontWeight: 'bold', color: '#FBC02D', marginBottom: '30px', zIndex: 1, letterSpacing: '10px' }}>PABANDI</h1>
           <p style={{ fontSize: '50px', textAlign: 'center', lineHeight: '1.5', zIndex: 1 }}>Stop crying. Start earning.</p>
           <Audio src={staticFile("narration.wav")} />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
