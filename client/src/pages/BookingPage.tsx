import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from 'react-query';
import { businessService, bookingPaymentService, stakingService, tokenStakingService, walletService } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';
import BusinessMap from '../components/BusinessMap';
import ReviewCarousel from '../components/ReviewCarousel';
import { executeBscDeposit, executeSolanaDeposit, executeStellarFranklinDeposit } from '../utils/web3';
import { encryptRsa } from '../utils/e2ee';
import { Button, Chip, Surface, tokens } from '../design-system';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';

export default function BookingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const [step, setStep] = useState<'details' | 'pay'>('details');
  const [bookingResult, setBookingResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const initialDate = urlParams.get('date') || format(new Date(), 'yyyy-MM-dd');
  const initialTime = urlParams.get('time') || '19:00';
  const initialGuests = parseInt(urlParams.get('guests') || '2', 10);

  const [formData, setFormData] = useState({
    reservationDate: initialDate,
    reservationTime: initialTime,
    numberOfGuests: initialGuests,
    customerName: '',
    customerPhone: '',
    specialRequests: '',
    paymentMethod: 'paylio',
  });

  const { data: businessData, isLoading: businessLoading } = useQuery(
    ['business', id],
    () => businessService.getBusiness(id!),
    { enabled: !!id }
  );

  const business = businessData?.data?.business;

  const trustScoreRaw = (business?.trustScore ?? user?.reliabilityScore ?? 0) as number;
  const trustScore = Math.max(0, Math.min(100, Math.round(trustScoreRaw / 10)));
  const dynamicDeposit = trustScore >= 80 ? 0 : trustScore >= 50 ? 5 : 15;

  const { data: analyticsData } = useQuery(
    ['business-analytics', id],
    () => businessService.getBusinessAnalytics(id!),
    { enabled: !!id }
  );

  const analytics = analyticsData?.data?.analytics;
  const googleRating = business?.rating || analytics?.googleRating || 4.9;

  const { data: walletData } = useQuery('pab-wallet-balances', async () => {
    const res = await walletService.getBalances();
    return res.data?.data;
  }, { enabled: isAuthenticated });
  void walletData;

  const REQUIRED_STAKE = 50;

  const { data: stakeMultData } = useQuery(
    ['stake-multiplier', user?.id],
    () => tokenStakingService.getMultiplier(user!.id),
    { enabled: isAuthenticated && !!user?.id, retry: false }
  );
  const stakeMultiplier = stakeMultData?.data?.multiplier || 1.0;
  const effectiveDeposit = Math.max(0, dynamicDeposit / stakeMultiplier);

  const bookingMutation = useMutation(
    (data: any) => bookingPaymentService.createBooking({
      businessId: data.businessId,
      reservationDate: data.reservationDate,
      reservationTime: data.reservationTime,
      numberOfGuests: parseInt(data.numberOfGuests, 10),
      customerName: data.customerName || 'Guest',
      customerPhone: data.customerPhone,
      depositAmount: effectiveDeposit || 25,
      specialRequests: data.specialRequests,
    }),
    {
      onSuccess: async (res) => {
        const data = res?.data?.data;
        if (data?.paymentUrl) {
          setBookingResult({ ...data, paymentMethod: formData.paymentMethod });
        } else if (data?.bookingReference) {
          setBookingResult({ ...data, paymentMethod: formData.paymentMethod });
        } else {
          navigate('/reservations');
        }
      },
    }
  );

  const handlePayDeposit = async () => {
    if (typeof window !== 'undefined' && window.navigator?.vibrate) {
      window.navigator.vibrate([30, 50, 30]);
    }

    if (!bookingResult) return;

    if (formData.paymentMethod === 'raast') {
      // For Raast, show instructions — the booking is already created
      // If screenshot uploaded, we could send it to AI verification endpoint
      if ((formData as any).paymentScreenshot) {
        setIsProcessing(true);
        try {
          // Upload screenshot for verification
          const fd = new FormData();
          fd.append('screenshot', (formData as any).paymentScreenshot);
          fd.append('reference', bookingResult.bookingReference);
          fd.append('amount', String(effectiveDeposit || 25));
          await fetch('/api/v1/payments/raast/verify', { method: 'POST', body: fd });
        } catch {
          // Screenshot upload failed, but booking is still pending — user can retry
        } finally {
          setIsProcessing(false);
        }
      }
      return;
    }

    if (formData.paymentMethod === 'paylio' && bookingResult.paymentUrl) {
      window.location.href = bookingResult.paymentUrl;
      return;
    }

    if (bookingResult.bookingReference) {
      try {
        const confirmRes = await bookingPaymentService.confirmBooking(bookingResult.bookingReference);
        if (confirmRes.data?.success) {
          navigate('/reservations');
          return;
        }
      } catch {
        navigate(`/booking/${bookingResult.bookingReference}/status`);
        return;
      }
    }

    if (formData.paymentMethod !== 'paylio') {
      setIsProcessing(true);
      try {
        let web3Result: { success: boolean; transactionHash?: string; error?: string } | undefined;
        if (formData.paymentMethod === 'bsc') {
          web3Result = await executeBscDeposit(bookingResult.depositAmount?.toString() || '0.05', business.walletAddress || '', bookingResult.reservationId);
          if (!web3Result.success) throw new Error(web3Result.error || 'BSC deposit failed');
        } else if (formData.paymentMethod === 'solana') {
          web3Result = await executeSolanaDeposit(0.1, business.walletAddress || '');
          if (!web3Result.success) throw new Error(web3Result.error || 'Solana deposit failed');
        } else if (formData.paymentMethod === 'stellar-franklin') {
          web3Result = await executeStellarFranklinDeposit('10.00', business.walletAddress || '');
          if (!web3Result.success) throw new Error(web3Result.error || 'Stellar deposit failed');
        } else if (formData.paymentMethod === 'sol-checkout') {
          const amount = bookingResult.depositAmount ? Number(bookingResult.depositAmount) : 0.05;
          window.open(`${window.location.origin}/sdk/pay-in-sol.html#amount=${amount}&agent=${business?.id || 'agent:demo'}`, '_blank', 'noopener');
          setIsProcessing(false);
          return;
        } else if (formData.paymentMethod === 'stake') {
          await stakingService.stake({ reservationId: bookingResult.reservationId, amount: REQUIRED_STAKE });
        }
        await bookingPaymentService.confirmBooking(bookingResult.bookingReference);
        navigate('/reservations');
      } catch (err: any) {
        alert('Transaction failed: ' + (err.message || 'Unknown error'));
      } finally {
        setIsProcessing(false);
      }
    }
  };

  useEffect(() => {
    if (isAuthenticated && user) {
      setFormData((prev) => ({
        ...prev,
        customerName: prev.customerName || `${user.firstName} ${user.lastName}`.trim(),
        customerPhone: prev.customerPhone || (user.phone || ''),
      }));
    }
  }, [isAuthenticated, user]);

  const handleAttachPassport = async () => {
    if (!user?.encryptedDietaryData || !business?.e2eePublicKey) return;
    try {
      const payload = JSON.parse(atob(user.encryptedDietaryData));
      const textToEncrypt = `Allergies: ${payload.allergies}\nPreferences: ${payload.preferences}`;
      const encrypted = await encryptRsa(textToEncrypt, business.e2eePublicKey);
      setFormData(prev => ({ ...prev, specialRequests: `E2EE:${encrypted}` }));
      alert('Dietary Passport attached and encrypted.');
    } catch (e) {
      console.error(e);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setStep('pay');
  };

  const handleQuickBook = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    bookingMutation.mutate({
      businessId: id,
      reservationDate: formData.reservationDate,
      reservationTime: formData.reservationTime,
      numberOfGuests: formData.numberOfGuests,
      customerName: formData.customerName,
      customerPhone: formData.customerPhone,
      depositAmount: effectiveDeposit || 25,
      specialRequests: formData.specialRequests,
      paymentMethod: formData.paymentMethod,
    });
  };

  if (businessLoading || !business) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8 flex flex-col max-w-7xl mx-auto gap-8 mt-16">
        <div className="h-[353px] md:h-[442px] rounded-xl bg-[var(--warm-sand)]/50" />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-4 space-y-8">
            <div className="h-32 rounded-xl border border-[rgba(191,179,163,0.2)] bg-[var(--warm-sand)]" />
            <div className="h-40 rounded-xl border border-[rgba(191,179,163,0.2)] bg-[var(--warm-sand)]" />
          </div>
          <div className="lg:col-span-8 space-y-4">
            <div className="h-24 rounded-xl border border-[rgba(191,179,163,0.2)] bg-[var(--warm-sand)]" />
            <div className="h-24 rounded-xl border border-[rgba(191,179,163,0.2)] bg-[var(--warm-sand)]" />
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (bookingResult) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--cream)' }}>
        <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(99,102,241,0.1) 0%, transparent 60%)' }} />
        <Surface className="p-8 max-w-md w-full text-center relative z-10">
          <div className="w-16 h-16 rounded-full bg-[rgba(var(--sage),0.15)] flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-[var(--sage)] text-3xl">check_circle</span>
          </div>
          <h2 className="text-2xl font-bold text-[var(--warm-ink)] mb-2">
            {bookingResult.paymentMethod === 'raast' ? 'Raast Payment Pending' : 'Booking Confirmed!'}
          </h2>
          <p className="mb-4 text-sm text-[var(--soft-stone)]">
            {bookingResult.paymentMethod === 'raast'
              ? 'Complete your Raast transfer and upload screenshot to confirm'
              : 'Your deposit is held in escrow until check-in'}
          </p>
          <Surface className="p-4 mb-6 text-left">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[var(--soft-stone)]">Reference</span>
              <span className="text-sm font-mono font-bold text-[var(--clay)]">{bookingResult.bookingReference}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[var(--soft-stone)]">Deposit</span>
              <span className="text-sm font-bold text-[var(--sage)]">${effectiveDeposit || 25}</span>
            </div>
            {bookingResult.paymentMethod === 'raast' && bookingResult.raastId && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--soft-stone)]">Raast ID</span>
                <span className="text-sm font-mono font-bold text-[var(--clay)]">{bookingResult.raastId}</span>
              </div>
            )}
          </Surface>
          <div className="flex flex-col gap-3">
            <Button onClick={() => navigate('/reservations')}>View My Bookings</Button>
            <Button variant="ghost" onClick={() => setBookingResult(null)}>Done</Button>
          </div>
        </Surface>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-[var(--warm-ink)]" style={{ background: 'var(--cream)' }}>
        <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, "rgba(99,102,241,0.06)" 0%, transparent 60%)' }} />

      <main className="relative z-10 mx-auto max-w-7xl mt-4 px-4 md:mt-8 sm:px-6 lg:px-8 pb-32 md:pb-8">
        {/* Hero */}
        <div className="relative h-[280px] overflow-hidden rounded-xl md:h-[380px] md:mb-8">
          <img alt={business.name} className="h-full w-full object-cover" src={business.coverImageUrl || business.logoUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1200'} />
          <div className="absolute inset-0 bg-gradient-to-t from-[#011d35]/90 via-[#011d35]/40 to-transparent" />
          <div className="absolute bottom-0 left-0 w-full p-6 text-[var(--warm-ink)] md:p-8">
            <div className="flex flex-col-reverse items-start justify-between gap-4 md:flex-row md:items-end">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Chip tone="success">⭐ {googleRating}</Chip>
                  <Chip tone="warning" className="flex items-center gap-1">
                    <ShieldCheckIcon className="h-3.5 w-3.5" />
                    Trust: {trustScore}/100
                  </Chip>
                  {stakeMultiplier > 1.0 && (
                    <Chip tone="success">{stakeMultiplier.toFixed(1)}x $PAB</Chip>
                  )}
                </div>
                <h2 className="font-headline text-2xl font-bold tracking-tight md:text-3xl">{business.name}</h2>
                <p className="text-sm text-[var(--warm-ink)]">📍 {business.address || 'Global Partner'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-3 mb-6">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${step === 'details' ? 'bg-[rgba(var(--clay),0.15)] text-[var(--clay)] border border-[var(--clay)]/30' : 'bg-[rgba(var(--sage),0.1)] text-[var(--sage)]'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step === 'details' ? 'bg-[var(--clay)] text-[var(--warm-ink)]' : 'bg-[var(--sage)] text-[var(--warm-ink)]'}`}>
              {step === 'pay' ? <span className="material-symbols-outlined text-xs">check</span> : '1'}
            </span>
            Details
          </div>
          <div className={`flex-1 h-0.5 ${step === 'pay' ? 'bg-[var(--sage)]' : 'bg-[var(--warm-sand)]'}`} />
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${step === 'pay' ? 'bg-[rgba(var(--clay),0.15)] text-[var(--clay)] border border-[var(--clay)]/30' : 'bg-[var(--warm-sand)] text-[var(--soft-stone)]'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step === 'pay' ? 'bg-[var(--clay)] text-[var(--warm-ink)]' : 'bg-[var(--warm-sand)] text-[var(--soft-stone)]'}`}>2</span>
            Pay
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
          {/* Left: Form */}
          <div className="lg:col-span-3">
            {bookingMutation.isError && (
              <div className="mb-4 p-4 rounded-xl bg-[rgba(var(--terracotta),0.1)] border border-[rgba(var(--terracotta),0.2)] text-sm text-[var(--warm-ink)]">
                {(bookingMutation.error as any)?.response?.data?.error || 'Booking failed'}
              </div>
            )}

            {step === 'details' ? (
              <Surface>
                <form onSubmit={handleDetailsSubmit} className="space-y-5">
                  <div>
                    <h3 className="font-headline text-lg font-semibold text-primary mb-1">When & Who</h3>
                    <p className="text-xs text-[var(--soft-stone)] mb-4">Takes 15 seconds</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[var(--soft-stone)] mb-1">Date</label>
                      <input type="date" name="reservationDate" required min={format(new Date(), 'yyyy-MM-dd')} value={formData.reservationDate} onChange={handleChange} className="w-full px-3 py-2.5 bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-xl text-[var(--warm-ink)] text-sm focus:outline-none focus:border-[var(--clay)]/50" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--soft-stone)] mb-1">Time</label>
                      <input type="time" name="reservationTime" required value={formData.reservationTime} onChange={handleChange} className="w-full px-3 py-2.5 bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-xl text-[var(--warm-ink)] text-sm focus:outline-none focus:border-[var(--clay)]/50" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[var(--soft-stone)] mb-1">Guests</label>
                      <select name="numberOfGuests" required value={formData.numberOfGuests} onChange={handleChange} className="w-full px-3 py-2.5 bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-xl text-[var(--warm-ink)] text-sm focus:outline-none focus:border-[var(--clay)]/50">
                        {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n} className="bg-[var(--warm-sand)]">{n} {n === 1 ? 'Person' : 'People'}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--soft-stone)] mb-1">Name</label>
                      <input type="text" name="customerName" required value={formData.customerName} onChange={handleChange} placeholder="Your name" className="w-full px-3 py-2.5 bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-xl text-[var(--warm-ink)] text-sm placeholder-[var(--soft-stone)] focus:outline-none focus:border-[var(--clay)]/50" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--soft-stone)] mb-1">Phone</label>
                    <input type="tel" name="customerPhone" required value={formData.customerPhone} onChange={handleChange} placeholder="+1 (555) 000-0000" className="w-full px-3 py-2.5 bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-xl text-[var(--warm-ink)] text-sm placeholder-[var(--soft-stone)] focus:outline-none focus:border-[var(--clay)]/50" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-[var(--soft-stone)]">Special Requests</label>
                      {user?.encryptedDietaryData && business?.e2eePublicKey && (
                        <button type="button" onClick={handleAttachPassport} className="text-[10px] font-bold text-[var(--clay)] hover:underline">🔒 Dietary Passport</button>
                      )}
                    </div>
                    <textarea name="specialRequests" value={formData.specialRequests} onChange={handleChange} rows={2} className="w-full px-3 py-2.5 bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-xl text-[var(--warm-ink)] text-sm placeholder-[var(--soft-stone)] focus:outline-none focus:border-[var(--clay)]/50 resize-none" placeholder="Birthday, dietary needs..." />
                  </div>

                  <Button type="submit" className="w-full py-3.5 text-base font-semibold">
                    Continue to Payment →
                  </Button>
                </form>
              </Surface>
            ) : (
              <Surface>
                <div className="space-y-5">
                  <div>
                    <h3 className="font-headline text-lg font-semibold text-primary mb-1">Pay Deposit</h3>
                    <p className="text-xs text-[var(--soft-stone)]">Held in escrow until check-in</p>
                  </div>

                  {/* Apple Pay / Google Pay — one-tap wallet buttons */}
                  <div className="space-y-2">
                    <button
                      onClick={handleQuickBook}
                      disabled={isProcessing}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[var(--warm-sand)] text-[var(--warm-ink)] font-semibold text-sm hover:bg-[var(--warm-sand)] transition-all active:scale-[0.98]"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                      Pay with Apple Pay
                    </button>
                    <button
                      onClick={handleQuickBook}
                      disabled={isProcessing}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white text-black font-semibold text-sm hover:bg-[var(--warm-sand)] transition-all active:scale-[0.98]"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" fill="currentColor"/></svg>
                      Pay with Google Pay
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-[var(--warm-sand)]" />
                    <span className="text-[10px] text-[var(--soft-stone)] uppercase tracking-wider">or pay with card</span>
                    <div className="flex-1 h-px bg-[var(--warm-sand)]" />
                  </div>

                  {/* Payment method selector */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'paylio', label: 'Card / Wallet', icon: '💳', desc: 'Visa, Mastercard, Apple Pay' },
                      { value: 'raast', label: 'Raast', icon: '🏦', desc: 'Instant bank transfer' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setFormData(prev => ({ ...prev, paymentMethod: opt.value }))}
                        className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-medium transition-all ${formData.paymentMethod === opt.value ? 'bg-[rgba(var(--clay),0.15)] text-[var(--clay)] border border-[var(--clay)]/30' : 'bg-[var(--warm-sand)] text-[var(--soft-stone)] border border-[rgba(191,179,163,0.3)] hover:bg-[var(--warm-sand)]'}`}
                      >
                        <span className="text-lg">{opt.icon}</span>
                        <span className="font-semibold">{opt.label}</span>
                        <span className="text-[10px] text-[var(--soft-stone)]">{opt.desc}</span>
                      </button>
                    ))}
                  </div>

                  {/* Raast instructions (shown when Raast is selected) */}
                  {formData.paymentMethod === 'raast' && (
                    <div className="space-y-3">
                      <div className="p-4 rounded-xl bg-[rgba(var(--sky-wash),0.1)] border border-[var(--sky-wash)]/20">
                        <h4 className="text-sm font-semibold text-[var(--warm-ink)] mb-2 flex items-center gap-2">
                          <span className="material-symbols-outlined text-[var(--sky-wash)] text-lg">info</span>
                          How to pay with Raast
                        </h4>
                        <ol className="text-xs text-[var(--soft-stone)] space-y-1.5 list-decimal list-inside">
                          <li>Open your bank app (HBL, Meezan,ABL, etc.)</li>
                          <li>Go to Raast transfers</li>
                          <li>Send <span className="font-bold text-[var(--clay)]">${effectiveDeposit || 25}</span> to Raast ID: <span className="font-mono font-bold text-[var(--clay)]">{business.raastId || 'Not configured'}</span></li>
                          <li>Use reference: <span className="font-mono text-[var(--clay)]">{bookingResult?.bookingReference || 'Generated after booking'}</span></li>
                          <li>Upload screenshot below for instant verification</li>
                        </ol>
                      </div>

                      {bookingResult?.raastId && (
                        <div className="p-3 rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)]">
                          <p className="text-xs text-[var(--soft-stone)] mb-1">Send to Raast ID</p>
                          <div className="flex items-center justify-between">
                            <span className="text-lg font-mono font-bold text-[var(--clay)]">{bookingResult.raastId}</span>
                            <button
                              onClick={() => navigator.clipboard.writeText(bookingResult.raastId)}
                              className="text-xs text-[var(--clay)] hover:text-[var(--clay)]"
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-medium text-[var(--soft-stone)] mb-1">Payment Screenshot</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setFormData(prev => ({ ...prev, paymentScreenshot: file } as any));
                            }
                          }}
                          className="w-full px-3 py-2.5 bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-xl text-[var(--warm-ink)] text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-[rgba(var(--clay),0.15)] file:text-[var(--clay)] file:text-xs file:font-medium"
                        />
                        <p className="text-[10px] text-[var(--soft-stone)] mt-1">Upload proof of payment for faster verification</p>
                      </div>
                    </div>
                  )}

                  {/* Deposit summary */}
                  <Surface className="bg-[rgba(var(--clay),0.1)] border border-[var(--clay)]/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-[var(--soft-stone)]">Deposit due now</p>
                        <p className="text-xs text-[var(--soft-stone)]">Credited toward your bill</p>
                      </div>
                      <span className="text-2xl font-bold text-[var(--clay)]">${effectiveDeposit || 25}</span>
                    </div>
                  </Surface>

                  {/* Trust badge */}
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--sage)]/5 border border-[var(--sage)]/10">
                    <span className="text-[var(--sage)] mt-0.5">🛡️</span>
                    <div>
                      <p className="text-xs font-medium text-[var(--warm-ink)]">Pabandi Escrow Protection</p>
                      <p className="text-[10px] text-[var(--soft-stone)] leading-relaxed">Deposit held safely until check-in. Earn $PAB rewards for reliability.</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="ghost" onClick={() => setStep('details')} className="flex-shrink-0">
                      ← Back
                    </Button>
                    <Button onClick={handlePayDeposit} disabled={isProcessing} className="flex-1 py-3.5 text-base font-semibold">
                      {isProcessing ? 'Processing...' : `Pay $${effectiveDeposit || 25} →`}
                    </Button>
                  </div>
                </div>
              </Surface>
            )}
          </div>

          {/* Right: Summary + Map */}
          <div className="lg:col-span-2 space-y-4">
            <Surface className="p-4">
              <h4 className="text-sm font-semibold text-[var(--warm-ink)] mb-3">Booking Summary</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--soft-stone)]">📍 {business.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--soft-stone)]">📅 {formData.reservationDate || 'Select date'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--soft-stone)]">🕐 {formData.reservationTime || 'Select time'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--soft-stone)]">👥 {formData.numberOfGuests} guests</span>
                </div>
                {formData.customerName && (
                  <div className="flex justify-between">
                    <span className="text-[var(--soft-stone)]">👤 {formData.customerName}</span>
                  </div>
                )}
              </div>
            </Surface>

            <Surface className="p-4">
              <h4 className="text-sm font-semibold text-[var(--warm-ink)] mb-3">Location</h4>
              <div className="h-40 overflow-hidden rounded-lg">
                <BusinessMap latitude={business.latitude || 24.8607} longitude={business.longitude || 67.0011} name={business.name} zoom={15} />
              </div>
            </Surface>

            <div className="hidden lg:block">
              <h4 className="text-sm font-semibold text-[var(--warm-ink)] mb-3">Reviews</h4>
              <ReviewCarousel reviews={analytics?.reviews || [{ id: '1', authorName: 'Ali Khan', rating: 5, text: 'Fantastic service!', time: new Date().toISOString(), sentimentLabel: 'positive' }]} />
            </div>
          </div>
        </div>
      </main>

      {/* Mobile sticky CTA */}
      {step === 'details' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden p-4 bg-gradient-to-t from-[#0a0f1a] via-[#0a0f1a] to-transparent">
          <button
            onClick={() => {
              if (!isAuthenticated) { navigate('/login'); return; }
              setStep('pay');
            }}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-[var(--warm-ink)] font-semibold text-sm shadow-lg active:scale-[0.98]"
          >
            Continue to Payment →
          </button>
        </div>
      )}

      {step === 'pay' && !bookingResult && (
        <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden p-4 bg-gradient-to-t from-[#0a0f1a] via-[#0a0f1a] to-transparent">
          <button
            onClick={handlePayDeposit}
            disabled={isProcessing}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-[var(--warm-ink)] font-semibold text-sm shadow-lg active:scale-[0.98]"
          >
            {isProcessing ? 'Processing...' : formData.paymentMethod === 'raast' ? 'Show Raast Instructions' : `Pay $${effectiveDeposit || 25} →`}
          </button>
        </div>
      )}
    </div>
  );
}
