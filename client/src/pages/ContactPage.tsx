import { Link } from 'react-router-dom';
import { User, Building2, Mail, Phone, MessageCircle, HelpCircle, ArrowRight } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--clay)]/20 bg-[var(--clay)]/10 px-4 py-1.5 text-sm font-medium text-[var(--clay)] mb-6">
            We're Here For You
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-[var(--warm-ink)] font-headline tracking-tight">
            How can we help?
          </h1>
          <p className="text-[var(--soft-stone)] mt-4 max-w-xl mx-auto text-lg">
            Whether you're a member managing a booking or a partner growing your business, we're ready to assist.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          <div className="bg-white/60 backdrop-blur-sm border border-[rgba(191,179,163,0.2)] rounded-2xl p-6 md:p-8 shadow-[var(--shadow-soft)]">
            <div className="w-12 h-12 rounded-xl bg-[var(--clay)]/10 flex items-center justify-center mb-4">
              <User size={22} className="text-[var(--clay)]" />
            </div>
            <h2 className="text-xl font-bold text-[var(--warm-ink)] font-headline mb-2">User Support</h2>
            <p className="text-[var(--soft-stone)] text-sm mb-5">
              Need help with a reservation, your Trust Score, or accessing your $PAB rewards? Our member success team is available 24/7.
            </p>
            <div className="space-y-3">
              <a href="mailto:jay@pabandi.com" className="flex items-center gap-2 text-sm font-medium text-[var(--warm-ink)] hover:text-[var(--clay)] transition-colors">
                <Mail size={14} className="text-[var(--clay)]" />
                jay@pabandi.com
              </a>
              <div className="flex items-center gap-2 text-sm text-[var(--soft-stone)]">
                <MessageCircle size={14} className="text-[var(--sage)]" />
                In-App Live Chat (avg. response: &lt; 2 mins)
              </div>
            </div>
          </div>

          <div className="bg-white/60 backdrop-blur-sm border border-[rgba(191,179,163,0.2)] rounded-2xl p-6 md:p-8 shadow-[var(--shadow-soft)]">
            <div className="w-12 h-12 rounded-xl bg-[var(--sage)]/10 flex items-center justify-center mb-4">
              <Building2 size={22} className="text-[var(--sage)]" />
            </div>
            <h2 className="text-xl font-bold text-[var(--warm-ink)] font-headline mb-2">Partner Success</h2>
            <p className="text-[var(--soft-stone)] text-sm mb-5">
              For business partners. Need help setting up your profile, understanding analytics, or managing escrow payouts?
            </p>
            <div className="space-y-3">
              <a href="mailto:jay@pabandi.com" className="flex items-center gap-2 text-sm font-medium text-[var(--warm-ink)] hover:text-[var(--sage)] transition-colors">
                <Mail size={14} className="text-[var(--sage)]" />
                jay@pabandi.com
              </a>
              <a href="tel:+18007222634" className="flex items-center gap-2 text-sm font-medium text-[var(--warm-ink)] hover:text-[var(--sage)] transition-colors">
                <Phone size={14} className="text-[var(--sage)]" />
                1-800-PABANDI
              </a>
              <a href="https://wa.me/18007222634" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-medium text-[var(--warm-ink)] hover:text-[var(--sage)] transition-colors">
                <MessageCircle size={14} className="text-[var(--sage)]" />
                Partner WhatsApp Support
              </a>
            </div>
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-sm border border-[rgba(191,179,163,0.2)] rounded-2xl p-6 md:p-8 text-center shadow-[var(--shadow-soft)] mb-8">
          <h3 className="text-lg font-bold text-[var(--warm-ink)] font-headline mb-2">Press & General Inquiries</h3>
          <p className="text-sm text-[var(--soft-stone)] mb-4">
            For media inquiries, brand partnerships, or investment opportunities.
          </p>
          <a href="mailto:hello@pabandi.com" className="inline-flex items-center gap-2 font-semibold text-[var(--clay)] hover:underline">
            <Mail size={14} />
            hello@pabandi.com
          </a>
        </div>

        <div className="border-t border-[rgba(191,179,163,0.15)] pt-8 text-center">
          <p className="text-sm text-[var(--soft-stone)] mb-4">Looking for quick answers?</p>
          <Link to="/support" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--warm-sand)]/50 text-sm font-semibold text-[var(--warm-ink)] hover:bg-[var(--warm-sand)] transition-colors">
            <HelpCircle size={16} />
            Visit Help Center
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
