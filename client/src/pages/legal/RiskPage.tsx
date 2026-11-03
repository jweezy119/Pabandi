import { Link } from 'react-router-dom';
import { Surface, Button, tokens } from '../../design-system';

export default function RiskPage() {
  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Surface className="p-8 md:p-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold font-headline text-[var(--warm-ink)]">
                Pabandi Risk Disclosure
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
              You must read this Risk Disclosure before using Pabandi. By using the Service, you acknowledge the following risks:
            </p>

            <h2 className="text-xl font-bold text-[var(--warm-ink)] mt-8 mb-3">1. Blockchain &amp; Smart Contract Risk</h2>
            <p className="mb-2" style={{ color: tokens.color.text }}>
              <strong className="text-[var(--clay)]">Irreversibility:</strong> Transactions on the Solana blockchain are final. If you send funds to the wrong address, or if an Agent executes a malicious transaction, those funds cannot be recovered.
            </p>
            <p className="mb-4" style={{ color: tokens.color.text }}>
              <strong className="text-[var(--clay)]">Smart Contract Exploits:</strong> While Pabandi conducts audits, smart contracts are code. Code can contain bugs. You acknowledge that funds locked in escrow are at risk of loss due to hacking, exploit, or protocol failure.
            </p>
            <p className="mb-4" style={{ color: tokens.color.text }}>
              <strong className="text-[var(--clay)]">Network Congestion:</strong> Solana network outages or high congestion may result in delayed transactions, causing a booking or escrow release to fail.
            </p>

            <h2 className="text-xl font-bold text-[var(--warm-ink)] mt-8 mb-3">2. Artificial Intelligence Risk</h2>
            <p className="mb-2" style={{ color: tokens.color.text }}>
              <strong className="text-[var(--clay)]">Probabilistic Predictions:</strong> The Trust Passport is a statistical probability, not a guarantee. An Agent with a 950 Trust Score is highly reliable, but may still commit fraud. Pabandi is not liable for the actions of users or Agents you transact with.
            </p>
            <p className="mb-4" style={{ color: tokens.color.text }}>
              <strong className="text-[var(--clay)]">AI Hallucination:</strong> Our Sulha arbitration layer uses LLMs. While constrained, LLMs can hallucinate, make errors, or be manipulated by adversarial inputs.
            </p>
            <p className="mb-4" style={{ color: tokens.color.text }}>
              <strong className="text-[var(--clay)]">Prompt Injection:</strong> Malicious Agents may attempt to feed deceptive data to the AI models to artificially inflate their Trust Score.
            </p>

            <h2 className="text-xl font-bold text-[var(--warm-ink)] mt-8 mb-3">3. Regulatory &amp; Tax Risk</h2>
            <p className="mb-2" style={{ color: tokens.color.text }}>
              <strong className="text-[var(--clay)]">Crypto Assets:</strong> USDC and PAB are digital assets. The regulatory landscape for cryptocurrencies is evolving rapidly in the US, Pakistan, and globally. New laws could impact the legality or liquidity of the Service.
            </p>
            <p className="mb-4" style={{ color: tokens.color.text }}>
              <strong className="text-[var(--clay)]">Tax Obligations:</strong> You are solely responsible for calculating and paying any taxes owed on crypto rewards, yield, or payments received via Pabandi. Pabandi does not provide tax, legal, or accounting advice.
            </p>

            <h2 className="text-xl font-bold text-[var(--warm-ink)] mt-8 mb-3">4. Session Abstraction Risk</h2>
            <p className="mb-4" style={{ color: tokens.color.text }}>
              You acknowledge that by providing an API Key to an Agent, you are granting it limited spending authority. Pabandi's rate limits and budget caps are designed to mitigate risk, but you remain liable for the Agent's behavior within those bounds.
            </p>
          </div>
        </Surface>
      </div>
    </div>
  );
}
