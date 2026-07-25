import { tokens } from '../design-system';

export default function TermsOfServicePage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12 font-body" style={{ background: tokens.color.background, color: tokens.color.text }}>
      <h1 className="font-headline mb-8 text-4xl font-bold text-on-surface">
        Terms of Service & Compliance
      </h1>

      <p className="font-body mb-8" style={{ color: tokens.color.muted }}>
        Last Updated: June 2026. These terms govern your use of the Pabandi platform, APIs, and the $PAB utility token.
      </p>

      <div className="font-body space-y-8" style={{ color: tokens.color.muted }}>

        {/* Section 1: General Use & Privacy (GDPR & CCPA) */}
        <section className="rounded-xl border p-6" style={{ background: tokens.color.surface, borderColor: tokens.color.border }}>
          <h2 className="font-headline mb-4 text-2xl font-bold text-on-surface">
            1. General Use, Privacy & Data Rights
          </h2>
          <div className="space-y-4 font-body">
            <p>
              By using Pabandi, you agree to our data practices outlined in the Privacy Policy. We adhere to global privacy standards, including the EU General Data Protection Regulation (GDPR) and the California Consumer Privacy Act (CCPA).
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Right to Erasure:</strong>{' '}
                You have the absolute right to request the deletion of your account and personal data at any time.
              </li>
              <li>
                <strong>Data Sovereignty:</strong>{' '}
                Your data is securely stored and processed in compliance with local regulations. We do not sell your data to third parties.
              </li>
            </ul>
          </div>
        </section>

        {/* Section 2: Communications (FCC / TCPA) */}
        <section className="rounded-xl border p-6" style={{ background: tokens.color.surface, borderColor: tokens.color.border }}>
          <h2 className="font-headline mb-4 text-2xl font-bold text-on-surface">
            2. Communications & Messaging
          </h2>
          <p className="mb-4 font-body" style={{ color: tokens.color.muted }}>
            To provide reliable booking services, Pabandi utilizes WhatsApp and SMS for transactional notifications (e.g., booking confirmations and reminders).
          </p>
          <div className="rounded-lg border-l-4 p-4" style={{ background: tokens.color.surface, borderColor: tokens.color.primary }}>
            <p className="font-semibold" style={{ color: tokens.color.text }}>
              TCPA / FCC Compliance (USA Users):
            </p>
            <p className="mt-2 text-sm" style={{ color: tokens.color.muted }}>
              By providing your phone number, you explicitly consent to receive transactional and informational messages from Pabandi and its partners. Standard message and data rates may apply. You may opt-out at any time by replying "STOP", though this may impact your ability to receive booking confirmations.
            </p>
          </div>
        </section>

        {/* Section 3: Web3 & Token Regulations (SEC) */}
        <section className="rounded-xl border p-6" style={{ background: tokens.color.surface, borderColor: tokens.color.border }}>
          <h2 className="font-headline mb-4 text-2xl font-bold text-on-surface">
            3. Web3, $PAB Token & Financial Regulations
          </h2>
          <div className="space-y-6 font-body" style={{ color: tokens.color.muted }}>
            <div>
              <h3 className="mb-2 font-bold text-on-surface">
                A. Classification as a Utility Token
              </h3>
              <p>
                The $PAB token is exclusively a utility and reward token designed to facilitate trustless escrows, loyalty rewards, and access to the Pabandi platform. $PAB is NOT an investment contract, security, or financial instrument under the rules of the US Securities and Exchange Commission (SEC) or any equivalent global financial regulatory body. There is no expectation of profit.
              </p>
            </div>

            <div>
              <h3 className="mb-2 font-bold text-on-surface">
                B. Digital Token Policy
              </h3>
              <p>
                We explicitly state that $PAB is a digital reward voucher and is NOT recognized as legal tender or fiat currency in any jurisdiction. It is used strictly as a loyalty point system within the Pabandi application ecosystem.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: Solana Escrows & Finality */}
        <section className="rounded-xl border p-6" style={{ background: tokens.color.surface, borderColor: tokens.color.border }}>
          <h2 className="font-headline mb-4 text-2xl font-bold text-on-surface">
            4. Trustless Escrows & Smart Contracts
          </h2>
          <p className="font-body" style={{ color: tokens.color.muted }}>
            Booking deposits are locked via decentralized smart contracts on the Solana blockchain. Transactions on the blockchain are final and immutable. Pabandi Technologies cannot reverse, refund, or modify a transaction once it has been executed by the smart contract rules (e.g., in the event of a verified no-show). You assume all risks associated with cryptographic systems.
          </p>
        </section>

      </div>
    </div>
  );
}
