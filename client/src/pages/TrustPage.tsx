import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { socialService } from '../services/api';

// ─── Platform Config ──────────────────────────────────────────────────────────
const PLATFORMS = [
  {
    id: 'LINKEDIN',
    name: 'LinkedIn',
    emoji: '💼',
    color: '#0A66C2',
    glow: 'rgba(10,102,194,0.25)',
    tagline: 'Professional Identity',
    dataPoints: ['Profile completeness & years of experience', 'Recommendations & endorsement count', 'Industry & current role'],
    benefit: 'Up to +5 reliability points. Adds "Verified Professional" badge to your merchant profile.',
    maxBoost: '+5 pts',
  },
  {
    id: 'FIVERR',
    name: 'Fiverr',
    emoji: '🟢',
    color: '#1DBF73',
    glow: 'rgba(29,191,115,0.25)',
    tagline: 'Gig Economy Trust',
    dataPoints: ['Public star rating (e.g. 4.9/5)', 'Order completion rate', 'Account level & age'],
    benefit: 'Up to +8 reliability points. High-rated sellers get zero-deposit bookings at premium venues.',
    maxBoost: '+8 pts',
  },
  {
    id: 'UPWORK',
    name: 'Upwork',
    emoji: '🔵',
    color: '#14A800',
    glow: 'rgba(20,168,0,0.25)',
    tagline: 'Freelancer Credibility',
    dataPoints: ['Job Success Score', 'Completion & on-time delivery rates', 'Top Rated / Plus status'],
    benefit: 'Up to +8 reliability points. Display Pabandi badge on your Upwork profile — physical-world proof.',
    maxBoost: '+8 pts',
  },
  {
    id: 'X_TWITTER',
    name: 'X (Twitter)',
    emoji: '🐦',
    color: '#E7E9EA',
    glow: 'rgba(231,233,234,0.15)',
    tagline: 'Social Presence',
    dataPoints: ['Account age & verification status', 'Profile completeness'],
    benefit: 'Up to +3 reliability points. Earn bonus PAB when you share your check-in on X.',
    maxBoost: '+3 pts',
  },
  {
    id: 'TRUTH_SOCIAL',
    name: 'Truth Social',
    emoji: '🇺🇸',
    color: '#FF6A00',
    glow: 'rgba(255,106,0,0.2)',
    tagline: 'Community Trust',
    dataPoints: ['Account age & verification status', 'Profile consistency'],
    benefit: 'Up to +3 reliability points. Share your Pabandi streak to your Truth Social community.',
    maxBoost: '+3 pts',
  },
];

const CHALLENGES = [
  {
    id: 'linkedin-luminary',
    title: 'LinkedIn Luminary',
    emoji: '🏆',
    description: 'Link your LinkedIn and complete 10 bookings. Badge appears on both platforms.',
    progress: 0,
    target: 10,
    reward: '500 PAB + LinkedIn badge',
    color: '#0A66C2',
  },
  {
    id: 'freelancer-star',
    title: 'Freelancer Reliability Star',
    emoji: '⭐',
    description: 'Maintain 95%+ completion on Fiverr/Upwork AND 90%+ Pabandi attendance simultaneously.',
    progress: 0,
    target: 100,
    reward: '1000 PAB + Dual-Trusted badge',
    color: '#1DBF73',
  },
  {
    id: 'referral-champion',
    title: 'Referral Champion',
    emoji: '🔗',
    description: 'Share your unique link on any connected platform. Earn PAB for each signup that books.',
    progress: 0,
    target: 5,
    reward: '100 PAB per referral',
    color: '#818cf8',
  },
];

const PRIVACY_ITEMS = [
  {
    q: 'What data do you actually collect?',
    a: 'Only public metadata: account age, verification status, profile completeness scores, and aggregate performance metrics (like star ratings). We never read your posts, messages, feeds, or private contracts.',
  },
  {
    q: 'How is my social data stored?',
    a: 'Social identifiers are encrypted at rest in an isolated vault, completely separate from our main database and from the Solana blockchain. Your wallet is linked only to your pseudonymous Pabandi ID — never to your social handles.',
  },
  {
    q: 'Can I disconnect a platform?',
    a: 'Yes, with one tap. Your trust score instantly recalculates based on remaining signals. You are never penalised for disconnecting — the score simply returns to its baseline.',
  },
  {
    q: 'Will my data be sold or shared?',
    a: 'Never. Aggregated, anonymised trend data may appear in industry reports (e.g. "no-show rates in Karachi restaurants on Fridays"), but individual identities are always protected.',
  },
  {
    q: 'How often is my social data refreshed?',
    a: 'Once per day, maximum. We deliberately avoid real-time scraping to prevent abuse and to minimise our footprint on your accounts.',
  },
  {
    q: 'Can I request full deletion?',
    a: 'Absolutely. Request full anonymisation of your social bridge data and we comply immediately — no waiting periods, no retention.',
  },
];

// ─── Animated Score Badge ─────────────────────────────────────────────────────
function LiveBadge({ score, tier, signals }: { score: number; tier: string; signals: string[] }) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => {
      n = Math.min(n + 2, score);
      setDisplayed(n);
      if (n >= score) clearInterval(t);
    }, 20);
    return () => clearInterval(t);
  }, [score]);

  const tierColors: Record<string, string> = {
    EXCELLENT: '#22c55e',
    AVERAGE: '#f59e0b',
    RISKY: '#ef4444',
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
      border: '1px solid rgba(129,140,248,0.3)',
      borderRadius: '24px',
      padding: '32px 28px',
      textAlign: 'center',
      boxShadow: '0 0 60px rgba(129,140,248,0.15)',
      position: 'relative',
      overflow: 'hidden',
      maxWidth: '280px',
      margin: '0 auto',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 0%, rgba(129,140,248,0.1) 0%, transparent 60%)', pointerEvents: 'none' }} />
      <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.15em', color: '#64748b', marginBottom: '16px', textTransform: 'uppercase' }}>
        PABANDI RELIABILITY
      </div>
      <div style={{ fontSize: '72px', fontWeight: 900, lineHeight: 1, color: '#fff', marginBottom: '8px', fontVariantNumeric: 'tabular-nums' }}>
        {displayed}
      </div>
      <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: '20px', background: tierColors[tier] + '20', color: tierColors[tier], border: `1px solid ${tierColors[tier]}40`, fontSize: '11px', fontWeight: 800, letterSpacing: '0.1em', marginBottom: '20px' }}>
        {tier}
      </div>
      {signals.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {signals.map(s => {
            const p = PLATFORMS.find(p => p.id === s);
            return p ? (
              <span key={s} title={p.name} style={{ fontSize: '16px' }}>{p.emoji}</span>
            ) : null;
          })}
        </div>
      )}
      <div style={{ marginTop: '16px', fontSize: '11px', color: '#475569' }}>
        Verified by Pabandi AI · {new Date().toLocaleDateString()}
      </div>
    </div>
  );
}

// ─── Accordion ────────────────────────────────────────────────────────────────
function Accordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {items.map((item, i) => (
        <div key={i} style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px', overflow: 'hidden', transition: 'all 0.2s',
        }}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            style={{
              width: '100%', padding: '18px 20px', display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', background: 'none', border: 'none', color: '#e2e8f0',
              fontSize: '15px', fontWeight: 600, cursor: 'pointer', textAlign: 'left', gap: '12px',
            }}
          >
            <span>{item.q}</span>
            <span style={{ color: '#818cf8', fontSize: '20px', flexShrink: 0, transition: 'transform 0.2s', transform: open === i ? 'rotate(45deg)' : 'none' }}>+</span>
          </button>
          {open === i && (
            <div style={{ padding: '0 20px 18px', color: '#64748b', fontSize: '14px', lineHeight: 1.7 }}>
              {item.a}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Platform Card ────────────────────────────────────────────────────────────
function PlatformCard({ platform, connected, onConnect, onDisconnect }: {
  platform: typeof PLATFORMS[0];
  connected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{
      background: connected ? `linear-gradient(135deg, ${platform.color}10 0%, rgba(15,23,42,1) 100%)` : 'rgba(255,255,255,0.03)',
      border: connected ? `1px solid ${platform.color}40` : '1px solid rgba(255,255,255,0.08)',
      borderRadius: '20px', padding: '24px', transition: 'all 0.3s',
      boxShadow: connected ? `0 0 30px ${platform.glow}` : 'none',
      cursor: 'pointer',
    }} onClick={() => setExpanded(!expanded)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '28px' }}>{platform.emoji}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '16px', color: '#f1f5f9' }}>{platform.name}</div>
            <div style={{ fontSize: '12px', color: platform.color, fontWeight: 600 }}>{platform.tagline}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '20px',
            background: platform.color + '20', color: platform.color, border: `1px solid ${platform.color}30`,
          }}>
            {platform.maxBoost}
          </span>
          {connected && <span style={{ color: '#22c55e', fontSize: '18px' }}>✓</span>}
        </div>
      </div>

      {expanded && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>What we use (with permission)</div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {platform.dataPoints.map(dp => (
              <li key={dp} style={{ display: 'flex', gap: '8px', fontSize: '13px', color: '#94a3b8' }}>
                <span style={{ color: platform.color }}>·</span>{dp}
              </li>
            ))}
          </ul>
          <div style={{ marginTop: '12px', padding: '12px', background: platform.color + '10', borderRadius: '8px', fontSize: '13px', color: '#94a3b8', lineHeight: 1.6, border: `1px solid ${platform.color}20` }}>
            {platform.benefit}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px' }} onClick={e => e.stopPropagation()}>
        {connected ? (
          <>
            <div style={{ flex: 1, padding: '10px', background: '#22c55e15', border: '1px solid #22c55e30', borderRadius: '10px', color: '#22c55e', fontSize: '13px', fontWeight: 700, textAlign: 'center' }}>
              ✓ Connected
            </div>
            <button
              onClick={onDisconnect}
              style={{ padding: '10px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', color: '#ef4444', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            onClick={onConnect}
            style={{
              flex: 1, padding: '10px', background: `linear-gradient(135deg, ${platform.color}CC, ${platform.color})`,
              border: 'none', borderRadius: '10px', color: '#fff', fontSize: '13px',
              fontWeight: 700, cursor: 'pointer', boxShadow: `0 4px 15px ${platform.glow}`,
            }}
          >
            Connect {platform.name} →
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TrustPage() {
  const { isAuthenticated } = useAuthStore();
  const heroRef = useRef<HTMLElement>(null);
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [activeSharePlatform, setActiveSharePlatform] = useState('X_TWITTER');
  const [copiedShare, setCopiedShare] = useState(false);

  const connectedCount = Object.values(connected).filter(Boolean).length;
  const totalBoost = Object.entries(connected)
    .filter(([, v]) => v)
    .reduce((sum, [k]) => {
      const p = PLATFORMS.find(p => p.id === k);
      return sum + (p ? parseInt(p.maxBoost) : 0);
    }, 0);
  const displayScore = Math.min(100, 72 + totalBoost);
  const tier = displayScore >= 90 ? 'EXCELLENT' : displayScore >= 70 ? 'AVERAGE' : 'RISKY';

  // Load connected platforms on mount
  useEffect(() => {
    if (isAuthenticated) {
      socialService.getIdentities()
        .then(res => {
          const ids = res.data?.data?.identities || [];
          const initConnected: Record<string, boolean> = {};
          ids.forEach((id: string) => {
            initConnected[id] = true;
          });
          setConnected(initConnected);
        })
        .catch(err => console.error('Failed to fetch connected platforms', err));
    }
  }, [isAuthenticated]);

  const handleDisconnect = async (platformId: string) => {
    try {
      await socialService.disconnect(platformId);
    } catch (err) {
      console.error('Failed to disconnect platform', platformId, err);
    }
    setConnected(prev => ({ ...prev, [platformId]: false }));
  };

  const shareTexts: Record<string, string> = {
    X_TWITTER: `Reliability score: ${displayScore}/100. Building trust across platforms. #PabandiReliable #BookingTrust`,
    LINKEDIN: `Maintaining professional punctuality across all platforms. Pabandi Reliability Score: ${displayScore}/100 (${tier}).\n\n#Reliability #ProfessionalDevelopment`,
    FIVERR: `Physical-world reliability verified by Pabandi AI. Score: ${displayScore}/100. Combined with Fiverr performance for 360° trust.`,
    UPWORK: `${displayScore}% reliability across ${connectedCount} verified platforms. Pabandi Verified — physical and digital trust combined.`,
    TRUTH_SOCIAL: `Building a verified reliability record that travels everywhere. Pabandi Score: ${displayScore}/100.`,
  };

  const handleConnect = async (platformId: string) => {
    try {
      await socialService.connect(platformId);
      setConnected(prev => ({ ...prev, [platformId]: true }));
    } catch (err) {
      console.error('Failed to connect platform', platformId, err);
    }
  };
  const handleCopyShare = () => {
    navigator.clipboard.writeText(shareTexts[activeSharePlatform]);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  return (
    <div style={{ background: '#020617', minHeight: '100vh', color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section ref={heroRef} style={{ padding: '80px 24px 60px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.12) 0%, transparent 60%)', pointerEvents: 'none' }} />

        {/* Orbiting platform logos */}
        <div style={{ position: 'relative', width: '200px', height: '200px', margin: '0 auto 40px', flexShrink: 0 }}>
          <div style={{ position: 'absolute', inset: '20px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', zIndex: 2, boxShadow: '0 0 40px rgba(99,102,241,0.5)' }}>
            🛡️
          </div>
          {PLATFORMS.map((p, i) => {
            const angle = (i / PLATFORMS.length) * 2 * Math.PI - Math.PI / 2;
            const r = 88;
            const x = 100 + r * Math.cos(angle) - 18;
            const y = 100 + r * Math.sin(angle) - 18;
            return (
              <div key={p.id} style={{
                position: 'absolute', left: x, top: y, width: '36px', height: '36px',
                borderRadius: '50%', background: p.color + '20', border: `2px solid ${p.color}60`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
                boxShadow: `0 0 12px ${p.glow}`,
                animation: `orbit-${i} 20s linear infinite`,
              }}>
                {p.emoji}
              </div>
            );
          })}
        </div>

        <div style={{ position: 'relative', maxWidth: '760px', margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.3)', borderRadius: '20px', padding: '6px 16px', marginBottom: '24px', fontSize: '12px', color: '#818cf8', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#818cf8', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            SECTION 6.4 — SOCIAL & PROFESSIONAL TRUST LAYER
          </div>
          <h1 style={{ fontSize: 'clamp(32px, 5.5vw, 60px)', fontWeight: 800, lineHeight: 1.1, marginBottom: '20px', letterSpacing: '-0.03em', background: 'linear-gradient(135deg, #ffffff 0%, #818cf8 50%, #c084fc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Your Reputation,<br />Everywhere You Are
          </h1>
          <p style={{ fontSize: '18px', color: '#94a3b8', maxWidth: '560px', margin: '0 auto 36px', lineHeight: 1.7 }}>
            Link your LinkedIn, Fiverr, Upwork, and social accounts. Your hard-earned reputation travels with you — into every booking, badge, and business interaction.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="#platforms" style={{ padding: '13px 28px', borderRadius: '12px', fontWeight: 700, fontSize: '14px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', textDecoration: 'none', boxShadow: '0 0 25px rgba(99,102,241,0.4)' }}>
              Connect Your Accounts →
            </a>
            <a href="#badge" style={{ padding: '13px 28px', borderRadius: '12px', fontWeight: 600, fontSize: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0', textDecoration: 'none' }}>
              See the Badge
            </a>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section style={{ padding: '20px 24px 80px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          {[
            { step: '01', icon: '🔗', title: 'Connect', desc: 'Link any platform in one tap via OAuth. We request only the minimum scope needed — public metadata only.' },
            { step: '02', icon: '⚡', title: 'Enrich', desc: 'Our ensemble blends your cross-platform history with your Pabandi booking record. Score updates within seconds.' },
            { step: '03', icon: '🏅', title: 'Earn', desc: 'Unlock new badge tiers, earn bonus PAB on check-ins, and display your portable trust badge everywhere.' },
          ].map(item => (
            <div key={item.step} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '28px 24px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '12px', right: '16px', fontSize: '52px', fontWeight: 900, color: 'rgba(255,255,255,0.04)', lineHeight: 1 }}>{item.step}</div>
              <div style={{ fontSize: '32px', marginBottom: '14px' }}>{item.icon}</div>
              <h3 style={{ fontWeight: 700, fontSize: '18px', marginBottom: '8px', color: '#f1f5f9' }}>{item.title}</h3>
              <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.6 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Platform Cards ────────────────────────────────────────────────────── */}
      <section id="platforms" style={{ padding: '0 24px 80px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '30px', fontWeight: 700, marginBottom: '6px', letterSpacing: '-0.02em' }}>Connect Your Platforms</h2>
            <p style={{ color: '#64748b', fontSize: '14px' }}>Each connection is opt-in. Disconnect any time. No feeds, no messages, no private data.</p>
          </div>
          {connectedCount > 0 && (
            <div style={{ padding: '10px 20px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '12px', color: '#22c55e', fontWeight: 700, fontSize: '14px' }}>
              +{totalBoost} pts active · {connectedCount} connected
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          {PLATFORMS.map(p => (
            <PlatformCard
              key={p.id}
              platform={p}
              connected={!!connected[p.id]}
              onConnect={() => handleConnect(p.id)}
              onDisconnect={() => handleDisconnect(p.id)}
            />
          ))}
        </div>
        {!isAuthenticated && (
          <div style={{ marginTop: '24px', textAlign: 'center', padding: '20px', background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.2)', borderRadius: '14px' }}>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '12px' }}>Sign in to connect your real accounts and receive your trust boost.</p>
            <Link to="/login" style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', borderRadius: '10px', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}>
              Sign In to Connect
            </Link>
          </div>
        )}
      </section>

      {/* ── Live Badge Preview ────────────────────────────────────────────────── */}
      <section id="badge" style={{ padding: '0 24px 80px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '30px', fontWeight: 700, marginBottom: '12px', letterSpacing: '-0.02em' }}>Your Portable Trust Badge</h2>
            <p style={{ color: '#64748b', fontSize: '15px', lineHeight: 1.7, marginBottom: '20px' }}>
              A dynamically generated, signed badge showing your reliability score, tier, and connected platforms. Share it to LinkedIn, Fiverr profiles, X — anywhere your reputation matters.
            </p>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#818cf8', letterSpacing: '0.08em', marginBottom: '10px', textTransform: 'uppercase' }}>Share to platform</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                {PLATFORMS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setActiveSharePlatform(p.id)}
                    style={{
                      padding: '6px 14px', borderRadius: '8px', border: `1px solid ${activeSharePlatform === p.id ? p.color : 'rgba(255,255,255,0.1)'}`,
                      background: activeSharePlatform === p.id ? p.color + '20' : 'transparent',
                      color: activeSharePlatform === p.id ? p.color : '#64748b',
                      fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {p.emoji} {p.name}
                  </button>
                ))}
              </div>
              <div style={{ background: '#0f172a', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.08)', fontSize: '13px', color: '#94a3b8', lineHeight: 1.6, marginBottom: '10px', minHeight: '80px' }}>
                {shareTexts[activeSharePlatform]}
              </div>
              <button
                onClick={handleCopyShare}
                style={{ padding: '10px 20px', background: copiedShare ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${copiedShare ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '10px', color: copiedShare ? '#22c55e' : '#e2e8f0', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
              >
                {copiedShare ? '✓ Copied!' : 'Copy Text'}
              </button>
            </div>
          </div>
          <div>
            <LiveBadge score={displayScore} tier={tier} signals={Object.keys(connected).filter(k => connected[k])} />
            <p style={{ textAlign: 'center', color: '#475569', fontSize: '12px', marginTop: '12px' }}>
              Connect platforms above to see your score grow live ↑
            </p>
          </div>
        </div>
      </section>

      {/* ── Challenges ───────────────────────────────────────────────────────── */}
      <section style={{ padding: '0 24px 80px', maxWidth: '1100px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '30px', fontWeight: 700, marginBottom: '8px', letterSpacing: '-0.02em' }}>Cross-Platform Challenges</h2>
        <p style={{ color: '#64748b', marginBottom: '36px', fontSize: '14px' }}>Complete challenges that span your digital and physical worlds. Earn badges and PAB tokens.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {CHALLENGES.map(ch => (
            <div key={ch.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '28px 24px' }}>
              <div style={{ fontSize: '28px', marginBottom: '12px' }}>{ch.emoji}</div>
              <h3 style={{ fontWeight: 700, fontSize: '17px', marginBottom: '6px', color: '#f1f5f9' }}>{ch.title}</h3>
              <p style={{ color: '#64748b', fontSize: '13px', lineHeight: 1.6, marginBottom: '20px' }}>{ch.description}</p>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#475569', marginBottom: '6px' }}>
                  <span>Progress</span><span>0 / {ch.target}</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '0%', background: ch.color, borderRadius: '3px', transition: 'width 1s ease' }} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: ch.color, fontWeight: 700 }}>
                🏆 {ch.reward}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Business Badge Section ────────────────────────────────────────────── */}
      <section style={{ padding: '0 24px 80px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(168,85,247,0.08) 100%)', border: '1px solid rgba(129,140,248,0.2)', borderRadius: '24px', padding: '48px 40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#818cf8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '16px' }}>For Service Providers</div>
              <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '16px', lineHeight: 1.2 }}>Verified Reliable Business Badge</h2>
              <p style={{ color: '#64748b', fontSize: '15px', lineHeight: 1.7, marginBottom: '24px' }}>
                Businesses earn a "Verified Reliable Business" badge displayable on LinkedIn company pages, Fiverr agency profiles, Upwork agencies, and X/Truth Social business accounts. The badge links to a live verification page showing real attendance metrics.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {['98% booking attendance rate', 'Average customer rating 4.9', 'Verified by Pabandi AI', '200+ successful bookings'].map(item => (
                  <div key={item} style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '14px', color: '#94a3b8' }}>
                    <span style={{ color: '#22c55e', fontWeight: 800 }}>✓</span>{item}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '24px', display: 'inline-block' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', marginBottom: '12px', letterSpacing: '0.05em' }}>PABANDI VERIFIED BUSINESS</div>
                <div style={{ fontSize: '48px', marginBottom: '8px' }}>🏢✅</div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#22c55e', marginBottom: '4px' }}>98%</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Attendance Rate</div>
                <div style={{ marginTop: '16px', padding: '8px 16px', background: 'rgba(129,140,248,0.1)', borderRadius: '8px', fontSize: '12px', color: '#818cf8', fontWeight: 600 }}>
                  Verified · pabandi.com/verify
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Privacy Promise ───────────────────────────────────────────────────── */}
      <section style={{ padding: '0 24px 80px', maxWidth: '760px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '30px', fontWeight: 700, marginBottom: '8px', letterSpacing: '-0.02em' }}>🔒 Privacy & Control</h2>
        <p style={{ color: '#64748b', marginBottom: '32px', fontSize: '14px' }}>We hold ourselves to the highest privacy standards. Every integration is opt-in, granular, and reversible.</p>
        <Accordion items={PRIVACY_ITEMS} />
      </section>

      {/* ── Technical Reference ───────────────────────────────────────────────── */}
      <section style={{ padding: '0 24px 80px', maxWidth: '1100px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>🔌 Technical Integration</h2>
        <p style={{ color: '#64748b', marginBottom: '28px', fontSize: '14px' }}>For platforms wanting to embed or verify Pabandi badges.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          {[
            { method: 'GET', path: '/api/v1/badge/:pseudonymousId', desc: 'Public. Returns signed badge JSON for any pseudonymous ID. No auth required.', tag: 'PUBLIC' },
            { method: 'GET', path: '/external/v1/badge/:pseudonymousId', desc: 'B2B API. Requires x-api-key. Returns same payload — for automated platform integrations.', tag: 'API KEY' },
            { method: 'GET', path: '/api/v1/social/identities', desc: 'Authenticated. Returns the calling user\'s connected platforms and trust boost breakdown.', tag: 'AUTH' },
            { method: 'POST', path: '/api/v1/social/connect/:platform', desc: 'Authenticated. Connects a social platform via OAuth stub. Returns trust boost earned.', tag: 'AUTH' },
          ].map(endpoint => (
            <div key={endpoint.path} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ padding: '2px 8px', background: endpoint.method === 'GET' ? 'rgba(34,197,94,0.15)' : 'rgba(251,191,36,0.15)', color: endpoint.method === 'GET' ? '#22c55e' : '#fbbf24', borderRadius: '4px', fontSize: '11px', fontWeight: 800 }}>{endpoint.method}</span>
                <span style={{ padding: '2px 8px', background: 'rgba(129,140,248,0.1)', color: '#818cf8', borderRadius: '4px', fontSize: '10px', fontWeight: 800 }}>{endpoint.tag}</span>
              </div>
              <code style={{ fontSize: '12px', color: '#c4b5fd', fontFamily: "'Fira Code', monospace", display: 'block', marginBottom: '8px', wordBreak: 'break-all' }}>{endpoint.path}</code>
              <p style={{ color: '#64748b', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>{endpoint.desc}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <Link to="/developer" style={{ color: '#818cf8', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}>
            View full API documentation → Developer Portal
          </Link>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section style={{ padding: '0 24px 100px', maxWidth: '560px', margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '12px' }}>Ready to make your reputation portable?</h2>
        <p style={{ color: '#64748b', marginBottom: '28px', fontSize: '15px', lineHeight: 1.7 }}>
          Every connection you make today means fewer deposits, better bookings, and a trust score that follows you everywhere.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to={isAuthenticated ? '/profile' : '/register'} style={{ padding: '14px 28px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', fontWeight: 700, fontSize: '15px', textDecoration: 'none', boxShadow: '0 0 25px rgba(99,102,241,0.4)' }}>
            {isAuthenticated ? 'Go to My Profile →' : 'Create Free Account →'}
          </Link>
          <Link to="/developer" style={{ padding: '14px 28px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0', fontWeight: 600, fontSize: '15px', textDecoration: 'none' }}>
            API Docs
          </Link>
        </div>
      </section>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}
