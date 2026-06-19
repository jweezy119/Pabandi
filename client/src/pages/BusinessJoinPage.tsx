import { useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../services/api';
import { useLanguage } from '../context/LanguageContext';

// ── Icons ──────────────────────────────────────────────────────────────
const CheckIcon = () => (
  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

// ── Data ───────────────────────────────────────────────────────────────
const BENEFITS = [
  {
    icon: '🧠',
    color: '#3b82f6',
    glow: 'rgba(59,130,246,0.15)',
    title: 'AI No-Show Prediction', titleUrdu: 'AI No-Show Prediction',
    desc: 'Our proprietary machine learning engine analyzes behavioral signals to predict the probability of a no-show before it happens.', descUrdu: 'Hamara machine learning engine customers ke aane se pehle hi no-show ki paish-goi karta hai.',
  },
  {
    icon: '⛓️',
    color: '#14F195',
    glow: 'rgba(20,241,149,0.15)',
    title: 'Trustless Solana Escrow', titleUrdu: 'Solana Escrow ka Tahafuz',
    desc: 'Deposits are held securely in Solana smart contracts and instantly released to you if a customer no-shows — zero chargebacks.', descUrdu: 'Deposits Solana smart contracts mein mehfooz rehte hain aur agar customer no-show kare, to foran aapko mil jatay hain — no chargebacks.',
  },
  {
    icon: '🪙',
    color: '#9945FF',
    glow: 'rgba(153,69,255,0.15)',
    title: 'Earn $PAB Crypto Rewards', titleUrdu: '$PAB Crypto Inamaat Kamayen',
    desc: 'You earn $PAB tokens for every booking you honor. Accumulate tokens to unlock priority placement and governance rights.', descUrdu: 'Aap har mukammal booking par $PAB tokens kamatay hain. Tokens jama kar ke priority placement aur mazeed fawaid haasil karein.',
  },
  {
    icon: '🛡️',
    color: '#10b981',
    glow: 'rgba(16,185,129,0.15)',
    title: 'Pabandi Score Protection', titleUrdu: 'Pabandi Score Tahafuz',
    desc: 'Customers are scored by our AI based on their reliability. Bad actors are automatically blocked from making high-risk bookings.', descUrdu: 'Customers ka Pabandi Score AI banata hai. Kharab score walay high-risk bookings nahi kar saktay.',
  },
  {
    icon: '📊',
    color: '#ec4899',
    glow: 'rgba(236,72,153,0.15)',
    title: 'Real-Time Analytics', titleUrdu: 'Real-Time Tajziya',
    desc: 'Track your protected revenue, no-show reduction rates, and crypto earnings through your dedicated business dashboard.', descUrdu: 'Apne business dashboard se mehfooz aamdani, no-show mein kami, aur crypto earnings track karein.',
  },
  {
    icon: '⭐',
    color: '#f97316',
    glow: 'rgba(249,115,22,0.15)',
    title: 'Verified Google Reviews', titleUrdu: 'Tasdeeq-shuda Google Reviews',
    desc: 'Only customers who actually checked in via Pabandi can leave a review, protecting your reputation from fake bots.', descUrdu: 'Sirf wo customers review de saktay hain jinhon ne waqai visit kiya ho. Fake reviews se bachayen.',
  },
];

const INCENTIVES = [
  { emoji: '🎁', title: '6 Months Free', titleUrdu: '6 Mahinay Free', desc: 'Zero subscription fees for founding partners. No credit card required to start.', descUrdu: 'Founding partners ke liye 6 mahinay muft. Credit card ki zaroorat nahi.' },
  { emoji: '🏅', title: 'Founding Business Badge', titleUrdu: 'Founding Business Badge', desc: 'A permanent "Founding Partner" badge on your profile, visible to all customers.', descUrdu: 'Aapki profile par "Founding Partner" badge jo hamesha nazar aayega.' },
  { emoji: '📌', title: 'Featured Listing', titleUrdu: 'Featured Listing', desc: 'Your business appears at the top of search results in your category for 6 months.', descUrdu: 'Aap ka business 6 mahinay tak search results mein sab se oopar nazar aayega.' },
  { emoji: '📞', title: 'Dedicated Setup Support', titleUrdu: 'Khusoosi Setup Support', desc: 'Our team personally sets up your business profile. You don\'t have to do anything technical.', descUrdu: 'Hamari team aapki profile setup karegi. Aapko kuch technical karne ki zaroorat nahi.' },
];

const STEPS = [
  { num: '01', title: 'Fill in the form below', titleUrdu: 'Neechay diya gaya form pur karein', desc: 'Business name, category, and contact details. Takes 2 minutes.', descUrdu: 'Business ka naam, category, aur contact details dein. Sirf 2 minute lagenge.' },
  { num: '02', title: 'We set up your profile', titleUrdu: 'Hum aapki profile banayenge', desc: 'Our team builds your full profile, syncs with Google Maps, and handles all technical setup.', descUrdu: 'Hamari team aapki profile mukammal karegi, Google Maps link karegi, aur technical kaam sambhalegi.' },
  { num: '03', title: 'Start receiving bookings', titleUrdu: 'Bookings wasool karna shuru karein', desc: 'Share your unique Pabandi link. Customers book, you get notified instantly.', descUrdu: 'Apna Pabandi link share karein. Customer book karega, aur aapko foran notification milega.' },
];

const CATEGORIES = [
  { en: 'Restaurant', ur: 'Restaurant' },
  { en: 'Cafe', ur: 'Cafe' },
  { en: 'Salon', ur: 'Salon' },
  { en: 'Spa', ur: 'Spa' },
  { en: 'Clinic', ur: 'Clinic' },
  { en: 'Fitness Center', ur: 'Fitness Center' },
  { en: 'Event Venue', ur: 'Event Venue' },
  { en: 'Other', ur: 'Deegar' }
];

// ── Component ──────────────────────────────────────────────────────────
export default function BusinessJoinPage() {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    businessName: '', ownerName: '', phone: '', email: '', category: '', city: '',
    country: 'United States',
    password: '', confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessName || !form.ownerName || !form.phone || !form.email || !form.category) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!form.password || form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      // Store interest lead in database via the auth register flow
      // or a dedicated /leads endpoint — for now we use register + business creation
      await apiClient.post('/auth/register', {
        email: form.email,
        password: form.password,
        firstName: form.ownerName.split(' ')[0] || form.ownerName,
        lastName: form.ownerName.split(' ').slice(1).join(' ') || '.',
        phone: form.phone,
        role: 'BUSINESS_OWNER',
        businessName: form.businessName,
      });
      setSubmitted(true);
    } catch (err: any) {
      const msg = err.response?.data?.message || '';
      if (msg.includes('already exists')) {
        setError('An account with this email already exists. Please sign in instead.');
      } else {
        setError(msg || 'Something went wrong. Please try again or call us at +1 (800) 000-0000.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div 
        style={{ 
          background: '#080e17', 
          color: '#edf1f5',
          ['--color-bg' as any]: '#080e17',
          ['--color-text' as any]: '#edf1f5',
          ['--color-text-muted' as any]: '#9e9e9e',
          ['--color-surface' as any]: '#0f172a',
          ['--color-surface-raised' as any]: '#1e293b',
          minHeight: '100vh' 
        }} 
        className="flex items-center justify-center p-6"
      >
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🎉</div>
          <h2 className="text-3xl font-black mb-3 text-[#e8e8e8]" >{t("You're In!", "Aap Shamil Ho Gaye!")}</h2>
          <p className="text-base mb-2 text-[#757575]" >
            {t("Welcome to Pabandi", "Pabandi mein Khush Aamdeed")}, <span style={{ fontWeight: 700 }}>{form.businessName}</span>!
          </p>
          <p className="text-sm mb-8 text-[#9e9e9e]" >
            {t("Our team will WhatsApp you at", "Hamari team aapko")} <strong className="text-[#616161]">{form.phone}</strong> {t("within 24 hours to complete your setup — completely free.", "par 24 ghanton mein WhatsApp karegi aapka setup mukammal karne ke liye — bilkul muft.")}
          </p>
          <div className="rounded-2xl p-5 mb-8 text-left space-y-3"
            style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}>
            {[
              t('6 months free — activated', '6 mahinay muft — active ho gaya'), 
              t('Founding Business badge — reserved', 'Founding Business badge — mehfooz ho gaya'), 
              t('Featured listing — queued', 'Featured listing — qataar mein hai')
            ].map(item => (
              <div key={item} className="flex items-center gap-3 text-sm font-medium" style={{ color: '#34d399' }}>
                <CheckIcon /> {item}
              </div>
            ))}
          </div>
          <Link to="/" className="btn-secondary text-sm">← {t("Back to Home", "Wapas Home Par")}</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      background: '#080e17', 
      color: '#edf1f5',
      ['--color-bg' as any]: '#080e17',
      ['--color-text' as any]: '#edf1f5',
      ['--color-text-muted' as any]: '#9e9e9e',
      ['--color-surface' as any]: '#0f172a',
      ['--color-surface-raised' as any]: '#1e293b'
    }}>

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b" style={{ background: 'rgba(8,14,23,0.9)', backdropFilter: 'blur(20px)', borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs text-white"
              style={{ background: 'linear-gradient(135deg,#0ea5e9, #14b8a6)' }}>P</div>
            <span className="font-bold text-sm text-[#e8e8e8]" >Pabandi</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-xs font-medium text-[#9e9e9e]" >{t("Sign in", "Log in karein")}</Link>
            <a href="#join-form" className="btn-primary text-xs py-2 px-4">{t("Get Started Free", "Muft Shuru Karein")}</a>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-24 pb-20 px-4">
        <div className="glow-blob w-[600px] h-[600px] top-[-200px] left-1/2 -translate-x-1/2"
          style={{ background: 'rgba(37,99,235,0.1)', position: 'absolute', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' }} />
        <div className="glow-blob w-[400px] h-[400px] bottom-0 right-0"
          style={{ background: 'rgba(124,58,237,0.08)', position: 'absolute', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' }} />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          {/* Founding badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-xs font-bold tracking-widest uppercase"
            style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          {t("Founding Partner Program — 🇺🇸 USA & 🇵🇰 Pakistan", "Founding Partner Program — 🇺🇸 USA aur 🇵🇰 Pakistan")}
          </div>

          <h1 className="text-5xl sm:text-6xl font-black leading-tight mb-6 text-[#e8e8e8]" >
            {t("Protect Your Revenue.", "Apni Aamdani Mehfooz Karein.")}<br />
            <span style={{ background: 'linear-gradient(135deg,#0ea5e9, #14F195)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {t("Eliminate No-Shows with AI.", "AI ke zariye No-Shows khatam karein.")}
            </span>
          </h1>

          <p className="text-lg max-w-2xl mx-auto mb-10" style={{ lineHeight: 1.7 }}>
            {t("Pabandi is the Web3-powered reservation platform that uses predictive AI and Solana smart contracts to guarantee your bookings.", "Pabandi aik Web3 reservation platform hai jo predictive AI aur Solana smart contracts ka istemaal kar ke aapki bookings ki zamanat deta hai.")}
            <strong className="text-[#14F195]"> {t("Zero Chargebacks. 100% Protection.", "Zero Chargebacks. 100% Tahafuz.")} </strong>
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <a href="#join-form" className="btn-primary text-base px-8 py-4">
              {t("Claim Your Free Spot →", "Apni Muft Jagah Reserve Karein →")}
            </a>
            <div className="flex items-center gap-2 text-sm text-[#9e9e9e]" >
              <div className="flex -space-x-2">
                {['🍽️','💇','🏋️'].map((e) => (
                  <div key={e} className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm"
                    style={{ borderColor: 'var(--color-bg)', background: 'var(--color-surface-raised)' }}>{e}</div>
                ))}
              </div>
              <span>{t("Join", "Shamil hon")} <strong className="text-[#616161]">50+ {t("businesses", "businesses")}</strong> {t("already on the waitlist", "jo pehle se waitlist par hain")}</span>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { val: t('Forever', 'Hamesha'), label: t('Base CRM Free', 'Base CRM Muft') },
              { val: '98%', label: t('Show-up Rate', 'Aane ka Tanasub') },
              { val: t('2 min', '2 minute'), label: t('Setup Time', 'Setup ka Waqt') },
              { val: '24/7', label: t('Support', 'Madad') },
            ].map(s => (
              <div key={s.val + s.label} className="rounded-2xl p-4"
                style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-2xl font-black mb-1" style={{ color: '#e8e8e8' }}>{s.val}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Incentives ──────────────────────────────────────────── */}
      <section className="py-20 px-4" style={{ background: 'var(--color-surface)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#00FFB0' }}>{t("Founding Partner Perks", "Founding Partner Fawaid")}</p>
            <h2 className="text-4xl font-black mb-4" style={{ color: '#e8e8e8', fontFamily: 'Space Grotesk, sans-serif' }}>{t("Start For Free. Pay When You Win.", "Muft Shuru Karein. Kamyabi Par Pay Karein.")}</h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: 'var(--color-text-muted)' }}>
              {t("Join the first 100 businesses to unlock our Base CRM forever free. Upgrade to our Outcome-Based AI protection when you're ready to eliminate no-shows for good.", "Pehle 100 businesses mein shamil hon aur hamara Base CRM hamesha ke liye muft hasil karein. Jab aap no-shows ko mukammal khatam karna chahein to hamari Outcome-Based AI protection par upgrade karein.")}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {INCENTIVES.map(inc => (
              <div key={inc.title} className="rounded-2xl p-6 flex items-start gap-5"
                style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="text-3xl shrink-0">{inc.emoji}</div>
                <div>
                  <h3 className="font-bold text-base mb-1.5" style={{ color: '#e8e8e8' }}>{t(inc.title, inc.titleUrdu)}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{t(inc.desc, inc.descUrdu)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Urgency bar */}
          <div className="mt-8 rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div>
              <p className="font-bold text-sm" style={{ color: '#fbbf24' }}>⚡ {t("Only 63 founding spots remaining", "Sirf 63 founding spots baqi hain")}</p>
              <p className="text-xs mt-0.5" style={{ color: '#d97706' }}>{t("Spots are going fast. Sign up today to lock in your free Base CRM forever.", "Spots tezi se bhar rahi hain. Aaj hi sign up karein aur apna Base CRM hamesha ke liye muft hasil karein.")}</p>
            </div>
            <a href="#join-form" className="btn-primary text-sm px-6 py-2.5 shrink-0">
              {t("Reserve My Spot", "Apni Jagah Mehfooz Karein")}
            </a>
          </div>
        </div>
      </section>

      {/* ── Deep Dive: Why Partner With Us ──────────────────────── */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto space-y-20">
          
          {/* Financial Impact */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#ec4899' }}>{t("The Financial Impact", "Maali Asraat")}</p>
              <h2 className="text-3xl font-black mb-4 text-[#e8e8e8] leading-tight">{t("Stop Losing 20% of Your Revenue to No-Shows", "No-Shows ki wajah se 20% Aamdani Khona Band Karein")}</h2>
              <p className="text-base text-[#757575] leading-relaxed mb-6">
                {t("The average service business loses thousands of dollars a month to last-minute cancellations and ghosting. Our AI engine instantly evaluates the risk of every booking. If a customer is high-risk, we automatically lock a deposit in a Solana smart contract. If they don't show, you get paid instantly. Zero chargebacks, guaranteed.", "Aam tor par service business aakhri waqt ki cancellations se hazaron dollar khota hai. Hamara AI engine har booking ka risk janchta hai. Agar customer high-risk ho, to hum Solana smart contract mein deposit lock kar dete hain. Agar wo na aaye to aapko foran paisay mil jate hain. Zero chargebacks, zamanat ke sath.")}
              </p>
            </div>
            <div className="rounded-2xl p-8 border border-[rgba(236,72,153,0.2)] bg-[rgba(236,72,153,0.05)] relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-pink-500/20 blur-3xl rounded-full"></div>
              <h3 className="font-bold text-lg text-white mb-4 relative z-10">{t("Average Monthly Recovery", "Ost Mahana Wapsi")}</h3>
              <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-rose-400 relative z-10 mb-2">
                +$4,200
              </div>
              <p className="text-sm text-pink-200/80 relative z-10">{t("Based on 15 saved bookings per month.", "Mahana 15 bachi hui bookings ki bunyad par.")}</p>
            </div>
          </div>

          {/* Marketing Impact */}
          <div className="grid md:grid-cols-2 gap-12 items-center flex-row-reverse">
            <div className="order-2 md:order-1 rounded-2xl p-8 border border-[rgba(16,185,129,0.2)] bg-[rgba(16,185,129,0.05)] relative overflow-hidden">
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-500/20 blur-3xl rounded-full"></div>
              <h3 className="font-bold text-lg text-white mb-4 relative z-10">{t("High-Intent Traffic", "Ziada Pukhta Iraday wali Traffic")}</h3>
              <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-sm text-emerald-100/70">{t("Average Pabandi Score", "Ost Pabandi Score")}</span>
                  <span className="text-emerald-400 font-bold">810 {t("(Elite)", "(Aala)")}</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-sm text-emerald-100/70">{t("Show-up Rate", "Aane ka Tanasub")}</span>
                  <span className="text-emerald-400 font-bold">99.2%</span>
                </div>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#10b981' }}>{t("The Marketing Funnel", "Marketing Funnel")}</p>
              <h2 className="text-3xl font-black mb-4 text-[#e8e8e8] leading-tight">{t("Attract the Best Customers in Your City", "Apne Shehar ke Behtareen Customers ko Mutawajjah Karein")}</h2>
              <p className="text-base text-[#757575] leading-relaxed mb-6">
                {t("Pabandi isn't just a booking tool; it's a vetted network. By partnering with us, your business is placed in front of users who have proven their reliability through their high Pabandi Scores. Better customers mean higher spend per ticket and zero wasted time.", "Pabandi sirf ek booking tool nahi hai; ye aik tasdeeq shuda network hai. Hamare sath partner banne se, aapka business un users ke samne pesh hota hai jinhon ne apne high Pabandi Scores se khud ko qabil-e-aitamad sabit kiya hai. Behtar customers ka matlab hai zyada kharch aur waqt ka zaya na hona.")}
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* ── Industry Matrix ─────────────────────────────────────── */}
      <section className="py-20 px-4" style={{ background: 'var(--color-bg)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#0ea5e9' }}>{t("Tailored Protection", "Makhsoos Tahafuz")}</p>
            <h2 className="text-4xl font-black mb-4 text-[#e8e8e8]">{t("How the Matrix Protects Your Industry", "Matrix Aapke Industry Ko Kaise Bachata Hai")}</h2>
            <p className="text-base text-[#757575] max-w-2xl mx-auto leading-relaxed">
              {t("Different businesses face different risks. The Trust Matrix dynamically weighs the four data layers to provide custom, outcome-based protection for your specific avenue of business.", "Mukhtalif businesses ko mukhtalif khatraat hote hain. Trust Matrix char data layers ko istemaal kar ke aapke business ke mutabiq custom, nateeja-khez tahafuz faraham karta hai.")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            
            {/* Fine Dining */}
            <div className="rounded-3xl p-8 relative overflow-hidden group" style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/20 transition-all"></div>
              <div className="text-4xl mb-4 relative z-10">🍽️</div>
              <h3 className="text-xl font-bold text-[#e8e8e8] mb-2 relative z-10">{t("Fine Dining & Restaurants", "Fine Dining aur Restaurants")}</h3>
              <p className="text-sm text-[#9e9e9e] leading-relaxed mb-4 relative z-10">
                {t("Empty tables during peak hours devastate margins. For dining, the Matrix heavily weighs the", "Peak hours mein khali tables nuqsan deh hote hain. Dining ke liye, Matrix ")} <strong className="text-blue-400">{t("Historical Show Rate", "Pichli Haazri ki Sharah")}</strong> {t("to filter out chronic no-showers and ensure high-demand slots are filled by reliable patrons.", "par ziada zor deta hai taake aadi no-showers ko filter kiya ja sake aur ahem slots qabil-e-aitamad gahkon se bhare jayen.")}
              </p>
            </div>

            {/* Salons & Spas */}
            <div className="rounded-3xl p-8 relative overflow-hidden group" style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-pink-500/20 transition-all"></div>
              <div className="text-4xl mb-4 relative z-10">💇</div>
              <h3 className="text-xl font-bold text-[#e8e8e8] mb-2 relative z-10">{t("Salons & Spas", "Salons aur Spas")}</h3>
              <p className="text-sm text-[#9e9e9e] leading-relaxed mb-4 relative z-10">
                {t("A late cancellation leaves high-value block times unfillable. For salons, the Matrix focuses on", "Der se cancellation ahem block times ko khali chhor deti hai. Salons ke liye, Matrix ")} <strong className="text-pink-400">{t("Cancellation Lead Time", "Cancellation Lead Time")}</strong>{t(", automatically requiring escrow deposits from users who frequently cancel at the last minute.", "par tawajjo deta hai, un users se automatically escrow deposit mangta hai jo aksar aakhri waqt par cancel karte hain.")}
              </p>
            </div>

            {/* Event Venues */}
            <div className="rounded-3xl p-8 relative overflow-hidden group" style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-purple-500/20 transition-all"></div>
              <div className="text-4xl mb-4 relative z-10">🎪</div>
              <h3 className="text-xl font-bold text-[#e8e8e8] mb-2 relative z-10">{t("Event Venues & Planners", "Event Venues aur Planners")}</h3>
              <p className="text-sm text-[#9e9e9e] leading-relaxed mb-4 relative z-10">
                {t("Huge deposits and massive revenue are at stake. For venues, the Matrix prioritizes", "Baray deposits aur bhari aamdani dao par hoti hai. Venues ke liye, Matrix ")} <strong className="text-purple-400">{t("Verified Identity (KYC)", "Tasdeeq shuda Shanakht (KYC)")}</strong> {t("and", "aur")} <strong className="text-purple-400">{t("Social Graph Analytics", "Social Graph Analytics")}</strong> {t("to guarantee that large bookings are backed by real, vetted individuals.", "ko tarjeeh deta hai taake bari bookings ke peechay asli, janchay hue afraad hon.")}
              </p>
            </div>

            {/* Clinics */}
            <div className="rounded-3xl p-8 relative overflow-hidden group" style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-emerald-500/20 transition-all"></div>
              <div className="text-4xl mb-4 relative z-10">🩺</div>
              <h3 className="text-xl font-bold text-[#e8e8e8] mb-2 relative z-10">{t("Clinics & Healthcare", "Clinics aur Healthcare")}</h3>
              <p className="text-sm text-[#9e9e9e] leading-relaxed mb-4 relative z-10">
                {t("Patient flow integrity is critical for both revenue and care delivery. The Matrix looks at", "Mareezon ka bahao aamdani aur dekh bhal dono ke liye ahem hai. Matrix ")} <strong className="text-emerald-400">{t("Consistent Reliability", "Musalsal Qabiliyat")}</strong> {t("across the ecosystem to ensure high-priority appointment slots are respected.", "par nazar rakhta hai taake aham appointment slots ka ehtaram ho.")}
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── API & Integrations ──────────────────────────────────── */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#8b5cf6' }}>{t("Seamless Integration", "Bagair Kisi Rukawat Ke Integration")}</p>
            <h2 className="text-4xl font-black mb-4 text-[#e8e8e8]">{t("Connect Your Ecosystem", "Apne Ecosystem Ko Joriye")}</h2>
            <p className="text-base text-[#757575] max-w-2xl mx-auto leading-relaxed">
              {t("Whether you are a solo operator using our Free CRM, or an enterprise needing direct API access, Pabandi connects seamlessly.", "Chahe aap hamara Free CRM istemaal karne walay solo operator hon, ya direct API access chahne wali enterprise, Pabandi asani se connect ho jata hai.")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="rounded-3xl p-8 border border-white/10" style={{ background: 'var(--color-surface-raised)' }}>
              <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center mb-6">
                <span className="material-symbols-outlined">developer_board</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">{t("Enterprise API & SDKs", "Enterprise API aur SDKs")}</h3>
              <p className="text-slate-400 mb-6 leading-relaxed">
                {t("Add our Trust Matrix directly to your existing app. Pay only for what you use with our Pay-As-You-Go pricing model, and accept fiat or $PAB token natively.", "Hamara Trust Matrix direct apni mojooda app mein shamil karein. Hamare Pay-As-You-Go pricing model ke sath sirf utna pay karein jitna istemaal karein, aur fiat ya $PAB token qabool karein.")} 
              </p>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="text-blue-400 material-symbols-outlined text-[18px]">check_circle</span>
                  {t("Node.js / TypeScript SDK", "Node.js / TypeScript SDK")}
                </li>
                <li className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="text-blue-400 material-symbols-outlined text-[18px]">check_circle</span>
                  {t("Real-time Webhook Events", "Real-time Webhook Events")}
                </li>
              </ul>
              <a href="#" className="text-blue-400 text-sm font-bold hover:underline flex items-center gap-1">{t("View API Docs", "API Docs Dekhein")} <span className="material-symbols-outlined text-[16px]">arrow_forward</span></a>
            </div>

            <div className="rounded-3xl p-8 border border-white/10" style={{ background: 'var(--color-surface-raised)' }}>
              <div className="w-12 h-12 bg-purple-500/20 text-purple-400 rounded-xl flex items-center justify-center mb-6">
                <span className="material-symbols-outlined">widgets</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">{t("Open Source CRM Integration", "Open Source CRM Integration")}</h3>
              <p className="text-slate-400 mb-6 leading-relaxed">
                {t("Connect your free Pabandi account to powerful open-source CRMs like Odoo or Cal.com. Manage your schedule and pipeline with zero monthly fees.", "Apne muft Pabandi account ko taqatwar open-source CRMs jaise Odoo ya Cal.com se joriye. Bagair kisi mahana fee ke apna schedule manage karein.")}
              </p>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="text-purple-400 material-symbols-outlined text-[18px]">check_circle</span>
                  {t("Native Odoo Community Sync", "Native Odoo Community Sync")}
                </li>
                <li className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="text-purple-400 material-symbols-outlined text-[18px]">check_circle</span>
                  {t("Cal.com Scheduling Infrastructure", "Cal.com Scheduling Infrastructure")}
                </li>
              </ul>
              <a href="#" className="text-purple-400 text-sm font-bold hover:underline flex items-center gap-1">{t("Explore CRM Partners", "CRM Partners Explore Karein")} <span className="material-symbols-outlined text-[16px]">arrow_forward</span></a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Benefits ────────────────────────────────────────────── */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest mb-3 text-[#9e9e9e]" >{t("Platform Features", "Platform ki Khususiyat")}</p>
            <h2 className="text-4xl font-black text-[#e8e8e8]" >{t("Next-Gen Web3 Infrastructure", "Nai Nasal ka Web3 Infrastructure")}</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {BENEFITS.map(b => (
              <div key={b.title} className="rounded-2xl p-6 transition-transform hover:-translate-y-1"
                style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-4"
                  style={{ background: b.glow }}>
                  {b.icon}
                </div>
                <h3 className="font-bold text-base mb-2 text-[#e8e8e8]" >{t(b.title, b.titleUrdu)}</h3>
                <p className="text-sm leading-relaxed text-[#757575]" >{t(b.desc, b.descUrdu)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────── */}
      <section className="py-20 px-4" style={{ background: 'var(--color-surface)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest mb-3 text-[#9e9e9e]" >{t("Getting Started", "Shuruaat Kaise Karein")}</p>
            <h2 className="text-4xl font-black text-[#e8e8e8]" >{t("Live in 24 Hours", "24 Ghanton Mein Live")}</h2>
          </div>

          <div className="space-y-4">
            {STEPS.map((step) => (
              <div key={step.num} className="rounded-2xl p-6 flex items-start gap-6"
                style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="text-3xl font-black shrink-0" style={{ color: 'rgba(59,130,246,0.3)', fontVariantNumeric: 'tabular-nums' }}>
                  {step.num}
                </div>
                <div>
                  <h3 className="font-bold text-base mb-1 text-[#e8e8e8]" >{t(step.title, step.titleUrdu)}</h3>
                  <p className="text-sm text-[#757575]" >{t(step.desc, step.descUrdu)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sign-Up Form ─────────────────────────────────────────── */}
      <section id="join-form" className="py-24 px-4">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-xs font-bold tracking-widest uppercase"
              style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399' }}>
              🎁 {t("6 Months Free · No Credit Card", "6 Mahinay Free · Credit Card Ki Zaroorat Nahi")}
            </div>
            <h2 className="text-4xl font-black mb-3 text-[#e8e8e8]" >{t("Claim Your Free Spot", "Apni Muft Jagah Reserve Karein")}</h2>
            <p className="text-sm text-[#757575]" >
              {t("Fill in your details and our team will WhatsApp you within 24 hours to complete setup.", "Apni tafseelat darj karein aur hamari team aapka setup mukammal karne ke liye 24 ghanton mein WhatsApp karegi.")}
            </p>
          </div>

          <div className="rounded-2xl p-8"
            style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.08)' }}>

            {error && (
              <div className="mb-5 px-4 py-3 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
                {t(error, error)}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-[#9e9e9e]" >{t("Business Name", "Business Ka Naam")}</label>
                <input name="businessName" value={form.businessName} onChange={handleChange}
                  placeholder={t("e.g. Kolachi Restaurant", "Mislan: Kolachi Restaurant")}
                  className="input-field w-full" />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-[#9e9e9e]" >{t("Owner / Manager Name", "Malik / Manager Ka Naam")}</label>
                <input name="ownerName" value={form.ownerName} onChange={handleChange}
                  placeholder={t("Your full name", "Aapka poora naam")}
                  className="input-field w-full" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-[#9e9e9e]" >{t("WhatsApp Number", "WhatsApp Number")}</label>
                  <input name="phone" value={form.phone} onChange={handleChange}
                    placeholder="+1 (555) 000-0000"
                    className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-[#9e9e9e]" >{t("Email", "Email")}</label>
                  <input name="email" type="email" value={form.email} onChange={handleChange}
                    placeholder="you@business.com"
                    className="input-field w-full" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-[#9e9e9e]" >{t("Category", "Category")}</label>
                  <select name="category" value={form.category} onChange={handleChange}
                    className="input-field w-full appearance-none">
                    <option value="" disabled>{t("Select...", "Muntakhib karein...")}</option>
                    {CATEGORIES.map(c => <option key={c.en} value={c.en.toUpperCase().replace(' ', '_')}>{t(c.en, c.ur)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-[#9e9e9e]" >{t("Country", "Mulk")}</label>
                  <select name="country" value={form.country} onChange={handleChange}
                    className="input-field w-full appearance-none">
                    <option value="United States">🇺🇸 United States</option>
                    <option value="Pakistan">🇵🇰 Pakistan</option>
                  </select>
                </div>
              </div>

              {/* Password row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-[#9e9e9e]" >{t("Password", "Password")}</label>
                  <div className="relative">
                    <input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={handleChange}
                      placeholder={t("Min. 8 characters", "Kam az kam 8 huroof")}
                      className="input-field w-full pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold transition-colors text-[#e8e8e8]" >
                      {showPassword ? t('Hide', 'Chupayen') : t('Show', 'Dekhayen')}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-[#9e9e9e]" >{t("Confirm Password", "Password Tasdeeq Karein")}</label>
                  <input
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={handleChange}
                    placeholder={t("Repeat password", "Password dobara likhein")}
                    className="input-field w-full"
                  />
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="btn-primary w-full py-4 text-base font-bold mt-2">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t("Submitting...", "Jama kiya ja raha hai...")}
                  </span>
                ) : `🎉 ${t('Claim My Free 6 Months', 'Apne 6 Mahinay Free Claim Karein')}`}
              </button>

              <p className="text-center text-xs text-[#e8e8e8]" >
                {t("No credit card · No contracts · Cancel anytime", "No credit card · Koi contract nahi · Kabhi bhi cancel karein")}
              </p>
            </form>
          </div>

          {/* Trust row */}
          <div className="mt-8 flex items-center justify-center gap-6 flex-wrap">
            {[
              t('🔒 Secure & Private', '🔒 Mehfooz aur Niji'), 
              t('🇺🇸 Built for the USA', '🇺🇸 USA ke liye banaya gaya'), 
              t('⚡ Live in 24hrs', '⚡ 24 ghanton mein Live')
            ].map(txt => (
              <span key={txt} className="text-xs font-medium text-[#e8e8e8]" >{txt}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t py-8 px-4 text-center"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <p className="text-xs">© 2026 Pabandi · {t("United States", "United States")} · <a href="mailto:hello@pabandi.com" className="hover:text-blue-400 transition-colors">hello@pabandi.com</a></p>
      </footer>

    </div>
  );
}
