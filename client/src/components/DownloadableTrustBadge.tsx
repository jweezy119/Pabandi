import { useRef, useState, useEffect } from 'react';
import * as htmlToImage from 'html-to-image';
import { ShieldCheckIcon, DocumentDuplicateIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

interface DownloadableTrustBadgeProps {
  score: number;
  tier: string;
  osintCount: number;
  noShowProbability: number;
  hashes: string[];
  displayName?: string;
}

export default function DownloadableTrustBadge({
  score,
  tier,
  osintCount,
  noShowProbability,
  hashes,
  displayName
}: DownloadableTrustBadgeProps) {
  const badgeRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [displayedScore, setDisplayedScore] = useState(0);

  useEffect(() => {
    let n = 0;
    const t = setInterval(() => {
      n = Math.min(n + 2, score);
      setDisplayedScore(n);
      if (n >= score) clearInterval(t);
    }, 20);
    return () => clearInterval(t);
  }, [score]);

  const handleDownload = async () => {
    if (!badgeRef.current) return;
    try {
      setDownloading(true);
      // We scale it up by 3 for a high-res export
      const dataUrl = await htmlToImage.toPng(badgeRef.current, {
        pixelRatio: 3,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
          margin: '0',
        },
      });
      const link = document.createElement('a');
      link.download = `Pabandi-Trust-Badge-${displayName || 'Profile'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to generate badge image:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      {/* 
        This is the actual element that will be converted to an image.
        It uses inline styles and strict sizing to ensure html-to-image captures it perfectly.
      */}
      <div 
        ref={badgeRef}
        style={{
          width: '380px',
          height: '420px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: '24px',
          padding: '32px',
          position: 'relative',
          fontFamily: 'system-ui, sans-serif',
          color: '#ffffff',
          overflow: 'hidden',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.05)',
        }}
      >
        {/* Background glow effects */}
        <div style={{ position: 'absolute', top: '-100px', left: '-100px', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(20,241,149,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-100px', right: '-100px', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px', zIndex: 10, position: 'relative' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, letterSpacing: '0.02em', color: '#f8fafc' }}>
            Trust Physics Engine
          </h2>
          {displayName && (
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0' }}>
              {displayName}
            </p>
          )}
        </div>

        {/* Circular Score Indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px', zIndex: 10, position: 'relative' }}>
          <div style={{
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            border: '6px solid #14F195',
            boxShadow: '0 0 30px rgba(20,241,149,0.4), inset 0 0 20px rgba(20,241,149,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
          }}>
            <div style={{ fontSize: '48px', fontWeight: 800, color: '#14F195', textShadow: '0 0 15px rgba(20,241,149,0.5)' }}>
              {displayedScore}
            </div>
            {/* The gap at the top to simulate the ring from the mockup */}
            <div style={{ position: 'absolute', top: '-6px', left: '50%', transform: 'translateX(-50%)', width: '20px', height: '6px', background: '#0f172a' }} />
          </div>
        </div>

        {/* Metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', zIndex: 10, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '18px' }}>🚫</span>
            <div style={{ fontSize: '15px', color: '#e2e8f0', fontWeight: 500 }}>
              No-show Probability: <span style={{ color: '#06b6d4', fontWeight: 700 }}>{noShowProbability.toFixed(1)}%</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '18px' }}>🔍</span>
            <div style={{ fontSize: '15px', color: '#e2e8f0', fontWeight: 500 }}>
              OSINT Signals: <span style={{ color: '#f8fafc', fontWeight: 700 }}>{osintCount}/24</span> Verified
            </div>
          </div>
        </div>

        {/* Audit Trail Box */}
        <div style={{ 
          marginTop: '24px', 
          background: 'rgba(255,255,255,0.03)', 
          border: '1px solid rgba(255,255,255,0.1)', 
          borderRadius: '12px', 
          padding: '16px',
          zIndex: 10, position: 'relative'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px' }}>⛓️</span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0' }}>Cryptographic Audit Trail</span>
          </div>
          <div style={{ 
            fontFamily: 'monospace', 
            fontSize: '11px', 
            color: '#94a3b8',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {hashes.length >= 2 ? (
              <>
                {hashes[1].substring(0, 6)}... &rarr; {hashes[0].substring(0, 6)}...
              </>
            ) : hashes.length === 1 ? (
              <>{hashes[0].substring(0, 16)}...</>
            ) : (
              'Initializing...'
            )}
          </div>
        </div>
        
        {/* Pabandi watermark */}
        <div style={{ position: 'absolute', bottom: '16px', right: '16px', fontSize: '10px', color: '#475569', fontWeight: 600, letterSpacing: '0.05em' }}>
          VERIFIED BY PABANDI.COM
        </div>
      </div>

      <button
        onClick={handleDownload}
        disabled={downloading}
        className="mt-6 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-surface-container-high border border-outline-variant/20 text-on-surface font-bold hover:bg-surface-container-highest transition-colors shadow-sm w-[380px]"
      >
        <ArrowDownTrayIcon className="w-5 h-5 text-primary" />
        {downloading ? 'Generating High-Res PNG...' : 'Download for Socials'}
      </button>
    </div>
  );
}
