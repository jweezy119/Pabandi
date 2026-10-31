import MarketplaceRevenuePanel from '../../components/marketplace/MarketplaceRevenuePanel';
import MonetizationDashboard from '../../components/MonetizationDashboard';

/**
 * Admin revenue page (support/admin) — one screen for the operator's money:
 * the agent marketplace's real fee income and escrow state, plus the legacy
 * monetization surfaces. This is the "can we fund donations yet" screen.
 */
export default function AdminRevenuePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1
        className="mb-2 text-2xl font-bold"
        style={{ color: 'var(--deep-stone, #2b2320)' }}
      >
        Revenue
      </h1>
      <p className="mb-8 text-sm" style={{ color: 'var(--soft-stone, #6b6259)' }}>
        Platform income across the agent marketplace and monetization products.
        Every completed job returns the 2% marketplace fee to the house.
      </p>

      <div className="space-y-6">
        <MarketplaceRevenuePanel />
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--cream, #faf6ee)', boxShadow: 'var(--shadow-btn)' }}
        >
          <h4
            className="mb-3 text-xs font-bold uppercase tracking-wider"
            style={{ color: 'var(--soft-stone, #6b6259)' }}
          >
            Trust Brokerage &amp; Insurance
          </h4>
          <MonetizationDashboard />
        </div>
        <p className="text-xs" style={{ color: 'var(--soft-stone, #6b6259)' }}>
          Optional: the day fee income covers a chosen donation target, the
          operator sweeps it from the treasury — this page is the scoreboard
          that says when.
        </p>
      </div>
    </div>
  );
}
