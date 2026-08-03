import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from 'react-query';
import { businessService, reservationService, stakingService, tokenStakingService, walletService } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';
import BusinessMap from '../components/BusinessMap';
import ReviewCarousel from '../components/ReviewCarousel';
import { executeBscDeposit, executeSolanaDeposit, executeStellarFranklinDeposit } from '../utils/web3';
import { encryptRsa } from '../utils/e2ee';
import { Button, Chip, Surface, Badge, tokens } from '../design-system';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';

export default function BookingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingResult, setBookingResult] = useState<any>(null);
  const [isProcessingWeb3, setIsProcessingWeb3] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const initialDate = urlParams.get('date') || '';
  const initialTime = urlParams.get('time') || '';
  const initialGuests = parseInt(urlParams.get('guests') || '2', 10);

  const [formData, setFormData] = useState({
    reservationDate: initialDate,
    reservationTime: initialTime,
    numberOfGuests: initialGuests,
    customerName: '',
    customerPhone: '',
    specialRequests: '',
    paymentMethod: 'safepay',
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

  const offChainBalance = Number(walletData?.offChainBalance || 0);
  const REQUIRED_STAKE = 50;

  // Fetch user's $PAB staking multiplier for deposit reduction
  const { data: stakeMultData } = useQuery(
    ['stake-multiplier', user?.id],
    () => tokenStakingService.getMultiplier(user!.id),
    { enabled: isAuthenticated && !!user?.id, retry: false }
  );
  const stakeMultiplier = stakeMultData?.data?.multiplier || 1.0;
  // Effective deposit reduced by staking multiplier
  const effectiveDeposit = Math.max(0, dynamicDeposit / stakeMultiplier);

  const bookingMutation = useMutation(
    (data: any) => reservationService.createReservation(data),
    {
      onSuccess: async (res) => {
        const data = res?.data?.data;
        if (data?.prediction?.requiresDeposit || data?.reservation?.depositRequired) {
          setBookingResult(data);
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
    const { reservation } = bookingResult;

    if (formData.paymentMethod === 'paypal' || formData.paymentMethod === 'safepay') {
      window.location.href = bookingResult.checkoutUrl || '/reservations';
      return;
    }

    setIsProcessingWeb3(true);
    try {
      let web3Result: { success: boolean; transactionHash?: string; error?: string } | undefined;

      if (formData.paymentMethod === 'bsc') {
        web3Result = await executeBscDeposit(reservation.depositAmount?.toString() || '0.05', business.walletAddress || '', reservation.id);
        if (!web3Result.success) throw new Error(web3Result.error || 'BSC deposit failed');
      } else if (formData.paymentMethod === 'solana') {
        web3Result = await executeSolanaDeposit(0.1, business.walletAddress || '');
        if (!web3Result.success) throw new Error(web3Result.error || 'Solana deposit failed');
      } else if (formData.paymentMethod === 'stellar-franklin') {
        web3Result = await executeStellarFranklinDeposit('10.00', business.walletAddress || '');
        if (!web3Result.success) throw new Error(web3Result.error || 'Stellar deposit failed');
      } else if (formData.paymentMethod === 'stake') {
        await stakingService.stake({ reservationId: reservation.id, amount: REQUIRED_STAKE });
      }

      await reservationService.updateReservation(reservation.id, {
        depositStatus: 'PAID',
        cryptoDepositTxHash: web3Result?.transactionHash || '',
      });
      navigate('/reservations');
    } catch (err: any) {
      alert('Transaction failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessingWeb3(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated && showBookingForm) {
      // Prompt logic if unauthenticated and trying to book
    }
  }, [isAuthenticated, showBookingForm]);

  const handleAttachPassport = async () => {
    if (!user?.encryptedDietaryData || !business?.e2eePublicKey) return;
    try {
      const payload = JSON.parse(atob(user.encryptedDietaryData));
      const textToEncrypt = `Allergies: ${payload.allergies}\nPreferences: ${payload.preferences}`;
      const encrypted = await encryptRsa(textToEncrypt, business.e2eePublicKey);
      setFormData(prev => ({ ...prev, specialRequests: `E2EE:${encrypted}` }));
      alert('Dietary Passport attached and encrypted with Zero-Knowledge E2EE.');
    } catch (e) {
      console.error(e);
      alert('Failed to attach passport.');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (typeof window !== 'undefined' && window.navigator?.vibrate) {
      window.navigator.vibrate(50);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const isConcierge = urlParams.get('concierge') === 'true';

    bookingMutation.mutate({ businessId: id, isConcierge, ...formData });
  };
  if (businessLoading || !business) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8 flex flex-col max-w-7xl mx-auto gap-8 mt-16">
        <div className="h-[353px] md:h-[442px] rounded-xl bg-surface/50" />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-4 space-y-8">
            <div className="h-32 rounded-xl border border-white/[0.07] bg-white/[0.03]" />
            <div className="h-40 rounded-xl border border-white/[0.07] bg-white/[0.03]" />
          </div>
          <div className="lg:col-span-8 space-y-4">
            <div className="h-24 rounded-xl border border-white/[0.07] bg-white/[0.03]" />
            <div className="h-24 rounded-xl border border-white/[0.07] bg-white/[0.03]" />
            <div className="h-24 rounded-xl border border-white/[0.07] bg-white/[0.03]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-slate-100 antialiased"
      style={{ background: tokens.color.background, fontFamily: tokens.font.body }}
    >
      {/* Top App Bar */}
      <header className="sticky top-0 z-40 hidden md:flex items-center justify-between bg-background/80 px-6 py-4 backdrop-blur-md">
        <h1 className="cursor-pointer font-headline text-2xl font-bold tracking-tighter text-primary" onClick={() => navigate('/')}>Pabandi</h1>
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <button onClick={() => navigate('/reservations')} className="text-sm font-medium text-slate-300 transition-colors hover:text-primary">My Bookings</button>
          ) : (
            <button onClick={() => navigate('/login')} className="text-sm font-medium text-slate-300 transition-colors hover:text-primary">Sign In</button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl mt-4 px-4 md:mt-8 sm:px-6 lg:px-8">
        {bookingMutation.isError && (
          <Surface className="mb-6 border-red-500/20 bg-red-500/10 text-red-200">
            {(bookingMutation.error as any)?.response?.data?.message || 'Booking failed'}
          </Surface>
        )}

        {/* Hero */}
        <div className="relative h-[353px] overflow-hidden rounded-xl md:h-[442px] md:mb-16">
          <img alt={business.name} className="h-full w-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAs0Ker3tH73HShnpzCYS57ru-3m9EJycGJWEoAjRes7gsogMja6_xbRcECJxl_z65r8L8K1RlEZ2Yi88YJIyaf83nLezBsjFXmlb_CGtThPJ6ogXH5z611EYKzBEDTMXJzLDG7fyLLKF34ij9frHsDsecGNoy_hs7IvUhUmEZAuY_nv4p5KYyTXW-LOg21c0WpklLm6jEm6yaeo4IOy7Cbsvl4x9UTkBa5rXOf0SxMRAdn2ZWlqSWwjXH_p0OZcyCMXCl4COE9RDOk" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#011d35]/90 via-[#011d35]/40 to-transparent" />
          <div className="absolute bottom-0 left-0 w-full p-6 text-white md:p-10">
            <div className="flex flex-col-reverse items-start justify-between gap-4 md:flex-row md:items-end">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Chip tone="success">⭐ {googleRating} Rating</Chip>
                  <Chip tone="warning" className="flex items-center gap-1">
                    <ShieldCheckIcon className="h-3.5 w-3.5" />
                    Trust Score: {trustScore}/100
                  </Chip>
                  {stakeMultiplier > 1.0 && (
                    <Chip tone="success" className="flex items-center gap-1">
                      💎 {stakeMultiplier.toFixed(1)}x $PAB Boost
                    </Chip>
                  )}
                  <Badge tone={trustScore >= 80 ? 'success' : trustScore >= 50 ? 'warning' : 'danger'}>
                    Escrow Deposit: ${effectiveDeposit}
                  </Badge>
                  <Chip tone="info">Premium Partner</Chip>
                </div>
                <h2 className="font-headline text-3xl font-bold tracking-tight md:text-[2.75rem]">{business.name}</h2>
                <p className="flex items-center font-body text-sm text-slate-200 md:text-[0.875rem]">
                  <span className="mr-1">📍</span> {business.address || 'Global Partner'}
                </p>
              </div>
              <div className="hidden gap-3 md:flex">
                <button className="rounded-lg border border-white/30 bg-white/10 px-6 py-3 font-body text-sm font-medium text-white backdrop-blur-md transition-all hover:bg-white/20">Save</button>
                <button
                  onClick={() => {
                    if (typeof window !== 'undefined' && window.navigator?.vibrate) window.navigator.vibrate(30);
                    setShowBookingForm(true);
                  }}
                  className="rounded-lg bg-white px-8 py-3 font-body text-sm font-semibold text-primary shadow-sm transition-all hover:bg-slate-50 active:scale-95"
                >
                  Make Reservation
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className={`grid grid-cols-1 gap-8 md:gap-12 transition-all duration-300 ${showBookingForm ? 'lg:grid-cols-2' : 'lg:grid-cols-12'}`}>
          <div className={`${showBookingForm ? 'lg:col-span-1' : 'lg:col-span-4'} space-y-8`}>
            <Surface>
              <h3 className="mb-6 font-headline text-xl font-semibold text-primary">Details</h3>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface text-primary">🕒</div>
                  <div>
                    <h4 className="font-body text-[0.875rem] font-medium text-slate-100">Opening Hours</h4>
                    <p className="font-body text-[0.875rem] text-slate-300">Mon - Sat: 10:00 AM - 9:00 PM</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface text-primary">📞</div>
                  <div>
                    <h4 className="font-body text-[0.875rem] font-medium text-slate-100">Contact</h4>
                    <p className="font-body text-[0.875rem] text-slate-300">{business.address || `${business.city || ''}, ${business.state || business.country || 'United States'}`}</p>
                  </div>
                </div>
              </div>
            </Surface>

            <Surface>
              <h3 className="mb-4 font-headline text-xl font-semibold text-primary">Location</h3>
              <div className="h-48 overflow-hidden rounded-lg bg-surface">
                <BusinessMap latitude={business.latitude || 24.8607} longitude={business.longitude || 67.0011} name={business.name} zoom={15} />
              </div>
            </Surface>
          </div>

          <div className={`${showBookingForm ? 'lg:col-span-1' : 'lg:col-span-8'}`}>
            {showBookingForm ? (
              <Surface>
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="font-headline text-[1.5rem] font-semibold text-primary">Table Reservation</h3>
                  <button onClick={() => setShowBookingForm(false)} className="text-sm font-medium text-slate-300 transition-colors hover:text-primary">Cancel</button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-200">Date *</label>
                      <input type="date" name="reservationDate" required min={format(new Date(), 'yyyy-MM-dd')} value={formData.reservationDate} onChange={handleChange} className="w-full rounded-md border-0 bg-surface px-3 py-2 font-body text-sm text-slate-100 outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-200">Time *</label>
                      <input type="time" name="reservationTime" required value={formData.reservationTime} onChange={handleChange} className="w-full rounded-md border-0 bg-surface px-3 py-2 font-body text-sm text-slate-100 outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-200">Guests *</label>
                      <select name="numberOfGuests" required value={formData.numberOfGuests} onChange={handleChange} className="w-full rounded-md border-0 bg-surface px-3 py-2 font-body text-sm text-slate-100 outline-none focus:ring-1 focus:ring-primary">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => <option key={num} value={num}>{num} {num === 1 ? 'Person' : 'People'}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-200">Your Name *</label>
                      <input type="text" name="customerName" required value={formData.customerName} onChange={handleChange} className="w-full rounded-md border-0 bg-surface px-3 py-2 font-body text-sm text-slate-100 outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-200">Phone Number *</label>
                    <input type="tel" name="customerPhone" required value={formData.customerPhone} onChange={handleChange} className="w-full rounded-md border-0 bg-surface px-3 py-2 font-body text-sm text-slate-100 outline-none focus:ring-1 focus:ring-primary" placeholder="+1 (555) 000-0000" />
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="block text-sm font-medium text-slate-200">Special Requests</label>
                      {user?.encryptedDietaryData && business?.e2eePublicKey && (
                        <button type="button" onClick={handleAttachPassport} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">🔒 Attach Encrypted Dietary Passport</button>
                      )}
                    </div>
                    <textarea name="specialRequests" value={formData.specialRequests} onChange={handleChange} rows={2} className="w-full rounded-md border-0 bg-surface px-3 py-2 font-body text-sm text-slate-100 outline-none focus:ring-1 focus:ring-primary" placeholder="Any special requests or dietary needs..." />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-200">Deposit Payment Method</label>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                      {[
                        { value: 'safepay', label: 'Safepay', sub: 'Fiat' },
                        { value: 'bsc', label: 'Web3 BSC', sub: 'BNB / USDT' },
                        { value: 'solana', label: 'Web3 Solana', sub: 'SOL / USDC' },
                        { value: 'stellar-franklin', label: 'Web3 Stellar', sub: 'BENJI / FOBXX' },
                        { value: 'stake', label: 'Stake PAB', sub: `${REQUIRED_STAKE} PAB required`, disabled: offChainBalance < REQUIRED_STAKE },
                      ].map((option) => {
                        const selected = formData.paymentMethod === option.value;
                        return (
                          <label key={option.value} className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border p-3 transition-all ${selected ? 'border-primary bg-surface' : 'border-white/10 bg-surface hover:bg-surface/80'} ${option.disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
                            <input type="radio" name="paymentMethod" value={option.value} checked={selected} onChange={handleChange} disabled={option.disabled} className="sr-only" />
                            <span className="text-xs font-semibold text-slate-100">{option.label}</span>
                            <span className="text-[10px] text-slate-400">{option.sub}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <Surface className="border-tertiary/30 bg-tertiary/10">
                    <div className="flex items-start gap-4">
                      <span className="mt-0.5 text-tertiary">🛡️</span>
                      <div>
                        <h4 className="font-body text-sm font-semibold text-slate-100">Pabandi Protected Booking</h4>
                        <p className="mt-1 text-xs text-slate-300 leading-relaxed">Checking in securely earns you Pabandi Reliability Tokens. No-shows may affect your platform reliability score.</p>
                      </div>
                    </div>
                  </Surface>

                  <div>
                    <Button variant="default" onClick={() => {}} className="w-full py-4 text-lg font-semibold">
                      Request Reservation
                    </Button>
                  </div>
                </form>
              </Surface>
            ) : bookingResult ? (
              <Surface className="relative overflow-hidden">
                <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl mix-blend-screen" />
                <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-tertiary/20 blur-3xl mix-blend-screen" />
                <div className="relative z-10">
                  <div className="mb-2 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">🤖</div>
                    <h3 className="font-headline text-[1.75rem] font-bold tracking-tight text-primary">AI Risk Analysis</h3>
                  </div>
                  <p className="mb-8 font-body text-slate-300">Our autonomous agent has analyzed your booking request to secure this reservation.</p>

                  <Surface className="mb-8 border border-white/10">
                    <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-6">
                      <div>
                        <p className="mb-1 text-sm font-medium text-slate-300">No-Show Risk Score</p>
                        <div className="flex items-end gap-2">
                          <span className={`font-headline text-4xl font-black ${bookingResult.prediction.riskScore >= 70 ? 'text-red-400' : bookingResult.prediction.riskScore >= 40 ? 'text-orange-400' : 'text-primary'}`}>{bookingResult.prediction.riskScore}</span>
                          <span className="mb-1 font-medium text-slate-300">/ 100</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="mb-1 text-sm font-medium text-slate-300">Required Deposit</p>
                        <div className="font-headline text-3xl font-black text-slate-100">{business.currency || 'USD'} {bookingResult.reservation.depositAmount || 0}</div>
                      </div>
                    </div>
                    <div>
                      <h4 className="mb-3 flex items-center gap-2 font-semibold text-slate-100">📊 Agent Insights</h4>
                      <ul className="space-y-3">
                        {Object.entries(bookingResult.reservation.aiFactors || {}).map(([factor, impact]: [string, any]) => (
                          <li key={factor} className="flex items-center justify-between rounded-lg border border-white/10 bg-surface/50 p-3">
                            <span className="font-body text-sm font-medium text-slate-100 capitalize">{factor.replace(/([A-Z])/g, ' $1').trim()}</span>
                            <span className={`font-mono rounded px-2 py-1 text-xs font-bold ${impact > 0 ? 'bg-red-500/15 text-red-300' : 'bg-primary/15 text-indigo-200'}`}>{impact > 0 ? '+' : ''}{impact}% Risk</span>
                          </li>
                        ))}
                        {Object.keys(bookingResult.reservation.aiFactors || {}).length === 0 && (
                          <li className="italic text-slate-400">Standard baseline risk applied.</li>
                        )}
                      </ul>
                    </div>
                  </Surface>

                  <Surface className="mb-8 border-tertiary/30 bg-tertiary/10">
                    <p className="text-sm text-slate-300">
                      <strong className="text-slate-100">Trust Ecosystem:</strong> This deposit is fully credited towards your final bill. Checking in successfully will reward you with $PAB tokens and lower your future risk scores!
                    </p>
                  </Surface>

                  <div className="flex gap-4">
                    <Button variant="ghost" onClick={() => { setBookingResult(null); setShowBookingForm(false); }} className="flex-1">Cancel</Button>
                    <Button onClick={handlePayDeposit} disabled={isProcessingWeb3} className="flex-[2]">
                      {isProcessingWeb3 ? 'Processing...' : 'Pay Deposit & Confirm'}
                    </Button>
                  </div>
                </div>
              </Surface>
            ) : (
              <div className="space-y-8">
                <div className="flex items-end justify-between">
                  <h3 className="font-headline text-[1.5rem] font-semibold text-primary">Services Overview</h3>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Surface key={i} className="flex cursor-pointer items-center justify-between transition-all hover:border-white/20" onClick={() => setShowBookingForm(true)}>
                      <div>
                        <h4 className="font-body text-[0.875rem] font-medium text-slate-100">Standard Reservation</h4>
                        <p className="font-body text-[0.6875rem] text-slate-300">Secure your spot instantly</p>
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-primary transition-colors group-hover:bg-primary group-hover:text-white">+</div>
                    </Surface>
                  ))}
                </div>
                <div>
                  <h3 className="mb-6 font-headline text-[1.5rem] font-semibold text-primary">Latest Reviews</h3>
                  <ReviewCarousel reviews={analytics?.reviews || [{ id: '1', authorName: 'Ali Khan', rating: 5, text: 'Fantastic service! Checked in smoothly using Pabandi.', time: new Date().toISOString(), sentimentLabel: 'positive' }]} />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Mobile Fixed CTA */}
      {!showBookingForm && (
        <div className="fixed bottom-6 left-4 right-4 z-40 flex justify-center md:hidden">
          <button
            onClick={() => {
              if (typeof window !== 'undefined' && window.navigator?.vibrate) window.navigator.vibrate(30);
              setShowBookingForm(true);
            }}
            className="w-full max-w-sm rounded-full bg-gradient-to-r from-primary to-primary-container px-8 py-4 font-body text-sm font-medium text-white shadow-[0_0_20px_rgba(var(--color-primary),0.3)]"
          >
            <span>Book Appointment</span>
            <span className="ml-1">→</span>
          </button>
        </div>
      )}
    </div>
  );
}
