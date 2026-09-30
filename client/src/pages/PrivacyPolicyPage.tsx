import { Link } from 'react-router-dom';
import { MessageCircle, Users, Trash2, Server, ArrowRight } from 'lucide-react';

const SECTIONS = [
  {
    icon: MessageCircle,
    title: 'WhatsApp Messages',
    content: 'We never store your WhatsApp messages. We only use WhatsApp to send booking confirmations and reminders. Your conversations remain entirely private.',
  },
  {
    icon: Users,
    title: 'Social Connections',
    content: 'Your social connections are hashed. We don\'t see or store your posts, friends list, or private data. We only use account age and public signals to give you a trust bonus.',
  },
  {
    icon: Trash2,
    title: 'Data Control',
    content: 'Your data is yours. You can delete your account and all associated data at any time from your profile settings. Once deleted, it cannot be recovered.',
  },
  {
    icon: Server,
    title: 'Data Security & Hosting',
    content: 'Your data is encrypted at rest and never sold to third parties. Our servers are secured and globally distributed for maximum data sovereignty and reliability.',
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--sage)]/20 bg-[var(--sage)]/10 px-4 py-1.5 text-sm font-medium text-[var(--sage)] mb-6">
            <Server size={14} />
            Your Data
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-[var(--warm-ink)] font-headline tracking-tight">
            Privacy & Data Sovereignty
          </h1>
          <p className="text-[var(--soft-stone)] mt-3 max-w-xl mx-auto">
            Your data belongs to you. Here's exactly how we handle it.
          </p>
        </header>

        <div className="space-y-4">
          {SECTIONS.map((section, i) => (
            <section
              key={i}
              className="bg-white/60 backdrop-blur-sm border border-[rgba(191,179,163,0.2)] rounded-2xl p-6 shadow-[var(--shadow-soft)]"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-[var(--sage)]/10 flex items-center justify-center shrink-0">
                  <section.icon size={18} className="text-[var(--sage)]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[var(--warm-ink)] font-headline">
                    {i + 1}. {section.title}
                  </h2>
                  <p className="text-[var(--soft-stone)] mt-2 leading-relaxed text-[15px]">
                    {section.content}
                  </p>
                </div>
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 p-6 md:p-8 rounded-2xl bg-white/60 border border-[rgba(191,179,163,0.2)] shadow-[var(--shadow-soft)]">
          <h2 className="text-xl font-bold text-[var(--warm-ink)] font-headline mb-6 text-center">
            How Your Data Moves
          </h2>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6">
            <div className="flex flex-col items-center p-5 rounded-xl bg-[var(--cream)] text-center w-full md:w-1/3">
              <div className="text-3xl mb-2">📱</div>
              <h3 className="font-semibold text-[var(--warm-ink)] text-sm">Your Phone</h3>
              <p className="text-xs text-[var(--soft-stone)] mt-1">Only GPS Coordinate + Timestamp</p>
            </div>
            <ArrowRight size={20} className="text-[var(--soft-stone)] rotate-90 md:rotate-0" />
            <div className="flex flex-col items-center p-5 rounded-xl bg-[var(--cream)] text-center w-full md:w-1/3">
              <div className="text-3xl mb-2">🖥️</div>
              <h3 className="font-semibold text-[var(--warm-ink)] text-sm">Pabandi Server</h3>
              <p className="text-xs text-[var(--soft-stone)] mt-1">Encrypted & Verified Check-in</p>
            </div>
          </div>
          <p className="mt-5 text-center text-xs text-[var(--soft-stone)]">
            No constant tracking. We only verify your location at the exact time of your appointment.
          </p>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-[var(--soft-stone)]">
            Want to delete your data?{' '}
            <Link to="/contact" className="font-medium text-[var(--clay)] hover:underline">
              Contact us
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
