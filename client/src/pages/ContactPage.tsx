import { Link } from 'react-router-dom';
import { tokens } from '../design-system';

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 md:px-8 space-y-6 sm:space-y-8 sm:space-y-12 sm:space-y-16 font-body" style={{ background: tokens.color.background, color: tokens.color.text }}>
      
      {/* Header */}
      <section className="mx-auto max-w-3xl text-center space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-500/15 px-3 py-1 font-label text-sm text-indigo-300">
          We're Here For You
        </div>
        <h1 className="font-headline text-[3rem] leading-[1.1] font-bold tracking-tight text-on-surface md:text-[4rem]">
          How can we help?
        </h1>
        <p className="text-xl leading-relaxed text-white/70">
          At Pabandi, we obsess over your experience. Whether you're a VIP member managing a booking or a founding partner growing your business, our dedicated teams are ready to assist you.
        </p>
      </section>

      {/* Contact Channels Grid */}
      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 sm:p-8">
        
        {/* Customer Support */}
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.03] p-5 shadow-sm transition-all hover:-translate-y-[2px] hover:border-white/10 sm:p-8 md:p-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-indigo-400/20 bg-indigo-500/10">
            <span className="text-2xl">👤</span>
          </div>
          <div>
            <h2 className="font-headline mb-2 text-2xl font-bold text-on-surface">User Support</h2>
            <p className="font-body mb-6 text-white/70">
              Need help with a reservation, your Pabandi Score, or accessing your $PAB rewards? Our member success team is available 24/7.
            </p>
            <div className="space-y-4">
              <a href="mailto:support@pabandi.com" className="flex items-center gap-3 text-on-surface transition-colors hover:text-primary font-semibold">
                support@pabandi.com
              </a>
              <div className="flex items-center gap-3 font-semibold text-on-surface">
                In-App Live Chat (Average response time: &lt; 2 mins)
              </div>
            </div>
          </div>
        </div>

        {/* Business Support */}
        <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-5 shadow-sm transition-all hover:-translate-y-[2px] hover:border-emerald-500/30 sm:p-8 md:p-10 relative overflow-hidden">
          <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/20">
            <span className="text-2xl" style={{ color: '#10b981' }}>🏪</span>
          </div>
          <div className="relative z-10">
            <h2 className="font-headline mb-2 text-2xl font-bold text-on-surface">Partner Success</h2>
            <p className="font-body mb-6 text-white/70">
              For our business partners. Need help setting up your profile, understanding analytics, or managing escrow payouts? Reach your dedicated account manager.
            </p>
            <div className="space-y-4">
              <a href="mailto:sales@pabandi.com" className="flex items-center gap-3 text-on-surface transition-colors font-semibold" style={{ color: '#10b981' }}>
                sales@pabandi.com
              </a>
              <a href="tel:+18007222634" className="flex items-center gap-3 text-on-surface transition-colors font-semibold" style={{ color: '#10b981' }}>
                1-800-PABANDI
              </a>
              <a href="https://wa.me/18007222634" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-on-surface transition-colors font-semibold" style={{ color: '#10b981' }}>
                Partner WhatsApp Support
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* General Inquiries */}
      <section className="mx-auto max-w-2xl rounded-3xl border border-white/[0.07] bg-white/[0.03] p-5 text-center sm:p-8">
        <h3 className="font-headline mb-2 text-xl font-bold text-on-surface">Press & General Inquiries</h3>
        <p className="font-body mb-4 text-sm text-white/70">
          For media inquiries, brand partnerships, or investment opportunities, please contact our corporate team.
        </p>
        <a href="mailto:hello@pabandi.com" className="inline-flex items-center gap-2 font-bold hover:underline" style={{ color: tokens.color.primary }}>
          hello@pabandi.com
        </a>
      </section>

      {/* FAQ Link */}
      <section className="border-t border-white/10 pt-8 text-center">
        <p className="font-body mb-4 text-white/70">Looking for quick answers?</p>
        <Link to="/" className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-200 transition-colors hover:bg-white/10">
          Visit our Help Center
        </Link>
      </section>

    </div>
  );
}
