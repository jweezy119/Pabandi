import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

/* ── Animated Counter ── */
function AnimatedCounter({ target, suffix = '', duration = 2000 }: { target: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const step = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setCount(Math.floor(eased * target));
          if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }, { threshold: 0.5 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

/* ── Scroll Reveal ── */
function ScrollReveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(28px)',
      transition: `opacity 0.6s ${delay}ms ease, transform 0.6s ${delay}ms ease`,
    }}>
      {children}
    </div>
  );
}

/* ── 3D Tilt Feature Card ── */
function FeatureCard({ icon, color, glow, title, desc, delay }: {
  icon: React.ReactNode; color: string; glow: string; title: string; desc: string; delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(800px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg) scale(1.03)`;
  };

  const handleMouseLeave = () => {
    if (ref.current) ref.current.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg) scale(1)';
  };

  return (
    <ScrollReveal delay={delay}>
      <div
        ref={ref}
        onMouseMove={handleMouseMove}
        style={{
          background: 'var(--color-surface)',
          border: `1px solid ${glow.replace('0.15', '0.2')}`,
          borderRadius: '1.25rem',
          padding: '1.75rem',
          transition: 'transform 0.15s ease, box-shadow 0.3s ease',
          cursor: 'default',
          position: 'relative',
          overflow: 'hidden',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = `0 20px 60px rgba(0,0,0,0.5), 0 0 40px ${glow}`;
          (e.currentTarget as HTMLDivElement).style.borderColor = color + '55';
        }}
        onMouseLeave={e => {
          handleMouseLeave();
          const target = e.currentTarget as HTMLDivElement;
          target.style.boxShadow = '';
          target.style.borderColor = glow.replace('0.15', '0.2');
          target.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg) scale(1)';
        }}
      >
        {/* Subtle shine sweep */}
        <div style={{
          position: 'absolute', top: 0, left: '-100%', width: '60%', height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent)',
          pointerEvents: 'none',
        }} />
        <div style={{
          width: 52, height: 52, borderRadius: '14px',
          background: glow.replace('0.15', '0.15'),
          color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '1.25rem',
          boxShadow: `0 0 20px ${glow}`,
          border: `1px solid ${color}30`,
        }}>
          {icon}
        </div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', color: '#e8eef8', fontFamily: 'Space Grotesk, sans-serif' }}>
          {title}
        </h3>
        <p style={{ fontSize: '0.875rem', lineHeight: 1.7, color: 'var(--color-text-muted)' }}>{desc}</p>
      </div>
    </ScrollReveal>
  );
}

const features = [
  {
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>,
    color: '#6C63FF', glow: 'rgba(108,99,255,0.15)',
    title: 'Smart Booking', desc: 'Ultra-fast reservations optimised for high conversion. Book in seconds, from anywhere.',
  },
  {
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>,
    color: '#00FFB0', glow: 'rgba(0,255,176,0.15)',
    title: 'Revenue Protection', desc: 'ML-powered no-show prediction. Guaranteed reimbursement for missed bookings.',
  },
  {
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>,
    color: '#FFB830', glow: 'rgba(255,184,48,0.15)',
    title: 'Pulse Alerts', desc: 'Automated SMS & Email reminders keep both parties engaged. Zero drop-offs.',
  },
  {
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>,
    color: '#00E5FF', glow: 'rgba(0,229,255,0.15)',
    title: 'Bold Analytics', desc: 'Real-time insights into every booking, trend, and protected dollar.',
  },
];

const stats = [
  { value: 10000, suffix: '+', label: 'Active Bookings', color: '#6C63FF' },
  { value: 98, suffix: '%', label: 'Show-up Rate', color: '#00FFB0' },
  { value: 500, suffix: '+', label: 'Businesses Listed', color: '#00E5FF' },
  { value: 2, suffix: 'M+', label: 'Revenue Protected', color: '#FFB830' },
];

export default function HomePage() {
  return (
    <div style={{ background: 'transparent', color: 'var(--color-text)' }}>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-28 pb-36 px-4" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>

        {/* Animated background orbs */}
        <div className="animate-orb" style={{
          position: 'absolute', width: 600, height: 600,
          top: '-20%', left: '50%', transform: 'translateX(-50%)',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(108,99,255,0.18) 0%, transparent 70%)',
          filter: 'blur(40px)', pointerEvents: 'none',
        }} />
        <div className="animate-float" style={{
          position: 'absolute', width: 400, height: 400,
          bottom: '10%', right: '-5%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,229,255,0.1) 0%, transparent 70%)',
          filter: 'blur(60px)', pointerEvents: 'none', animationDelay: '2s',
        }} />
        <div className="animate-float-2" style={{
          position: 'absolute', width: 350, height: 350,
          top: '30%', left: '-5%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,255,176,0.08) 0%, transparent 70%)',
          filter: 'blur(60px)', pointerEvents: 'none',
        }} />

        {/* Grid dots */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(rgba(108,99,255,0.12) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 20%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 20%, transparent 100%)',
        }} />

        <div className="max-w-5xl mx-auto text-center relative z-10 w-full">

          {/* AI Badge */}
          <div className="animate-fade-up" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 18px', borderRadius: 9999, marginBottom: 32,
            background: 'rgba(108,99,255,0.1)',
            border: '1px solid rgba(108,99,255,0.3)',
            color: '#a5b4fc', fontSize: 11, fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            boxShadow: '0 0 30px rgba(108,99,255,0.15)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6C63FF', animation: 'pulseGlow 1.5s ease-in-out infinite', display: 'inline-block' }} />
            AI-Powered · Smarter Bookings. Anywhere.
          </div>

          {/* Headline */}
          <h1 className="animate-fade-up-delay-1" style={{
            fontSize: 'clamp(2.8rem, 8vw, 5.5rem)',
            fontWeight: 900,
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
            marginBottom: '1.5rem',
            color: '#e8eef8',
            fontFamily: 'Space Grotesk, sans-serif',
          }}>
            Book Smarter.{' '}
            <span className="gradient-text animate-gradient">
              Show Up Every Time.
            </span>
          </h1>

          <p className="animate-fade-up-delay-2" style={{
            fontSize: 'clamp(1rem, 2.5vw, 1.2rem)',
            maxWidth: 640, margin: '0 auto 2.5rem',
            lineHeight: 1.75,
            color: 'var(--color-text-muted)',
          }}>
            No more missed appointments or lost revenue. Pabandi protects businesses from no-shows and rewards customers with{' '}
            <span style={{ color: '#a5b4fc', fontWeight: 600 }}>Pabandi Reliability Tokens (PAB)</span>{' '}
            — now live in{' '}
            <span style={{ fontWeight: 700, color: '#e8eef8' }}>🇺🇸 USA</span> &{' '}
            <span style={{ fontWeight: 700, color: '#e8eef8' }}>🇵🇰 Pakistan</span>.
          </p>

          {/* CTAs */}
          <div className="animate-fade-up-delay-3 flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register" id="hero-cta-customer" className="btn-primary text-base px-10 py-4" style={{ fontSize: '1rem' }}>
              Get Started — It's Free
            </Link>
            <Link to="/join" id="hero-cta-business" className="btn-secondary text-base px-10 py-4" style={{ fontSize: '1rem' }}>
              List Your Business →
            </Link>
          </div>

          {/* Social proof */}
          <div className="animate-fade-up-delay-4 flex items-center justify-center gap-3 mt-10">
            <div className="flex -space-x-2">
              {['#6C63FF', '#00E5FF', '#00FFB0', '#FFB830'].map((c, i) => (
                <div key={i} style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: c, border: '2px solid #050915',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, color: '#fff',
                  boxShadow: `0 0 10px ${c}88`,
                }}>
                  {['A', 'S', 'M', 'K'][i]}
                </div>
              ))}
            </div>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              Trusted by <strong style={{ color: '#e8eef8' }}>500+ businesses</strong> across 🇺🇸 USA & 🇵🇰 Pakistan
            </span>
          </div>

          {/* Floating stat cards */}
          <div className="hidden lg:flex gap-4 justify-center mt-14 flex-wrap">
            {[
              { label: 'No-Shows Prevented', value: '12,400+', icon: '🛡️', color: '#00FFB0' },
              { label: 'AI Risk Assessments', value: '99,800+', icon: '🧠', color: '#6C63FF' },
              { label: 'Tokens Distributed', value: '3.2M PAB', icon: '⚡', color: '#FFB830' },
            ].map((s, i) => (
              <div key={i} className="animate-fade-up" style={{
                animationDelay: `${0.5 + i * 0.1}s`,
                background: 'rgba(12,20,38,0.85)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 16, padding: '12px 20px',
                display: 'flex', alignItems: 'center', gap: 10,
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              }}>
                <span style={{ fontSize: 20 }}>{s.icon}</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section style={{ borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(8,14,30,0.6)', backdropFilter: 'blur(8px)' }}>
        <div className="max-w-5xl mx-auto px-4 py-14 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <div style={{
                fontSize: 'clamp(2rem, 5vw, 2.75rem)', fontWeight: 900,
                fontFamily: 'Space Grotesk, sans-serif', color: s.color,
                textShadow: `0 0 30px ${s.color}88`,
                marginBottom: 6,
              }}>
                <AnimatedCounter target={s.value} suffix={s.suffix} />
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', letterSpacing: '0.04em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="max-w-6xl mx-auto px-4 py-28">
        <ScrollReveal>
          <div className="text-center mb-16">
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '4px 14px', borderRadius: 9999, marginBottom: 16,
              background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)',
              color: '#00E5FF', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
            }}>
              PLATFORM FEATURES
            </div>
            <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 900, marginBottom: 16, color: '#e8eef8', fontFamily: 'Space Grotesk, sans-serif' }}>
              Everything You Need to Scale
            </h2>
            <p style={{ fontSize: '1rem', maxWidth: 520, margin: '0 auto', color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
              Our AI-first approach protects your business while delivering a premium booking experience for your customers.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <FeatureCard key={f.title} {...f} delay={i * 100} />
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="max-w-5xl mx-auto px-4 pb-28">
        <ScrollReveal>
          <div className="text-center mb-14">
            <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.25rem)', fontWeight: 900, marginBottom: 14, color: '#e8eef8', fontFamily: 'Space Grotesk, sans-serif' }}>
              How It Works
            </h2>
          </div>
        </ScrollReveal>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { step: '01', title: 'Book Your Spot', desc: 'Find any business — salon, restaurant, clinic — and reserve in under 30 seconds.', color: '#6C63FF' },
            { step: '02', title: 'AI Monitors Risk', desc: 'Our ML engine analyses your history to assign a reliability score and predict no-shows.', color: '#00E5FF' },
            { step: '03', title: 'Earn PAB Tokens', desc: 'Show up every time and earn Pabandi tokens redeemable for discounts and perks.', color: '#00FFB0' },
          ].map((s, i) => (
            <ScrollReveal key={s.step} delay={i * 120}>
              <div style={{
                textAlign: 'center', padding: '2rem',
                background: 'var(--color-surface)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '1.25rem',
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', top: -20, right: -20, fontSize: 80,
                  fontWeight: 900, color: s.color, opacity: 0.04,
                  fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1,
                }}>{s.step}</div>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%', margin: '0 auto 1.25rem',
                  background: s.color + '15', border: `1px solid ${s.color}35`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 900, color: s.color,
                }}>{s.step}</div>
                <h3 style={{ fontWeight: 700, marginBottom: 10, color: '#e8eef8', fontFamily: 'Space Grotesk, sans-serif' }}>{s.title}</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.7 }}>{s.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* ── Dual CTA ── */}
      <section className="max-w-6xl mx-auto px-4 pb-28">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Customer CTA */}
          <ScrollReveal>
            <div style={{
              position: 'relative', overflow: 'hidden', borderRadius: '1.75rem', padding: '2.5rem',
              background: 'linear-gradient(135deg, rgba(108,99,255,0.15) 0%, rgba(8,14,30,0.9) 100%)',
              border: '1px solid rgba(108,99,255,0.25)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 80px rgba(108,99,255,0.05)',
            }}>
              <div style={{
                position: 'absolute', width: 200, height: 200, top: -60, right: -60,
                borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,99,255,0.3), transparent)',
                filter: 'blur(40px)', pointerEvents: 'none',
              }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, marginBottom: '1.5rem',
                  background: 'rgba(108,99,255,0.15)', border: '1px solid rgba(108,99,255,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a5b4fc',
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                </div>
                <h3 style={{ fontSize: '1.6rem', fontWeight: 900, marginBottom: 10, color: '#e8eef8', fontFamily: 'Space Grotesk, sans-serif' }}>For Customers</h3>
                <p style={{ fontSize: '0.9rem', marginBottom: '1.75rem', color: '#8899bb', lineHeight: 1.7 }}>
                  Book top salons, restaurants, and clinics near you. Earn PAB tokens every time you show up.
                </p>
                <Link to="/register" id="cta-customer-section" className="btn-primary text-sm inline-flex">
                  Sign Up Free →
                </Link>
              </div>
            </div>
          </ScrollReveal>

          {/* Business CTA */}
          <ScrollReveal delay={100}>
            <div style={{
              position: 'relative', overflow: 'hidden', borderRadius: '1.75rem', padding: '2.5rem',
              background: 'linear-gradient(135deg, rgba(0,255,176,0.1) 0%, rgba(8,14,30,0.9) 100%)',
              border: '1px solid rgba(0,255,176,0.2)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 80px rgba(0,255,176,0.04)',
            }}>
              <div style={{
                position: 'absolute', width: 200, height: 200, top: -60, right: -60,
                borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,255,176,0.25), transparent)',
                filter: 'blur(40px)', pointerEvents: 'none',
              }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, marginBottom: '1.5rem',
                  background: 'rgba(0,255,176,0.1)', border: '1px solid rgba(0,255,176,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00FFB0',
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" /></svg>
                </div>
                <h3 style={{ fontSize: '1.6rem', fontWeight: 900, marginBottom: 10, color: '#e8eef8', fontFamily: 'Space Grotesk, sans-serif' }}>For Businesses</h3>
                <p style={{ fontSize: '0.9rem', marginBottom: '1.75rem', color: '#8899bb', lineHeight: 1.7 }}>
                  Connect your Google Business profile. Accept bookings, eliminate no-shows, and grow your revenue with AI.
                </p>
                <Link to="/register?role=business" id="cta-business-section"
                  className="text-sm font-semibold px-5 py-3 rounded-xl inline-flex items-center gap-2 transition-all"
                  style={{
                    background: 'rgba(0,255,176,0.1)',
                    color: '#00FFB0',
                    border: '1px solid rgba(0,255,176,0.3)',
                  }}>
                  List Your Business →
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

    </div>
  );
}
