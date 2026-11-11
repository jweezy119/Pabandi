import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  Share2,
  QrCode,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ExternalLink,
  Wallet,
  Smartphone,
  CreditCard,
  Building2,
  Scale,
  Plus,
  RefreshCw,
  X
} from 'lucide-react';
import { API_HOST } from '../utils/apiHost';
import { PabandiCheckoutModal } from '../components/PabandiCheckoutModal';
import { SecureQRCode } from '../components/SecureQRCode';
import { useLanguage } from '../context/LanguageContext';
import '../styles/pbn-tokens.css';

const PKR_PER_USD = 280;

interface PaymentLinkDetails {
  id: string;
  slug: string;
  title: string;
  description?: string;
  amount: number | null;
  currency: 'USD' | 'PKR' | 'USDC';
  merchantName: string;
  merchantWallet?: string;
  merchantRaastId?: string;
  trustScore: number;
  isShariaCompliant: boolean;
  allowCustomAmount: boolean;
  suggestedAmounts?: number[];
  url?: string;
  whatsappUrl?: string;
}

export default function UniversalPaymentLinkPage() {
  const { slug } = useParams<{ slug?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { language, setLanguage, isRTL, t } = useLanguage();

  const activeSlug = slug || 'quick-escrow';

  const [linkData, setLinkData] = useState<PaymentLinkDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Currency & Amount State
  const [currency, setCurrency] = useState<'USD' | 'PKR'>('USD');
  const [selectedAmount, setSelectedAmount] = useState<number>(100);
  const [customAmountStr, setCustomAmountStr] = useState<string>('100');

  // Modals & Drawers
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Creator state
  const [creatorName, setCreatorName] = useState('');
  const [creatorTitle, setCreatorTitle] = useState('');
  const [creatorAmount, setCreatorAmount] = useState('50');
  const [creatorRaast, setCreatorRaast] = useState('');
  const [creatorCreating, setCreatorCreating] = useState(false);

  // Fetch link data
  const fetchLink = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queryStr = searchParams.toString();
      const res = await fetch(`${API_HOST}/api/v1/payment-links/${activeSlug}${queryStr ? `?${queryStr}` : ''}`);
      const data = await res.json();
      if (data.success && data.data) {
        setLinkData(data.data);
        const initialCurrency = (data.data.currency || 'USD').toUpperCase() === 'PKR' ? 'PKR' : 'USD';
        setCurrency(initialCurrency);
        const amt = data.data.amount || Number(searchParams.get('amount')) || 100;
        setSelectedAmount(amt);
        setCustomAmountStr(String(amt));
      } else {
        setError(data.error || 'Payment link not found');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load payment link');
    } finally {
      setLoading(false);
    }
  }, [activeSlug, searchParams]);

  useEffect(() => {
    fetchLink();
  }, [fetchLink]);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Convert amounts dynamically
  const amountUsd = useMemo(() => {
    return currency === 'USD' ? selectedAmount : Math.round((selectedAmount / PKR_PER_USD) * 100) / 100;
  }, [currency, selectedAmount]);

  const amountPkr = useMemo(() => {
    return currency === 'PKR' ? selectedAmount : Math.round(selectedAmount * PKR_PER_USD);
  }, [currency, selectedAmount]);

  const handleAmountChange = (val: number) => {
    setSelectedAmount(val);
    setCustomAmountStr(String(val));
  };

  const handleCustomInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setCustomAmountStr(raw);
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed > 0) {
      setSelectedAmount(parsed);
    }
  };

  const currentFullUrl = typeof window !== 'undefined' ? window.location.href : `https://pabandi.com/pay/link/${activeSlug}`;
  const whatsappShareText = encodeURIComponent(
    `Pay securely via Pabandi Escrow: ${linkData?.title || 'Payment'} (${currency === 'USD' ? `$${selectedAmount}` : `Rs. ${selectedAmount.toLocaleString()}`})\n${currentFullUrl}`
  );
  const whatsappUrl = `https://api.whatsapp.com/send?text=${whatsappShareText}`;

  // Handle Quick Creator
  const handleCreateNewLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatorTitle || !creatorName) return;
    setCreatorCreating(true);
    try {
      const res = await fetch(`${API_HOST}/api/v1/payment-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: creatorTitle,
          merchantName: creatorName,
          amount: creatorAmount ? Number(creatorAmount) : null,
          merchantRaastId: creatorRaast || undefined,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setCreateDrawerOpen(false);
        navigate(`/pay/link/${data.data.slug}`);
      }
    } catch {
      // Error handling
    } finally {
      setCreatorCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a1118] flex items-center justify-center text-white font-mono text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#4fd1c5] border-t-transparent animate-spin" />
          <span className="text-[#8a9aa8]">Loading universal escrow link...</span>
        </div>
      </div>
    );
  }

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
      {/* ── Top Header ── */}
      <header className="border-b border-[rgba(255,255,255,0.08)] bg-[#101a24]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-mono text-[#8a9aa8] hover:text-[#4fd1c5] transition-colors"
          >
            <ArrowLeft size={14} className={isRTL ? 'rotate-180' : ''} />
            <span>Pabandi Core</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language Switcher Pill */}
            <div className="inline-flex items-center p-0.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs font-mono">
              <button
                type="button"
                onClick={() => setLanguage('EN')}
                className={`px-2 py-0.5 rounded-md transition-all ${
                  language === 'EN' ? 'bg-[#4fd1c5] text-[#0a1118] font-bold' : 'text-[#8a9aa8]'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('UR')}
                className={`px-2 py-0.5 rounded-md transition-all ${
                  language === 'UR' ? 'bg-[#4fd1c5] text-[#0a1118] font-bold font-sans' : 'text-[#8a9aa8]'
                }`}
              >
                اردو
              </button>
            </div>

            <button
              onClick={() => setCreateDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-white/[0.04] hover:bg-white/[0.08] text-[#e8eef4] border border-white/10 transition-colors"
            >
              <Plus size={13} className="text-[#4fd1c5]" />
              <span className="hidden sm:inline">{t('Create Payment Link', 'نیا لنک بنائیں')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Payment Card Container ── */}
      <div className="max-w-xl mx-auto px-4 py-8 sm:py-12 space-y-6">
        {/* Merchant Trust Header Card */}
        <div className="p-6 rounded-2xl bg-[#101a24] border border-[rgba(255,255,255,0.08)] space-y-4 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#4fd1c5]/20 to-[#38b2ac]/10 border border-[#4fd1c5]/30 flex items-center justify-center font-bold text-lg text-[#4fd1c5]">
                {(linkData?.merchantName || 'P')[0].toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-[#e8eef4]">{linkData?.merchantName}</h1>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950/70 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 size={11} />
                    <span>{t('Verified', 'تصدیق شدہ')}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-[#8a9aa8] mt-0.5">
                  <span>{t('Trust Score:', 'اعتماد اسکور:')}</span>
                  <span className="text-[#4fd1c5] font-bold">{linkData?.trustScore || 800}/1000</span>
                  <span className="text-white/20">•</span>
                  <span>{t('Tier A Settlement', 'اے درجہ تصفیہ')}</span>
                </div>
              </div>
            </div>

            {/* Sharia Compliance Pill */}
            <Link
              to="/sharia-compliance"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono bg-emerald-950/40 text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/40 transition-colors"
            >
              <Scale size={12} className="text-emerald-400" />
              <span className="hidden sm:inline">AAOIFI Riba-Free</span>
            </Link>
          </div>

          <div className="pt-2 border-t border-white/5 space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-bold text-[#e8eef4] tracking-tight">{linkData?.title}</h2>
            {linkData?.description && (
              <p className="text-sm text-[#8a9aa8] leading-relaxed">{linkData.description}</p>
            )}
          </div>
        </div>

        {/* Amount & Currency Selection Card */}
        <div className="p-6 rounded-2xl bg-[#101a24] border border-[rgba(255,255,255,0.08)] space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-[#8a9aa8]">
              {t('Escrow Payment Amount', 'اسکرو ادائیگی کی رقم')}
            </span>

            {/* Currency Switcher */}
            <div className="inline-flex p-1 rounded-lg bg-[#0a1118] border border-white/10 text-xs font-mono">
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`px-3 py-1 rounded-md transition-all ${
                  currency === 'USD' ? 'bg-[#4fd1c5] text-[#0a1118] font-bold' : 'text-[#8a9aa8]'
                }`}
              >
                USD ($)
              </button>
              <button
                type="button"
                onClick={() => setCurrency('PKR')}
                className={`px-3 py-1 rounded-md transition-all ${
                  currency === 'PKR' ? 'bg-[#4fd1c5] text-[#0a1118] font-bold' : 'text-[#8a9aa8]'
                }`}
              >
                PKR (Rs.)
              </button>
            </div>
          </div>

          {/* Amount Display with Dual Conversion */}
          <div className="p-5 rounded-xl bg-[#0a1118] border border-white/10 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <span className="text-3xl sm:text-4xl font-extrabold text-[#e8eef4] tracking-tight">
                {currency === 'USD' ? `$${selectedAmount.toFixed(2)}` : `Rs. ${selectedAmount.toLocaleString()}`}
              </span>
              <span className="ml-2 text-xs font-mono text-[#8a9aa8]">
                {currency === 'USD' ? `≈ Rs. ${amountPkr.toLocaleString()} PKR` : `≈ $${amountUsd.toFixed(2)} USD`}
              </span>
            </div>
            <span className="text-xs font-mono text-emerald-400 font-semibold bg-emerald-950/50 px-2.5 py-1 rounded border border-emerald-500/20">
              {t('0% Platform FX Markup', 'صفر فیصد ایکسچینج کٹوتی')}
            </span>
          </div>

          {/* Preset Suggested Amounts / Custom Amount Input */}
          {linkData?.allowCustomAmount && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(currency === 'USD' ? [25, 50, 100, 250, 500] : [7000, 14000, 28000, 70000]).map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleAmountChange(amt)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
                      selectedAmount === amt
                        ? 'bg-[#4fd1c5] text-[#0a1118] font-bold'
                        : 'bg-white/[0.04] text-[#8a9aa8] hover:text-[#e8eef4] border border-white/10'
                    }`}
                  >
                    {currency === 'USD' ? `$${amt}` : `Rs. ${amt.toLocaleString()}`}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#8a9aa8] mb-1">
                  {t('Or enter custom amount:', 'یا اپنی مرضی کی رقم درج کریں:')}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-sm font-mono text-[#8a9aa8]">
                    {currency === 'USD' ? '$' : 'Rs.'}
                  </span>
                  <input
                    type="number"
                    value={customAmountStr}
                    onChange={handleCustomInput}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0a1118] border border-white/10 text-sm font-mono text-[#e8eef4] focus:outline-none focus:border-[#4fd1c5]"
                    placeholder="Enter amount"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Trigger Button */}
          <button
            type="button"
            onClick={() => setCheckoutOpen(true)}
            className="w-full h-14 rounded-xl bg-[#4fd1c5] hover:bg-[#38b2ac] text-[#0a1118] font-bold text-base inline-flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(79,209,197,0.3)] active:scale-[0.99]"
          >
            <span>{t('Pay via Escrow Protection', 'محفوظ اسکرو ادائیگی شروع کریں')}</span>
            <ArrowRight size={18} className={isRTL ? 'rotate-180' : ''} />
          </button>

          {/* Guaranteed Settlement Rails Row */}
          <div className="pt-2 flex flex-wrap items-center justify-between text-xs text-[#8a9aa8] border-t border-white/5">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-[#34d399]" />
              <span>{t('100% Refundable if unfulfilled', 'کام مکمل نہ ہونے پر مکمل واپسی')}</span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span>💳 Cards</span>
              <span>⚡ Solana</span>
              <span>🏦 Raast</span>
              <span>📱 JazzCash</span>
            </div>
          </div>
        </div>

        {/* Share & In-Person QR Code Card */}
        <div className="p-4 rounded-2xl bg-[#101a24] border border-[rgba(255,255,255,0.08)] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 text-[#8a9aa8]">
            <Share2 size={15} className="text-[#4fd1c5]" />
            <span>{t('Share link with client:', 'یہ لنک کلائنٹ کے ساتھ شیئر کریں:')}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy('url', currentFullUrl)}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[#e8eef4] border border-white/10 inline-flex items-center gap-1.5 transition-colors"
            >
              {copiedKey === 'url' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              <span>{copiedKey === 'url' ? t('Copied', 'کاپی ہو گیا') : t('Copy Link', 'لنک کاپی کریں')}</span>
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1.5 transition-colors"
            >
              <span>💬</span>
              <span>WhatsApp</span>
            </a>

            <button
              onClick={() => setQrModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[#e8eef4] border border-white/10 inline-flex items-center gap-1.5 transition-colors"
            >
              <QrCode size={13} />
              <span>QR</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Pabandi Multi-Rail Checkout Modal ── */}
      <PabandiCheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        title={linkData?.title || 'Pabandi Universal Escrow'}
        subtitle={`To ${linkData?.merchantName} (Trust Score: ${linkData?.trustScore})`}
        amount={selectedAmount}
        currency={currency}
        referenceId={linkData?.id || activeSlug}
        squareNote={`pabandi:link:${activeSlug}:${selectedAmount}`}
        recipientWallet={linkData?.merchantWallet}
        merchantRaastId={linkData?.merchantRaastId}
        onSuccess={(rail) => {
          setCheckoutOpen(false);
          alert(`Payment initiated successfully via ${rail.toUpperCase()}`);
        }}
      />

      {/* ── In-Person QR Code Modal ── */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="p-6 rounded-2xl bg-[#101a24] border border-white/10 max-w-sm w-full text-center space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-sm font-bold text-[#e8eef4]">{t('Scan to Pay on Phone', 'فون سے اسکین کر کے ادائیگی کریں')}</span>
              <button onClick={() => setQrModalOpen(false)} className="text-[#8a9aa8] hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 bg-white rounded-xl inline-block shadow-lg">
              <SecureQRCode value={currentFullUrl} size={200} />
            </div>

            <p className="text-xs font-mono text-[#8a9aa8]">
              {currency === 'USD' ? `$${selectedAmount.toFixed(2)} USD` : `Rs. ${selectedAmount.toLocaleString()} PKR`}
              <br />
              <span className="text-[11px] text-[#4fd1c5]">{linkData?.merchantName}</span>
            </p>
          </div>
        </div>
      )}

      {/* ── Quick Payment Link Creator Drawer ── */}
      {createDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="p-6 rounded-2xl bg-[#101a24] border border-white/10 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold text-[#e8eef4]">{t('Create Your Universal Payment Link', 'اپنا ادائیگی لنک بنائیں')}</h3>
                <p className="text-xs text-[#8a9aa8]">{t('Get paid via Raast, JazzCash, Cards, and Solana USDC', 'راست، جاز کیش اور کارڈز کے ذریعے رقم وصول کریں')}</p>
              </div>
              <button onClick={() => setCreateDrawerOpen(false)} className="text-[#8a9aa8] hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateNewLink} className="space-y-3.5">
              <div>
                <label className="block text-xs font-mono text-[#8a9aa8] mb-1">{t('Business / Your Name', 'آپ کا نام یا کاروبار')}</label>
                <input
                  type="text"
                  required
                  value={creatorName}
                  onChange={(e) => setCreatorName(e.target.value)}
                  placeholder="e.g. Ali Roofing & AC Services"
                  className="w-full px-3 py-2 rounded-xl bg-[#0a1118] border border-white/10 text-xs font-mono text-[#e8eef4] focus:outline-none focus:border-[#4fd1c5]"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[#8a9aa8] mb-1">{t('Service or Item Title', 'سروس کا نام')}</label>
                <input
                  type="text"
                  required
                  value={creatorTitle}
                  onChange={(e) => setCreatorTitle(e.target.value)}
                  placeholder="e.g. AC Maintenance & Gas Recharge"
                  className="w-full px-3 py-2 rounded-xl bg-[#0a1118] border border-white/10 text-xs font-mono text-[#e8eef4] focus:outline-none focus:border-[#4fd1c5]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-[#8a9aa8] mb-1">{t('Default Amount (USD)', 'طے شدہ رقم ($)')}</label>
                  <input
                    type="number"
                    value={creatorAmount}
                    onChange={(e) => setCreatorAmount(e.target.value)}
                    placeholder="Leave empty for flexible"
                    className="w-full px-3 py-2 rounded-xl bg-[#0a1118] border border-white/10 text-xs font-mono text-[#e8eef4] focus:outline-none focus:border-[#4fd1c5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[#8a9aa8] mb-1">{t('Raast ID / Phone', 'راست نمبر / فون')}</label>
                  <input
                    type="text"
                    value={creatorRaast}
                    onChange={(e) => setCreatorRaast(e.target.value)}
                    placeholder="03001234567"
                    className="w-full px-3 py-2 rounded-xl bg-[#0a1118] border border-white/10 text-xs font-mono text-[#e8eef4] focus:outline-none focus:border-[#4fd1c5]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={creatorCreating}
                className="w-full py-2.5 rounded-xl bg-[#4fd1c5] hover:bg-[#38b2ac] text-[#0a1118] font-bold text-xs font-mono transition-colors disabled:opacity-50"
              >
                {creatorCreating ? t('Generating Link...', 'لنک تیار ہو رہا ہے...') : t('Generate Shareable Link', 'شیئر کرنے والا لنک بنائیں')}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

