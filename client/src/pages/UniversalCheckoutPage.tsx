import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { ArrowLeftIcon, UserIcon, CheckCircleIcon, VideoCameraIcon } from '@heroicons/react/24/outline';
import { businessService, reservationService, liveSellerService, passportService, popService } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { tokens } from '../design-system';
import { checkTrustActionAccess, type TrustActionAccess } from '../services/trustApi';
import { getAuthToken } from '../utils/authToken';

function getDraftReservationId(sellerId?: string) {
  if (!sellerId) return null;
  const key = `reservationDraft:${sellerId}`;
  let id = localStorage.getItem(key);
  if (!id) {
    id = `draft-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

export default function UniversalCheckoutPage() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();

  const [step, setStep] = useState<'details' | 'confirm'>('details');
  const [copied, setCopied] = useState(false);
  const [dae, setDae] = useState<{ suggestedEscrowPercentage: number; trustFrictionScore: number; dAE_reason?: string } | null>(null);
  const [reservationId] = useState<string | null>(() => getDraftReservationId(sellerId));
  const [popStatus, setPopStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    reservationDate: '',
    reservationTime: '',
    notes: '',
    paymentMethod: 'safepay' as const,
    itemTitle: searchParams.get('item') || '',
    priceCents: searchParams.get('price') ? Number(searchParams.get('price')) * 100 : 0,
    session: searchParams.get('session') || '',
    mode: (searchParams.get('mode') as 'instant' | 'booking') || 'instant',
  });

  useEffect(() => {
    if (isAuthenticated && user) {
      setForm(prev => ({
        ...prev,
        customerName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || prev.customerName,
        customerEmail: user.email || prev.customerEmail,
        customerPhone: user.phone || prev.customerPhone,
      }));
    }
  }, [isAuthenticated, user]);

  const category = searchParams.get('category') || 'general';

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await passportService.dynamicEscrow({
          userId: user.id,
          category,
          transactionValue: Number((form.priceCents / 100).toFixed(2)),
          currency: 'USD',
        });
        if (!cancelled) setDae(res?.data?.data || null);
      } catch {
        if (!cancelled) setDae(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id, category, form.priceCents]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await popService.recordIntent({ userId: user?.id || '', reservationId: reservationId || '', businessId: sellerId || '' });
        if (!cancelled) setPopStatus('intent_recorded');
      } catch {
        if (!cancelled) setPopStatus(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reservationId, sellerId, user?.id]);

  const { data: sellerBiz } = useQuery(
    ['business', sellerId],
    () => businessService.getBusiness(sellerId!),
    { enabled: !!sellerId }
  );
  const seller = sellerBiz?.data?.data?.business;

  const { data: liveStateData } = useQuery(
    ['live-seller-state', sellerId],
    async () => {
      const platforms = ['tiktok-live','youtube-shopping','shopify-live', 'whatnot-live'] as const;
      const results = await Promise.allSettled(
        platforms.map(p => liveSellerService.getShowState(p).catch(() => ({ businessId: '', isLive: false })))
      );
      const fulfilled = results.filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled');
      const match = fulfilled.find(r => r.value.data?.data?.businessId === sellerId);
      return match ? match.value.data.data : null;
    },
    { enabled: !!sellerId }
  );

  const liveState = liveStateData?.isLive ? liveStateData : null;
  const baseDeposit = liveState?.depositCents || form.priceCents;
  const depositAmount = dae ? Math.round(baseDeposit * (dae.suggestedEscrowPercentage / 100)) : baseDeposit;
  const pabReward = liveState?.rewardPab || Math.round(form.priceCents / 100);

  const { data: trustAccess } = useQuery<TrustActionAccess>(
    ['trust-access', 'BOOKING'],
    () => checkTrustActionAccess('BOOKING'),
    { retry: false, enabled: typeof window !== 'undefined' ? Boolean(getAuthToken()) : false, staleTime: 1000 * 60 }
  );

  const trustDeniedReason = trustAccess?.allowed
    ? null
    : trustAccess?.missingStamps?.length
      ? `Missing trust stamps: ${trustAccess.missingStamps.join(', ')}`
      : 'Trust score requirement not met for booking.';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('confirm');
  };

  const handleConfirmBooking = async () => {
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }

    if (trustDeniedReason) {
      alert(trustDeniedReason);
      return;
    }

    try {
      setSubmitting(true);
      const payload: any = {
        businessId: sellerId,
        reservationDate: form.reservationDate,
        reservationTime: form.reservationTime,
        numberOfGuests: 1,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        specialRequests: form.notes,
      };

      if (form.session) {
        payload.metadata = {
          source: 'live-show',
          sessionId: form.session,
          itemTitle: form.itemTitle,
          priceCents: form.priceCents,
          mode: form.mode,
        };
      }

      const res = await reservationService.createReservation(payload);
      const checkoutUrl = res?.data?.data?.checkoutUrl;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        navigate('/reservations?success=1');
      }
    } catch (err) {
      console.error('Booking failed', err);
      alert('Booking failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const copySellerLink = () => {
    navigator.clipboard.writeText(`https://pabandi.com/s/${sellerId}?item=${encodeURIComponent(form.itemTitle)}&price=${(form.priceCents / 100).toFixed(2)}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const markArrived = async () => {
    if (!reservationId) return;
    await popService.recordArrived({ userId: user?.id || '', reservationId, businessId: sellerId });
    setPopStatus('arrived');
  };

  if (!seller && !liveState) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: tokens.color.background, color: tokens.color.text }}>
          <VideoCameraIcon className="h-12 w-12 text-outline mx-auto mb-4" />
          <h1 className="font-headline text-2xl font-bold mb-2">Seller not found</h1>
          <p className="text-on-surface-variant mb-6">This seller page may not be active yet.</p>
          <Link to="/" className="px-6 py-2 bg-primary text-on-primary rounded-xl font-bold">Back to home</Link>
        </div>
    );
  }

  return (
    <div className="min-h-screen font-body mobile-safe-bottom" style={{ background: tokens.color.background, color: tokens.color.text }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <button onClick={() => navigate(-1)} className="p-3 bg-surface-container-low hover:bg-surface-container-high rounded-2xl transition-colors touch-target">
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-headline text-xl sm:text-2xl font-black">{liveState ? 'Live Show Checkout' : 'Checkout'}</h1>
            {seller && <p className="text-xs sm:text-sm text-on-surface-variant">{seller.name}</p>}
            {liveState && <p className="text-[10px] sm:text-xs text-green-600 font-bold">● Live now · {liveState.platform}</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-6 mb-6">
          {(seller?.coverImageUrl || liveState?.thumbnailUrl) && (
            <img
              src={seller?.coverImageUrl || liveState?.thumbnailUrl || ''}
              alt={seller?.name || 'Seller'}
              className="w-full h-48 object-cover rounded-xl mb-4"
            />
          )}

          <div className="flex flex-wrap items-center gap-2 mb-3">
            {seller?.category && (
              <span className="text-[10px] font-black uppercase tracking-wider bg-surface-container-high px-2 py-0.5 rounded">
                {seller.category}
              </span>
            )}
            {liveState && (
              <span className="text-[10px] font-black uppercase tracking-wider bg-green-500/20 text-green-700 px-2 py-0.5 rounded border border-green-500/30">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#14F195] animate-pulse mr-1" />
                {liveState.platform}
              </span>
            )}
            {dae && (
              <span className="text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">
                AI escrow {dae.suggestedEscrowPercentage}%
              </span>
            )}
            {!dae && (
              <span className="text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded">
                Deposit required
              </span>
            )}
          </div>

          {form.itemTitle && (
            <h2 className="font-headline text-xl font-bold mb-1">{form.itemTitle}</h2>
          )}

          {seller?.description && (
            <p className="text-sm text-on-surface-variant line-clamp-2">{seller.description}</p>
          )}
        </div>

        {step === 'details' && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5 sm:p-6 space-y-4">
              <h3 className="font-headline font-bold text-lg flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-primary" /> Your details
              </h3>

              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Full name</label>
                <input
                  required
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  placeholder="Your full name"
                  className="w-full p-3.5 sm:p-3.5 rounded-2xl bg-surface border border-outline-variant/30 text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent touch-target"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-3">
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Phone</label>
                  <input
                    required
                    value={form.customerPhone}
                    onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                    className="w-full p-3.5 sm:p-3 rounded-xl bg-surface border border-outline-variant/30 text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent touch-target"
                  />
                </div>
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Email</label>
                  <input
                    required
                    type="email"
                    value={form.customerEmail}
                    onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                    placeholder="you@example.com"
                    className="w-full p-3.5 sm:p-3 rounded-xl bg-surface border border-outline-variant/30 text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent touch-target"
                  />
                </div>
              </div>

              {form.mode === 'booking' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-3">
                    <div>
                      <label className="block text-[10px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Date</label>
                      <input
                        required
                        type="date"
                        value={form.reservationDate}
                        onChange={(e) => setForm({ ...form, reservationDate: e.target.value })}
                        className="w-full p-3.5 sm:p-3 rounded-xl bg-surface border border-outline-variant/30 text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent touch-target"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Time</label>
                      <input
                        required
                        type="time"
                        value={form.reservationTime}
                        onChange={(e) => setForm({ ...form, reservationTime: e.target.value })}
                        className="w-full p-3.5 sm:p-3 rounded-xl bg-surface border border-outline-variant/30 text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent touch-target"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Notes</label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      rows={3}
                      placeholder="Special requests..."
                      className="w-full p-3.5 sm:p-3 rounded-xl bg-surface border border-outline-variant/30 text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent touch-target"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5 sm:p-6">
              <h3 className="font-headline font-bold text-lg mb-4">Summary</h3>

              {form.itemTitle && (
                <div className="flex justify-between mb-2">
                  <span className="text-xs sm:text-sm text-on-surface-variant">Item</span>
                  <span className="text-xs sm:text-sm font-bold">{form.itemTitle}</span>
                </div>
              )}

              <div className="flex justify-between mb-2">
                <span className="text-xs sm:text-sm text-on-surface-variant">Price</span>
                <span className="text-xs sm:text-sm font-bold">${(form.priceCents / 100).toFixed(2)}</span>
              </div>

              <div className="flex justify-between mb-2">
                <span className="text-xs sm:text-sm text-on-surface-variant">Pabandi deposit</span>
                <span className="text-sm font-bold text-primary">${(depositAmount / 100).toFixed(2)}</span>
              </div>

              {dae?.dAE_reason && (
                <div className="mt-2 rounded-xl bg-primary/5 border border-primary/10 p-3">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">AI escrow reasoning</p>
                  <p className="text-xs text-on-surface-variant">{dae.dAE_reason}</p>
                </div>
              )}

              <div className="flex justify-between mb-2">
                <span className="text-xs sm:text-sm text-on-surface-variant">You&apos;ll earn</span>
                <span className="text-sm font-bold text-orange-500">{pabReward} $PAB</span>
              </div>

              <div className="border-t border-outline-variant/20 my-3" />

              <div className="flex items-start gap-2">
                <CheckCircleIcon className="h-5 w-5 text-green-600 mt-0.5" />
                <p className="text-xs text-on-surface-variant">
                  Pabandi holds your deposit until the seller confirms. No-shows are covered by AI risk protection. Honored appointments release deposits and mint $PAB rewards.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={!isAuthenticated}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary to-[#06b6d4] text-on-primary font-headline font-bold text-base sm:text-lg shadow-sm hover:opacity-90 disabled:opacity-50 active:scale-[0.98] transition-all touch-target mt-4"
            >
              {isAuthenticated ? 'Continue to confirm' : 'Log in to book'}
            </button>

            {isAuthenticated && trustDeniedReason && (
              <p className="text-[10px] sm:text-xs text-red-300 text-center mt-2">{trustDeniedReason}</p>
            )}

            {!isAuthenticated && (
              <p className="text-[10px] sm:text-xs text-on-surface-variant text-center">
                Log in or create an account to protect your booking with deposit escrow.
              </p>
            )}
          </form>
        )}

        {step === 'confirm' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-3">
              <div className={`rounded-2xl border p-4 sm:p-5 ${trustDeniedReason ? 'border-red-500/40 bg-red-500/10' : 'border-green-500/30 bg-green-500/10'}`}>
                <h3 className="font-headline font-bold text-lg mb-1">Trust gate</h3>
                <p className="text-sm text-on-surface-variant">
                  This booking action requires trust verification.
                </p>
                <div className="mt-2 text-xs text-on-surface-variant">
                  {trustDeniedReason ? (
                    <span className="text-red-300 font-semibold">{trustDeniedReason}</span>
                  ) : typeof trustAccess !== 'undefined' ? (
                    <span className="text-green-200 font-semibold">Verified</span>
                  ) : (
                    <span>Checking access...</span>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5 sm:p-6">
              <h3 className="font-headline font-bold text-lg text-green-700 mb-2">Review your booking</h3>
              <div className="space-y-2 text-sm">
                {form.itemTitle && <p><strong>Item:</strong> {form.itemTitle}</p>}
                <p><strong>Contact:</strong> {form.customerName} · {form.customerEmail} · {form.customerPhone}</p>
                {form.mode === 'booking' && (
                  <>
                    <p><strong>Date:</strong> {form.reservationDate} · {form.reservationTime}</p>
                    {form.notes && <p><strong>Notes:</strong> {form.notes}</p>}
                  </>
                )}
                <p><strong>Deposit:</strong> ${(depositAmount / 100).toFixed(2)}</p>
                <p><strong>Reward:</strong> {pabReward} $PAB after honored appointment</p>
                {dae?.dAE_reason && <p className="text-xs text-on-surface-variant">{dae.dAE_reason}</p>}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('details')}
                className="flex-1 py-3 sm:py-3.5 rounded-2xl border border-outline-variant/20 font-bold hover:bg-surface-container-high transition-colors"
              >
                Edit
              </button>
              <button
                onClick={handleConfirmBooking}
                disabled={submitting || Boolean(trustDeniedReason)}
                className="flex-1 py-3 sm:py-3.5 rounded-2xl bg-gradient-to-r from-green-500 to-[#06b6d4] text-black font-headline font-bold shadow-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Confirm booking'}
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4 sm:p-5">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Proof of presence</p>
          <div className="flex flex-wrap gap-2">
            {reservationId ? (
              <>
                <button type="button" onClick={() => void popService.recordIntent({ userId: user?.id || '', reservationId, businessId: sellerId })} className="px-3 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold">
                  I&apos;m on my way
                </button>
                <button type="button" onClick={markArrived} className="px-3 py-2 rounded-xl bg-green-500 text-black text-xs font-bold">
                  Arrived
                </button>
              </>
            ) : (
              <p className="text-xs text-on-surface-variant">PoP activates after booking draft exists.</p>
            )}
          </div>
          {popStatus && <p className="mt-2 text-[10px] text-on-surface-variant">Status: {popStatus}</p>}
          {reservationId && <p className="mt-1 text-[10px] text-on-surface-variant">Ref: {reservationId}</p>}
        </div>

        {sellerId && (
          <div className="mt-8 rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Share seller checkout link</p>
                <p className="text-sm text-on-surface truncate max-w-[260px]">pabandi.com/s/{sellerId}{form.itemTitle ? `?item=${encodeURIComponent(form.itemTitle)}&price=${(form.priceCents / 100).toFixed(2)}` : ''}</p>
              </div>
              <button onClick={copySellerLink} className="px-3 py-2 rounded-xl bg-surface border border-outline-variant/20 text-xs font-bold hover:bg-surface-container-high transition-colors">
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
