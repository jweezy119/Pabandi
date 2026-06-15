const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/WalletDashboard.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Add Trust Matrix imports
content = content.replace(
  `import {
  ArrowUpRightIcon,`,
  `import { ShieldCheckIcon, UserCircleIcon, FingerPrintIcon, ShareIcon } from '@heroicons/react/24/solid';\nimport {\n  ArrowUpRightIcon,`
);

// 2. Add the Matrix rendering logic inside the component before return
const variablesReplacement = `  const offChainBalance = Number(balances?.offChainBalance || 0);`;
const matrixLogic = `  const reliabilityScore = badgeData?.reliabilityScore || 100;
  const socialTrustBoost = badgeData?.socialTrustBoost || 0;
  const isKycVerified = userData?.kycStatus === 'VERIFIED';
  const socialPlatformsCount = badgeData?.socialSignals?.length || 0;
  const hasWeb3 = !!connected;
  
  const offChainBalance = Number(balances?.offChainBalance || 0);`;

content = content.replace(variablesReplacement, matrixLogic);

// 3. Replace the Tech Explainer with Web3TrustMatrix
const explainerStart = `{/* ── Web3 Tech Explainer ── */}`;
const explainerEnd = `        {/* ── Rewards History ── */}`;

const matrixHtml = `{/* ── Web3 Reliability Matrix ── */}
        <div className="animate-fade-up-delay-2 mb-10">
          <div className="mb-5">
            <h2 className="font-headline text-xl font-black text-on-surface">Web3 Trust Matrix</h2>
            <p className="font-body text-sm text-on-surface-variant mt-1">
              Transparent, cryptographic proof of the factors powering your Pabandi Reliability Score.
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-stretch">
            {/* The 4 Pillars */}
            <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Pillar 1: Historical Proof */}
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 flex gap-3 shadow-sm relative overflow-hidden">
                <div className="bg-primary/10 text-primary p-2.5 rounded-xl h-fit border border-primary/20"><CheckCircleIcon className="h-6 w-6" /></div>
                <div>
                  <h4 className="font-headline text-sm font-bold text-on-surface">Historical Proof</h4>
                  <p className="font-body text-xs text-on-surface-variant mt-0.5 mb-2 leading-relaxed">On-chain ledger of your bookings and show-up rate.</p>
                  <div className="flex items-center gap-2">
                    <span className="font-body text-xs font-bold px-2 py-0.5 rounded bg-primary text-on-primary">{showRate}% Rate</span>
                    <span className="font-body text-[10px] text-on-surface-variant">{totalBookings} Bookings</span>
                  </div>
                </div>
              </div>

              {/* Pillar 2: Identity (KYC) */}
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 flex gap-3 shadow-sm relative overflow-hidden">
                <div className="bg-secondary/10 text-secondary p-2.5 rounded-xl h-fit border border-secondary/20"><FingerPrintIcon className="h-6 w-6" /></div>
                <div>
                  <h4 className="font-headline text-sm font-bold text-on-surface">Identity Proof</h4>
                  <p className="font-body text-xs text-on-surface-variant mt-0.5 mb-2 leading-relaxed">Government-grade identity verification for ultimate trust.</p>
                  {isKycVerified ? (
                    <span className="font-body text-xs font-bold px-2 py-0.5 rounded bg-secondary text-on-secondary flex items-center w-fit gap-1"><ShieldCheckIcon className="h-3 w-3" /> Verified Identity</span>
                  ) : (
                    <span className="font-body text-xs font-bold px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant flex items-center w-fit gap-1"><UserCircleIcon className="h-3 w-3" /> Pseudonymous</span>
                  )}
                </div>
              </div>

              {/* Pillar 3: Social Graph */}
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 flex gap-3 shadow-sm relative overflow-hidden">
                <div className="bg-tertiary/10 text-tertiary p-2.5 rounded-xl h-fit border border-tertiary/20"><ShareIcon className="h-6 w-6" /></div>
                <div>
                  <h4 className="font-headline text-sm font-bold text-on-surface">Social Graph</h4>
                  <p className="font-body text-xs text-on-surface-variant mt-0.5 mb-2 leading-relaxed">Reputation merged from Fiverr, Upwork, and LinkedIn.</p>
                  {socialPlatformsCount > 0 ? (
                    <div className="flex items-center gap-2">
                      <span className="font-body text-xs font-bold px-2 py-0.5 rounded bg-tertiary text-on-tertiary">+{socialTrustBoost} pts Boost</span>
                      <span className="font-body text-[10px] text-on-surface-variant">{socialPlatformsCount} Connected</span>
                    </div>
                  ) : (
                    <span className="font-body text-xs font-bold px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant">0 Connected</span>
                  )}
                </div>
              </div>

              {/* Pillar 4: Web3 Custody */}
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 flex gap-3 shadow-sm relative overflow-hidden">
                <div className="bg-[#d97706]/10 text-[#d97706] p-2.5 rounded-xl h-fit border border-[#d97706]/20"><BoltIcon className="h-6 w-6" /></div>
                <div>
                  <h4 className="font-headline text-sm font-bold text-on-surface">Web3 Custody</h4>
                  <p className="font-body text-xs text-on-surface-variant mt-0.5 mb-2 leading-relaxed">Cryptographic wallet connecting your SBTs to reality.</p>
                  {hasWeb3 ? (
                    <span className="font-body text-xs font-bold px-2 py-0.5 rounded bg-[#d97706] text-white flex items-center w-fit gap-1"><LinkIcon className="h-3 w-3" /> Wallet Linked</span>
                  ) : (
                    <span className="font-body text-xs font-bold px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant">Not Linked</span>
                  )}
                </div>
              </div>

            </div>

            {/* Final Trust Score Box */}
            <div className="lg:col-span-2 relative overflow-hidden rounded-2xl p-6 shadow-sm border border-primary/20 flex flex-col justify-center items-center text-center" style={{
              background: 'linear-gradient(135deg, var(--color-surface-container-lowest) 0%, var(--color-primary-container) 150%)',
            }}>
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, var(--color-primary) 0%, transparent 60%)', opacity: 0.05, pointerEvents: 'none' }} />
              <ShieldCheckIcon className="h-12 w-12 text-primary mb-3 drop-shadow-md" />
              <h3 className="font-headline text-sm font-bold text-on-surface mb-1">Standard Trust Score</h3>
              <div className="flex items-baseline gap-1 mt-1 mb-2">
                <span className="font-headline text-6xl font-black text-primary drop-shadow-sm">{reliabilityScore}</span>
                <span className="font-headline text-xl font-bold text-on-surface-variant">/100</span>
              </div>
              <p className="font-body text-xs text-on-surface-variant leading-relaxed max-w-[200px]">
                Calculated transparently using your booking history, social graph, and identity proofs.
              </p>
            </div>
            
          </div>
        </div>

        {/* ── Rewards History ── */}`;

const regex = new RegExp(explainerStart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + explainerEnd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

content = content.replace(regex, matrixHtml);

fs.writeFileSync(filePath, content);
console.log('WalletDashboard.tsx updated with Web3TrustMatrix successfully.');
