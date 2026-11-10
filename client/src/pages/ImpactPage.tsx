import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  Smartphone, 
  ShieldCheck, 
  ArrowLeft, 
  Globe2, 
  Send, 
  CheckCircle2, 
  TrendingUp, 
  Award, 
  ArrowRight,
  Zap,
  Users,
  Coins,
  QrCode,
  FileCheck
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import '../styles/pbn-tokens.css';

export default function ImpactPage() {
  const { language, setLanguage, isRTL, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'inclusion' | 'remittance' | 'passport'>('inclusion');

  return (
    <main 
      className={`min-h-screen text-[#e8eef4] selection:bg-[#4fd1c5] selection:text-[#0a1118] ${isRTL ? 'rtl' : 'ltr'}`}
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        backgroundColor: 'var(--pbn-bg, #0a1118)',
        fontFamily: isRTL 
          ? "'Noto Nastaliq Urdu', 'Space Grotesk', system-ui, sans-serif" 
          : "var(--pbn-font-ui, 'Space Grotesk', system-ui, sans-serif)",
      }}
    >
      {/* ── Top Navigation Bar ── */}
      <header className="border-b border-[rgba(255,255,255,0.08)] bg-[#101a24]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              to="/" 
              className="inline-flex items-center gap-2 text-xs font-mono text-[#8a9aa8] hover:text-[#4fd1c5] transition-colors focus-visible:ring-2 focus-visible:ring-[#4fd1c5] focus-visible:outline-none rounded px-2 py-1"
              aria-label="Back to home"
            >
              <ArrowLeft size={14} className={isRTL ? 'rotate-180' : ''} />
              <span>{t('Pabandi Core', 'پابندی کور')}</span>
            </Link>
            <span className="text-[rgba(255,255,255,0.16)] font-mono">/</span>
            <span className="text-xs font-mono text-[#4fd1c5] font-semibold tracking-wide uppercase">
              {t('Impact & Financial Inclusion', 'معاشی شمولیت و سماجی اثرات')}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Language Switcher Pill */}
            <div className="inline-flex items-center p-1 rounded-lg bg-white/[0.04] border border-white/10 text-xs font-mono">
              <button
                type="button"
                onClick={() => setLanguage('EN')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  language === 'EN' 
                    ? 'bg-[#4fd1c5] text-[#0a1118] font-bold' 
                    : 'text-[#8a9aa8] hover:text-[#e8eef4]'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('UR')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  language === 'UR' 
                    ? 'bg-[#4fd1c5] text-[#0a1118] font-bold font-sans' 
                    : 'text-[#8a9aa8] hover:text-[#e8eef4]'
                }`}
              >
                اردو
              </button>
            </div>

            <Link
              to="/sharia-compliance"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-mono text-[#8a9aa8] hover:text-[#e8eef4] bg-white/[0.04] border border-white/10 px-3 py-1.5 rounded-lg hover:border-[#4fd1c5]/40 transition-colors"
            >
              <ShieldCheck size={13} className="text-[#34d399]" />
              <span>{t('Sharia Audit', 'شرعی آڈٹ')}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden pt-16 pb-20 border-b border-[rgba(255,255,255,0.08)]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#4fd1c5]/10 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono text-[#4fd1c5] bg-[#4fd1c5]/10 border border-[#4fd1c5]/30">
            <Globe2 size={14} />
            <span>{t('SBP Raast & Mojaloop Compatible Financial Architecture', 'اسٹیٹ بینک راست اور موجالوپ کے مطابق مالیاتی ڈھانچہ')}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#e8eef4] leading-[1.2]">
            {t(
              'Formalizing the Informal Economy.',
              'غیر رسمی معیشت کو باضابطہ اور مستحکم بنانا۔'
            )}
          </h1>

          <p className="text-base sm:text-lg text-[#8a9aa8] max-w-2xl mx-auto font-normal leading-relaxed">
            {t(
              'Over 70% of Pakistan’s workforce operates in the informal cash economy with zero credit history. Pabandi bridges local domestic rails (Raast, JazzCash, EasyPaisa) and global programmable escrow (Solana USDC) to transform verified daily jobs into portable financial passports.',
              'پاکستان کی 70 فیصد سے زیادہ افرادی قوت روایتی نقد معیشت میں بغیر کسی کریڈٹ ریکارڈ کے کام کرتی ہے۔ پابندی مقامی بینکنگ ریلز (راست، جاز کیش، ایزی پیسہ) اور عالمی اسکرو (سولانا یو ایس ڈی سی) کے ذریعے ہر مکمل کام کو ایک قابلِ اعتماد مالیاتی پاسپورٹ میں تبدیل کرتی ہے۔'
            )}
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <Link
              to="/signup?module=contact"
              className="min-h-[48px] px-6 py-3 rounded-xl bg-[#4fd1c5] hover:bg-[#38b2ac] text-[#0a1118] font-bold text-sm inline-flex items-center gap-2.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#4fd1c5] focus-visible:outline-none"
            >
              <span>{t('Onboard as a Verified Worker', 'بطور تصدیق شدہ ورکر شامل ہوں')}</span>
              <ArrowRight size={16} className={isRTL ? 'rotate-180' : ''} />
            </Link>

            <Link
              to="/sharia-compliance"
              className="min-h-[48px] px-6 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#e8eef4] border border-white/10 font-semibold text-sm inline-flex items-center gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-[#4fd1c5] focus-visible:outline-none"
            >
              <ShieldCheck size={16} className="text-[#34d399]" />
              <span>{t('View Islamic Finance Principles', 'اسلامی فنانس کے اصول دیکھیں')}</span>
            </Link>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-10 text-left">
            <div className="p-4 rounded-xl bg-[#101a24] border border-[rgba(255,255,255,0.08)]">
              <span className="block text-[11px] font-mono text-[#8a9aa8] uppercase tracking-wider">
                {t('Domestic Rails', 'مقامی بینک ریلز')}
              </span>
              <span className="text-xl font-bold font-mono text-[#34d399] mt-0.5 block">0% Fee Raast</span>
              <span className="text-[11px] text-[#8a9aa8] mt-1 block">
                {t('Direct SBP instant clearing', 'اسٹیٹ بینک کی فوری کلیئرنگ')}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-[#101a24] border border-[rgba(255,255,255,0.08)]">
              <span className="block text-[11px] font-mono text-[#8a9aa8] uppercase tracking-wider">
                {t('Cross-Border FX', 'بین الاقوامی منتقلی')}
              </span>
              <span className="text-xl font-bold font-mono text-[#4fd1c5] mt-0.5 block">0% Remittance</span>
              <span className="text-[11px] text-[#8a9aa8] mt-1 block">
                {t('Solana USDC sub-second settlement', 'سولانا یو ایس ڈی سی فوری تصفیہ')}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-[#101a24] border border-[rgba(255,255,255,0.08)]">
              <span className="block text-[11px] font-mono text-[#8a9aa8] uppercase tracking-wider">
                {t('Unbanked Access', 'غیر بینک شدہ افراد')}
              </span>
              <span className="text-xl font-bold font-mono text-[#e8eef4] mt-0.5 block">Mobile Wallets</span>
              <span className="text-[11px] text-[#8a9aa8] mt-1 block">
                {t('JazzCash & EasyPaisa native QR', 'جاز کیش اور ایزی پیسہ کیو آر')}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-[#101a24] border border-[rgba(255,255,255,0.08)]">
              <span className="block text-[11px] font-mono text-[#8a9aa8] uppercase tracking-wider">
                {t('Credit Building', 'کریڈٹ اور ساکھ')}
              </span>
              <span className="text-xl font-bold font-mono text-[#34d399] mt-0.5 block">Trust Score</span>
              <span className="text-[11px] text-[#8a9aa8] mt-1 block">
                {t('Collateral-free micro loans', 'بغیر ضمانت مائیکرو فنانس')}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3 Strategic Pillars of Inclusion ── */}
      <section className="py-20 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#e8eef4]">
            {t('The 3 Pillars of Financial Inclusion', 'معاشی شمولیت کے ۳ بنیادی ستون')}
          </h2>
          <p className="text-sm sm:text-base text-[#8a9aa8] mt-2">
            {t(
              'How Pabandi replaces usurious middlemen with transparent, protocol-level rails.',
              'پابندی کس طرح روایتی سودی مڈل مین کا خاتمہ کر کے شفاف اور محفوظ نیٹ ورک فراہم کرتی ہے۔'
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Raast & Wallets */}
          <div className="p-6 rounded-2xl bg-[#101a24] border border-[rgba(255,255,255,0.08)] flex flex-col justify-between hover:border-[#4fd1c5]/30 transition-all">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-950/60 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                <Smartphone size={24} />
              </div>
              <h3 className="text-lg font-bold text-[#e8eef4]">
                {t('1. Domestic Cashless Onboarding', '۱. مقامی کیش لیس آن بورڈنگ')}
              </h3>
              <p className="text-sm text-[#8a9aa8] leading-relaxed">
                {t(
                  'Plumbers, roofers, salon technicians, and independent mechanics receive instant payments directly into their JazzCash, EasyPaisa, or bank account via SBP Raast. No expensive POS machines or banking red tape required.',
                  'پلمبر، الیکٹریشن، سیلون ورکرز اور مکینک کسی بھی پیچیدہ بینکاری کاغذی کارروائی کے بغیر اسٹیٹ بینک کے راست، جاز کیش اور ایزی پیسہ کے ذریعے براہ راست فوری ادائیگیاں وصول کرتے ہیں۔'
                )}
              </p>
              <div className="pt-2">
                <span className="inline-block text-[11px] font-mono text-[#34d399] bg-emerald-950/50 px-2.5 py-1 rounded border border-emerald-500/20">
                  {t('100% Interoperable across all 33 Pakistani Banks', 'پاکستان کے تمام ۳۳ بینکوں کے ساتھ مربوط')}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Financial Passport */}
          <div className="p-6 rounded-2xl bg-[#101a24] border border-[rgba(255,255,255,0.08)] flex flex-col justify-between hover:border-[#4fd1c5]/30 transition-all">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-[#4fd1c5]/10 text-[#4fd1c5] border border-[#4fd1c5]/20 flex items-center justify-center">
                <Award size={24} />
              </div>
              <h3 className="text-lg font-bold text-[#e8eef4]">
                {t('2. Trust Scores as Financial Passports', '۲. ٹرسٹ اسکور بطور مالیاتی پاسپورٹ')}
              </h3>
              <p className="text-sm text-[#8a9aa8] leading-relaxed">
                {t(
                  'Every job confirmed via QR check-in and customer sign-off builds an immutable Trust Score. Instead of asking for physical land collateral, future micro-finance institutions can evaluate verifiable performance history.',
                  'کیو آر کوڈ کے ذریعے ہر مکمل ہونے والا کام کارکن کی ساکھ کو محفوظ کرتا ہے۔ روایتی زمین یا اثاثوں کی ضمانت کے بغیر یہ ریکارڈ مستقبل میں سودی مڈل مین کے بغیر مائیکرو فنانس تک رسائی کا راستہ کھولتا ہے۔'
                )}
              </p>
              <div className="pt-2">
                <span className="inline-block text-[11px] font-mono text-[#4fd1c5] bg-[#4fd1c5]/10 px-2.5 py-1 rounded border border-[#4fd1c5]/20">
                  {t('Cryptographically Verified Proof-of-Work', 'کرپٹوگرافک طور پر تصدیق شدہ کام کا ثبوت')}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Zero-Fee Cross Border */}
          <div className="p-6 rounded-2xl bg-[#101a24] border border-[rgba(255,255,255,0.08)] flex flex-col justify-between hover:border-[#4fd1c5]/30 transition-all">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-purple-950/60 text-purple-400 border border-purple-500/20 flex items-center justify-center">
                <Send size={24} />
              </div>
              <h3 className="text-lg font-bold text-[#e8eef4]">
                {t('3. Zero-Fee Cross-Border Remittances', '۳. بلا فیس بین الاقوامی ترسیلات')}
              </h3>
              <p className="text-sm text-[#8a9aa8] leading-relaxed">
                {t(
                  'Overseas clients in the US and Europe can hire Pakistani technical talent or pay for family services back home without losing 7-12% to Western Union or traditional SWIFT spreads. Solana USDC settles instantly at 1:1 parity.',
                  'امریکہ اور یورپ میں مقیم صارفین ویسٹرن یونین یا بینکوں کی 7 سے 12 فیصد زائد فیس کے بغیر پاکستان میں ہنر مند ورکرز کو فوری اور مکمل ادائیگی یو ایس ڈی سی کے ذریعے کر سکتے ہیں۔'
                )}
              </p>
              <div className="pt-2">
                <span className="inline-block text-[11px] font-mono text-purple-300 bg-purple-950/50 px-2.5 py-1 rounded border border-purple-500/20">
                  {t('Sub-second finality · < $0.001 network gas', 'ایک سیکنڈ سے کم تصفیہ · صفر فی فیس')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Visual Comparison Section: Informal vs Formal ── */}
      <section className="py-16 bg-[#101a24]/50 border-t border-b border-[rgba(255,255,255,0.08)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-xl mx-auto mb-12">
            <h2 className="text-2xl font-bold text-[#e8eef4]">
              {t('Informal Cash Economy vs. Pabandi Trust Rails', 'روایتی غیر رسمی طریقہ بمقابلہ پابندی نظام')}
            </h2>
            <p className="text-sm text-[#8a9aa8] mt-2">
              {t('A side-by-side breakdown of economic empowerment.', 'معاشی آزادی اور تحفظ کا مکمل جائزہ۔')}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse font-sans">
              <thead>
                <tr className="border-b border-white/10 text-xs font-mono uppercase tracking-wider text-[#8a9aa8]">
                  <th className="py-3 px-4">{t('Dimension', 'پہلو')}</th>
                  <th className="py-3 px-4 text-[#f87171]">{t('Traditional Informal Reality', 'روایتی طریقہ کار')}</th>
                  <th className="py-3 px-4 text-[#4fd1c5]">{t('Pabandi Financial Passport', 'پابندی فنانشل پاسپورٹ')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs sm:text-sm">
                <tr>
                  <td className="py-4 px-4 font-semibold text-[#e8eef4]">{t('Payment Guarantee', 'ادائیگی کی ضمانت')}</td>
                  <td className="py-4 px-4 text-[#8a9aa8]">{t('Verbal agreement, rampant non-payment risk', 'زبانی معاہدہ، رقم ڈوبنے کا خطرہ')}</td>
                  <td className="py-4 px-4 text-emerald-400 font-semibold">{t('Funds pre-locked in non-custodial escrow', 'رقم اسکرو میں محفوظ اور ضمانت یافتہ')}</td>
                </tr>
                <tr>
                  <td className="py-4 px-4 font-semibold text-[#e8eef4]">{t('Credit Record', 'کریڈٹ ہسٹری')}</td>
                  <td className="py-4 px-4 text-[#8a9aa8]">{t('Zero record; considered unbankable by commercial banks', 'صفر ریکارڈ؛ روایتی بینک قرض نہیں دیتے')}</td>
                  <td className="py-4 px-4 text-emerald-400 font-semibold">{t('Verified Trust Score unlocks clean micro-credit', 'تصدیق شدہ ساکھ مائیکرو فنانس کی اہل بناتی ہے')}</td>
                </tr>
                <tr>
                  <td className="py-4 px-4 font-semibold text-[#e8eef4]">{t('Remittance Fee', 'ترسیلات زر کی لاگت')}</td>
                  <td className="py-4 px-4 text-[#8a9aa8]">{t('7% - 12% lost to informal hawala or wire fees', 'حوالہ یا بینکوں کے ذریعے 7 سے 12 فیصد کٹوتی')}</td>
                  <td className="py-4 px-4 text-emerald-400 font-semibold">{t('0% FX spread using Solana USDC & Raast', 'سولانا یو ایس ڈی سی اور راست پر صفر فیس')}</td>
                </tr>
                <tr>
                  <td className="py-4 px-4 font-semibold text-[#e8eef4]">{t('Dispute Resolution', 'تنازعات کا حل')}</td>
                  <td className="py-4 px-4 text-[#8a9aa8]">{t('Protracted police or local council friction', 'عدالتی یا مقامی الجھنیں')}</td>
                  <td className="py-4 px-4 text-emerald-400 font-semibold">{t('Sulha community arbitration on verified milestones', 'صلح کمیٹی کے ذریعے تیز اور منصفانہ فیصلہ')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── State Bank of Pakistan & Incubator Alignment ── */}
      <section className="py-20 max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono text-[#34d399] bg-emerald-950/60 border border-emerald-500/20">
          <CheckCircle2 size={13} />
          <span>{t('Aligned with National Financial Inclusion Strategy (NFIS)', 'قومی مالیاتی شمولیت کی حکمت عملی کے عین مطابق')}</span>
        </div>

        <h2 className="text-2xl sm:text-4xl font-bold text-[#e8eef4]">
          {t('Building for Pakistan’s Digital Renaissance', 'پاکستان کے ڈیجیٹل مستقبل کی تعمیر')}
        </h2>

        <p className="text-base text-[#8a9aa8] max-w-2xl mx-auto leading-relaxed">
          {t(
            'In alignment with State Bank of Pakistan (SBP) directives and the National Incubation Center (NIC) roadmap, Pabandi eliminates cash friction without imposing foreign currency vulnerabilities or predatory debt traps.',
            'اسٹیٹ بینک آف پاکستان کی ہدایات اور این آئی سی کے وژن کے مطابق، پابندی غیر ملکی کرنسی کے غیر ضروری خطرات یا سودی قرضوں کے بغیر شفافیت اور معاشی آزادی لاتی ہے۔'
          )}
        </p>

        <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/developers"
            className="px-6 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#e8eef4] border border-white/10 text-xs font-mono inline-flex items-center gap-2 transition-colors"
          >
            <span>{t('View Developer API & MCP Server', 'ڈویلپر اے پی آئی اور ایم سی پی سرور')}</span>
            <ArrowRight size={14} className={isRTL ? 'rotate-180' : ''} />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[rgba(255,255,255,0.08)] py-8 text-center text-xs font-mono text-[#8a9aa8]">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>{t('© 2026 Pabandi. Financial Inclusion & Trust Infrastructure.', '© ۲۰۲۶ پابندی۔ مالیاتی شمولیت اور اعتماد کا بنیادی ڈھانچہ۔')}</span>
          <div className="flex items-center gap-4">
            <Link to="/sharia-compliance" className="hover:text-[#4fd1c5] transition-colors">
              {t('Sharia Compliance', 'شرعی اصول')}
            </Link>
            <Link to="/developers" className="hover:text-[#4fd1c5] transition-colors">
              {t('API & MCP Tools', 'اے پی آئی ٹولز')}
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

