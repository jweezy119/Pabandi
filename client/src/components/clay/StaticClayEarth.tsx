import React from 'react';

export default function StaticClayEarth() {
  const earthStyle = {
    width: '100%',
    height: '100%',
    maxWidth: '500px', // As per instructions "max-width: 500px"
    maxHeight: '500px',
    aspectRatio: '1 / 1',
  };

  return (
    <div style={earthStyle}>
      <svg width="100%" height="100%" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="earth-sphere" cx="38%" cy="32%" r="65%">
            <stop offset="0%" stop-color="#8EC5E0" />
            <stop offset="40%" stop-color="#5C8A9E" />
            <stop offset="70%" stop-color="#3D6B7E" />
            <stop offset="100%" stop-color="#1A3A4A" />
          </radialGradient>
          <linearGradient id="cont-green" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#B5D4A8" />
            <stop offset="100%" stop-color="#6B8F5E" />
          </linearGradient>
          <linearGradient id="cont-brown" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#D4B896" />
            <stop offset="100%" stop-color="#9A7B4F" />
          </linearGradient>
          <linearGradient id="cont-tan" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#DCC9A8" />
            <stop offset="100%" stop-color="#B8956A" />
          </linearGradient>
          <radialGradient id="atmos" cx="50%" cy="50%" r="50%">
            <stop offset="85%" stop-color="transparent" />
            <stop offset="100%" stop-color="rgba(180,210,230,0.15)" />
          </radialGradient>
          <filter id="relief" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="3" dy="5" stdDeviation="6" flood-color="rgba(20,40,50,0.25)" />
          </filter>
        </defs>
        <circle cx="150" cy="150" r="142" fill="url(#atmos)" />
        <circle cx="150" cy="150" r="135" fill="url(#earth-sphere)" />
        <g filter="url(#relief)">
          <path d="M 75 95 Q 95 75 115 80 Q 130 90 125 110 Q 118 125 105 130 Q 90 128 80 115 Q 72 105 75 95 Z" fill="url(#cont-green)" />
          <path d="M 95 145 Q 108 138 115 150 Q 118 170 112 190 Q 105 200 95 195 Q 85 180 88 165 Q 90 150 95 145 Z" fill="url(#cont-green)" />
          <path d="M 140 110 Q 160 100 175 115 Q 182 135 178 155 Q 172 175 160 180 Q 145 178 138 165 Q 132 148 135 130 Q 136 118 140 110 Z" fill="url(#cont-green)" />
          <path d="M 145 85 Q 165 78 180 88 Q 188 100 182 112 Q 172 118 158 115 Q 145 110 140 98 Q 140 90 145 85 Z" fill="url(#cont-tan)" />
          <path d="M 190 80 Q 215 72 235 85 Q 245 100 240 118 Q 230 130 215 128 Q 198 122 190 108 Q 185 95 190 80 Z" fill="url(#cont-green)" />
          <path d="M 215 165 Q 230 158 240 168 Q 245 180 238 192 Q 228 198 218 193 Q 208 185 210 175 Q 212 168 215 165 Z" fill="url(#cont-brown)" />
          <path d="M 100 220 Q 130 215 160 218 Q 190 215 220 220 Q 225 228 210 232 Q 180 235 150 232 Q 120 235 90 232 Q 80 228 100 220 Z" fill="rgba(210,200,185,0.45)" />
          <path d="M 115 62 Q 128 55 138 62 Q 142 72 135 80 Q 125 82 118 75 Q 112 68 115 62 Z" fill="url(#cont-tan)" />
        </g>
        <ellipse cx="115" cy="105" rx="45" ry="30" fill="rgba(255,255,255,0.12)" transform="rotate(-30 115 105)" />
        <circle cx="150" cy="150" r="135" fill="url(#atmos)" />
      </svg>
    </div>
  );
}
