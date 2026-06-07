import { Link } from 'react-router-dom';

export default function TechnologyPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 md:px-8 py-12 md:py-20 space-y-24">
      
      {/* Hero Section */}
      <section className="text-center max-w-4xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-label text-sm mb-4">
          <span className="material-symbols-outlined text-[16px]">memory</span>
          Next-Generation Infrastructure
        </div>
        <h1 className="font-headline text-[3rem] md:text-[4.5rem] leading-[1.05] font-bold text-on-surface tracking-tight">
          Where <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-[#38bdf8]">AI</span> meets <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#14F195] to-[#9945FF]">Web3</span>.
        </h1>
        <p className="font-body text-xl text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
          Pabandi is powered by a proprietary AI risk engine and secured by the Solana blockchain, creating the first trustless, no-show proof reservation economy.
        </p>
      </section>

      {/* The AI Risk Engine */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        <div className="space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-surface-container-highest flex items-center justify-center border border-outline-variant/20 shadow-sm">
            <span className="material-symbols-outlined text-4xl text-primary">psychology</span>
          </div>
          <h2 className="font-headline text-3xl md:text-4xl font-bold tracking-tight text-on-surface">
            Breakthrough AI Risk Engine
          </h2>
          <p className="font-body text-lg text-on-surface-variant">
            Our machine learning models analyze dozens of behavioral signals in real-time to predict the exact probability of a reservation no-show. 
          </p>
          <ul className="space-y-4 pt-4">
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary mt-0.5">check_circle</span>
              <div>
                <strong className="block text-on-surface font-headline">Predictive Analytics</strong>
                <span className="text-on-surface-variant text-sm font-body">Identifies high-risk bookings instantly using historical patterns.</span>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary mt-0.5">check_circle</span>
              <div>
                <strong className="block text-on-surface font-headline">Dynamic Deposits</strong>
                <span className="text-on-surface-variant text-sm font-body">Automatically enforces non-refundable deposits only when risk thresholds are exceeded.</span>
              </div>
            </li>
          </ul>
        </div>
        <div className="bg-surface-container-low rounded-3xl p-8 relative overflow-hidden shadow-lg border border-outline-variant/10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
          <div className="relative space-y-6">
            {/* Visual Representation of AI Analysis */}
            <div className="bg-surface-container-highest rounded-xl p-4 space-y-3">
              <div className="flex justify-between text-xs font-label text-on-surface-variant uppercase tracking-wider">
                <span>Signal Analysis</span>
                <span>Weight</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-body text-on-surface">Historical Reliability</span>
                  <div className="w-1/2 bg-surface-container h-2 rounded-full overflow-hidden">
                    <div className="bg-primary w-[85%] h-full"></div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-body text-on-surface">Time & Day Factor</span>
                  <div className="w-1/2 bg-surface-container h-2 rounded-full overflow-hidden">
                    <div className="bg-primary/70 w-[60%] h-full"></div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-body text-on-surface">Booking Lead Time</span>
                  <div className="w-1/2 bg-surface-container h-2 rounded-full overflow-hidden">
                    <div className="bg-[#f59e0b] w-[45%] h-full"></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-[#1e293b] rounded-xl p-6 text-center shadow-inner border border-white/5">
              <div className="text-4xl font-bold text-white mb-1">94%</div>
              <div className="text-sm text-slate-400 font-label uppercase tracking-widest">No-Show Accuracy Rate</div>
            </div>
          </div>
        </div>
      </section>

      {/* The Web3 Crypto Ecosystem */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center flex-row-reverse">
        <div className="order-2 md:order-1 bg-[#14F195]/5 rounded-3xl p-8 relative overflow-hidden shadow-lg border border-[#14F195]/20">
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#9945FF]/20 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3"></div>
          <div className="relative space-y-6">
            <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
              <div className="w-12 h-12 rounded-full bg-[#14F195]/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#14F195]">account_balance_wallet</span>
              </div>
              <div>
                <div className="text-white font-bold">Solana Trustless Escrow</div>
                <div className="text-slate-400 text-sm">Smart contracts handle deposits</div>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm ml-8">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">token</span>
              </div>
              <div>
                <div className="text-white font-bold">$PAB Token Rewards</div>
                <div className="text-slate-400 text-sm">Earned for reliable behavior</div>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm ml-16">
              <div className="w-12 h-12 rounded-full bg-[#9945FF]/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#9945FF]">storefront</span>
              </div>
              <div>
                <div className="text-white font-bold">Instant Payouts</div>
                <div className="text-slate-400 text-sm">Settled in milliseconds</div>
              </div>
            </div>
          </div>
        </div>
        <div className="order-1 md:order-2 space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-surface-container-highest flex items-center justify-center border border-outline-variant/20 shadow-sm">
            <img src="https://cryptologos.cc/logos/solana-sol-logo.svg?v=029" alt="Solana" className="w-8 h-8" />
          </div>
          <h2 className="font-headline text-3xl md:text-4xl font-bold tracking-tight text-on-surface">
            Powered by Solana Web3
          </h2>
          <p className="font-body text-lg text-on-surface-variant">
            Pabandi leverages the high-speed, low-cost Solana blockchain to manage the $PAB reward token and execute trustless escrow smart contracts.
          </p>
          <ul className="space-y-4 pt-4">
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[#14F195] mt-0.5">verified_user</span>
              <div>
                <strong className="block text-on-surface font-headline">Trustless Deposits</strong>
                <span className="text-on-surface-variant text-sm font-body">Deposits are locked in a smart contract and automatically released to the business upon a no-show, eliminating chargeback fraud.</span>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[#14F195] mt-0.5">currency_exchange</span>
              <div>
                <strong className="block text-on-surface font-headline">The $PAB Economy</strong>
                <span className="text-on-surface-variant text-sm font-body">Users earn tokens for checking in; businesses earn tokens for honoring bookings. Stake $PAB for VIP governance rights.</span>
              </div>
            </li>
          </ul>
        </div>
      </section>

      {/* The Pabandi Score */}
      <section className="text-center max-w-3xl mx-auto space-y-8 bg-surface-container-low rounded-3xl p-10 md:p-16 border border-outline-variant/20 shadow-lg">
        <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-[#f59e0b] to-[#fcd34d] flex items-center justify-center shadow-lg shadow-amber-500/20">
          <span className="material-symbols-outlined text-white text-4xl">workspace_premium</span>
        </div>
        <div>
          <h2 className="font-headline text-3xl md:text-4xl font-bold tracking-tight text-on-surface mb-4">
            The Pabandi Score
          </h2>
          <p className="font-body text-lg text-on-surface-variant leading-relaxed">
            Your ultimate trust metric. The Pabandi Score is a real-time reputation score derived from your reservation history. High scores unlock zero-deposit bookings, priority waitlists, and VIP tiers at exclusive venues.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6">
          <div className="p-6 bg-surface-container-highest rounded-xl text-center">
            <div className="text-3xl font-bold text-on-surface mb-2">900+</div>
            <div className="text-sm font-label uppercase text-primary tracking-wider">Elite</div>
          </div>
          <div className="p-6 bg-surface-container-highest rounded-xl text-center">
            <div className="text-3xl font-bold text-on-surface mb-2">700-899</div>
            <div className="text-sm font-label uppercase text-on-surface-variant tracking-wider">Reliable</div>
          </div>
          <div className="p-6 bg-surface-container-highest rounded-xl text-center opacity-70">
            <div className="text-3xl font-bold text-on-surface mb-2">&lt; 700</div>
            <div className="text-sm font-label uppercase text-error tracking-wider">High Risk</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="text-center pb-12">
        <h2 className="font-headline text-3xl font-bold text-on-surface mb-6">Ready to experience the future of booking?</h2>
        <div className="flex justify-center gap-4">
          <Link to="/" className="bg-primary text-on-primary px-8 py-3 rounded-full font-semibold hover:bg-primary/90 transition-all shadow-md">
            Explore Venues
          </Link>
          <Link to="/join" className="bg-surface-container-highest text-on-surface px-8 py-3 rounded-full font-semibold hover:bg-surface-container-highest/80 transition-all border border-outline-variant/30">
            For Businesses
          </Link>
        </div>
      </section>
    </div>
  );
}
