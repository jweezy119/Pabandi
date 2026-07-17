import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { ArrowLeftIcon, UserIcon, CheckCircleIcon, VideoCameraIcon } from '@heroicons/react/24/outline';
import { businessService, reservationService, liveSellerService } from '../services/api';
import { useAuthStore } from '../store/authStore';

export default function UniversalCheckoutPage() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();

  const [step, setStep] = useState<'details' | 'confirm'>('details');
  const [copied, setCopied] = useState(false);
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

  const { data: sellerBiz } = useQuery(
    ['business', sellerId],
    () => businessService.getBusiness(sellerId!),
    { enabled: !!sellerId }
  );
  const seller = sellerBiz?.data?.data?.business;

  const { data: liveStateData } = useQuery(
    ['live-seller-state', sellerId],
    async () => {
      const platforms = ['tiktok-live','youtube-shopping','shopify-live'] as const;
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
  const depositAmount = liveState?.depositCents || form.priceCents;
  const pabReward = liveState?.rewardPab || Math.round(form.priceCents / 100);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('confirm');
  };

  const handleConfirmBooking = async () => {
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }

    try {
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
    }
  };

  const copySellerLink = () => {
    navigator.clipboard.writeText(`https://pabandi.com/s/${sellerId}?item=${encodeURIComponent(form.itemTitle)}&price=${(form.priceCents / 100).toFixed(2)}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!seller && !liveState) {
    return (
      <div className="min-h-screen bg-surface text-on-surface font-body">
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <VideoCameraIcon className="h-12 w-12 text-outline mx-auto mb-4" />
          <h1 className="font-headline text-2xl font-bold mb-2">Seller not found</h1>
          <p className="text-on-surface-variant mb-6">This seller page may not be active yet.</p>
          <Link to="/" className="px-6 py-2 bg-primary text-on-primary rounded-xl font-bold">Back to home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body mobile-safe-bottom">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <button onClick={() => navigate(-1)} className="p-3 sm:p-3 bg-surface-container-low hover:bg-surface-container-high rounded-2xl transition-colors touch-target">
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
            <span className="text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded">
              Deposit required
            </span>
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

            {!isAuthenticated && (
              <p className="text-[10px] sm:text-xs text-on-surface-variant text-center">
                Log in or create an account to protect your booking with deposit escrow.
              </p>
            )}
          </form>
        )}

        {step === 'confirm' && (
          <div className="space-y-6">
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
                className="flex-1 py-3 sm:py-3.5 rounded-2xl bg-gradient-to-r from-green-500 to-[#06b6d4] text-black font-headline font-bold shadow-sm hover:opacity-90 active:scale-[0.98] transition-all"
              >
                Confirm booking
              </button>
            </div>
          </div>
        )}

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
