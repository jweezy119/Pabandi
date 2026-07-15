import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { businessService, passportService } from '../services/api';
import QRCodeLib from 'qrcode';

type Business = {
  id: string;
  name: string;
  category?: string;
  address?: string;
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
  rating?: number | null;
  reviewCount?: number;
  description?: string | null;
  coverImageUrl?: string | null;
  owner?: { isPhoneVerified?: boolean; isEmailVerified?: boolean };
};

const normalizeScore = (value?: number | null | string | any) => {
  if (value == null) return null;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  if (num <= 1 && num >= 0) return Math.round(num * 100);
  return Math.round(num);
};

export const PublicPassportPage: React.FC = () => {
  const { sellerId } = useParams<{ sellerId: string }>();
  const [seller, setSeller] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [endorsements, setEndorsements] = useState<
    { title: string; detail: string }[]
  >([]);
  const [reviews, setReviews] = useState<{ authorName: string; rating: number; text?: string; time: string; source: string }[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        if (!sellerId) return;
        try {
          const res = await passportService.getPublicSummary(sellerId);
          const next = (res.data?.data?.business as Business | undefined) ?? null;
          const rawEndorsements = (res.data?.data?.endorsements as
            | { title: string; detail: string }[]
            | undefined) ?? [];
          if (active) {
            setSeller(next);
            setEndorsements(rawEndorsements);
          }
        } catch {
          const res = await businessService.getBusiness(sellerId);
          const next = (res.data?.data?.business as Business | undefined) ?? null;
          if (active) setSeller(next);
        }

        try {
          const list = await passportService.getPublicReviews(sellerId);
          const nextReviews = ((list.data?.data?.reviews as any[]) ?? []).map((review) => ({
            authorName: review.authorName || 'Customer',
            rating: Number(review.rating ?? 0),
            text: review.text || '',
            time: review.time || new Date().toISOString(),
            source: review.source || 'pabandi',
          }));
          if (active) setReviews(nextReviews);
        } catch {
          if (active) setReviews([]);
        } finally {
          if (active) setReviewsLoading(false);
        }
      } catch {
        if (active) {
          setSeller(null);
          setReviews([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => { active = false; };
  }, [sellerId]);

  useEffect(() => {
    const url = sellerId ? `${window.location.origin}/passport/${sellerId}` : '';
    if (!url) { setQrDataUrl(''); return; }
    let active = true;
    QRCodeLib.toDataURL(url, { width: 512, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } })
      .then((dataUrl: string) => { if (active) setQrDataUrl(dataUrl); })
      .catch(() => { if (active) setQrDataUrl(''); });
    return () => { active = false; };
  }, [sellerId]);

  const passportUrl = useMemo(() => sellerId ? `${window.location.origin}/passport/${sellerId}` : '', [sellerId]);
  const tapLink = useMemo(() => sellerId ? `${window.location.origin}/t/pay/${sellerId}` : '', [sellerId]);

  const copyLink = async (url: string) => {
    try { await navigator.clipboard.writeText(url); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const printPassport = () => {
    const win = window.open(passportUrl || ``, '_blank', 'noopener,noreferrer');
    if (!win) return;
    setTimeout(() => win.print(), 700);
  };

  const titleCase = (value?: string | null) => {
    if (!value) return '';
    return value.replace(/\b\w/g, (char: string) => char.toUpperCase());
  };

  const trustScore = normalizeScore((seller as any)?.trustScore);
  const reliabilityScore = normalizeScore((seller as any)?.reliabilityScore);
  const rating = (seller as any)?.rating ?? null;
  const reviewCount = (seller as any)?.reviewCount ?? 0;
  const isVerified = !!(
    (seller as any)?.owner?.isPhoneVerified ||
    (seller as any)?.owner?.isEmailVerified ||
    (seller as any)?.isVerified
  );

  const displayCategory = titleCase(seller?.category) || 'Seller';
  const displayLocation = seller?.city || seller?.address || '';

  return (
    <div className="min-h-screen bg-surface pt-24 pb-12 px-4">
      <div className="max-w-3xl mx-auto">
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-40 bg-surface-container rounded" />
            <div className="h-4 w-full bg-surface-container rounded" />
          </div>
        ) : !seller ? (
          <div className="glass-panel p-6 rounded-3xl">
            <h1 className="text-xl font-headline font-bold mb-2">Passport unavailable</h1>
            <p className="text-sm text-on-surface-variant mb-4">
              We couldn’t find a verified seller at that link yet.
            </p>
            <Link to="/search" className="text-sm font-bold text-primary">
              Find sellers on Pabandi
            </Link>
          </div>
        ) : (
          <div className="glass-panel p-6 rounded-3xl">
            <div className="flex gap-5">
              <div className="w-20 h-20 rounded-2xl bg-surface-container-low overflow-hidden shrink-0">
                {seller.coverImageUrl && <img src={seller.coverImageUrl} alt={seller.name} className="w-full h-full object-cover" />}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-headline font-bold truncate">{seller.name || 'Seller'}</h1>
                  {isVerified && (
                    <span className="px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-bold uppercase tracking-widest">
                      Verified Identity
                    </span>
                  )}
                </div>
                <p className="text-sm text-on-surface-variant mt-1 truncate">{displayLocation}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="px-2 py-1 rounded-full bg-primary-container text-on-primary-container text-[10px] font-bold uppercase tracking-widest">
                    {displayCategory}
                  </span>
                  {trustScore !== null && (
                    <span className="px-2 py-1 rounded-full bg-sky-500/15 text-sky-200 text-[10px] font-bold">
                      Trust {trustScore}%
                    </span>
                  )}
                  {reliabilityScore !== null && (
                    <span className="px-2 py-1 rounded-full bg-purple-500/15 text-purple-200 text-[10px] font-bold">
                      Reliability {reliabilityScore}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-surface-container-low p-4 rounded-2xl">
                <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Trust score</p>
                <p className="text-sm font-bold text-on-surface mt-1">{trustScore !== null ? `${trustScore}%` : '—'}</p>
              </div>
              <div className="bg-surface-container-low p-4 rounded-2xl">
                <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Reliability</p>
                <p className="text-sm font-bold text-on-surface mt-1">{reliabilityScore !== null ? reliabilityScore.toLocaleString() : '—'}</p>
              </div>
              <div className="bg-surface-container-low p-4 rounded-2xl">
                <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Rating</p>
                <p className="text-sm font-bold text-on-surface mt-1">{rating !== null ? `${rating.toFixed(1)} ⭐` : '—'}</p>
              </div>
              <div className="bg-surface-container-low p-4 rounded-2xl">
                <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Reviews</p>
                <p className="text-sm font-bold text-on-surface mt-1">{reviewCount ? reviewCount.toLocaleString() : '—'}</p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {endorsements.map((item) => (
                <span key={item.title} className="px-3 py-1 rounded-full bg-[#111111] text-[#f4f4f5] text-[10px] font-bold">
                  {item.title}: {item.detail}
                </span>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface-container-low rounded-2xl p-4">
                <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mb-2">Passport QR</p>
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Passport QR" className="w-full rounded-xl bg-white" />
                ) : (
                  <div className="w-full aspect-square rounded-xl bg-[#252525] flex items-center justify-center text-xs text-[#757575]">
                    Generating QR…
                  </div>
                )}
                <p className="text-[10px] text-on-surface-variant mt-2">Scan to open this Passport. Share it on receipts, bio links, stickers, and live events.</p>
              </div>
              <div className="bg-surface-container-low rounded-2xl p-4">
                <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mb-3">Quick actions</p>
                <div className="grid grid-cols-1 gap-2">
                  <button onClick={() => copyLink(passportUrl)} className="px-3 py-2 rounded-xl border border-outline-variant/20 text-xs font-bold text-on-surface text-left">
                    {copied ? 'Copied Passport link ✓' : 'Copy Passport link'}
                  </button>
                  <button onClick={() => copyLink(tapLink)} className="px-3 py-2 rounded-xl border border-outline-variant/20 text-xs font-bold text-on-surface text-left">
                    Copy Tap checkout link
                  </button>
                  <button onClick={printPassport} className="px-3 py-2 rounded-xl border border-outline-variant/20 text-xs font-bold text-on-surface text-left">
                    Print this Passport
                  </button>
                  <Link to={`/business/${seller.id}`} className="px-3 py-2 rounded-xl border border-outline-variant/20 text-xs font-bold text-on-surface text-left">
                    Visit full business profile
                  </Link>
                </div>

                <div className="bg-surface-container-low rounded-2xl p-4">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mb-3">Recent reviews</p>
                  {reviewsLoading ? (
                    <div className="animate-pulse space-y-2">
                      <div className="h-3 w-full bg-surface-container rounded" />
                      <div className="h-3 w-5/6 bg-surface-container rounded" />
                      <div className="h-3 w-4/6 bg-surface-container rounded" />
                    </div>
                  ) : reviews.length === 0 ? (
                    <p className="text-xs text-on-surface-variant">No public reviews yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {reviews.slice(0, 8).map((review, idx) => (
                        <div key={idx} className="p-3 rounded-2xl border border-outline-variant/20 bg-white/60">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] text-on-surface-variant font-bold">{review.authorName}</p>
                            <span className="text-[10px] text-on-surface-variant">{review.time ? new Date(review.time).toLocaleDateString() : ''}</span>
                          </div>
                          <p className="text-[11px] text-on-surface mt-1">{'⭐'.repeat(review.rating)}</p>
                          {review.text && <p className="text-xs text-on-surface mt-1 leading-relaxed">{review.text}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 text-[11px] text-on-surface-variant leading-relaxed">
              This Passport is a shareable trust snapshot for {seller.name || 'this seller'}. For live bookings, reviews, and verified profile details, visit the business profile or use the Tap check-out link.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
