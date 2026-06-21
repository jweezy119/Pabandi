
import { useLanguage } from '../context/LanguageContext';

export default function Web3Page() {
  const { t, language } = useLanguage();

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-8 py-12 md:py-20 space-y-24">
      {/* Hero Section */}
      <section className="text-center max-w-4xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-label text-sm mb-4">
          <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
          {t("Web3 Ecosystem", "Web3 Ecosystem")}
        </div>
        <h1 className="font-headline text-[3rem] md:text-[4.5rem] leading-[1.05] font-bold text-on-surface tracking-tight">
          {language === 'en' ? (
            <>Powered by <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#14F195] to-[#9945FF]">Solana Web3</span></>
          ) : (
            <><span className="text-transparent bg-clip-text bg-gradient-to-r from-[#14F195] to-[#9945FF]">Solana Web3</span> Se Powered</>
          )}
        </h1>
        <p className="font-body text-xl text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
          {t(
            "Pabandi leverages the high-speed, low-cost Solana blockchain to manage the $PAB reward token and execute trustless escrow smart contracts.",
            "Pabandi taiz aur kam lagat wali Solana blockchain ka istemal karta hai taake $PAB reward token ko manage kiya ja sake aur trustless escrow smart contracts chalaye ja sakein."
          )}
        </p>
      </section>

      {/* The Web3 Crypto Ecosystem (From Technology Page) */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center max-w-5xl mx-auto">
        <div className="order-2 md:order-1 bg-[#031f38] rounded-3xl p-8 relative overflow-hidden shadow-lg border border-primary-container">
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#9945FF]/20 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3"></div>
          <div className="relative space-y-6">
            <div className="flex items-center gap-4 p-4 bg-white/10 rounded-xl border border-white/10 backdrop-blur-sm">
              <div className="w-12 h-12 rounded-full bg-[#14F195]/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#14F195]">account_balance_wallet</span>
              </div>
              <div>
                <div className="text-white font-bold font-headline">{t("Solana Trustless Escrow", "Solana Trustless Escrow")}</div>
                <div className="text-slate-300 text-sm font-body">{t("Smart contracts handle deposits", "Smart contracts deposits ko handle karte hain")}</div>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-white/10 rounded-xl border border-white/10 backdrop-blur-sm ml-8">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-white">token</span>
              </div>
              <div>
                <div className="text-white font-bold font-headline">{t("$PAB Token Rewards", "$PAB Token Inaam")}</div>
                <div className="text-slate-300 text-sm font-body">{t("Earned for reliable behavior", "Qaabil-e-Aitmaad rawayya par milte hain")}</div>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-white/10 rounded-xl border border-white/10 backdrop-blur-sm ml-16">
              <div className="w-12 h-12 rounded-full bg-[#9945FF]/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#9945FF]">storefront</span>
              </div>
              <div>
                <div className="text-white font-bold font-headline">{t("Instant Payouts", "Fauri Payouts")}</div>
                <div className="text-slate-300 text-sm font-body">{t("Settled in milliseconds", "Milliseconds mein ada ho jate hain")}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="order-1 md:order-2 space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-surface-container-highest flex items-center justify-center border border-outline-variant/20 shadow-sm">
            <img src="https://cryptologos.cc/logos/solana-sol-logo.svg?v=029" alt="Solana" className="w-8 h-8" />
          </div>
          <h2 className="font-headline text-3xl md:text-4xl font-bold tracking-tight text-on-surface">
            {t("Decentralized Reliability", "Decentralized Aitmaad")}
          </h2>
          <p className="font-body text-lg text-on-surface-variant">
            {t(
              "By leveraging Solana's ultra-fast network, we've built the world's first no-show proof booking economy. Your reputation is immutable and fully transparent.",
              "Solana ke ultra-fast network ka istemal karke, humne dunya ki pehli no-show proof booking economy banayi hai. Aapki reputation nakaabil-e-tabdeel aur mukammal shaffaf hai."
            )}
          </p>
          <ul className="space-y-4 pt-4">
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[#14F195] mt-0.5">verified_user</span>
              <div>
                <strong className="block text-on-surface font-headline">{t("Trustless Deposits", "Trustless Deposits")}</strong>
                <span className="text-on-surface-variant text-sm font-body">{t("Deposits are locked in a smart contract and automatically released to the business upon a no-show, eliminating chargeback fraud.", "Deposits smart contract mein lock ho jate hain aur no-show ki surat mein business ko automatic release ho jate hain, chargeback fraud ko khatam karte hue.")}</span>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[#14F195] mt-0.5">currency_exchange</span>
              <div>
                <strong className="block text-on-surface font-headline">{t("The $PAB Economy", "$PAB Economy")}</strong>
                <span className="text-on-surface-variant text-sm font-body">{t("Users earn tokens for checking in; businesses earn tokens for honoring bookings. Stake $PAB for VIP governance rights.", "Users check-in karne par tokens kamate hain; businesses booking ko honor karne par tokens kamate hain. VIP governance rights ke liye $PAB stake karein.")}</span>
              </div>
            </li>
          </ul>
        </div>
      </section>

      {/* TOKENOMICS SECTION (Moved from HomePage) */}
      <section className="bg-surface-bright py-24 border-y border-outline-variant/10 -mx-6 md:-mx-8 px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-[#06b6d4]">{t("Tokenomics: Built to Reward the Reliable", "Tokenomics: Pabandi Karne Walon Ko Inam")}</h2>
            <h3 className="font-headline text-4xl font-bold text-on-surface">{t("A Token That Works as Hard as You Do", "Ek Token Jo Aapki Tarah Mehnat Kare")}</h3>
            <p className="font-body text-lg text-on-surface-variant">
              {t("Fixed supply. Business compensation. Utility from day zero.", "Mukarrar supply. Business compensation. Pehle din se faida.")} <span className="font-bold text-primary">$PAB</span> {t("isn’t a bet — it’s the fuel for an economy where punctuality pays.", "koi shart nahi — yeh ek aisi economy ka eendhan hai jahan waqt ki pabandi ka faida milta hai.")}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {/* Left: Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-2xl shadow-[0_4px_20px_rgba(1,29,53,0.04)] border border-outline-variant/20 group hover:border-[#14F195]/50 transition-colors">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t("Total Supply", "Kul Supply")}</div>
                <div className="text-2xl font-black text-primary group-hover:text-[#14F195] transition-colors">1,000,000,000 $PAB</div>
                <div className="text-sm text-slate-500 mt-1">{t("Mint Authority Revoked", "Mint Authority Khatam Kar Di Gayi")}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-[0_4px_20px_rgba(1,29,53,0.04)] border border-outline-variant/20 group hover:border-[#06b6d4]/50 transition-colors">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t("Network", "Network")}</div>
                <div className="text-2xl font-black text-primary">Solana <span className="text-sm font-normal text-slate-400">(SPL)</span></div>
                <div className="text-sm text-slate-500 mt-1">{t("Blazing fast & cheap", "Nihayat Taiz aur Sasta")}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-[0_4px_20px_rgba(1,29,53,0.04)] border border-outline-variant/20 sm:col-span-2">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t("Utility & Compensation", "Fawaid aur Muawza")}</div>
                <p className="text-sm font-medium text-slate-700 leading-relaxed mb-2">
                  {t("Used for booking deposits, dynamic rewards, business bonuses, and API payments.", "Booking deposits, dynamic inamaat, business bonuses, aur API payments ke liye istemaal.")}
                </p>
                <div className="inline-flex items-center gap-1 text-xs font-bold text-[#ec4899] bg-pink-50 px-2 py-1 rounded border border-pink-200">
                  <span className="material-symbols-outlined text-[14px]">local_fire_department</span>
                  {t("No‑show deposits compensate businesses", "No-show deposits business ko compensate karte hain")}
                </div>
              </div>
            </div>

            {/* Right: Allocation Bars */}
            <div className="bg-[#0f172a] rounded-3xl p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#14F195]/20 blur-3xl rounded-full"></div>
              <h4 className="font-headline text-white font-bold mb-6">{t("Token Allocation", "Token Taqseem")}</h4>
              <div className="space-y-5">
                {[
                  { label: t('Ecosystem Rewards', 'Ecosystem Inaam'), pct: '40%', color: 'from-[#14F195] to-[#06b6d4]', desc: t('Fuelling rewards for 4 years', '4 saal tak inamaat') },
                  { label: t('Deposit Reserve', 'Deposit Reserve'), pct: '15%', color: 'from-[#3b82f6] to-[#6366f1]', desc: t('Backing high-risk deposits', 'High-risk deposits ka backup') },
                  { label: t('Team & Advisors', 'Team aur Advisors'), pct: '15%', color: 'from-[#8b5cf6] to-[#d946ef]', desc: t('3-year vesting', '3 saal ki vesting') },
                  { label: t('Marketing', 'Marketing'), pct: '10%', color: 'from-[#f43f5e] to-[#fb923c]', desc: t('Airdrops, bounties', 'Airdrops aur bounties') },
                  { label: t('Community Sale', 'Community Sale'), pct: '10%', color: 'from-[#facc15] to-[#84cc16]', desc: t('100% unlocked at TGE', 'TGE par 100% unlock') },
                  { label: t('Treasury / DAO', 'Treasury / DAO'), pct: '10%', color: 'from-[#10b981] to-[#14b8a6]', desc: t('Multisig governed', 'Multisig ke tehat') },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-white font-medium">{item.label}</span>
                      <span className="text-slate-400">{item.desc} ({item.pct})</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2">
                      <div className={`bg-gradient-to-r ${item.color} h-2 rounded-full`} style={{ width: item.pct }}></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 pt-6 border-t border-slate-700">
                <button className="text-[#06b6d4] font-bold hover:text-[#14F195] transition-colors flex items-center gap-1 text-sm">
                  {t("Read the Full Tokenomics Paper", "Mukammal Tokenomics Padhain")} <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COMMUNITY SALE SECTION (Moved from HomePage) */}
      <section className="py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            
            {/* Sale Info */}
            <div className="flex-1 space-y-6">
              <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1 bg-amber-100 text-amber-700 rounded-full border border-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                {t("LIVE NOW", "ABHI LIVE HAI")}
              </div>
              <h2 className="font-headline text-4xl md:text-5xl font-black text-on-surface leading-tight">
                {t("The First Token Where", "Pehla Token Jahan")} <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#d97706] to-[#f59e0b]">{t("Showing Up Is the Alpha.", "Aana Hi Sab Kuch Hai.")}</span>
              </h2>
              <p className="font-body text-lg text-slate-600 leading-relaxed">
                {t("Join the community‑powered launch. Buy $PAB at the DEX listing price — no VCs, no insider unlocks, just fair distribution.", "Community ki sale mein hissa lein. $PAB ko DEX listing price par kharidein — koi VC nahi, siraf fair distribution.")}
              </p>
              
              <div className="bg-surface-bright border border-outline-variant/20 rounded-2xl p-6 space-y-4 shadow-sm">
                <div className="flex justify-between items-center pb-4 border-b border-outline-variant/20">
                  <span className="text-slate-500 font-medium">{t("Price", "Qeemat")}</span>
                  <span className="font-bold text-on-surface">1 SOL = 10,000 $PAB</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-outline-variant/20">
                  <span className="text-slate-500 font-medium">{t("Min / Max", "Min / Max")}</span>
                  <span className="font-bold text-on-surface">0.1 SOL / 50 SOL</span>
                </div>
                <div className="pt-2">
                  <div className="flex justify-between text-sm mb-1 font-bold">
                    <span className="text-slate-700">{t("Progress (Soft Cap Reached)", "Progress (Soft Cap Reached)")}</span>
                    <span className="text-[#10b981]">12 / 50 SOL</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3">
                    <div className="bg-gradient-to-r from-[#f59e0b] to-[#10b981] h-3 rounded-full w-[24%]"></div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-2">
                <button onClick={() => window.open('https://raydium.io/swap/?inputCurrency=sol&outputCurrency=Cc2nwBNc8Zo5e6QwmtV3JQfEi2gTfEYNrDGgxPmGaZLZ', '_blank')} className="px-8 py-4 bg-primary text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all">
                  {t("Buy $PAB Now →", "$PAB Abhi Khareedain →")}
                </button>
                <button onClick={() => window.open('https://discord.gg/pabandi', '_blank')} className="px-8 py-4 bg-white border-2 border-primary text-primary font-bold rounded-xl hover:bg-slate-50 transition-colors">
                  {t("Join Discord for Updates", "Updates Ke Liye Discord Join Karein")}
                </button>
              </div>
              
              {/* Trust Indicators */}
              <div className="flex flex-wrap gap-3 pt-4">
                <span className="text-xs font-bold px-2 py-1 bg-slate-100 text-slate-500 rounded flex items-center gap-1 border border-slate-200">
                  <span className="material-symbols-outlined text-[14px]">lock</span> {t("Multisig-Secured", "Multisig-Secured")}
                </span>
                <span className="text-xs font-bold px-2 py-1 bg-slate-100 text-slate-500 rounded flex items-center gap-1 border border-slate-200">
                  <span className="material-symbols-outlined text-[14px]">block</span> {t("Mint Authority Revoked", "Mint Authority Revoked")}
                </span>
                <span className="text-xs font-bold px-2 py-1 bg-slate-100 text-slate-500 rounded flex items-center gap-1 border border-slate-200">
                  <span className="material-symbols-outlined text-[14px]">verified_user</span> {t("Audit Pending", "Audit Pending")}
                </span>
              </div>
            </div>

            {/* Steps UI */}
            <div className="flex-1 w-full max-w-md bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-8 shadow-xl">
              <h3 className="font-headline font-bold text-2xl mb-8 text-on-surface">{t("How It Works", "Yeh Kaise Kaam Karta Hai")}</h3>
              <div className="space-y-8 relative before:absolute before:inset-0 before:ml-[15px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-[#14F195] before:to-[#06b6d4]">
                
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full border-4 border-white bg-[#14F195] text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                    <span className="font-bold text-xs text-[#0f172a]">1</span>
                  </div>
                  <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-slate-200 bg-white shadow-sm ml-4 md:ml-0 md:group-even:ml-10 md:group-odd:mr-10">
                    <h4 className="font-bold text-slate-800 text-sm mb-1">{t("Whitelist Your Wallet", "Apna Wallet Whitelist Karein")}</h4>
                    <p className="text-xs text-slate-500">{t("Fill the form with your Solana address and email.", "Form mein apna Solana address aur email darj karein.")}</p>
                  </div>
                </div>

                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full border-4 border-white bg-slate-300 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                    <span className="font-bold text-xs">2</span>
                  </div>
                  <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-slate-200 bg-white shadow-sm ml-4 md:ml-0 md:group-even:ml-10 md:group-odd:mr-10">
                    <h4 className="font-bold text-slate-800 text-sm mb-1">{t("Send SOL", "SOL Bhejein")}</h4>
                    <p className="text-xs text-slate-500">{t("Use the generated Solana Pay QR or deep link to contribute.", "Contribute karne ke liye generated Solana Pay QR ya deep link istemal karein.")}</p>
                  </div>
                </div>

                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full border-4 border-white bg-slate-300 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                    <span className="font-bold text-xs">3</span>
                  </div>
                  <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-slate-200 bg-white shadow-sm ml-4 md:ml-0 md:group-even:ml-10 md:group-odd:mr-10">
                    <h4 className="font-bold text-slate-800 text-sm mb-1">{t("Receive $PAB", "$PAB Hasil Karein")}</h4>
                    <p className="text-xs text-slate-500">{t("Tokens are airdropped directly to your wallet when the sale closes.", "Sale khatam hone par tokens direct aapke wallet mein airdrop ho jayenge.")}</p>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>
      
    </div>
  );
}
