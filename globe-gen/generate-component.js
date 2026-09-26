const fs = require('fs');
const path = require('path');

const svgPath = fs.readFileSync('paths.txt', 'utf8').trim();

const componentContent = `import React from 'react';

export function ClayGlobe() {
  return (
    <svg 
      className="clay-globe-svg"
      width="100%" 
      height="100%" 
      viewBox="0 0 300 300" 
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: "drop-shadow(0 20px 30px rgba(180,130,90,0.25))" }}
    >
      <defs>
        <filter id="clay-texture">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7"/>
          <feColorMatrix type="saturate" values="0"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.15"/>
          </feComponentTransfer>
          <feBlend in="SourceGraphic" mode="multiply"/>
        </filter>

        <filter id="clay-edges">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="3"/>
          <feDisplacementMap in="SourceGraphic" scale="4"/>
        </filter>
        
        <radialGradient id="ocean-depth" cx="50%" cy="50%" r="50%">
          <stop offset="60%" stopColor="#3A6EA5"/>
          <stop offset="100%" stopColor="#254A75"/>
        </radialGradient>

        <radialGradient id="inner-highlight" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
        </radialGradient>
        
        <radialGradient id="sphere-shadow" cx="30%" cy="30%" r="70%">
           <stop offset="60%" stopColor="transparent" stopOpacity="0"/>
           <stop offset="100%" stopColor="#000000" stopOpacity="0.4"/>
        </radialGradient>
      </defs>
      
      <g>
        {/* Base circle ocean with depth */}
        <circle cx="150" cy="150" r="135" fill="url(#ocean-depth)"/>
        
        {/* Continents layer */}
        <g filter="url(#clay-edges)">
          <path d="${svgPath}" fill="#6B8E4E" stroke="#C9A66B" strokeWidth="2" />
        </g>
        
        {/* Ice caps (top and bottom arcs) */}
        <g filter="url(#clay-edges)">
          {/* North pole */}
          <path d="M 65 50 Q 150 70 235 50 A 135 135 0 0 0 65 50 Z" fill="#F5EFE6" />
          {/* South pole */}
          <path d="M 65 250 Q 150 230 235 250 A 135 135 0 0 1 65 250 Z" fill="#F5EFE6" />
        </g>
        
        {/* Inner highlight (warm lighting upper-left) */}
        <circle cx="150" cy="150" r="135" fill="url(#inner-highlight)" />
        
        {/* Shadow over the sphere for 3D depth (lit top-left, shadow bottom-right) */}
        <circle cx="150" cy="150" r="135" fill="url(#sphere-shadow)" />
        
        {/* Clay texture overlay on everything */}
        <rect width="300" height="300" fill="url(#clay-texture)" style={{ mixBlendMode: 'multiply' }} pointerEvents="none" />
      </g>
    </svg>
  );
}
`;

fs.writeFileSync(path.join(__dirname, '../client/src/components/ClayGlobe.tsx'), componentContent);
