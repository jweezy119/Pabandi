import React from 'react';

export const ClayGlobe = () => {
  return (
    <div 
      className="clay-earth-css-globe" 
      style={{ 
        width: '400px', 
        height: '400px', 
        maxWidth: '100%',
        aspectRatio: '1 / 1',
        margin: '0 auto',
        borderRadius: '50%',
        background: 'url(/clay-map.png) repeat-x',
        backgroundSize: '200% 100%',
        boxShadow: 'inset -40px -40px 60px rgba(0, 0, 0, 0.7), inset 15px 15px 40px rgba(255, 255, 255, 0.25), 0 20px 50px rgba(0, 0, 0, 0.4)',
        position: 'relative',
        animation: 'rotateGlobeCSS 40s linear infinite',
        transform: 'rotate(-10deg)', // slight tilt to look like Earth's axis
      }}
    >
      <style>
        {`
          @keyframes rotateGlobeCSS {
            0% { background-position: 0 0; }
            100% { background-position: 200% 0; }
          }
        `}
      </style>
      
      {/* Specular overlay to add a permanent lighting highlight on the top left that doesn't rotate */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: '50%',
        boxShadow: 'inset 20px 20px 50px rgba(255, 241, 230, 0.2), inset -10px -10px 30px rgba(0, 0, 0, 0.5)',
        pointerEvents: 'none'
      }}></div>
    </div>
  );
};
