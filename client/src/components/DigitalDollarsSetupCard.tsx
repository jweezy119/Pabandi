import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Zap,
  Copy,
  Check,
  KeyRound,
  ExternalLink,
  Lock,
} from 'lucide-react';
import {
  connectWithPhantom,
  PhantomAuthProvider,
} from '../lib/phantomConnect';
import {
  PrivyEmbeddedSetupButton,
  PrivyExportKeyButton,
  isPrivyEmbeddedConfigured,
} from './PrivyEmbeddedSetupButton';

interface DigitalDollarsSetupCardProps {
  existingAddress?: string | null;
  onSaveAddress: (solanaAddress: string) => Promise<void>;
  compact?: boolean;
}

const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const USDC_MAINNET_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const PHANTOM_EXPORT_GUIDE_URL =
  'https://help.phantom.com/hc/en-us/articles/4406388670483-How-to-export-your-private-key-or-recovery-phrase';

const FAQ_ITEMS = [
  {
    q: 'Does the value jump up and down like Bitcoin?',
    a: 'No. USDC is a regulated digital US dollar backed 1-to-1 by cash and US Treasuries. $100 you earn today stays $100 tomorrow — zero crypto price swings.',
  },
  {
    q: 'Do my customers have to understand crypto?',
    a: 'Not at all. Keep accepting Credit/Debit Cards via Square side-by-side. Customers who pay with Digital Dollars (Solana Pay / USDC) settle instantly at 0% fee — saving you 2.9% + 30¢ on every booking.',
  },
  {
    q: 'What if I want to leave Pabandi or move funds to my bank?',
    a: 'Because Pabandi is 100% non-custodial, your funds live in your own Phantom wallet or directly inside our audited Solana smart contract. Move USDC to your US bank anytime with zero lock-in.',
  },
];

export const DigitalDollarsSetupCard: React.FC<DigitalDollarsSetupCardProps> = ({
  existingAddress,
  onSaveAddress,
  compact = false,
}) => {
  const [monthlySales, setMonthlySales] = useState(10000);
  const [connecting, setConnecting] = useState<PhantomAuthProvider | 'embedded' | 'manual' | null>(null);
  const [walletSource, setWalletSource] = useState<'phantom' | 'embedded' | 'manual' | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showFaqList, setShowFaqList] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [showPhantomKeyGuidance, setShowPhantomKeyGuidance] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAddress, setSavedAddress] = useState<string | null>(existingAddress || null);
  const [copiedLink, setCopiedLink] = useState(false);

  const privyReady = isPrivyEmbeddedConfigured();
  const activeAddress = existingAddress || savedAddress;

  // US Card processing (2.9% + $0.30 across ~$100 average ticket ≈ 3.2%) vs 0% Solana Pay / USDC
  const monthlyCardFees = Math.round(monthlySales * 0.029 + (monthlySales / 100) * 0.3);
  const monthlyDigitalFees = 0;
  const yearlySavings = Math.max(0, (monthlyCardFees - monthlyDigitalFees) * 12);

  const handlePhantomSetup = async (provider: PhantomAuthProvider) => {
    setError(null);
    setShowPhantomKeyGuidance(false);
    setConnecting(provider);
    try {
      const { address } = await connectWithPhantom(provider);
      await onSaveAddress(address);
      setSavedAddress(address);
      setWalletSource('phantom');
    } catch (err: any) {
      if (provider === 'injected' && typeof window !== 'undefined' && !(window as any).solana?.isPhantom) {
        setError(
          'Phantom browser extension was not detected. Install Phantom at phantom.app, use the 1-Click Embedded Wallet below, or paste a Solana address manually.'
        );
      } else {
        setError(err?.message || 'Could not connect Phantom wallet. You can try again or use the 1-Click Embedded Wallet.');
      }
    } finally {
      setConnecting(null);
    }
  };

  const handleFallbackEmbeddedClick = async () => {
    setError(null);
    setConnecting('embedded');
    try {
      const { address } = await connectWithPhantom('google');
      await onSaveAddress(address);
      setSavedAddress(address);
      setWalletSource('embedded');
    } catch (err: any) {
      setError(
        err?.message ||
          '1-Click Embedded Wallet requires Privy (VITE_PRIVY_APP_ID) or Phantom App ID in this environment. Connect Phantom Extension or paste an address below.'
      );
    } finally {
      setConnecting(null);
    }
  };

  const handleManualSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = manualAddress.trim();
    if (!SOLANA_ADDRESS_RE.test(cleaned)) {
      setError('That does not look like a valid Solana payout address (32–44 characters).');
      return;
    }
    setError(null);
    setConnecting('manual');
    try {
      await onSaveAddress(cleaned);
      setSavedAddress(cleaned);
      setWalletSource('manual');
      setManualAddress('');
      setShowManual(false);
    } catch (err: any) {
      setError(err?.message || 'Could not save payout address.');
    } finally {
      setConnecting(null);
    }
  };

  const copyShareLink = async () => {
    if (!activeAddress) return;
    const payUrl = `solana:${activeAddress}?spl-token=${USDC_MAINNET_MINT}&label=Pabandi`;
    try {
      await navigator.clipboard.writeText(payUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div
      className="rounded-2xl border p-5 sm:p-6 space-y-5"
      style={{
        background: 'linear-gradient(135deg, #FFFDF9 0%, #F7F1E8 100%)',
        borderColor: 'rgba(201, 123, 90, 0.35)',
      }}
    >
      {/* Plain-English Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#E9F4EC] text-[#2D6A4F]">
            <Zap size={12} /> The Real Exit · 0% Fee Solana Pay &amp; USDC
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-[var(--warm-ink)]">
            Keep 100% of every booking — exit Stripe &amp; Square fees
          </h3>
          <p className="text-sm text-[var(--soft-stone)] max-w-xl">
            Accept <strong>USDC Digital Dollars</strong> directly into your own self-custodial Solana wallet. <strong>0% processing fees</strong>, instant settlement, and zero frozen accounts.
          </p>
        </div>
        {activeAddress && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E9F4EC] text-[#2D6A4F] text-xs font-bold">
            <CheckCircle2 size={15} /> Self-Custody Ready
          </div>
        )}
      </div>

      {/* Interactive Fee Savings Calculator (shown in full mode) */}
      {!compact && (
        <div className="rounded-xl bg-white/90 border border-[rgba(191,179,163,0.35)] p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--warm-ink)]">Your monthly US card sales</span>
            <span className="font-bold text-[var(--clay)]">${monthlySales.toLocaleString()}/mo</span>
          </div>
          <input
            type="range"
            min={1000}
            max={50000}
            step={500}
            value={monthlySales}
            onChange={(e) => setMonthlySales(Number(e.target.value))}
            className="w-full accent-[#C97B5A]"
          />
          <div className="grid grid-cols-3 gap-2.5 text-center pt-1">
            <div className="p-2.5 rounded-xl bg-[var(--cream)]">
              <div className="text-[11px] text-[var(--soft-stone)]">Square / Stripe (2.9% + 30¢)</div>
              <div className="text-base font-bold text-[var(--warm-ink)]">${monthlyCardFees.toLocaleString()}/mo</div>
            </div>
            <div className="p-2.5 rounded-xl bg-[var(--cream)]">
              <div className="text-[11px] text-[var(--soft-stone)]">Solana Pay / USDC</div>
              <div className="text-base font-bold text-[#2D6A4F]">$0/mo (0%)</div>
            </div>
            <div className="p-2.5 rounded-xl bg-[#E9F4EC] border border-[#2D6A4F]/20">
              <div className="text-[11px] text-[#2D6A4F] font-semibold">You Keep Extra</div>
              <div className="text-base font-black text-[#1B4332]">${yearlySavings.toLocaleString()}/yr</div>
            </div>
          </div>
        </div>
      )}

      {/* Active Payout Summary */}
      {activeAddress && (
        <div className="rounded-xl bg-white border border-[#2D6A4F]/25 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-[#2D6A4F] flex items-center gap-1.5">
              <ShieldCheck size={14} /> Direct Solana Pay / USDC Payouts Enabled
            </div>
            <div className="text-xs font-mono text-[var(--soft-stone)] mt-1">
              {activeAddress.slice(0, 8)}...{activeAddress.slice(-8)}
            </div>
          </div>
          <button
            type="button"
            onClick={copyShareLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[rgba(191,179,163,0.45)] text-[var(--warm-ink)] hover:border-[var(--clay)] transition"
          >
            {copiedLink ? <Check size={13} /> : <Copy size={13} />}
            {copiedLink ? 'Solana Pay URI Copied!' : 'Copy Solana Pay Link'}
          </button>
        </div>
      )}

      {/* Primary Self-Custody + Secondary 1-Click Embedded Wallet Buttons */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Primary Button: Connect Phantom Wallet (Self-Custodial) */}
          <button
            type="button"
            disabled={connecting !== null}
            onClick={() => handlePhantomSetup('injected')}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm text-white transition hover:opacity-95 disabled:opacity-50 shadow-sm"
            style={{ background: 'linear-gradient(135deg, var(--clay), var(--terracotta))' }}
          >
            <ShieldCheck size={16} />
            {connecting === 'injected'
              ? 'Connecting Phantom…'
              : 'Connect Phantom Wallet (Self-Custodial)'}
          </button>

          {/* Secondary Button: Use Pabandi Embedded Wallet (1-Click) */}
          {privyReady ? (
            <PrivyEmbeddedSetupButton
              disabled={connecting !== null}
              label="Use Pabandi Embedded Wallet (1-Click)"
              onError={(msg) => setError(msg)}
              onAddressReady={async (addr) => {
                setError(null);
                setShowPhantomKeyGuidance(false);
                await onSaveAddress(addr);
                setSavedAddress(addr);
                setWalletSource('embedded');
              }}
            />
          ) : (
            <button
              type="button"
              disabled={connecting !== null}
              onClick={handleFallbackEmbeddedClick}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm bg-white border border-[rgba(191,179,163,0.55)] text-[var(--warm-ink)] hover:border-[var(--clay)] transition disabled:opacity-50"
            >
              <Sparkles size={15} className="text-[var(--clay)]" />
              {connecting === 'embedded'
                ? 'Starting Embedded Wallet…'
                : 'Use Pabandi Embedded Wallet (1-Click)'}
            </button>
          )}
        </div>

        {/* Subtle manual fallback */}
        <div className="pt-0.5">
          <button
            type="button"
            onClick={() => setShowManual((v) => !v)}
            className="text-xs font-medium text-[var(--soft-stone)] hover:text-[var(--warm-ink)] underline"
          >
            {showManual ? 'Hide manual address input' : 'Or paste an existing Solana USDC address manually'}
          </button>

          {showManual && (
            <form onSubmit={handleManualSave} className="mt-2.5 flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="Paste your Solana payout address"
                className="flex-1 px-3 py-2 text-sm rounded-xl bg-white border border-[var(--warm-sand)] text-[var(--warm-ink)]"
                required
              />
              <button
                type="submit"
                disabled={connecting !== null}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--clay)' }}
              >
                {connecting === 'manual' ? 'Saving…' : 'Save Address'}
              </button>
            </form>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl px-3.5 py-2.5 text-xs bg-[#FCE8E6] text-[#8C1D18] border border-[#8C1D18]/15">
          {error}
        </div>
      )}

      {/* Crucial Advanced Self-Custody Section: "Your Keys, Your Crypto." */}
      <div className="rounded-2xl border border-[rgba(191,179,163,0.45)] bg-white/85 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--cream)]/60 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Lock size={14} className="text-[var(--terracotta)]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--terracotta)]">
              Advanced
            </span>
            <span className="text-sm font-bold text-[var(--warm-ink)]">
              Your Keys, Your Crypto.
            </span>
          </div>
          {showAdvanced ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {showAdvanced && (
          <div className="px-4 pb-4 pt-1 space-y-3 border-t border-[rgba(191,179,163,0.25)]">
            <p className="text-xs text-[#5a5348] leading-relaxed">
              Pabandi is non-custodial. Your funds are held in a smart contract. If Pabandi goes offline, you can recover your funds directly on Solana.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <PrivyExportKeyButton
                activeAddress={activeAddress}
                isExternalPhantom={walletSource === 'phantom'}
                onShowPhantomGuidance={() => setShowPhantomKeyGuidance(true)}
                onError={(msg) => setError(msg)}
              />

              <Link
                to="/transparency"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--terracotta)] hover:underline"
              >
                <span>Inspect Live Smart Contract TVL</span>
                <ExternalLink size={12} />
              </Link>
            </div>

            {/* Calm, non-error Self-Custody Phantom Guidance Card */}
            {showPhantomKeyGuidance && (
              <div
                role="status"
                data-testid="phantom-self-custody-guidance"
                className="rounded-xl border border-[#2D6A4F]/25 bg-[#E9F4EC]/75 p-3.5 text-xs text-[#1B4332] space-y-2"
              >
                <div className="flex items-center gap-1.5 font-bold text-[#1B4332]">
                  <KeyRound size={14} className="text-[#2D6A4F]" />
                  <span>Your keys are already safe in Phantom</span>
                </div>
                <p className="leading-relaxed">
                  You are using a self-custodial Phantom wallet. Your keys never leave your extension. If you ever need to export them, follow Phantom&apos;s official guide.
                </p>
                <a
                  href={PHANTOM_EXPORT_GUIDE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-bold text-[#2D6A4F] underline hover:text-[#1B4332]"
                >
                  <span>Read Phantom&apos;s Official Export Guide</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Friendly Plain-English Explainer */}
      <div className="border-t border-[rgba(191,179,163,0.3)] pt-3">
        <button
          type="button"
          onClick={() => setShowFaqList((v) => !v)}
          className="w-full flex items-center justify-between text-xs font-semibold text-[var(--warm-ink)]"
        >
          <span>New to digital dollars? Here’s how it works in 30 seconds</span>
          {showFaqList ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {showFaqList && (
          <div className="mt-3 space-y-2">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={item.q}
                  className="rounded-xl bg-white/80 border border-[rgba(191,179,163,0.3)] overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-[var(--warm-ink)] flex items-center justify-between gap-2"
                  >
                    <span>{item.q}</span>
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {isOpen && (
                    <div className="px-3.5 pb-3 text-xs text-[var(--soft-stone)] leading-relaxed">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
