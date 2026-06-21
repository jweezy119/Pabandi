export default function TermsOfServicePage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-4xl font-headline font-bold text-on-surface mb-8">
        Terms of Service & Compliance
      </h1>
      
      <p className="text-on-surface-variant font-body mb-8">
        Last Updated: June 2026. These terms govern your use of the Pabandi platform, APIs, and the $PAB utility token.
      </p>

      <div className="space-y-8 text-on-surface-variant font-body">
        
        {/* Section 1: General Use & Privacy (GDPR & CCPA) */}
        <section className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/30">
          <h2 className="text-2xl font-bold text-on-surface mb-4">
            1. General Use, Privacy & Data Rights
          </h2>
          <div className="space-y-4 text-lg">
            <p>
              By using Pabandi, you agree to our data practices outlined in the Privacy Policy. We adhere to global privacy standards, including the EU General Data Protection Regulation (GDPR) and the California Consumer Privacy Act (CCPA).
            </p>
            <ul className="list-disc pl-6 space-y-2">
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
        <section className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/30">
          <h2 className="text-2xl font-bold text-on-surface mb-4">
            2. Communications & Messaging
          </h2>
          <p className="text-lg mb-4">
            To provide reliable booking services, Pabandi utilizes WhatsApp and SMS for transactional notifications (e.g., booking confirmations and reminders).
          </p>
          <div className="bg-surface-container p-4 rounded-lg border-l-4 border-primary">
            <p className="font-semibold text-on-surface">
              TCPA / FCC Compliance (USA Users):
            </p>
            <p className="mt-2 text-sm">
              By providing your phone number, you explicitly consent to receive transactional and informational messages from Pabandi and its partners. Standard message and data rates may apply. You may opt-out at any time by replying "STOP", though this may impact your ability to receive booking confirmations.
            </p>
          </div>
        </section>

        {/* Section 3: Web3 & Token Regulations (SEC) */}
        <section className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/30">
          <h2 className="text-2xl font-bold text-on-surface mb-4">
            3. Web3, $PAB Token & Financial Regulations
          </h2>
          <div className="space-y-6 text-lg">
            <div>
              <h3 className="font-bold text-on-surface mb-2">
                A. Classification as a Utility Token
              </h3>
              <p>
                The $PAB token is exclusively a utility and reward token designed to facilitate trustless escrows, loyalty rewards, and access to the Pabandi platform. $PAB is NOT an investment contract, security, or financial instrument under the rules of the US Securities and Exchange Commission (SEC) or any equivalent global financial regulatory body. There is no expectation of profit.
              </p>
            </div>
            
            <div>
              <h3 className="font-bold text-on-surface mb-2">
                B. Digital Token Policy
              </h3>
              <p>
                We explicitly state that $PAB is a digital reward voucher and is NOT recognized as legal tender or fiat currency in any jurisdiction. It is used strictly as a loyalty point system within the Pabandi application ecosystem.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: Solana Escrows & Finality */}
        <section className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/30">
          <h2 className="text-2xl font-bold text-on-surface mb-4">
            4. Trustless Escrows & Smart Contracts
          </h2>
          <p className="text-lg">
            Booking deposits are locked via decentralized smart contracts on the Solana blockchain. Transactions on the blockchain are final and immutable. Pabandi Technologies cannot reverse, refund, or modify a transaction once it has been executed by the smart contract rules (e.g., in the event of a verified no-show). You assume all risks associated with cryptographic systems.
          </p>
        </section>

      </div>
    </div>
  );
}
