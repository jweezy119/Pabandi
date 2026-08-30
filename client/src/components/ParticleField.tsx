import { useEffect, useRef } from 'react';

/**
 * Lightweight, dependency-free particle field for the Pabandi homepage hero.
 * - HTML5 canvas (no WebGL / three.js) → tiny bundle cost.
 * - Brand palette: violet→indigo→teal drifts, matching the site theme.
 * - Respects prefers-reduced-motion and pauses when the tab/canvas is offscreen.
 * - DPR-aware and resize-safe.
 */
const COLORS = ['#8b5cf6', '#6366f1', '#7c3aed', '#06b6d4', '#14F195'];

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  c: string;
  a: number;
}

export default function ParticleField({ density = 0.00009 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let h = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let parts: P[] = [];
    let raf = 0;
    let running = true;

    const seed = () => {
      const count = Math.max(24, Math.min(120, Math.floor(w * h * density)));
      parts = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.8 + 0.6,
        c: COLORS[(Math.random() * COLORS.length) | 0],
        a: Math.random() * 0.5 + 0.25,
      }));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.c;
        ctx.globalAlpha = p.a;
        ctx.fill();
      }
      // faint connecting lines for a "constellation/trust network" feel
      ctx.globalAlpha = 1;
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) {
          const a = parts[i];
          const b = parts[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 14000) {
            ctx.globalAlpha = 0.04 * (1 - d2 / 14000);
            ctx.strokeStyle = '#8b5cf6';
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = () => {
      if (!running) return;
      draw();
      raf = requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener('resize', resize);

    if (reduce) {
      draw(); // single static frame
    } else {
      loop();
    }

    // Pause when offscreen / tab hidden to save CPU.
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !document.hidden) {
          if (!running && !reduce) {
            running = true;
            loop();
          }
        } else {
          running = false;
          cancelAnimationFrame(raf);
        }
      },
      { threshold: 0.05 },
    );
    io.observe(canvas);

    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!reduce) {
        running = true;
        loop();
      }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
      io.disconnect();
    };
  }, [density]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}
