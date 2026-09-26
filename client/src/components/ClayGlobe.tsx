import React, { useRef } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';

const GlobeMesh = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Load the clay texture
  const colorMap = useLoader(THREE.TextureLoader, '/clay-map.png');
  
  // Rotate the globe slowly
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.002;
    }
  });

  return (
    <Sphere ref={meshRef} args={[1.5, 64, 64]}>
      <meshStandardMaterial 
        map={colorMap} 
        roughness={0.9} 
        metalness={0.1}
      />
    </Sphere>
  );
};

export const ClayGlobe = () => {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '400px' }} className="clay-earth-container">
      <Canvas camera={{ position: [0, 0, 3.5] }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={1.5} color="#fff1e6" />
        <directionalLight position={[-5, -5, 5]} intensity={0.5} color="#d4a5a5" />
        <GlobeMesh />
      </Canvas>
    </div>
  );
};
