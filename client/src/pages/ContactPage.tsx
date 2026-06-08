import { Link } from 'react-router-dom';

export default function ContactPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 md:px-8 py-12 md:py-20 space-y-16">
      
      {/* Header */}
      <section className="text-center max-w-3xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-label text-sm mb-2">
          <span className="material-symbols-outlined text-[16px]">support_agent</span>
          We're Here For You
        </div>
        <h1 className="font-headline text-[3rem] md:text-[4rem] leading-[1.1] font-bold text-on-surface tracking-tight">
          How can we help?
        </h1>
        <p className="font-body text-xl text-on-surface-variant leading-relaxed">
          At Pabandi, we obsess over your experience. Whether you're a VIP member managing a booking or a founding partner growing your business, our dedicated teams are ready to assist you.
        </p>
      </section>

      {/* Contact Channels Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Customer Support */}
        <div className="bg-surface-container-low rounded-3xl p-8 md:p-10 border border-outline-variant/20 shadow-sm flex flex-col items-start gap-6 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
            <span className="material-symbols-outlined text-primary text-2xl">person</span>
          </div>
          <div>
            <h2 className="font-headline text-2xl font-bold text-on-surface mb-2">User Support</h2>
            <p className="font-body text-on-surface-variant mb-6">
              Need help with a reservation, your Pabandi Score, or accessing your $PAB rewards? Our member success team is available 24/7.
            </p>
            <div className="space-y-4">
              <a href="mailto:support@pabandi.com" className="flex items-center gap-3 text-on-surface hover:text-primary transition-colors font-semibold">
                <span className="material-symbols-outlined text-on-surface-variant">mail</span>
                support@pabandi.com
              </a>
              <div className="flex items-center gap-3 text-on-surface font-semibold">
                <span className="material-symbols-outlined text-on-surface-variant">chat</span>
                In-App Live Chat (Average response time: &lt; 2 mins)
              </div>
            </div>
          </div>
        </div>

        {/* Business Support */}
        <div className="bg-[#14F195]/5 rounded-3xl p-8 md:p-10 border border-[#14F195]/20 shadow-sm flex flex-col items-start gap-6 hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#14F195]/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="w-14 h-14 rounded-full bg-[#14F195]/20 flex items-center justify-center border border-[#14F195]/30">
            <span className="material-symbols-outlined text-[#10b981] text-2xl">storefront</span>
          </div>
          <div className="relative z-10">
            <h2 className="font-headline text-2xl font-bold text-on-surface mb-2">Partner Success</h2>
            <p className="font-body text-on-surface-variant mb-6">
              For our business partners. Need help setting up your profile, understanding analytics, or managing escrow payouts? Reach your dedicated account manager.
            </p>
            <div className="space-y-4">
              <a href="mailto:partners@pabandi.com" className="flex items-center gap-3 text-on-surface hover:text-[#10b981] transition-colors font-semibold">
                <span className="material-symbols-outlined text-on-surface-variant">mail</span>
                partners@pabandi.com
              </a>
              <a href="tel:+18007222634" className="flex items-center gap-3 text-on-surface hover:text-[#10b981] transition-colors font-semibold">
                <span className="material-symbols-outlined text-on-surface-variant">call</span>
                1-800-PABANDI
              </a>
              <a href="#" className="flex items-center gap-3 text-on-surface hover:text-[#10b981] transition-colors font-semibold">
                <span className="material-symbols-outlined text-on-surface-variant">forum</span>
                Partner WhatsApp Support
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* General Inquiries */}
      <section className="bg-surface-container-highest rounded-3xl p-8 text-center max-w-2xl mx-auto border border-outline-variant/10">
        <h3 className="font-headline text-xl font-bold text-on-surface mb-2">Press & General Inquiries</h3>
        <p className="font-body text-on-surface-variant text-sm mb-4">
          For media inquiries, brand partnerships, or investment opportunities, please contact our corporate team.
        </p>
        <a href="mailto:hello@pabandi.com" className="inline-flex items-center gap-2 text-primary font-bold hover:underline">
          <span className="material-symbols-outlined text-[18px]">send</span>
          hello@pabandi.com
        </a>
      </section>

      {/* FAQ Link */}
      <section className="text-center pt-8 border-t border-outline-variant/20">
        <p className="font-body text-on-surface-variant mb-4">Looking for quick answers?</p>
        <Link to="/" className="btn-secondary">
          Visit our Help Center
        </Link>
      </section>

    </div>
  );
}
