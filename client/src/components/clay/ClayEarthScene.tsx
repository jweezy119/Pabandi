import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// ── Noise helpers for hand-pressed clay texture ──────────────────────────

function hash2D(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2D(ix, iy), b = hash2D(ix + 1, iy);
  const c = hash2D(ix, iy + 1), d = hash2D(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(x: number, y: number, octaves: number): number {
  let value = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    value += amp * smoothNoise(x * freq, y * freq);
    amp *= 0.5;
    freq *= 2;
  }
  return value;
}

// ── Continent outlines (equirectangular coords, lon/lat degrees) ────────

interface P { x: number; y: number; }

// x = longitude (-180..180) → canvas x (0..w)
// y = latitude (90..-90)  → canvas y (0..h)
// We draw in canvas space directly.

const CONTINENTS: P[][] = [
  // North America
  [
    { x: -130, y: 55 }, { x: -125, y: 60 }, { x: -115, y: 65 },
    { x: -100, y: 60 }, { x: -90, y: 55 }, { x: -80, y: 50 },
    { x: -75, y: 45 }, { x: -80, y: 40 }, { x: -85, y: 35 },
    { x: -90, y: 30 }, { x: -95, y: 25 }, { x: -105, y: 25 },
    { x: -115, y: 30 }, { x: -120, y: 35 }, { x: -125, y: 45 },
    { x: -130, y: 50 }, { x: -130, y: 55 },
  ],
  // South America
  [
    { x: -80, y: 10 }, { x: -75, y: 5 }, { x: -70, y: 0 },
    { x: -65, y: -5 }, { x: -60, y: -10 }, { x: -55, y: -20 },
    { x: -50, y: -30 }, { x: -55, y: -40 }, { x: -65, y: -50 },
    { x: -70, y: -55 }, { x: -75, y: -50 }, { x: -80, y: -40 },
    { x: -75, y: -30 }, { x: -70, y: -20 }, { x: -75, y: -10 },
    { x: -80, y: 0 }, { x: -80, y: 5 }, { x: -80, y: 10 },
  ],
  // Europe
  [
    { x: -5, y: 55 }, { x: 0, y: 60 }, { x: 10, y: 65 },
    { x: 20, y: 70 }, { x: 30, y: 70 }, { x: 40, y: 65 },
    { x: 35, y: 60 }, { x: 30, y: 55 }, { x: 20, y: 50 },
    { x: 10, y: 45 }, { x: 5, y: 40 }, { x: 10, y: 40 },
    { x: 15, y: 45 }, { x: 20, y: 50 }, { x: 15, y: 55 },
    { x: 10, y: 55 }, { x: 5, y: 55 }, { x: -5, y: 55 },
  ],
  // Africa
  [
    { x: -5, y: 37 }, { x: 5, y: 35 }, { x: 10, y: 32 },
    { x: 15, y: 30 }, { x: 20, y: 25 }, { x: 30, y: 20 },
    { x: 40, y: 15 }, { x: 45, y: 10 }, { x: 40, y: 5 },
    { x: 35, y: 0 }, { x: 30, y: -5 }, { x: 25, y: -10 },
    { x: 20, y: -15 }, { x: 20, y: -20 }, { x: 25, y: -25 },
    { x: 20, y: -30 }, { x: 15, y: -35 }, { x: 10, y: -35 },
    { x: 5, y: -30 }, { x: 0, y: -25 }, { x: -5, y: -20 },
    { x: -10, y: -15 }, { x: -5, y: -10 }, { x: 0, y: -5 },
    { x: 5, y: 0 }, { x: 10, y: 5 }, { x: 15, y: 10 },
    { x: 20, y: 15 }, { x: 25, y: 20 }, { x: 30, y: 25 },
    { x: 35, y: 30 }, { x: 37, y: 35 }, { x: 35, y: 37 },
    { x: 30, y: 37 }, { x: 25, y: 37 }, { x: -5, y: 37 },
  ],
  // Asia (broad strokes)
  [
    { x: 40, y: 70 }, { x: 60, y: 70 }, { x: 90, y: 70 },
    { x: 120, y: 70 }, { x: 150, y: 70 }, { x: 150, y: 65 },
    { x: 140, y: 60 }, { x: 130, y: 55 }, { x: 120, y: 50 },
    { x: 110, y: 45 }, { x: 100, y: 40 }, { x: 90, y: 35 },
    { x: 80, y: 30 }, { x: 70, y: 25 }, { x: 60, y: 20 },
    { x: 50, y: 15 }, { x: 40, y: 10 }, { x: 40, y: 15 },
    { x: 45, y: 20 }, { x: 50, y: 25 }, { x: 55, y: 30 },
    { x: 60, y: 35 }, { x: 70, y: 40 }, { x: 80, y: 45 },
    { x: 90, y: 50 }, { x: 100, y: 55 }, { x: 110, y: 60 },
    { x: 120, y: 65 }, { x: 130, y: 70 }, { x: 120, y: 70 },
    { x: 110, y: 70 }, { x: 100, y: 70 }, { x: 90, y: 70 },
    { x: 80, y: 70 }, { x: 70, y: 70 }, { x: 60, y: 70 },
    { x: 50, y: 70 }, { x: 40, y: 70 },
  ],
  // Australia
  [
    { x: 115, y: -10 }, { x: 120, y: -15 }, { x: 125, y: -20 },
    { x: 130, y: -25 }, { x: 135, y: -30 }, { x: 140, y: -35 },
    { x: 145, y: -38 }, { x: 150, y: -35 }, { x: 150, y: -30 },
    { x: 145, y: -25 }, { x: 140, y: -20 }, { x: 135, y: -15 },
    { x: 130, y: -10 }, { x: 125, y: -10 }, { x: 120, y: -10 },
    { x: 115, y: -10 },
  ],
  // Greenland
  [
    { x: -55, y: 60 }, { x: -50, y: 65 }, { x: -40, y: 70 },
    { x: -35, y: 75 }, { x: -30, y: 80 }, { x: -45, y: 80 },
    { x: -50, y: 75 }, { x: -50, y: 70 }, { x: -55, y: 65 },
    { x: -55, y: 60 },
  ],
];

// ── Canvas coordinate helpers ────────────────────────────────────────────

function lonToX(lon: number, w: number): number {
  return ((lon + 180) / 360) * w;
}

function latToY(lat: number, h: number): number {
  return ((90 - lat) / 180) * h;
}

// Ray-casting point-in-polygon (canvas space)
function pointInPolygon(px: number, py: number, poly: P[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// ── Texture generation ────────────────────────────────────────────────────

let textureCache: {
  diffuse: THREE.CanvasTexture;
  displacement: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
} | null = null;

function generateClayTextures(size: number = 1024) {
  if (textureCache) return textureCache;

  const w = size, h = size / 2; // equirectangular 2:1
  const lonRange = 360, latRange = 180;

  // ── 1. Mask canvas (continent/ocean/ice classification) ──────────────

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = w; maskCanvas.height = h;
  const maskCtx = maskCanvas.getContext('2d')!;
  const maskData = maskCtx.createImageData(w, h);

  // Paint continents onto mask
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = w; tempCanvas.height = h;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.fillStyle = '#888';
  for (const poly of CONTINENTS) {
    if (poly.length < 3) continue;
    tempCtx.beginPath();
    tempCtx.moveTo(lonToX(poly[0].x, w), latToY(poly[0].y, h));
    for (let i = 1; i < poly.length; i++) {
      tempCtx.lineTo(lonToX(poly[i].x, w), latToY(poly[i].y, h));
    }
    tempCtx.closePath();
    tempCtx.fill();
  }

  const tempData = tempCtx.getImageData(0, 0, w, h).data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const lat = 90 - (y / h) * 180;
      const isIce = Math.abs(lat) > 70;

      if (isIce) {
        maskData.data[idx] = 255;
        maskData.data[idx + 1] = 255;
        maskData.data[idx + 2] = 255;
        maskData.data[idx + 3] = 255;
      } else if (tempData[idx + 3] > 128) {
        // Land — color by latitude for variation
        const latNorm = (lat + 90) / 180; // 0..1 equator→pole
        const r = 80 + Math.floor(60 * (1 - latNorm * 0.5)) + Math.floor(fbm(x / w * 6, y / h * 3, 3) * 30);
        const g = 100 + Math.floor(50 * (1 - latNorm * 0.3)) + Math.floor(fbm(x / w * 6 + 100, y / h * 3, 3) * 25);
        const b = 50 + Math.floor(40 * (1 - latNorm * 0.2)) + Math.floor(fbm(x / w * 6 + 200, y / h * 3, 3) * 20);
        maskData.data[idx] = Math.min(255, r);
        maskData.data[idx + 1] = Math.min(255, g);
        maskData.data[idx + 2] = Math.min(255, b);
        maskData.data[idx + 3] = 255;
      } else {
        // Ocean — blue clay gradient
        const depth = fbm(x / w * 4, y / h * 2, 3) * 0.3 + 0.5;
        const r = Math.floor(30 + depth * 25);
        const g = Math.floor(55 + depth * 40);
        const b = Math.floor(80 + depth * 55);
        maskData.data[idx] = r;
        maskData.data[idx + 1] = g;
        maskData.data[idx + 2] = b;
        maskData.data[idx + 3] = 255;
      }
    }
  }
  maskCtx.putImageData(maskData, 0, 0);

  // ── 2. Diffuse texture (same as mask, with noise overlay) ─────────────

  const diffuseCanvas = document.createElement('canvas');
  diffuseCanvas.width = w; diffuseCanvas.height = h;
  const diffuseCtx = diffuseCanvas.getContext('2d')!;
  diffuseCtx.drawImage(maskCanvas, 0, 0);

  // Add noise grain
  const grainCanvas = document.createElement('canvas');
  grainCanvas.width = w; grainCanvas.height = h;
  const grainCtx = grainCanvas.getContext('2d')!;
  const grainData = grainCtx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const n = fbm(x / w * 20, y / h * 10, 3) * 30 - 15;
      grainData.data[idx] = Math.floor(n);
      grainData.data[idx + 1] = Math.floor(n);
      grainData.data[idx + 2] = Math.floor(n);
      grainData.data[idx + 3] = 60;
    }
  }
  grainCtx.putImageData(grainData, 0, 0);
  diffuseCtx.drawImage(grainCanvas, 0, 0);

  const diffuseTex = new THREE.CanvasTexture(diffuseCanvas);
  diffuseTex.wrapS = diffuseTex.wrapT = THREE.RepeatWrapping;
  diffuseTex.repeat.set(1, 1);

  // ── 3. Displacement map ────────────────────────────────────────────────

  const dispCanvas = document.createElement('canvas');
  dispCanvas.width = w; dispCanvas.height = h;
  const dispCtx = dispCanvas.getContext('2d')!;
  const dispData = dispCtx.createImageData(w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const lat = 90 - (y / h) * 180;
      const isIce = Math.abs(lat) > 70;
      const isLand = tempData[idx + 3] > 128;

      if (isIce) {
        dispData.data[idx] = 200; dispData.data[idx + 1] = 200;
        dispData.data[idx + 2] = 200; dispData.data[idx + 3] = 255;
      } else if (isLand) {
        const hVal = 180 + Math.floor(fbm(x / w * 8, y / h * 4, 3) * 50);
        dispData.data[idx] = Math.min(255, hVal);
        dispData.data[idx + 1] = Math.min(255, hVal);
        dispData.data[idx + 2] = Math.min(255, hVal);
        dispData.data[idx + 3] = 255;
      } else {
        const hVal = 60 + Math.floor(fbm(x / w * 4, y / h * 2, 2) * 20);
        dispData.data[idx] = Math.min(255, hVal);
        dispData.data[idx + 1] = Math.min(255, hVal);
        dispData.data[idx + 2] = Math.min(255, hVal);
        dispData.data[idx + 3] = 255;
      }
    }
  }
  dispCtx.putImageData(dispData, 0, 0);

  const dispTex = new THREE.CanvasTexture(dispCanvas);
  dispTex.wrapS = dispTex.wrapT = THREE.RepeatWrapping;

  // ── 4. Normal map from noise ────────────────────────────────────────────

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = w; normalCanvas.height = h;
  const normalCtx = normalCanvas.getContext('2d')!;
  const normalData = normalCtx.createImageData(w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const hL = fbm(x / w * 15, y / h * 8, 3);
      const hR = fbm((x + 1) / w * 15, y / h * 8, 3);
      const hU = fbm(x / w * 15, (y - 1) / h * 8, 3);
      const dx = (hR - hL) * 40;
      const dy = (hU - hL) * 40;
      const dz = 1;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const nx = dx / len, ny = dy / len, nz = dz / len;
      normalData.data[idx] = Math.floor((nx * 0.5 + 0.5) * 255);
      normalData.data[idx + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
      normalData.data[idx + 2] = Math.floor((nz * 0.5 + 0.5) * 255);
      normalData.data[idx + 3] = 255;
    }
  }
  normalCtx.putImageData(normalData, 0, 0);

  const normalTex = new THREE.CanvasTexture(normalCanvas);
  normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping;

  textureCache = { diffuse: diffuseTex, displacement: dispTex, normal: normalTex };
  return textureCache;
}

// ── SVG fallback ──────────────────────────────────────────────────────────

function ClayEarthSVG() {
  const earthStyle = {
    width: '100%',
    height: '100%',
    maxWidth: '480px',
    maxHeight: '480px',
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
          {/* North America */}
          <path d="M 75 95 Q 95 75 115 80 Q 130 90 125 110 Q 118 125 105 130 Q 90 128 80 115 Q 72 105 75 95 Z" fill="url(#cont-green)" />
          {/* South America */}
          <path d="M 95 145 Q 108 138 115 150 Q 118 170 112 190 Q 105 200 95 195 Q 85 180 88 165 Q 90 150 95 145 Z" fill="url(#cont-green)" />
          {/* Europe/Africa */}
          <path d="M 140 110 Q 160 100 175 115 Q 182 135 178 155 Q 172 175 160 180 Q 145 178 138 165 Q 132 148 135 130 Q 136 118 140 110 Z" fill="url(#cont-green)" />
          {/* Asia */}
          <path d="M 145 85 Q 165 78 180 88 Q 188 100 182 112 Q 172 118 158 115 Q 145 110 140 98 Q 140 90 145 85 Z" fill="url(#cont-tan)" />
          {/* Australia */}
          <path d="M 190 80 Q 215 72 235 85 Q 245 100 240 118 Q 230 130 215 128 Q 198 122 190 108 Q 185 95 190 80 Z" fill="url(#cont-green)" />
          {/* Brown patch */}
          <path d="M 215 165 Q 230 158 240 168 Q 245 180 238 192 Q 228 198 218 193 Q 208 185 210 175 Q 212 168 215 165 Z" fill="url(#cont-brown)" />
          {/* Ice caps */}
          <path d="M 100 220 Q 130 215 160 218 Q 190 215 220 220 Q 225 228 210 232 Q 180 235 150 232 Q 120 235 90 232 Q 80 228 100 220 Z" fill="rgba(210,200,185,0.45)" />
          <path d="M 115 62 Q 128 55 138 62 Q 142 72 135 80 Q 125 82 118 75 Q 112 68 115 62 Z" fill="url(#cont-tan)" />
        </g>
        <ellipse cx="115" cy="105" rx="45" ry="30" fill="rgba(255,255,255,0.12)" transform="rotate(-30 115 105)" />
        <circle cx="150" cy="150" r="135" fill="url(#atmos)" />
      </svg>
    </div>
  );
}

// ── Main 3D Scene component ───────────────────────────────────────────────

export default function ClayEarthScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const earthRef = useRef<THREE.Mesh | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasWebGL, setHasWebGL] = useState(true); // optimistic

  useEffect(() => {
    if (!containerRef.current) return;

    // Check WebGL support
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setHasWebGL(false);
        return;
      }
    } catch {
      setHasWebGL(false);
      return;
    }

    const width = containerRef.current.clientWidth || 480;
    const height = containerRef.current.clientHeight || 480;

    const scene = new THREE.Scene();
    scene.background = null; // transparent

    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(0, 0.3, 3.8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    const { diffuse, displacement, normal } = generateClayTextures(1024);

    // Earth geometry — high-res sphere with displacement
    const geometry = new THREE.SphereGeometry(1.5, 80, 40);
    const material = new THREE.MeshStandardMaterial({
      map: diffuse,
      displacementMap: displacement,
      displacementScale: 0.035,
      roughness: 1.0,
      metalness: 0.0,
      normalMap: normal,
      normalScale: new THREE.Vector2(0.8, 0.8),
      flatShading: false,
    });

    const earth = new THREE.Mesh(geometry, material);
    scene.add(earth);
    earthRef.current = earth;

    // Lighting — warm directional from upper-left
    const keyLight = new THREE.DirectionalLight(0xFFEECC, 1.6);
    keyLight.position.set(-3, 4, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xCCDDFF, 0.35);
    fillLight.position.set(2, -1, 3);
    scene.add(fillLight);

    const ambient = new THREE.AmbientLight(0xFFFFFF, 0.15);
    scene.add(ambient);

    sceneRef.current = scene;
    cameraRef.current = camera;

    containerRef.current.appendChild(renderer.domElement);
    setIsReady(true);

    // ── Animation loop ──────────────────────────────────────────────────────

    let rafId: number;
    let cancelled = false;
    const startTime = performance.now();

    const animate = () => {
      if (cancelled) return;
      const elapsed = (performance.now() - startTime) / 1000;

      if (earthRef.current) {
        // 60s per full revolution
        earthRef.current.rotation.y = (elapsed / 60) * Math.PI * 2;

        // Bob: ±4px at 6s cycle
        const bobAmplitude = 4 / (height * 0.55); // normalize to container size
        earthRef.current.position.y = Math.sin(elapsed / 6 * Math.PI * 2) * bobAmplitude;
      }

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    // ── Resize handler ──────────────────────────────────────────────────────

    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current || cancelled) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      if (w === 0 || h === 0) return;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', handleResize);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (containerRef.current?.contains(rendererRef.current.domElement)) {
          containerRef.current.removeChild(rendererRef.current.domElement);
        }
      }
    };
  }, []);

  if (!hasWebGL || !isReady) {
    return <ClayEarthSVG />;
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        maxWidth: '480px',
        maxHeight: '480px',
        aspectRatio: '1 / 1',
        position: 'relative',
      }}
    />
  );
}
