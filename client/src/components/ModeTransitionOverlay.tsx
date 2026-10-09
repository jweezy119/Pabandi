import React, { useEffect, useRef } from 'react';
import { useModeTransition } from '../hooks/useModeTransition';
import '../styles/modeTransition.css';

export function ModeTransitionOverlay() {
  const { isTransitioning, phase } = useModeTransition();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorRef = useRef<string>('#1f2937'); // Default dark color
  
  useEffect(() => {
    // Capture the primary color from the body right before transition
    if (isTransitioning && phase === 'obscuring') {
      const computedColor = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#1f2937';
      colorRef.current = computedColor;
    }
  }, [isTransitioning, phase]);

  useEffect(() => {
    if (!isTransitioning || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();
    
    let animationFrameId: number;
    let particles: Array<{ x: number, y: number, r: number, vx: number, vy: number, alpha: number, color: string }> = [];
    
    const initParticles = () => {
      particles = [];
      const particleCount = Math.floor((canvas.width * canvas.height) / 1500);
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height + canvas.height * 0.1, // Start slightly lower
          r: Math.random() * 5 + 1,
          vx: (Math.random() - 0.5) * 1.5,
          vy: -Math.random() * 4 - 2,
          alpha: 1,
          color: colorRef.current,
        });
      }
    };

    if (phase === 'obscuring') {
      let progress = 0;
      const animateObscure = () => {
        progress += 0.08;
        if (progress > 1) progress = 1;
        
        ctx.globalAlpha = progress;
        ctx.fillStyle = colorRef.current;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        if (progress < 1) {
          animationFrameId = requestAnimationFrame(animateObscure);
        } else {
          initParticles();
        }
      };
      animateObscure();
    } else if (phase === 'revealing') {
      // In revealing phase, we assume particles were initialized
      if (particles.length === 0) initParticles();
      
      let startTime = Date.now();
      const duration = 1200;
      
      const animateReveal = () => {
        const elapsed = Date.now() - startTime;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        let alive = false;
        particles.forEach(p => {
          if (p.alpha <= 0) return;
          alive = true;
          
          p.x += p.vx;
          p.y += p.vy;
          // Apply a bit of wind or drag
          p.vy -= 0.05; // accelerate upwards
          
          // Fade out based on elapsed time
          p.alpha = Math.max(0, 1 - (elapsed / duration));
          
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.fill();
        });
        
        if (alive && elapsed < duration) {
          animationFrameId = requestAnimationFrame(animateReveal);
        }
      };
      animateReveal();
    }
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isTransitioning, phase]);
  
  if (!isTransitioning) return null;
  
  return (
    <div className={`mode-transition-overlay phase-${phase}`}>
      <canvas ref={canvasRef} className="mode-transition-canvas" />
    </div>
  );
}
