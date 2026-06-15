const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/BusinessJoinPage.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

const targetStr = `{/* ── Benefits ────────────────────────────────────────────── */}`;

const newMatrixHtml = `{/* ── Industry Matrix ─────────────────────────────────────── */}
      <section className="py-20 px-4" style={{ background: 'var(--color-bg)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#0ea5e9' }}>Tailored Protection</p>
            <h2 className="text-4xl font-black mb-4 text-[#e8e8e8]">How the Matrix Protects Your Industry</h2>
            <p className="text-base text-[#757575] max-w-2xl mx-auto leading-relaxed">
              Different businesses face different risks. The Trust Matrix dynamically weighs the four data layers to provide custom, outcome-based protection for your specific avenue of business.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            
            {/* Fine Dining */}
            <div className="rounded-3xl p-8 relative overflow-hidden group" style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/20 transition-all"></div>
              <div className="text-4xl mb-4 relative z-10">🍽️</div>
              <h3 className="text-xl font-bold text-[#e8e8e8] mb-2 relative z-10">Fine Dining & Restaurants</h3>
              <p className="text-sm text-[#9e9e9e] leading-relaxed mb-4 relative z-10">
                Empty tables during peak hours devastate margins. For dining, the Matrix heavily weighs the <strong className="text-blue-400">Historical Show Rate</strong> to filter out chronic no-showers and ensure high-demand slots are filled by reliable patrons.
              </p>
            </div>

            {/* Salons & Spas */}
            <div className="rounded-3xl p-8 relative overflow-hidden group" style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-pink-500/20 transition-all"></div>
              <div className="text-4xl mb-4 relative z-10">💇</div>
              <h3 className="text-xl font-bold text-[#e8e8e8] mb-2 relative z-10">Salons & Spas</h3>
              <p className="text-sm text-[#9e9e9e] leading-relaxed mb-4 relative z-10">
                A late cancellation leaves high-value block times unfillable. For salons, the Matrix focuses on <strong className="text-pink-400">Cancellation Lead Time</strong>, automatically requiring escrow deposits from users who frequently cancel at the last minute.
              </p>
            </div>

            {/* Event Venues */}
            <div className="rounded-3xl p-8 relative overflow-hidden group" style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-purple-500/20 transition-all"></div>
              <div className="text-4xl mb-4 relative z-10">🎪</div>
              <h3 className="text-xl font-bold text-[#e8e8e8] mb-2 relative z-10">Event Venues & Planners</h3>
              <p className="text-sm text-[#9e9e9e] leading-relaxed mb-4 relative z-10">
                Huge deposits and massive revenue are at stake. For venues, the Matrix prioritizes <strong className="text-purple-400">Verified Identity (KYC)</strong> and <strong className="text-purple-400">Social Graph Analytics</strong> to guarantee that large bookings are backed by real, vetted individuals.
              </p>
            </div>

            {/* Clinics */}
            <div className="rounded-3xl p-8 relative overflow-hidden group" style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-emerald-500/20 transition-all"></div>
              <div className="text-4xl mb-4 relative z-10">🩺</div>
              <h3 className="text-xl font-bold text-[#e8e8e8] mb-2 relative z-10">Clinics & Healthcare</h3>
              <p className="text-sm text-[#9e9e9e] leading-relaxed mb-4 relative z-10">
                Patient flow integrity is critical for both revenue and care delivery. The Matrix looks at <strong className="text-emerald-400">Consistent Reliability</strong> across the ecosystem to ensure high-priority appointment slots are respected.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── Benefits ────────────────────────────────────────────── */}`;

content = content.replace(targetStr, newMatrixHtml);

fs.writeFileSync(filePath, content);
console.log('BusinessJoinPage.tsx updated with Industry Matrix successfully.');
