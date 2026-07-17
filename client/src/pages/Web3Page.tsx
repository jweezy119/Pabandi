import { useLanguage } from '../context/LanguageContext';
import { ShieldCheckIcon, BoltIcon, LinkIcon, BanknotesIcon } from '@heroicons/react/24/outline';

export default function Web3Page() {
  const { t, language } = useLanguage();

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-8 py-12 md:py-20 space-y-24 font-body">
      {/* ─── Hero Section: Web3 for Dummies ─────────────────────────────────── */}
      <section className="text-center max-w-4xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-label text-sm mb-4 font-bold">
          <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
          {t("Web3 Made Simple", "Web3 Ko Aasaan Banaya")}
        </div>
        <h1 className="font-headline text-[2.5rem] md:text-[4rem] leading-[1.1] font-black text-on-surface tracking-tight">
          {language === 'en' ? (
            <>How Pabandi Uses <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#14F195] to-[#9945FF]">Web3</span> to Eliminate Fraud</>
          ) : (
            <>Pabandi <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#14F195] to-[#9945FF]">Web3</span> Ke Zariye Fraud Kaise Khatam Karta Hai</>
          )}
        </h1>
        <p className="text-xl text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
          {t(
            "You don’t need to be a crypto expert to use Pabandi. We use blockchain technology in the background purely as a tool to lock deposits safely, guarantee payments, and reward you for showing up.",
            "Pabandi istemal karne ke liye aapko crypto expert banne ki zaroorat nahi. Hum blockchain ka istemal sirf deposits ko mehfooz rakhne aur aapko inaam dene ke liye karte hain."
          )}
        </p>
      </section>

      {/* ─── Section 1: What is Staking? ────────────────────────────────────── */}
      <section className="bg-surface-container-low rounded-3xl p-8 md:p-12 border border-outline-variant/20 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 space-y-6">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <ShieldCheckIcon className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-headline text-3xl font-black text-on-surface">
              {t("What does 'Staking' mean?", "'Staking' Ka Kya Matlab Hai?")}
            </h2>
            <p className="text-lg text-on-surface-variant leading-relaxed">
              {t(
                "Think of staking as a security deposit. When you 'stake' $PAB tokens, you are temporarily locking them up to prove you are a reliable actor on the platform.",
                "Staking ko ek security deposit samajhein. Jab aap $PAB tokens 'stake' karte hain, toh aap unhe kuch arsay ke liye lock kar dete hain taake sabit kar sakein ke aap qabil-e-aitmaad hain."
              )}
            </p>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary mt-0.5">check_circle</span>
                <span className="text-on-surface-variant font-medium">{t("Provides liquidity to back real-world bookings.", "Booking ki guarantees ke liye raqam faraham karta hai.")}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary mt-0.5">check_circle</span>
                <span className="text-on-surface-variant font-medium">{t("Earns you a share of platform revenues (Halal/Profit-sharing).", "Aapko platform ke munafe se hissa milta hai (Halal).")}</span>
              </li>
            </ul>
          </div>
          <div className="flex-1 w-full bg-white rounded-2xl p-6 border border-outline-variant/20 shadow-lg text-center">
             <div className="text-6xl mb-4">🔒</div>
             <h3 className="font-bold text-xl mb-2">{t("Your Tokens Are Safe", "Aapke Tokens Mehfooz Hain")}</h3>
             <p className="text-sm text-slate-500">{t("Staked tokens never leave the smart contract without your permission.", "Staked tokens aapki ijazat ke baghair smart contract se nahi nikaltay.")}</p>
          </div>
        </div>
      </section>

      {/* ─── Section 2: Solana & Bitcoin Connectivity ───────────────────────── */}
      <section className="space-y-12">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="font-headline text-3xl font-black text-on-surface mb-4">
            {t("Powered by Solana, Connected to Bitcoin", "Solana Par Mabni, Bitcoin Se Munsalik")}
          </h2>
          <p className="text-on-surface-variant text-lg">
            {t(
              "We chose the best networks for the job. Speed where you need it, and access to the world's most trusted digital asset.",
              "Humne behtareen networks ka intekhab kiya hai. Jahan tezi chahiye wahan Solana, aur dunya ke sab se baray asset (Bitcoin) tak rasai."
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Solana */}
          <div className="bg-[#0f172a] text-white rounded-3xl p-8 md:p-10 border border-[#14F195]/30 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#14F195]/20 blur-2xl rounded-full group-hover:scale-150 transition-transform duration-700"></div>
            <div className="relative z-10 space-y-4">
              <img src="https://cryptologos.cc/logos/solana-sol-logo.svg?v=029" alt="Solana" className="w-12 h-12 mb-6" />
              <h3 className="font-headline text-2xl font-bold">Solana: The Engine</h3>
              <p className="text-slate-400 leading-relaxed">
                {t(
                  "Pabandi runs its core smart contracts on Solana. Why? Because it handles thousands of transactions per second for fractions of a penny. When you book a hotel or a freelancer, the escrow lock happens instantly.",
                  "Pabandi ke core smart contracts Solana par chalte hain kyun ke yeh sasta aur taiz tareen hai. Jab aap booking karte hain toh escrow foran lock ho jata hai."
                )}
              </p>
              <div className="flex items-center gap-2 text-[#14F195] text-sm font-bold pt-4">
                <BoltIcon className="w-5 h-5" /> 400 millisecond settlement
              </div>
            </div>
          </div>

          {/* Bitcoin */}
          <div className="bg-[#fffbeb] text-amber-900 rounded-3xl p-8 md:p-10 border border-[#f59e0b]/30 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#f59e0b]/20 blur-2xl rounded-full group-hover:scale-150 transition-transform duration-700"></div>
            <div className="relative z-10 space-y-4">
              <img src="https://cryptologos.cc/logos/bitcoin-btc-logo.svg?v=029" alt="Bitcoin" className="w-12 h-12 mb-6" />
              <h3 className="font-headline text-2xl font-bold">Bitcoin: Cross-Chain Value</h3>
              <p className="text-amber-700/80 leading-relaxed">
                {t(
                  "Have Bitcoin? You don't need to sell it to use Pabandi. Through cross-chain bridges (like tBTC or cbBTC), you can bring your Bitcoin liquidity to our ecosystem to back escrows or stake for yield.",
                  "Agar aapke paas Bitcoin hai, toh usay baichne ki zaroorat nahi. Aap cross-chain bridges ke zariye apne Bitcoin ko Pabandi mein la kar staking aur escrow ke liye istemal kar sakte hain."
                )}
              </p>
              <div className="flex items-center gap-2 text-[#d97706] text-sm font-bold pt-4">
                <LinkIcon className="w-5 h-5" /> Seamless Bridge Integration
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Section 3: Understanding Pools ─────────────────────────────────── */}
      <section className="bg-surface-bright py-20 px-6 md:px-12 rounded-[2.5rem] border border-outline-variant/10 text-center">
        <h2 className="font-headline text-3xl md:text-4xl font-black text-on-surface mb-6">
          {t("The Two Pools", "Do Kism Ke Pools")}
        </h2>
        <p className="text-on-surface-variant text-lg max-w-2xl mx-auto mb-16">
          {t(
            "When you stake on Pabandi, you choose where your tokens go. Each pool serves a different purpose for the ecosystem.",
            "Jab aap Pabandi par stake karte hain, aap muntakhib karte hain ke aapke tokens kahan jayenge. Har pool ka maqsad mukhtalif hai."
          )}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto text-left">
          {/* Escrow Liquidity Pool */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-outline-variant/20 hover:border-primary/40 transition-colors">
            <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mb-6">
              <BanknotesIcon className="w-7 h-7 text-blue-500" />
            </div>
            <h3 className="font-bold text-xl mb-3">1. {t("Escrow Liquidity Pool", "Escrow Liquidity Pool")}</h3>
            <p className="text-slate-600 mb-6 text-sm leading-relaxed">
              {t(
                "This pool backs the real-world bookings. If a buyer doesn't have enough crypto, this pool lends the guarantee. In return, stakers in this pool earn a cut of the platform's booking fees.",
                "Yeh pool bookings ko guarantee karta hai. Is pool mein stake karne walon ko platform ki fees (munafa) mein se hissa milta hai."
              )}
            </p>
            <div className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg inline-block">
              {t("Best for: Earning real yield from business activity", "Haqeeqi business aamdani se munafe ke liye behtareen")}
            </div>
          </div>

          {/* Governance Pool */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-outline-variant/20 hover:border-primary/40 transition-colors">
            <div className="w-14 h-14 bg-purple-50 rounded-full flex items-center justify-center mb-6">
              <ShieldCheckIcon className="w-7 h-7 text-purple-500" />
            </div>
            <h3 className="font-bold text-xl mb-3">2. {t("Governance Pool", "Governance Pool")}</h3>
            <p className="text-slate-600 mb-6 text-sm leading-relaxed">
              {t(
                "This pool gives you voting power. Want to decide which cities launch next, or what the no-show penalty should be? Stake here to vote on Pabandi's future.",
                "Yeh pool aapko voting ka haq deta hai. Pabandi ke mustaqbil ke faislon (jese naye shehar launch karna) mein shamil hone ke liye yahan stake karein."
              )}
            </p>
            <div className="text-xs font-bold text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg inline-block">
              {t("Best for: Platform influence and voting rights", "Platform par asar-o-rusookh aur voting ke liye behtareen")}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
