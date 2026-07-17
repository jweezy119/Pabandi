import { ShieldCheckIcon, ScaleIcon, DocumentCheckIcon, HeartIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '../context/LanguageContext';

export default function ShariaCompliancePage() {
  const { t, language } = useLanguage();

  const PILLARS = [
    {
      icon: ScaleIcon,
      title: t("No Riba (Interest)", "Koi Riba (Sood) Nahi"),
      desc: t(
        "Escrow deposits are securely locked in a smart contract and do not earn or accrue interest while held. Funds are only used for their intended purpose: guaranteeing a booking.",
        "Escrow deposits mehfooz tareeqay se smart contract mein lock hotay hain aur in par koi sood (interest) nahi milta. Funds siraf booking ki guarantee ke liye istemal hotay hain."
      ),
      color: "from-emerald-400 to-teal-500",
      bgColor: "bg-emerald-500/10"
    },
    {
      icon: DocumentCheckIcon,
      title: t("Eliminating Gharar (Uncertainty)", "Gharar (Ghair Yakeeni) Ka Khatma"),
      desc: t(
        "Smart contracts execute precisely based on verifiable data (like checking in via a PMS). There is no ambiguity, gambling, or excessive uncertainty in how deposits are handled.",
        "Smart contracts qabil-e-tasdeeq data par amal karte hain. Deposits ke muamlaat mein koi juwa ya ghair yakeeni soorat-e-haal nahi hoti."
      ),
      color: "from-indigo-400 to-blue-500",
      bgColor: "bg-indigo-500/10"
    },
    {
      icon: HeartIcon,
      title: t("Mudarabah/Musharakah (Profit Sharing)", "Mudarabah/Musharakah (Munafa ki Taqseem)"),
      desc: t(
        "Unlike traditional DeFi yield farming that offers fixed interest rates, staking $PAB involves risk-sharing. Stakers earn a proportional share of actual platform revenue generated from services.",
        "Riwayati DeFi ki tarah fixed sood ke bajaye, $PAB staking mein risk-sharing hoti hai. Stakers platform ki haqeeqi aamdani (revenue) se apna hissa wasool karte hain."
      ),
      color: "from-fuchsia-400 to-pink-500",
      bgColor: "bg-fuchsia-500/10"
    }
  ];

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body overflow-hidden">
      {/* ─── Hero Section ────────────────────────────────────────────────────────── */}
      <section className="relative pt-24 pb-16 px-6 md:px-8 text-center max-w-5xl mx-auto">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-3xl">
          <div className="absolute inset-0 bg-emerald-500/10 blur-[100px] rounded-full"></div>
        </div>
        
        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-label text-sm font-bold mx-auto">
            <ShieldCheckIcon className="w-5 h-5" />
            {t("Sharia-Compliant by Design", "Sharia ke mutabiq tayar karda")}
          </div>
          <h1 className="font-headline text-4xl md:text-6xl font-black tracking-tight text-on-surface leading-tight">
            {language === 'en' ? (
              <>Ethical Finance meets <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">Web3 Trust</span></>
            ) : (
              <>Akhlaqi Maliyat aur <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">Web3 ka Aitmaad</span></>
            )}
          </h1>
          <p className="font-body text-lg md:text-xl text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
            {t(
              "Pabandi’s escrow system and token economy are built from the ground up to adhere to Islamic finance principles. No interest, no gambling, just fair trade and shared success.",
              "Pabandi ka escrow system aur token economy Islami usoolon par mabni hain. Koi sood nahi, koi juwa nahi, siraf munsifana tijarat aur mushtarika kamyabi."
            )}
          </p>
        </div>
      </section>

      {/* ─── The Three Pillars ─────────────────────────────────────────────────── */}
      <section className="py-16 px-6 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-headline text-3xl font-black text-on-surface mb-4">
              {t("The Three Pillars of Halal Escrow", "Halal Escrow ke Teen Sutoon")}
            </h2>
            <p className="text-on-surface-variant max-w-2xl mx-auto">
              {t(
                "How we ensure every transaction on Pabandi is ethical, transparent, and compliant.",
                "Hum kaisay yakeeni banate hain ke Pabandi par har transaction akhlaqi, shaffaf, aur usoolon ke mutabiq ho."
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {PILLARS.map((pillar, idx) => (
              <div key={idx} className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-8 hover:shadow-lg transition-all relative overflow-hidden group">
                <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl opacity-20 bg-gradient-to-br ${pillar.color} translate-x-1/3 -translate-y-1/3 group-hover:opacity-40 transition-opacity`}></div>
                <div className={`w-14 h-14 rounded-2xl ${pillar.bgColor} flex items-center justify-center mb-6`}>
                  <pillar.icon className="w-7 h-7 text-on-surface" />
                </div>
                <h3 className="font-headline text-xl font-bold text-on-surface mb-3">
                  {pillar.title}
                </h3>
                <p className="text-on-surface-variant leading-relaxed">
                  {pillar.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Staking vs Yield Farming ────────────────────────────────────────── */}
      <section className="py-20 px-6 md:px-8 bg-surface-container-lowest border-y border-outline-variant/10">
        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1 space-y-6">
            <h2 className="font-headline text-3xl md:text-4xl font-black text-on-surface">
              {t("Why $PAB Staking is Halal", "$PAB Staking Halal Kyun Hai")}
            </h2>
            <p className="text-on-surface-variant text-lg leading-relaxed">
              {t(
                "In traditional DeFi, users lend their crypto to earn a guaranteed, fixed interest rate (Riba), which is strictly prohibited. ",
                "Riwayati DeFi mein, users apna crypto sood (Riba) kamanay ke liye udhaar dete hain, jo ke sakhti se mana hai. "
              )}
            </p>
            <p className="text-on-surface-variant text-lg leading-relaxed">
              {t(
                "Pabandi staking acts as a profit-sharing mechanism (Mudarabah/Musharakah). When you stake $PAB, you provide liquidity to back high-value escrow guarantees. In return, you earn a share of the actual business revenue generated by the platform. If the platform earns no revenue, stakers earn no profit. This shared risk and reward is the foundation of Islamic finance.",
                "Pabandi staking munafa ki taqseem (Mudarabah/Musharakah) ke taur par kaam karti hai. Aapka munafa platform ke haqeeqi revenue se munsalik hota hai. Agar platform revenue nahi kamata, toh stakers ko bhi munafa nahi milta. Yeh mushtarika risk Islami maliyat ki bunyaad hai."
              )}
            </p>
          </div>
          
          <div className="flex-1 w-full max-w-md bg-white rounded-3xl p-6 border border-outline-variant/20 shadow-sm relative">
            <div className="absolute -top-4 -right-4 w-20 h-20 bg-emerald-500/20 blur-2xl rounded-full"></div>
            
            <div className="space-y-6 relative z-10">
              <div className="p-4 rounded-2xl bg-red-50 border border-red-100 flex items-start gap-4">
                <span className="material-symbols-outlined text-red-500 mt-1">cancel</span>
                <div>
                  <h4 className="font-bold text-red-900 mb-1">{t("Prohibited (Haram)", "Haram")}</h4>
                  <p className="text-sm text-red-700">{t("Fixed yield, guaranteed interest rates (Riba), earning money from lending money.", "Fixed sood, lending se paisa kamana (Riba).")}</p>
                </div>
              </div>
              
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-start gap-4">
                <span className="material-symbols-outlined text-emerald-600 mt-1">check_circle</span>
                <div>
                  <h4 className="font-bold text-emerald-900 mb-1">{t("Compliant (Halal)", "Halal")}</h4>
                  <p className="text-sm text-emerald-700">{t("Profit & risk sharing, earning from actual business services provided, asset-backed transactions.", "Munafa aur risk ki taqseem, haqeeqi business aamdani se kamائی.")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Transparency ──────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 md:px-8 max-w-4xl mx-auto text-center space-y-8">
        <h2 className="font-headline text-3xl font-black text-on-surface">
          {t("Absolute Transparency on the Blockchain", "Blockchain par Mukammal Shaffafiyat")}
        </h2>
        <p className="text-on-surface-variant text-lg leading-relaxed max-w-2xl mx-auto">
          {t(
            "Every escrow transaction, payout, and reward distribution is recorded immutably on the Solana blockchain. Anyone can audit the flow of funds to verify that no hidden interest or illicit activities are taking place.",
            "Har transaction aur inaam ki taqseem Solana blockchain par hamesha ke liye darj hoti hai. Koi bhi shakhs isay check kar sakta hai taake yakeeni banaya ja sakay ke koi chupa hua sood nahi."
          )}
        </p>
        <div className="pt-6">
          <button onClick={() => window.open('https://solscan.io', '_blank')} className="btn-primary px-8 py-3.5 text-sm font-bold shadow-lg shadow-primary/20">
            {t("View Smart Contracts on Explorer", "Smart Contracts Dekhein")}
          </button>
        </div>
      </section>
    </div>
  );
}
