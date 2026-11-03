import { Link } from 'react-router-dom';
import { Surface, Button, tokens } from '../../design-system';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Surface className="p-8 md:p-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold font-headline text-[var(--warm-ink)]">
                Pabandi Privacy Policy
              </h1>
              <p className="mt-2 text-sm" style={{ color: tokens.color.textMuted }}>
                Last Updated: November 2026
              </p>
            </div>
            <Link to="/register" className="text-sm text-[var(--clay)] hover:underline">
              Back to Sign Up →
            </Link>
          </div>

          <div className="prose prose-invert max-w-none text-sm leading-relaxed">
            <p className="mb-6 text-[var(--warm-ink)] font-semibold">
              Pabandi is built on a foundation of privacy and trust. This policy explains what data we collect, why we collect it, and how we handle it.
            </p>

            <h2 className="text-xl font-bold text-[var(--warm-ink)] mt-8 mb-3">1. Data We Collect</h2>
            <p className="mb-4" style={{ color: tokens.color.text }}>
              To provide the Trust Passport and MCP settlement layer, we collect:
            </p>
            <p className="mb-2" style={{ color: tokens.color.text }}>
              <strong className="text-[var(--clay)]">Account Data:</strong> Name, email address, and authentication credentials (hashed).
            </p>
            <p className="mb-4" style={{ color: tokens.color.text }}>
              <strong className="text-[var(--clay)]">Agent Data:</strong> API keys, Agent metadata (name, purpose), and telemetry (API requests, session budgets, tool calls).
            </p>
            <p className="mb-4" style={{ color: tokens.color.text }}>
              <strong className="text-[var(--clay)]">On-Chain Data:</strong> Public wallet addresses (Solana) associated with your account. Note: The blockchain is public by design.
            </p>
            <p className="mb-4" style={{ color: tokens.color.text }}>
              <strong className="text-[var(--clay)]">KYC/AML Data:</strong> If you process high-volume fiat or require verified status, we use third-party KYC providers (e.g., Stripe Identity, Persona) to verify identity. Pabandi does not store your raw passport or government ID.
            </p>
            <p className="mb-4" style={{ color: tokens.color.text }}>
              <strong className="text-[var(--clay)]">Web3 Reputation Data:</strong> Publicly available data from connected accounts (LinkedIn, Fiverr, etc.) used to calculate your Trust Score.
            </p>

            <h2 className="text-xl font-bold text-[var(--warm-ink)] mt-8 mb-3">2. How We Use Your Data</h2>
            <p className="mb-2" style={{ color: tokens.color.text }}>
              <strong className="text-[var(--clay)]">To Calculate Trust Scores:</strong> Anonymized behavioral patterns (e.g., booking frequency, payment timeliness) are fed into our ML models to generate reliability scores.
            </p>
            <p className="mb-4" style={{ color: tokens.color.text }}>
              <strong className="text-[var(--clay)]">To Power Sulha:</strong> If a dispute arises, the evidence bundle (logs, data hashes) is reviewed by our AI models to reach a verdict.
            </p>
            <p className="mb-4" style={{ color: tokens.color.text }}>
              <strong className="text-[var(--clay)]">To Secure the Platform:</strong> We use IP addresses and device fingerprints to rate-limit API calls and prevent Sybil attacks (Agents creating multiple fake accounts).
            </p>

            <h2 className="text-xl font-bold text-[var(--warm-ink)] mt-8 mb-3">3. AI Model Training</h2>
            <p className="mb-4" style={{ color: tokens.color.text }}>
              We use anonymized transaction patterns to train and improve our reliability models. We do not sell your personal data. If you are an Enterprise customer, we offer a zero-retention policy where your data is excluded from global model training.
            </p>

            <h2 className="text-xl font-bold text-[var(--warm-ink)] mt-8 mb-3">4. Data Sharing</h2>
            <p className="mb-4" style={{ color: tokens.color.text }}>
              We share data only with:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2" style={{ color: tokens.color.text }}>
              <li><strong className="text-[var(--clay)]">KYC Providers:</strong> For identity verification.</li>
              <li><strong className="text-[var(--clay)]">Payment Processors:</strong> (e.g., Square, Solana RPC nodes) to process your transactions.</li>
              <li><strong className="text-[var(--clay)]">Law Enforcement:</strong> If legally compelled by a valid subpoena.</li>
            </ul>

            <h2 className="text-xl font-bold text-[var(--warm-ink)] mt-8 mb-3">5. The Blockchain Caveat</h2>
            <p className="mb-4" style={{ color: tokens.color.text }}>
              You understand that due to the nature of the Solana blockchain, Pabandi cannot delete on-chain transaction history. If you request account deletion, we will delete your off-chain data (emails, API keys, dashboard data), but public blockchain records (e.g., wallet transactions) will remain immutable.
            </p>

            <h2 className="text-xl font-bold text-[var(--warm-ink)] mt-8 mb-3">6. Your Rights (CCPA/GDPR)</h2>
            <p className="mb-4" style={{ color: tokens.color.text }}>
              You have the right to access, correct, export, or delete your off-chain personal data. You can exercise these rights via your Pabandi Dashboard or by emailing privacy@pabandi.com.
            </p>
          </div>
        </Surface>
      </div>
    </div>
  );
}
