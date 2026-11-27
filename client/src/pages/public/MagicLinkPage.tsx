import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  CreditCard,
  ArrowRight,
  ExternalLink,
  Lock,
  Smartphone,
  Wrench,
  Camera,
  Bot,
  Sparkles,
  AlertTriangle,
  X,
} from 'lucide-react';
import { PabandiCheckoutModal } from '../../components/PabandiCheckoutModal';
import { ZkTrustBadge } from '../../components/ZkTrustBadge';
import { API_HOST } from '../../utils/apiHost';
import '../../styles/pbn-tokens.css';

interface DviPhoto {
  kind: 'before' | 'after' | 'inspection';
  url: string;
  label?: string;
  uploadedAt?: string;
}

interface EstimateItem {
  description: string;
  partName?: string;
  partCost: number;
  laborHours: number;
  laborRate: number;
  total?: number;
}

interface MagicLinkData {
  type: 'invoice' | 'booking' | 'business_direct' | 'repair_order';
  id: string;
  number?: string;
  title: string;
  description: string;
  amount: number;
  totalAmount?: number;
  depositAmount?: number;
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
  isBookedByAgent?: boolean;
  fairPriceVerified?: boolean;
  fairPriceReport?: {
    passed?: boolean;
    badge?: string;
    summary?: string;
    maxVariancePct?: number;
  } | null;
  itemizedEstimate?: {
    items?: EstimateItem[];
    subtotal?: number;
    depositAmount?: number;
  } | null;
  dviPhotos?: DviPhoto[];
  visionProofHash?: string | null;
  visionProofReport?: {
    verified?: boolean;
    summary?: string;
    provider?: string;
  } | null;
  vehicle?: {
    id: string;
    vin: string;
    year?: number | null;
    make?: string | null;
    model?: string | null;
    licensePlate?: string | null;
  } | null;
  business: {
    id: string;
    name: string;
    logoUrl?: string | null;
    slug?: string | null;
    trustScore: number;
    fairPriceScore?: number;
    communicationScore?: number;
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

const REPAIR_STEPS = [
  { key: 'CHECKED_IN', label: 'Checked In' },
  { key: 'INSPECTING', label: 'Inspecting' },
  { key: 'NEEDS_APPROVAL', label: 'Needs Approval' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'READY', label: 'Ready' },
] as const;

function stepIndexFor(status: string): number {
  const normalized = status === 'PENDING_MANUAL_REVIEW' ? 'NEEDS_APPROVAL' : status;
  const idx = REPAIR_STEPS.findIndex((s) => s.key === normalized);
  return idx >= 0 ? idx : 0;
}

export default function MagicLinkPage() {
  const params = useParams();
  const id = params.id || params.bookingId || params.invoiceId;

  const [data, setData] = useState<MagicLinkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

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
      const res = await fetch(`${API_HOST}/api/v1/public/magic/${targetId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
          setLoading(false);
          return;
        }
      }

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
          pkrAmount: Math.round(usd * 279.5),
          rate: 279.5,
          status: inv.status,
          isPaid: inv.status.toLowerCase() === 'paid',
          paidAt: inv.paidAt,
          business: {
            id: inv.business?.id || 'biz_direct',
            name: inv.business?.name || 'Pabandi Merchant',
            logoUrl: inv.business?.logoUrl,
            trustScore: inv.business?.trustScore ?? 70,
            isVerified: Boolean(inv.business?.isVerified),
          },
          client: { name: inv.clientName || 'Client' },
          whatsappShareText: `Hi ${inv.clientName || 'there'}, here is your secure payment link: https://pabandi.com/pay/${inv.id}`,
          whatsappShareUrl: `https://wa.me/?text=${encodeURIComponent(`Hi ${inv.clientName || 'there'}, here is your secure payment link: https://pabandi.com/pay/${inv.id}`)}`,
        });
        setLoading(false);
        return;
      }

      setError(`Could not find a repair order, invoice, or booking for reference "${targetId}".`);
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
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="pg-root flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-2 border-[#e08a63] border-t-transparent animate-spin mx-auto" />
          <p className="text-xs font-mono" style={{ color: 'var(--pg-muted)' }}>
            Loading Pabandi secure tracker…
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="pg-root flex items-center justify-center p-4">
        <div className="pg-glass max-w-md w-full p-8 text-center space-y-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
            style={{ background: 'rgba(240,180,106,0.12)', border: '1px solid rgba(240,180,106,0.3)', color: 'var(--pg-amber)' }}
          >
            <ShieldCheck size={28} />
          </div>
          <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--pg-display)' }}>
            Link Not Found
          </h2>
          <p className="text-xs" style={{ color: 'var(--pg-muted)' }}>
            {error || 'This link is invalid or has expired.'}
          </p>
          <Link to="/" className="pg-btn pg-btn-primary inline-flex">
            Back to Pabandi →
          </Link>
        </div>
      </div>
    );
  }

  const isRepairOrder = data.type === 'repair_order';
  const activeStepIdx = isRepairOrder ? stepIndexFor(data.status) : 0;
  const estimateItems = data.itemizedEstimate?.items ?? [];
  const dviPhotos = data.dviPhotos ?? [];
  const overallTrust = Math.round(data.business.trustScore ?? 85);
  const fairPriceScore = Math.round(data.business.fairPriceScore ?? 88);
  const commScore = Math.round(data.business.communicationScore ?? 90);
  const needsApproval = isRepairOrder && data.status === 'NEEDS_APPROVAL' && !data.isPaid;
  const pendingReview = isRepairOrder && data.status === 'PENDING_MANUAL_REVIEW';

  return (
    <div className="pg-root pb-16">
      <div className="pg-grid-bg" aria-hidden="true" />
      <div className="pg-aurora a1" aria-hidden="true" />
      <div className="pg-aurora a2" aria-hidden="true" />

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-4 relative z-10">
        {/* Top Brand Bar */}
        <div className="flex items-center justify-between pb-1">
          <Link to="/" className="pg-logo">
            <span className="pg-logo-mark">◈</span>
            <span className="text-sm font-bold">Pabandi</span>
          </Link>

          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-semibold"
            style={{
              background: 'rgba(94, 227, 154, 0.12)',
              border: '1px solid rgba(94, 227, 154, 0.35)',
              color: 'var(--pg-green)',
            }}
          >
            <Lock size={11} />
            <span>Escrow Protected</span>
          </div>
        </div>

        {/* PROMINENT TOP TRUST BADGE: Pabandi Verified Trust Score */}
        <div
          className="pg-glass p-4 sm:p-5 space-y-3"
          style={{
            borderColor: 'rgba(94, 227, 154, 0.3)',
            background: 'linear-gradient(135deg, rgba(94,227,154,0.08), rgba(255,255,255,0.03))',
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {data.business.logoUrl ? (
                <img
                  src={data.business.logoUrl}
                  alt={data.business.name}
                  className="w-12 h-12 rounded-2xl object-cover border border-white/15 shrink-0"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, rgba(224,138,99,0.3), rgba(124,140,255,0.25))',
                    border: '1px solid rgba(255,255,255,0.14)',
                    color: '#fff',
                  }}
                >
                  {isRepairOrder ? <Wrench size={20} /> : data.business.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="font-bold text-base text-white truncate" style={{ fontFamily: 'var(--pg-display)' }}>
                    {data.business.name}
                  </h1>
                  {data.business.isVerified && <CheckCircle2 size={15} style={{ color: 'var(--pg-green)' }} className="shrink-0" />}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold"
                    style={{
                      background: 'rgba(94, 227, 154, 0.16)',
                      color: 'var(--pg-green)',
                      border: '1px solid rgba(94, 227, 154, 0.35)',
                    }}
                  >
                    <ShieldCheck size={12} />
                    Pabandi Verified Trust Score · {overallTrust}/100
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleCopy}
              title="Copy Magic Link"
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--pg-line-strong)', color: 'var(--pg-muted)' }}
            >
              {copiedLink ? <Check size={16} style={{ color: 'var(--pg-green)' }} /> : <Copy size={16} />}
            </button>
          </div>

          {/* Sub-scores: Fair Price + Communication + FairPriceVerified stamp */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="px-3 py-2 rounded-xl" style={{ background: 'rgba(7,9,18,0.45)', border: '1px solid var(--pg-line)' }}>
              <span className="block text-[10px] font-mono uppercase" style={{ color: 'var(--pg-dim)' }}>
                Fair Price Score
              </span>
              <span className="text-sm font-bold" style={{ color: 'var(--pg-green)' }}>
                {fairPriceScore} / 100
              </span>
            </div>
            <div className="px-3 py-2 rounded-xl" style={{ background: 'rgba(7,9,18,0.45)', border: '1px solid var(--pg-line)' }}>
              <span className="block text-[10px] font-mono uppercase" style={{ color: 'var(--pg-dim)' }}>
                Communication Score
              </span>
              <span className="text-sm font-bold" style={{ color: 'var(--pg-teal)' }}>
                {commScore} / 100
              </span>
            </div>
          </div>

          {!isRepairOrder && (
            <div className="pt-1">
              <ZkTrustBadge
                score={data.business.trustScore}
                disputeRate={0.0}
                subjectName={data.business.name}
                subjectId={data.business.id}
                variant="compact"
              />
            </div>
          )}
        </div>

        {/* LIVE 5-STEP AUTO REPAIR TRACKER */}
        {isRepairOrder && (
          <div className="pg-glass p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: 'var(--pg-muted)' }}>
                Live Bay Progress
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {data.isBookedByAgent && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold"
                    style={{ background: 'rgba(124,140,255,0.16)', color: '#c4cbff', border: '1px solid rgba(124,140,255,0.35)' }}
                  >
                    <Bot size={11} />
                    Booked by AI Agent
                  </span>
                )}
                {data.fairPriceVerified && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold"
                    style={{ background: 'rgba(94,227,154,0.15)', color: 'var(--pg-green)', border: '1px solid rgba(94,227,154,0.35)' }}
                  >
                    <Sparkles size={11} />
                    FairPriceVerified
                  </span>
                )}
              </div>
            </div>

            {/* 5-step horizontal tracker */}
            <div className="grid grid-cols-5 gap-1.5">
              {REPAIR_STEPS.map((step, i) => {
                const isCompleted = i < activeStepIdx;
                const isCurrent = i === activeStepIdx;
                return (
                  <div key={step.key} className="flex flex-col items-center text-center gap-1.5">
                    <div
                      className="w-full h-1.5 rounded-full transition-all"
                      style={{
                        background: isCompleted
                          ? 'var(--pg-green)'
                          : isCurrent
                          ? 'var(--pg-clay)'
                          : 'rgba(255,255,255,0.1)',
                        boxShadow: isCurrent ? '0 0 12px rgba(224,138,99,0.75)' : 'none',
                      }}
                    />
                    <span
                      className="text-[10px] leading-tight font-medium"
                      style={{
                        color: isCurrent ? '#fff' : isCompleted ? 'var(--pg-green)' : 'var(--pg-dim)',
                        fontWeight: isCurrent ? 700 : 500,
                      }}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {pendingReview && (
              <div
                className="p-3 rounded-xl flex items-start gap-2.5 text-xs"
                style={{ background: 'rgba(240,180,106,0.12)', border: '1px solid rgba(240,180,106,0.35)', color: '#fde68a' }}
              >
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <div>
                  <strong className="block">Estimate Under Pabandi Fair-Price Review</strong>
                  <span style={{ color: 'var(--pg-muted)' }}>
                    Labor hours exceeded regional averages by &gt;20%. A Pabandi Coordinator is verifying this quote to protect you before deposit approval.
                  </span>
                </div>
              </div>
            )}

            {/* Vehicle Card */}
            {data.vehicle && (
              <div
                className="p-3.5 rounded-xl flex items-center justify-between gap-2"
                style={{ background: 'rgba(7,9,18,0.5)', border: '1px solid var(--pg-line)' }}
              >
                <div>
                  <span className="block text-[10px] font-mono uppercase" style={{ color: 'var(--pg-dim)' }}>
                    Vehicle
                  </span>
                  <span className="font-bold text-sm text-white">
                    {[data.vehicle.year, data.vehicle.make, data.vehicle.model].filter(Boolean).join(' ') || 'Vehicle on Lift'}
                  </span>
                  <span className="block text-[11px] font-mono mt-0.5" style={{ color: 'var(--pg-muted)' }}>
                    VIN: {data.vehicle.vin}
                    {data.vehicle.licensePlate ? ` · Plate ${data.vehicle.licensePlate}` : ''}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* DVI PHOTOS & VISION PROOF-OF-WORK */}
        {isRepairOrder && (
          <div className="pg-glass p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera size={15} style={{ color: 'var(--pg-clay)' }} />
                <span className="text-xs font-bold text-white">Digital Vehicle Inspection (DVI) Photos</span>
              </div>
              {data.visionProofHash && (
                <span
                  className="text-[10px] font-mono px-2 py-0.5 rounded-md"
                  style={{ background: 'rgba(94,227,154,0.14)', color: 'var(--pg-green)', border: '1px solid rgba(94,227,154,0.3)' }}
                >
                  AI Proof #{data.visionProofHash.slice(0, 8)}
                </span>
              )}
            </div>

            {dviPhotos.length > 0 ? (
              <div className="grid grid-cols-2 gap-2.5">
                {dviPhotos.map((photo, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setLightboxUrl(photo.url)}
                    className="group relative rounded-xl overflow-hidden text-left border border-white/10 bg-black/30 aspect-[4/3]"
                  >
                    <img src={photo.url} alt={photo.label || photo.kind} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-black/75 text-white">
                      {photo.label || photo.kind}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div
                className="p-4 rounded-xl text-center text-xs"
                style={{ background: 'rgba(7,9,18,0.45)', border: '1px dashed var(--pg-line-strong)', color: 'var(--pg-muted)' }}
              >
                Mechanic inspection &amp; Before/After photos will appear here live as soon as uploaded.
              </div>
            )}
          </div>
        )}

        {/* MAIN ESTIMATE / PAYMENT CARD */}
        <div className="pg-glass p-5 sm:p-6 space-y-5">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--pg-dim)' }}>
              {isRepairOrder ? 'Repair Order & Estimate' : data.type === 'invoice' ? 'Invoice Item' : 'Service Booking'}
            </span>
            <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'var(--pg-display)' }}>
              {data.title}
            </h2>
            <p className="text-xs m-0" style={{ color: 'var(--pg-muted)' }}>
              {data.description}
            </p>
          </div>

          {/* Itemized Repair Estimate Breakdown */}
          {isRepairOrder && estimateItems.length > 0 && (
            <div className="space-y-2 pt-1">
              {estimateItems.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl flex items-center justify-between gap-3 text-xs"
                  style={{ background: 'rgba(7,9,18,0.45)', border: '1px solid var(--pg-line)' }}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-white m-0 truncate">{item.description}</p>
                    <p className="text-[11px] font-mono m-0 mt-0.5" style={{ color: 'var(--pg-dim)' }}>
                      Parts ${Number(item.partCost || 0).toFixed(2)} · Labor {item.laborHours}h @ ${item.laborRate}/hr
                    </p>
                  </div>
                  <span className="font-mono font-bold text-white shrink-0">
                    ${Number(item.total ?? item.partCost + item.laborHours * item.laborRate).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Price Box */}
          <div
            className="p-4 rounded-2xl flex items-center justify-between"
            style={{ background: 'rgba(7,9,18,0.65)', border: '1px solid var(--pg-line-strong)' }}
          >
            <div>
              <span className="text-[10px] font-mono uppercase block" style={{ color: 'var(--pg-dim)' }}>
                {isRepairOrder ? 'Escrow Deposit Due Now' : 'Total Due'}
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-black text-white tracking-tight" style={{ fontFamily: 'var(--pg-display)' }}>
                  {isRepairOrder || data.currency === 'USD'
                    ? `$${data.usdAmount.toFixed(2)}`
                    : `Rs. ${data.pkrAmount.toLocaleString()}`}
                </span>
                <span className="text-xs font-mono font-bold" style={{ color: 'var(--pg-clay)' }}>
                  {isRepairOrder ? 'USD' : data.currency}
                </span>
              </div>
            </div>

            <div className="text-right">
              {isRepairOrder && data.totalAmount ? (
                <>
                  <span className="text-[10px] font-mono block" style={{ color: 'var(--pg-dim)' }}>
                    Full Estimate
                  </span>
                  <span className="text-sm font-bold font-mono text-white">
                    ${Number(data.totalAmount).toFixed(2)} USD
                  </span>
                  <span className="block text-[10px] font-mono" style={{ color: 'var(--pg-green)' }}>
                    Balance on pickup
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[10px] font-mono block" style={{ color: 'var(--pg-dim)' }}>
                    Guaranteed Rate
                  </span>
                  <span className="text-sm font-bold font-mono text-white">${data.usdAmount.toFixed(2)} USD</span>
                </>
              )}
            </div>
          </div>

          {/* Paid Banner OR 1-Tap Approval CTA */}
          {data.isPaid ? (
            <div
              className="p-4 rounded-2xl text-center space-y-2"
              style={{ background: 'rgba(94,227,154,0.1)', border: '1px solid rgba(94,227,154,0.35)' }}
            >
              <CheckCircle2 size={28} style={{ color: 'var(--pg-green)' }} className="mx-auto" />
              <h3 className="font-bold text-sm text-white m-0">Deposit Funded &amp; Approved</h3>
              <p className="text-xs m-0" style={{ color: 'var(--pg-muted)' }}>
                Funds are held safely in Pabandi Escrow and release only when your repair is verified complete.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                disabled={pendingReview}
                onClick={() => setCheckoutOpen(true)}
                className="pg-btn pg-btn-primary pg-btn-lg w-full"
              >
                <CreditCard size={18} />
                <span>
                  {needsApproval || isRepairOrder
                    ? `Approve & Pay Deposit via Apple Pay / Card ($${data.usdAmount.toFixed(2)})`
                    : `Pay Now • $${data.usdAmount.toFixed(2)} USD`}
                </span>
                <ArrowRight size={17} />
              </button>

              <a
                href={data.whatsappShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="pg-btn pg-btn-ghost w-full text-xs"
              >
                <Smartphone size={15} />
                <span>Share Tracking Link</span>
              </a>
            </div>
          )}

          {/* Security Micro-Copy */}
          <div
            className="pt-3 border-t flex items-center justify-between text-[10px] font-mono"
            style={{ borderColor: 'var(--pg-line)', color: 'var(--pg-dim)' }}
          >
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={13} style={{ color: 'var(--pg-green)' }} />
              <span>Zero login required</span>
            </div>
            <span>Apple Pay · Square · Escrow</span>
          </div>
        </div>

        {/* Public Trust Passport Footer Link */}
        <div className="pg-glass-subtle p-4 text-center space-y-1">
          <p className="text-xs m-0" style={{ color: 'var(--pg-muted)' }}>
            Verify this shop&apos;s on-chain reputation &amp; history
          </p>
          <Link
            to={data.business.slug ? `/trust/${data.business.slug}` : `/trust/${data.business.id}`}
            className="inline-flex items-center gap-1 text-xs font-bold font-mono hover:underline"
            style={{ color: 'var(--pg-clay)' }}
          >
            <span>View Public Trust Passport</span>
            <ExternalLink size={12} />
          </Link>
        </div>
      </div>

      {/* Photo Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center"
            aria-label="Close photo"
          >
            <X size={20} />
          </button>
          <img src={lightboxUrl} alt="DVI inspection" className="max-w-full max-h-[85dvh] rounded-2xl border border-white/15" />
        </div>
      )}

      {/* Square / Apple Pay Checkout Modal */}
      <PabandiCheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        title={data.title}
        subtitle={`To: ${data.business.name}`}
        amount={data.usdAmount}
        currency={isRepairOrder ? 'USD' : data.currency}
        referenceId={data.id}
        squareNote={
          isRepairOrder
            ? `pabandi:repair_order:${data.id}`
            : data.type === 'invoice'
            ? `pabandi:invoice:${data.id}:${data.number || '1'}`
            : `pabandi:booking:${data.id}`
        }
        customerEmail={data.client?.email || ''}
        initialRail="square"
        onSuccess={() => {
          setCheckoutOpen(false);
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  isPaid: true,
                  status: prev.type === 'repair_order' ? 'IN_PROGRESS' : prev.status,
                }
              : null
          );
        }}
      />
    </div>
  );
}
