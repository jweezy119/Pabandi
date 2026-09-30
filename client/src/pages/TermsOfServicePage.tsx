import { Link } from 'react-router-dom';
import { FileText, MessageSquare, Zap, Lock, Shield } from 'lucide-react';

const SECTIONS = [
  {
    icon: FileText,
    title: 'General Use, Privacy & Data Rights',
    content: (
      <>
        <p>
          By using Pabandi, you agree to our data practices outlined in the Privacy Policy. We adhere to global privacy standards, including the EU General Data Protection Regulation (GDPR) and the California Consumer Privacy Act (CCPA).
        </p>
        <ul className="list-disc space-y-2 pl-6 mt-4">
          <li>
            <strong className="text-[var(--warm-ink)]">Right to Erasure:</strong>{' '}
            You have the absolute right to request the deletion of your account and personal data at any time.
          </li>
          <li>
            <strong className="text-[var(--warm-ink)]">Data Sovereignty:</strong>{' '}
            Your data is securely stored and processed in compliance with local regulations. We do not sell your data to third parties.
          </li>
        </ul>
      </>
    ),
  },
  {
    icon: MessageSquare,
    title: 'Communications & Messaging',
    content: (
      <>
        <p>
          To provide reliable booking services, Pabandi utilizes WhatsApp and SMS for transactional notifications (e.g., booking confirmations and reminders).
        </p>
        <div className="mt-4 p-4 rounded-xl border-l-4 border-[var(--clay)] bg-[var(--clay)]/5">
          <p className="font-semibold text-[var(--warm-ink)]">TCPA / FCC Compliance (USA Users):</p>
          <p className="mt-2 text-sm text-[var(--soft-stone)]">
            By providing your phone number, you explicitly consent to receive transactional and informational messages from Pabandi and its partners. Standard message and data rates may apply. You may opt-out at any time by replying "STOP", though this may impact your ability to receive booking confirmations.
          </p>
        </div>
      </>
    ),
  },
  {
    icon: Zap,
    title: 'Web3, $PAB Token & Financial Regulations',
    content: (
      <>
        <h3 className="font-semibold text-[var(--warm-ink)] mb-2">A. Classification as a Utility Token</h3>
        <p>
          The $PAB token is exclusively a utility and reward token designed to facilitate trustless escrows, loyalty rewards, and access to the Pabandi platform. $PAB is NOT an investment contract, security, or financial instrument under the rules of the US Securities and Exchange Commission (SEC) or any equivalent global financial regulatory body. There is no expectation of profit.
        </p>
        <h3 className="font-semibold text-[var(--warm-ink)] mt-4 mb-2">B. Digital Token Policy</h3>
        <p>
          We explicitly state that $PAB is a digital reward voucher and is NOT recognized as legal tender or fiat currency in any jurisdiction. It is used strictly as a loyalty point system within the Pabandi application ecosystem.
        </p>
      </>
    ),
  },
  {
    icon: Lock,
    title: 'Smart Contracts & On-Chain Finality',
    content: (
      <p>
        Booking deposits are locked via decentralized smart contracts on the Solana blockchain. Transactions on the blockchain are final and immutable. Pabandi Technologies cannot reverse, refund, or modify a transaction once it has been executed by the smart contract rules (e.g., in the event of a verified no-show). You assume all risks associated with cryptographic systems.
      </p>
    ),
  },
];

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--clay)]/20 bg-[var(--clay)]/10 px-4 py-1.5 text-sm font-medium text-[var(--clay)] mb-6">
            <Shield size={14} />
            Legal
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-[var(--warm-ink)] font-headline tracking-tight">
            Terms of Service
          </h1>
          <p className="text-[var(--soft-stone)] mt-3 max-w-xl mx-auto">
            The agreement between you and Pabandi. Plain language, no legalese traps.
          </p>
        </header>

        <div className="space-y-6">
          {SECTIONS.map((section, i) => (
            <section
              key={i}
              className="bg-white/60 backdrop-blur-sm border border-[rgba(191,179,163,0.2)] rounded-2xl p-6 md:p-8 shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-lift)] transition-shadow"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[var(--clay)]/10 flex items-center justify-center">
                  <section.icon size={18} className="text-[var(--clay)]" />
                </div>
                <h2 className="text-xl font-bold text-[var(--warm-ink)] font-headline">
                  {i + 1}. {section.title}
                </h2>
              </div>
              <div className="text-[var(--soft-stone)] leading-relaxed text-[15px]">
                {section.content}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 p-6 rounded-2xl bg-[var(--warm-sand)]/30 border border-[rgba(191,179,163,0.15)] text-center">
          <p className="text-sm text-[var(--soft-stone)]">
            Questions about these terms?{' '}
            <Link to="/contact" className="font-medium text-[var(--clay)] hover:underline">
              Contact us
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
