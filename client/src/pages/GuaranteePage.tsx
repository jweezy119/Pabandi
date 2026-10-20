import { Link } from 'react-router-dom';
import { GUARANTEE_STEPS, VaultLocked } from '../components/GuaranteeVisuals';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

/**
 * /guarantee — the escrow flow, on its own page.
 *
 * Standalone like the landing page: no dashboard chrome, because this page is
 * the sales document, not a feature. It explains four states of one deposit;
 * every other argument this product makes is a corollary of it.
 */
export default function GuaranteePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="landing guarantee-page">
      <div className="orbs-container" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
      </div>

      <header className="header">
        <div className="container">
          <Link to="/" className="logo">
            <span className="logo-mark">◈</span>
            <span>PabandiOS</span>
          </Link>
          {isAuthenticated ? (
            <Link to="/contact" className="cta-nav">Open My Vault</Link>
          ) : (
            <Link to="/signup?module=contact" className="cta-nav">Protect My Revenue</Link>
          )}
        </div>
      </header>

      <main>
        <section className="hero" aria-labelledby="guarantee-title">
          <div className="container">
            <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto' }}>
              <p className="hero-kicker">The guarantee</p>
              <h1 id="guarantee-title" className="hero-title" style={{ fontSize: 'clamp(2.2rem, 5vw, 3.6rem)' }}>
                Your time is the asset.<br />
                <span className="hero-accent">The deposit secures it.</span>
              </h1>
              <p className="hero-subtitle">
                A $5,000 wedding shoot, a $12,000 roof, a $40,000 retainer — every one of them
                begins with somebody holding a calendar slot open. Hold enough of them and the
                uncollected no-show is not an inconvenience; it is the difference between a
                financed quarter and a lost one.
              </p>
            </div>
          </div>
        </section>

        <div className="wave-divider"><svg viewBox="0 0 1200 60" preserveAspectRatio="none"><path className="wave-anim" d="M0,30 C200,50 400,10 600,30 C800,50 1000,10 1200,30 L1200,60 L0,60 Z" fill="var(--warm-sand)" /></svg></div>

        {/* The four moves */}
        <section aria-labelledby="flow-title" className="how-it-works">
          <div className="container">
            <h2 id="flow-title" className="section-title">One Deposit. Four Fates.</h2>
            <p className="section-subtitle">
              The money is not yours and it is not theirs. That is the whole trick — and it is what
              makes both sides stop pretending.
            </p>
            <div className="steps-container" style={{ gridTemplateColumns: undefined }}>
              {GUARANTEE_STEPS.map((step) => (
                <div key={step.n} className="step-card" style={{ textAlign: 'left' }}>
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ background: 'var(--warm-sand)' }}
                    >
                      <span className="material-symbols-outlined" style={{ color: 'var(--terracotta)' }}>{step.icon}</span>
                    </div>
                    <div className="step-number" style={{ margin: 0 }}>{step.n}</div>
                  </div>
                  <h3 className="step-title">{step.title}</h3>
                  <p className="step-desc">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="wave-divider"><svg viewBox="0 0 1200 60" preserveAspectRatio="none"><path className="wave-anim" d="M0,30 C200,50 400,10 600,30 C800,50 1000,10 1200,30 L1200,60 L0,60 Z" fill="var(--warm-sand)" /></svg></div>

        {/* What the client sees */}
        <section aria-labelledby="checkout-title" className="trust-section">
          <div className="container">
            <h2 id="checkout-title" className="section-title">What the Client Sees When They Book</h2>
            <p className="section-subtitle">
              Not a penalty. A reservation they can prove they made.
            </p>

            <div className="deposit-breakdown guarantee-demo-breakdown">
              <div className="deposit-row" style={{ justifyContent: 'space-between', padding: '12px 0' }}>
                <span style={{ color: 'var(--soft-stone)', fontSize: 14 }}>Wedding photography</span>
                <span className="money-number" style={{ fontSize: 20 }}>$3,000</span>
              </div>
              <div className="deposit-row" style={{ justifyContent: 'space-between', padding: '12px 0' }}>
                <span style={{ color: 'var(--soft-stone)', fontSize: 14 }}>Refundable deposit</span>
                <span className="money-number" style={{ fontSize: 20, color: 'var(--terracotta)' }}>$300 <span style={{ fontSize: 11, color: 'var(--soft-stone)' }}>locked in escrow</span></span>
              </div>
              <div className="deposit-row" style={{ justifyContent: 'space-between', padding: '12px 0' }}>
                <span style={{ color: 'var(--soft-stone)', fontSize: 14 }}>Due on arrival</span>
                <span className="money-number" style={{ fontSize: 20 }}>$2,700</span>
              </div>
            </div>

            <div style={{ maxWidth: 420, margin: '48px auto 0' }}>
              <VaultLocked amount={300} />
              <p className="section-subtitle" style={{ marginTop: 16, fontSize: 14 }}>
                If they show up, the $300 goes toward the final bill. If they cancel last minute,
                you keep it. Either way, the slot held for them was never free.
              </p>
            </div>
          </div>
        </section>

        <div className="wave-divider"><svg viewBox="0 0 1200 60" preserveAspectRatio="none"><path className="wave-anim" d="M0,30 C200,50 400,10 600,30 C800,50 1000,10 1200,30 L1200,60 L0,60 Z" fill="var(--warm-sand)" /></svg></div>

        {/* Built for */}
        <section aria-labelledby="who-title" className="trust-signals">
          <div className="container">
            <h2 id="who-title" className="section-title">Who This Is For</h2>
            <p className="section-subtitle">
              Anyone whose product is reserved time: photographers, contractors, roofers, agencies,
              event crews, consultants — and the AI agents that book on behalf of them.
            </p>
            <div className="trust-grid">
              {[
                { number: 'Weddings', label: 'Photographers', detail: 'A booked date is a season. Guard it.' },
                { number: 'Roofs', label: 'Contractors', detail: 'Crews dispatched on unsecured jobs lose twice.' },
                { number: 'Retainers', label: 'Agencies', detail: 'Commitments priced in months, not hours.' },
                { number: 'APIs', label: 'AI Agents', detail: 'Agents book with open sessions. Settlement happens once.' },
              ].map((item) => (
                <div key={item.label} className="trust-card">
                  <p className="trust-number">{item.number}</p>
                  <p className="trust-label">{item.label}</p>
                  <p className="trust-detail">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="wave-divider"><svg viewBox="0 0 1200 60" preserveAspectRatio="none"><path className="wave-anim" d="M0,30 C200,50 400,10 600,30 C800,50 1000,10 1200,30 L1200,60 L0,60 Z" fill="var(--warm-sand)" /></svg></div>

        <section className="cta-section" aria-labelledby="guarantee-cta">
          <div className="container">
            <h2 id="guarantee-cta" className="section-title">Stop Chasing. Start Securing.</h2>
            <p className="section-subtitle">Every departing no-show cashes out the guarantee's ROI.</p>
            {isAuthenticated ? (
              <button className="btn btn-large btn-primary" onClick={() => navigate('/contact')}>
                Open My Vault
              </button>
            ) : (
              <button className="btn btn-large btn-primary" onClick={() => navigate('/signup?module=contact')}>
                Protect My Revenue
              </button>
            )}
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container">
          <div className="footer-brand">
            <span className="logo-mark">◈</span>
            <span>PabandiOS</span>
          </div>
          <p className="footer-tagline">Deposits held in Solana escrow · Released by attendance, not by promises</p>
          <p className="footer-copy">© 2026 Pabandi. The high-ticket guarantee engine.</p>
        </div>
      </footer>
    </div>
  );
}
