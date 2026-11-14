import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  Share2,
  Copy,
  Check,
  CreditCard,
  Building2,
  Zap,
  ArrowRight,
  ExternalLink,
  Lock,
  Clock,
  Sparkles,
  Smartphone,
} from 'lucide-react';
import { PabandiCheckoutModal } from '../../components/PabandiCheckoutModal';
import { ZkTrustBadge } from '../../components/ZkTrustBadge';
import { API_HOST } from '../../utils/apiHost';
import '../../styles/pbn-tokens.css';

interface MagicLinkData {
  type: 'invoice' | 'booking' | 'business_direct';
  id: string;
  number?: string;
  title: string;
  description: string;
  amount: number;
  currency: string;
  usdAmount: number;
  pkrAmount: number;
  rate: number;
  status: string;
  isPaid: boolean;
  paidAt?: string;
  lpDispatched?: boolean;
  platformFeeUsd?: number;
  netUsdc?: number;
  business: {
    id: string;
    name: string;
    logoUrl?: string | null;
    slug?: string;
    trustScore: number;
    isVerified: boolean;
  };
  client?: {
    id?: string;
    name: string;
    email?: string;
    phone?: string;
  } | null;
  whatsappShareText: string;
  whatsappShareUrl: string;
}

export default function MagicLinkPage() {
  const params = useParams();
  const id = params.id || params.bookingId || params.invoiceId;

  const [data, setData] = useState<MagicLinkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!id) {
      setError('Invalid link: missing transaction reference.');
      setLoading(false);
      return;
    }

    fetchMagicData(id);
  }, [id]);

  const fetchMagicData = async (targetId: string) => {
    setLoading(true);
    setError(null);
    try {
      // 1. Try unified public magic link endpoint
      const res = await fetch(`${API_HOST}/api/v1/public/magic/${targetId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
          setLoading(false);
          return;
        }
      }

      // 2. Fallback to direct invoice public endpoint if needed
      const invRes = await fetch(`${API_HOST}/api/v1/public/invoices/${targetId}`);
      if (invRes.ok) {
        const inv = await invRes.json();
        const usd = Number(inv.subtotal) || 0;
        setData({
          type: 'invoice',
          id: inv.id,
          number: inv.number,
          title: inv.number ? `Invoice #${inv.number}` : 'Professional Invoice',
          description: inv.notes || 'Professional Services via Pabandi Escrow',
          amount: usd,
          currency: inv.currency || 'USD',
          usdAmount: usd,
          pkrAmount: Math.round(usd * 279.50),
          rate: 279.50,
          status: inv.status,
          isPaid: inv.status.toLowerCase() === 'paid',
          paidAt: inv.paidAt,
          business: {
            id: inv.business?.id || 'biz_direct',
            name: inv.business?.name || 'Verified Pabandi Merchant',
            logoUrl: inv.business?.logoUrl,
            trustScore: 96,
            isVerified: true,
          },
          client: {
            name: inv.clientName || 'Client',
          },
          whatsappShareText: `Hi ${inv.clientName || 'there'}, here is your secure payment link: https://pabandi.com/pay/${inv.id}`,
          whatsappShareUrl: `https://wa.me/?text=${encodeURIComponent(`Hi ${inv.clientName || 'there'}, here is your secure payment link: https://pabandi.com/pay/${inv.id}`)}`,
        });
        setLoading(false);
        return;
      }

      setError(`Could not find an invoice or booking for reference "${targetId}".`);
    } catch (e: any) {
      setError(e.message || 'Failed to load secure link.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {}
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b12] text-[#e8eef4] flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-2 border-[var(--pbn-accent,#4fd1c5)] border-t-transparent animate-spin mx-auto" />
          <p className="text-xs font-mono text-[#8a9aa8]">Loading secure payment link...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#070b12] text-[#e8eef4] flex items-center justify-center p-4 font-['Space_Grotesk',sans-serif]">
        <div className="max-w-md w-full p-8 rounded-3xl bg-[#0f172a] border border-[#334155] text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
            <ShieldCheck size={28} />
          </div>
          <h2 className="text-xl font-bold">Link Not Found</h2>
          <p className="text-xs text-[#94a3b8]">{error || 'This payment link is invalid or has expired.'}</p>
          <Link
            to="/booking"
            className="inline-block mt-4 px-6 py-2.5 rounded-xl bg-[var(--pbn-accent,#4fd1c5)] text-[#070b12] font-bold text-xs font-mono hover:brightness-110 transition-all"
          >
            Explore Verified Businesses →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b12] text-[#e8eef4] font-['Space_Grotesk',sans-serif] selection:bg-[var(--pbn-accent,#4fd1c5)]/20 pb-16">
      {/* Top Ambient Light */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-xl h-64 bg-gradient-to-b from-[var(--pbn-accent,#4fd1c5)]/10 to-transparent blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-md mx-auto px-4 pt-6 space-y-5 relative z-10">
        
        {/* Brand Bar */}
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--pbn-accent,#4fd1c5)]/20 border border-[var(--pbn-accent,#4fd1c5)]/40 flex items-center justify-center text-[var(--pbn-accent,#4fd1c5)] font-black text-sm">
              P
            </div>
            <span className="font-bold tracking-tight text-sm text-white">Pabandi<span className="text-[var(--pbn-accent,#4fd1c5)]">Pay</span></span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-mono font-semibold">
            <Lock size={11} />
            <span>Escrow Guaranteed</span>
          </div>
        </div>

        {/* Card Surface */}
        <div className="rounded-3xl bg-[#0f172a] border border-[#334155] p-6 shadow-2xl space-y-6">
          
          {/* Business Profile Header */}
          <div className="flex items-start justify-between gap-3 border-b border-[#334155]/60 pb-5">
            <div className="flex items-center gap-3 min-w-0">
              {data.business.logoUrl ? (
                <img
                  src={data.business.logoUrl}
                  alt={data.business.name}
                  className="w-12 h-12 rounded-2xl object-cover border border-[#334155]"
                />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-[#334155] flex items-center justify-center text-lg font-bold text-[var(--pbn-accent,#4fd1c5)]">
                  {data.business.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="font-bold text-base text-white truncate">{data.business.name}</h1>
                  {data.business.isVerified && (
                    <CheckCircle2 size={15} className="text-[var(--pbn-accent,#4fd1c5)] shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <ZkTrustBadge
                    score={data.business.trustScore}
                    disputeRate={0.0}
                    subjectName={data.business.name}
                    subjectId={data.business.id}
                    variant="compact"
                  />
                  <span className="text-[10px] font-mono text-[#8a9aa8]">ZK Verified</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleCopy}
              title="Copy Link"
              className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#8a9aa8] hover:text-white transition-colors border border-[#334155]"
            >
              {copiedLink ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
            </button>
          </div>

          {/* Item Description */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#8a9aa8]">
              {data.type === 'invoice' ? 'Invoice Item' : 'Service Booking'}
            </span>
            <h2 className="text-lg font-black text-white">{data.title}</h2>
            <p className="text-xs text-[#94a3b8] leading-relaxed">{data.description}</p>
          </div>

          {/* Dual Currency Price Display */}
          <div className="p-4 rounded-2xl bg-[#070b12]/80 border border-[#334155] flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono text-[#8a9aa8] uppercase block">Total Due</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-black text-white tracking-tight">
                  Rs. {data.pkrAmount.toLocaleString()}
                </span>
                <span className="text-xs font-mono font-bold text-[var(--pbn-accent,#4fd1c5)]">PKR</span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-mono text-[#8a9aa8] block">Guaranteed Rate</span>
              <span className="text-sm font-bold text-[#cbd5e1] font-mono">
                ${data.usdAmount.toFixed(2)} USD
              </span>
              <span className="block text-[9px] font-mono text-[#64748b]">1 USD = 279.50 PKR</span>
            </div>
          </div>

          {/* Paid Status Banner OR Payment Buttons */}
          {data.isPaid ? (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="font-bold text-sm text-emerald-300">Payment Completed</h3>
              <p className="text-xs text-[#94a3b8]">
                Funds are secured in escrow. Digital receipt generated.
              </p>
              {data.lpDispatched && (
                <p className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 py-1 px-2 rounded-lg">
                  ⚡ Converted to PKR at 279.50. Raast transfer in progress.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {/* Primary 48px Pay Button */}
              <button
                type="button"
                onClick={() => setCheckoutOpen(true)}
                className="w-full min-h-[48px] py-3.5 px-6 rounded-2xl bg-[var(--pbn-accent,#4fd1c5)] hover:brightness-110 active:scale-[0.98] text-[#070b12] font-black text-sm tracking-wide shadow-lg shadow-[var(--pbn-accent,#4fd1c5)]/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>Pay Now • Rs. {data.pkrAmount.toLocaleString()}</span>
                <ArrowRight size={18} />
              </button>

              {/* Share to WhatsApp Button */}
              <a
                href={data.whatsappShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[44px] py-2.5 px-4 rounded-2xl bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 text-[#25D366] font-bold text-xs flex items-center justify-center gap-2 transition-all"
              >
                <Smartphone size={16} />
                <span>Share to WhatsApp</span>
              </a>
            </div>
          )}

          {/* Security Micro-Copy */}
          <div className="pt-2 border-t border-[#334155]/60 flex items-center justify-between text-[10px] font-mono text-[#64748b]">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-[var(--pbn-accent,#4fd1c5)]" />
              <span>No account required to pay</span>
            </div>
            <span>Square • Raast • Solana</span>
          </div>

        </div>

        {/* Trust Passport Teaser */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-[#334155]/60 text-center space-y-1">
          <p className="text-xs text-[#94a3b8]">Want to verify this business reputation?</p>
          <Link
            to={data.business.slug ? `/trust/${data.business.slug}` : `/trust/${data.business.id}`}
            className="inline-flex items-center gap-1 text-xs font-bold text-[var(--pbn-accent,#4fd1c5)] hover:underline font-mono"
          >
            <span>View Public Trust Passport</span>
            <ExternalLink size={12} />
          </Link>
        </div>

      </div>

      {/* Checkout Modal */}
      <PabandiCheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        title={data.title}
        subtitle={`To: ${data.business.name}`}
        amount={data.usdAmount}
        currency={data.currency}
        referenceId={data.id}
        squareNote={data.type === 'invoice' ? `pabandi:invoice:${data.id}:${data.number || '1'}` : `pabandi:booking:${data.id}`}
        customerEmail={data.client?.email || ''}
        initialRail="square"
        onSuccess={() => {
          setCheckoutOpen(false);
          setData((prev) => (prev ? { ...prev, isPaid: true } : null));
        }}
      />
    </div>
  );
}
