const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/TechnologyPage.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

const targetStr = `{/* The Web3 Crypto Ecosystem */}`;

const newMatrixHtml = `{/* The Trust Matrix Engine */}
      <section className="bg-surface-container-lowest rounded-3xl p-8 md:p-12 border border-outline-variant/30 shadow-sm">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-label text-sm mb-4">
            <span className="material-symbols-outlined text-[16px]">grid_view</span>
            The 4 Data Layers
          </div>
          <h2 className="font-headline text-3xl md:text-4xl font-bold tracking-tight text-on-surface mb-4">
            The Trust Matrix Engine
          </h2>
          <p className="font-body text-lg text-on-surface-variant">
            Pabandi doesn't just look at a single metric. Our engine fuses four verifiable data layers into a singular, cryptographic Trust Standard.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pillar 1 */}
          <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/30 relative overflow-hidden group hover:border-primary/50 transition-colors">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/10 transition-colors"></div>
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 border border-primary/20 relative z-10">
              <span className="material-symbols-outlined text-2xl">history</span>
            </div>
            <h3 className="font-headline text-xl font-bold text-on-surface mb-2 relative z-10">Behavioral History</h3>
            <p className="font-body text-sm text-on-surface-variant leading-relaxed relative z-10">
              We analyze the user's booking ledger across the entire Pabandi network. The engine calculates the frequency of no-shows and the exact timing of cancellations to identify chronically flaky behavior.
            </p>
          </div>

          {/* Pillar 2 */}
          <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/30 relative overflow-hidden group hover:border-secondary/50 transition-colors">
            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-secondary/10 transition-colors"></div>
            <div className="w-12 h-12 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center mb-4 border border-secondary/20 relative z-10">
              <span className="material-symbols-outlined text-2xl">fingerprint</span>
            </div>
            <h3 className="font-headline text-xl font-bold text-on-surface mb-2 relative z-10">Verified Identity (KYC)</h3>
            <p className="font-body text-sm text-on-surface-variant leading-relaxed relative z-10">
              Pseudonymous users carry higher risk. By securely integrating government-grade ID verification, we filter out bots and malicious actors, ensuring the person booking is exactly who they claim to be.
            </p>
          </div>

          {/* Pillar 3 */}
          <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/30 relative overflow-hidden group hover:border-tertiary/50 transition-colors">
            <div className="absolute top-0 right-0 w-32 h-32 bg-tertiary/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-tertiary/10 transition-colors"></div>
            <div className="w-12 h-12 rounded-xl bg-tertiary/10 text-tertiary flex items-center justify-center mb-4 border border-tertiary/20 relative z-10">
              <span className="material-symbols-outlined text-2xl">share</span>
            </div>
            <h3 className="font-headline text-xl font-bold text-on-surface mb-2 relative z-10">Social Graph Analytics</h3>
            <p className="font-body text-sm text-on-surface-variant leading-relaxed relative z-10">
              A user with a highly-rated Fiverr or Upwork profile, or a verified LinkedIn, is statistically less likely to no-show. The matrix ingests these vetted professional signals to boost their trust score.
            </p>
          </div>

          {/* Pillar 4 */}
          <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/30 relative overflow-hidden group hover:border-[#d97706]/50 transition-colors">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#d97706]/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-[#d97706]/10 transition-colors"></div>
            <div className="w-12 h-12 rounded-xl bg-[#d97706]/10 text-[#d97706] flex items-center justify-center mb-4 border border-[#d97706]/20 relative z-10">
              <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
            </div>
            <h3 className="font-headline text-xl font-bold text-on-surface mb-2 relative z-10">On-Chain Footprint</h3>
            <p className="font-body text-sm text-on-surface-variant leading-relaxed relative z-10">
              By connecting a self-custodial Web3 wallet, users anchor their reputation to an immutable cryptographic ledger. The matrix views on-chain escrow behavior as the ultimate proof of commitment.
            </p>
          </div>
        </div>
      </section>

      {/* The Web3 Crypto Ecosystem */}`;

content = content.replace(targetStr, newMatrixHtml);

fs.writeFileSync(filePath, content);
console.log('TechnologyPage.tsx updated with Trust Matrix Engine successfully.');
