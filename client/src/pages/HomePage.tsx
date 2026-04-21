import { Link } from 'react-router-dom';

const features = [
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
    color: '#3b82f6',
    glow: 'rgba(59,130,246,0.15)',
    title: 'Smart Booking',
    desc: 'Ultra-fast reservations optimised for high conversion. Book in seconds, from anywhere.',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    color: '#10b981',
    glow: 'rgba(16,185,129,0.15)',
    title: 'Revenue Protection',
    desc: 'ML-powered no-show prediction. Guaranteed reimbursement for missed bookings.',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
    ),
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.15)',
    title: 'Pulse Alerts',
    desc: 'Automated SMS & Email reminders keep both parties engaged. Zero drop-offs.',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    color: '#8b5cf6',
    glow: 'rgba(139,92,246,0.15)',
    title: 'Bold Analytics',
    desc: 'Real-time insights into every booking, trend, and protected rupee.',
  },
];

const stats = [
  { value: '10,000+', label: 'Active Bookings' },
  { value: '98%', label: 'Show-up Rate' },
  { value: '500+', label: 'Businesses Listed' },
  { value: '₨ 2M+', label: 'Revenue Protected' },
];

export default function HomePage() {
  return (
    <div style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-24 pb-32 px-4">
        {/* Glow blobs */}
        <div className="glow-blob w-[700px] h-[700px] top-[-300px] left-1/2 -translate-x-1/2"
          style={{ background: 'rgba(37,99,235,0.08)' }} />
        <div className="glow-blob w-[400px] h-[400px] bottom-0 right-0"
          style={{ background: 'rgba(16,185,129,0.06)' }} />

        <div className="max-w-5xl mx-auto text-center relative z-10">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-xs font-semibold tracking-widest uppercase"
            style={{
              background: 'rgba(37,99,235,0.12)',
              border: '1px solid rgba(59,130,246,0.25)',
              color: '#93c5fd',
            }}>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            AI-Powered · Karachi's Smartest Booking Platform
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6"
            style={{ color: '#e8edf3' }}>
            Book Smarter.{' '}
            <span className="gradient-text">
              Show Up Every Time.
            </span>
          </h1>

          <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{ color: '#7a90a8' }}>
            No more missed appointments or lost revenue. Pabandi protects businesses from no-shows and rewards customers with{' '}
            <span style={{ color: '#60a5fa', fontWeight: 600 }}>Pabandi Reliability Tokens (PAB)</span>{' '}
            just for showing up — guaranteed.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register" id="hero-cta-customer"
              className="btn-primary text-base px-8 py-4">
              Get Started — It's Free
            </Link>
            <Link to="/register?role=business" id="hero-cta-business"
              className="btn-secondary text-base px-8 py-4">
              List Your Business →
            </Link>
          </div>

          {/* Social proof */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <div className="flex -space-x-2">
              {['#ef4444','#f59e0b','#10b981','#3b82f6'].map((c, i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: c, borderColor: '#080e17' }}>
                  {['A','S','M','K'][i]}
                </div>
              ))}
            </div>
            <span className="text-sm" style={{ color: '#7a90a8' }}>
              Trusted by <strong style={{ color: '#a0b4c8' }}>500+ businesses</strong> across Karachi
            </span>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-5xl mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <div className="text-3xl md:text-4xl font-black mb-1 gradient-text">{s.value}</div>
              <div className="text-sm" style={{ color: '#7a90a8' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="max-w-6xl mx-auto px-4 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-black mb-4" style={{ color: '#e8edf3' }}>
            Everything You Need to Scale
          </h2>
          <p className="text-base max-w-xl mx-auto" style={{ color: '#7a90a8' }}>
            Our AI-first approach protects your business while delivering a premium booking experience for your customers.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map(f => (
            <div key={f.title} className="card group">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-all duration-300"
                style={{ background: f.glow, color: f.color }}>
                {f.icon}
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: '#e8edf3' }}>{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#7a90a8' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Dual CTA ── */}
      <section className="max-w-6xl mx-auto px-4 pb-24">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Customer CTA */}
          <div className="relative overflow-hidden rounded-3xl p-8"
            style={{
              background: 'linear-gradient(135deg, #0f2540 0%, #091a2e 100%)',
              border: '1px solid rgba(59,130,246,0.2)',
            }}>
            <div className="glow-blob w-48 h-48 top-0 right-0 -translate-y-1/2 translate-x-1/2"
              style={{ background: 'rgba(59,130,246,0.2)' }} />
            <div className="relative z-10">
              <div className="w-10 h-10 rounded-xl mb-5 flex items-center justify-center"
                style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <h3 className="text-2xl font-black mb-2" style={{ color: '#e8edf3' }}>For Customers</h3>
              <p className="text-sm mb-6" style={{ color: '#7a90a8' }}>
                Book top salons, restaurants, and clinics in Karachi. Earn PAB tokens every time you show up.
              </p>
              <Link to="/register" id="cta-customer-section"
                className="btn-primary text-sm inline-flex">
                Sign Up Free →
              </Link>
            </div>
          </div>

          {/* Business CTA */}
          <div className="relative overflow-hidden rounded-3xl p-8"
            style={{
              background: 'linear-gradient(135deg, #052e1f 0%, #031a12 100%)',
              border: '1px solid rgba(16,185,129,0.2)',
            }}>
            <div className="glow-blob w-48 h-48 top-0 right-0 -translate-y-1/2 translate-x-1/2"
              style={{ background: 'rgba(16,185,129,0.2)' }} />
            <div className="relative z-10">
              <div className="w-10 h-10 rounded-xl mb-5 flex items-center justify-center"
                style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                </svg>
              </div>
              <h3 className="text-2xl font-black mb-2" style={{ color: '#e8edf3' }}>For Businesses</h3>
              <p className="text-sm mb-6" style={{ color: '#7a90a8' }}>
                Connect your Google Business profile. Accept bookings, eliminate no-shows, and grow your revenue.
              </p>
              <Link to="/register?role=business" id="cta-business-section"
                className="text-sm font-semibold px-5 py-3 rounded-xl inline-flex items-center gap-2 transition-all"
                style={{
                  background: 'rgba(16,185,129,0.15)',
                  color: '#34d399',
                  border: '1px solid rgba(52,211,153,0.25)',
                }}>
                List Your Business →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
