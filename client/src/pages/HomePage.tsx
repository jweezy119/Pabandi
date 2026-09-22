import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function HomePage() {
  const [stats, setStats] = useState({ users: 0, transactions: 0, volume: 0 });

  useEffect(() => {
    setStats({ users: 1250, transactions: 5400, volume: 2800000 });
  }, []);

  return (
    <div className="min-h-screen bg-[#020617] text-[var(--warm-ink)]">
      {/* Hero */}
      <section className="relative py-20 px-4 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-10%] left-1/4 w-[40rem] h-[40rem] bg-emerald-600 rounded-full mix-blend-screen filter blur-[150px] opacity-20 animate-blob" />
          <div className="absolute bottom-[-10%] right-1/4 w-[40rem] h-[40rem] bg-[var(--dusty-rose)] rounded-full mix-blend-screen filter blur-[150px] opacity-20 animate-blob animation-delay-2000" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[var(--sage)] via-cyan-400 to-purple-400 mb-6">
            Pabandi
          </h1>
          <p className="text-xl md:text-2xl text-[var(--warm-ink)] mb-8 max-w-2xl mx-auto">
            The Global Trust Layer for the Digital Economy
          </p>
          <p className="text-lg text-[var(--soft-stone)] mb-12 max-w-xl mx-auto">
            Every transaction protected. Every user verified. Every business empowered.
            Available in 50+ countries. Powered by $PAB.
          </p>

          <div className="flex flex-wrap justify-center gap-4 mb-12">
            <Link to="/discovery" className="px-8 py-4 rounded-xl bg-gradient-to-r from-[var(--sage)] to-[var(--sky-wash)] text-[var(--warm-ink)] font-bold text-lg shadow-[var(--shadow-soft)] hover:shadow-xl hover:-translate-y-1 transition-all">
              🍽️ Book a Table
            </Link>
            <Link to="/saf" className="px-8 py-4 rounded-xl bg-gradient-to-r from-[var(--muted-ochre)] to-[var(--muted-ochre)] text-[var(--warm-ink)] font-bold text-lg shadow-[var(--shadow-soft)] hover:shadow-xl hover:-translate-y-1 transition-all">
              🚛 Post a Load
            </Link>
            <Link to="/haq" className="px-8 py-4 rounded-xl bg-gradient-to-r from-[var(--clay)] to-indigo-600 text-[var(--warm-ink)] font-bold text-lg shadow-[var(--shadow-soft)] hover:shadow-xl hover:-translate-y-1 transition-all">
              🏠 Manage Property
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
            <div>
              <p className="text-3xl font-bold text-[var(--sage)]">{stats.users.toLocaleString()}+</p>
              <p className="text-sm text-[var(--soft-stone)]">Users</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[var(--sky-wash)]">{stats.transactions.toLocaleString()}+</p>
              <p className="text-sm text-[var(--soft-stone)]">Transactions</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[var(--dusty-rose)]">${(stats.volume / 1000000).toFixed(1)}M+</p>
              <p className="text-sm text-[var(--soft-stone)]">Volume (USD)</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[var(--muted-ochre)]">50+</p>
              <p className="text-sm text-[var(--soft-stone)]">Countries</p>
            </div>
          </div>
        </div>
      </section>

      {/* What is Pabandi */}
      <section className="py-16 px-4 border-t border-[var(--soft-stone)]/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-[var(--cream)] border border-[var(--soft-stone)]/30">
              <div className="w-12 h-12 rounded-xl bg-[var(--sage)]/20 flex items-center justify-center text-2xl mb-4">🛡️</div>
              <h3 className="text-xl font-bold mb-2">Trust Score</h3>
              <p className="text-[var(--soft-stone)]">Every user and business builds a reputation over time. High trust = better deals, instant payouts, lower fees.</p>
            </div>
            <div className="p-6 rounded-2xl bg-[var(--cream)] border border-[var(--soft-stone)]/30">
              <div className="w-12 h-12 rounded-xl bg-[var(--sky-wash)]/20 flex items-center justify-center text-2xl mb-4">🔒</div>
              <h3 className="text-xl font-bold mb-2">Escrow Protection</h3>
              <p className="text-[var(--soft-stone)]">Funds locked until both parties fulfill. No more scams, no more ghosting, no more fraud.</p>
            </div>
            <div className="p-6 rounded-2xl bg-[var(--cream)] border border-[var(--soft-stone)]/30">
              <div className="w-12 h-12 rounded-xl bg-[var(--dusty-rose)]/20 flex items-center justify-center text-2xl mb-4">💰</div>
              <h3 className="text-xl font-bold mb-2">Earn $PAB</h3>
              <p className="text-[var(--soft-stone)]">Every transaction earns you $PAB tokens. Stake for yield, spend for discounts, hold for governance.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Three OS Platforms */}
      <section className="py-16 px-4 border-t border-[var(--soft-stone)]/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Three Platforms, One Trust Layer</h2>
          <p className="text-[var(--soft-stone)] text-center mb-12 max-w-2xl mx-auto">Each platform is purpose-built for its industry, all powered by the Pabandi trust engine.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Sitara */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-[var(--sage)]/10 to-[var(--sky-wash)]/10 border border-[var(--sage)]/20 hover:border-emerald-500/40 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--sage)] to-[var(--sky-wash)] flex items-center justify-center font-bold">S</div>
                <h3 className="text-xl font-bold">Sitara</h3>
              </div>
              <p className="text-[var(--soft-stone)] mb-4">Booking & discovery for restaurants, hotels, and services. Book with confidence, earn rewards on every check-in.</p>
              <ul className="space-y-2 text-sm text-[var(--warm-ink)] mb-6">
                <li>🍽️ Restaurant booking</li>
                <li>🏨 Hotel reservations</li>
                <li>📅 Service appointments</li>
                <li>📱 QR code check-in</li>
              </ul>
              <Link to="/discovery" className="block w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-center font-medium transition">
                Open Sitara →
              </Link>
            </div>

            {/* Saf OS */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-[var(--muted-ochre)]/10 to-orange-500/10 border border-[var(--muted-ochre)]/20 hover:border-amber-500/40 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--muted-ochre)] to-[var(--muted-ochre)] flex items-center justify-center font-bold">S</div>
                <h3 className="text-xl font-bold">Saf OS</h3>
              </div>
              <p className="text-[var(--soft-stone)] mb-4">Freight & logistics management. Post loads, find carriers, track shipments — all with trust scoring.</p>
              <ul className="space-y-2 text-sm text-[var(--warm-ink)] mb-6">
                <li>📦 Load board</li>
                <li>🚛 Carrier matching</li>
                <li>📍 Shipment tracking</li>
                <li>💰 Rate calculator</li>
              </ul>
              <Link to="/saf" className="block w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-center font-medium transition">
                Open Saf OS →
              </Link>
            </div>

            {/* Haq OS */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-[var(--clay)]/10 to-[var(--clay)]/10 border border-violet-500/20 hover:border-violet-500/40 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--clay)] to-indigo-600 flex items-center justify-center font-bold">H</div>
                <h3 className="text-xl font-bold">Haq OS</h3>
              </div>
              <p className="text-[var(--soft-stone)] mb-4">Property management for landlords and builders. Track tenants, leases, maintenance, and revenue in one dashboard.</p>
              <ul className="space-y-2 text-sm text-[var(--warm-ink)] mb-6">
                <li>📊 Revenue dashboard</li>
                <li>👥 Tenant management</li>
                <li>📝 Lease tracking</li>
                <li>🔧 Maintenance requests</li>
              </ul>
              <Link to="/haq" className="block w-full py-3 rounded-xl bg-[var(--terracotta)] hover:bg-violet-700 text-center font-medium transition">
                Open Haq OS →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Global Markets */}
      <section className="py-16 px-4 border-t border-[var(--soft-stone)]/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Available Worldwide</h2>
          <p className="text-[var(--soft-stone)] text-center mb-12 max-w-2xl mx-auto">Local payments, local compliance, global trust.</p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="p-4 rounded-xl bg-[var(--cream)] border border-[var(--soft-stone)]/30 text-center">
              <p className="text-3xl mb-2">🇺🇸</p>
              <p className="font-medium">United States</p>
              <p className="text-xs text-[var(--soft-stone)]">USD • Stripe</p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--cream)] border border-[var(--soft-stone)]/30 text-center">
              <p className="text-3xl mb-2">🇵🇰</p>
              <p className="font-medium">Pakistan</p>
              <p className="text-xs text-[var(--soft-stone)]">PKR • Raast • JazzCash</p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--cream)] border border-[var(--soft-stone)]/30 text-center">
              <p className="text-3xl mb-2">🇮🇳</p>
              <p className="font-medium">India</p>
              <p className="text-xs text-[var(--soft-stone)]">INR • UPI</p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--cream)] border border-[var(--soft-stone)]/30 text-center">
              <p className="text-3xl mb-2">🇬🇧</p>
              <p className="font-medium">United Kingdom</p>
              <p className="text-xs text-[var(--soft-stone)]">GBP • Open Banking</p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--cream)] border border-[var(--soft-stone)]/30 text-center">
              <p className="text-3xl mb-2">🇦🇪</p>
              <p className="font-medium">UAE</p>
              <p className="text-xs text-[var(--soft-stone)]">AED • Local Rails</p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--cream)] border border-[var(--soft-stone)]/30 text-center">
              <p className="text-3xl mb-2">🇧🇩</p>
              <p className="font-medium">Bangladesh</p>
              <p className="text-xs text-[var(--soft-stone)]">BDT • bKash</p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--cream)] border border-[var(--soft-stone)]/30 text-center">
              <p className="text-3xl mb-2">🇳🇬</p>
              <p className="font-medium">Nigeria</p>
              <p className="text-xs text-[var(--soft-stone)]">NGN • Local Rails</p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--cream)] border border-[var(--soft-stone)]/30 text-center">
              <p className="text-3xl mb-2">🌍</p>
              <p className="font-medium">50+ More</p>
              <p className="text-xs text-[var(--soft-stone)]">Local payments</p>
            </div>
          </div>
        </div>
      </section>

      {/* $PAB Token */}
      <section className="py-16 px-4 border-t border-[var(--soft-stone)]/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">$PAB — The Trust Token</h2>
          <p className="text-[var(--soft-stone)] mb-8 max-w-2xl mx-auto">Earn, stake, and spend $PAB across all platforms. The more you transact, the more you earn.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-[var(--cream)] border border-[var(--soft-stone)]/30">
              <p className="text-4xl mb-2">🌱</p>
              <h3 className="font-bold mb-2">Earn</h3>
              <p className="text-sm text-[var(--soft-stone)]">Earn $PAB on every booking, shipment, and rent payment.</p>
            </div>
            <div className="p-6 rounded-2xl bg-[var(--cream)] border border-[var(--soft-stone)]/30">
              <p className="text-4xl mb-2">🔒</p>
              <h3 className="font-bold mb-2">Stake</h3>
              <p className="text-sm text-[var(--soft-stone)]">Stake $PAB for up to 12% APY and boosted trust scores.</p>
            </div>
            <div className="p-6 rounded-2xl bg-[var(--cream)] border border-[var(--soft-stone)]/30">
              <p className="text-4xl mb-2">💸</p>
              <h3 className="font-bold mb-2">Spend</h3>
              <p className="text-sm text-[var(--soft-stone)]">Pay with $PAB for 5% discounts across all platforms.</p>
            </div>
          </div>

          <div className="mt-12">
            <Link to="/protocol" className="px-8 py-4 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-[var(--warm-ink)] font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all inline-block">
              View Protocol →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-[var(--soft-stone)]/30">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-bold mb-4">Platforms</h4>
              <ul className="space-y-2 text-sm text-[var(--soft-stone)]">
                <li><Link to="/discovery" className="hover:text-[var(--warm-ink)] transition">Sitara</Link></li>
                <li><Link to="/saf" className="hover:text-[var(--warm-ink)] transition">Saf OS</Link></li>
                <li><Link to="/haq" className="hover:text-[var(--warm-ink)] transition">Haq OS</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Protocol</h4>
              <ul className="space-y-2 text-sm text-[var(--soft-stone)]">
                <li><Link to="/protocol" className="hover:text-[var(--warm-ink)] transition">$PAB Token</Link></li>
                <li><Link to="/protocol/staking" className="hover:text-[var(--warm-ink)] transition">Staking</Link></li>
                <li><Link to="/protocol/escrow" className="hover:text-[var(--warm-ink)] transition">Escrow</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Trust</h4>
              <ul className="space-y-2 text-sm text-[var(--soft-stone)]">
                <li><Link to="/trust" className="hover:text-[var(--warm-ink)] transition">Trust Score</Link></li>
                <li><Link to="/background-check" className="hover:text-[var(--warm-ink)] transition">Background Check</Link></li>
                <li><Link to="/arbitration" className="hover:text-[var(--warm-ink)] transition">Arbitration</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-[var(--soft-stone)]">
                <li><Link to="/about" className="hover:text-[var(--warm-ink)] transition">About</Link></li>
                <li><Link to="/contact" className="hover:text-[var(--warm-ink)] transition">Contact</Link></li>
                <li><a href="mailto:jay@pabandi.com" className="hover:text-[var(--warm-ink)] transition">jay@pabandi.com</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-[var(--soft-stone)]/30 text-center text-sm text-[var(--soft-stone)]">
            <p>© 2026 Pabandi. All rights reserved. The global trust layer for the digital economy.</p>
            <p className="mt-2">
              <a href="https://wa.me/13124896967" className="hover:text-[var(--warm-ink)] transition mx-2">WhatsApp</a>
              <a href="https://x.com/pabandiglobal" className="hover:text-[var(--warm-ink)] transition mx-2">X/Twitter</a>
              <a href="https://instagram.com/pabandiglobal" className="hover:text-[var(--warm-ink)] transition mx-2">Instagram</a>
              <a href="https://linkedin.com/company/pabandi" className="hover:text-[var(--warm-ink)] transition mx-2">LinkedIn</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
