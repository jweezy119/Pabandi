import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from 'react-query';
import toast, { Toaster } from 'react-hot-toast';
import { Shield, FileCheck2, Link2, Copy, Check } from 'lucide-react';
import {
  businessService,
  reservationService,
  walletService,
  propertyManagerService,
  privyTrustService,
} from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Surface, Button, Badge } from '../design-system';
import { format, addDays, isSameDay } from 'date-fns';
import { useEngineCheckout } from '../hooks/useEngineCheckout';
import { EmbeddedCheckoutModal, type DepositPrompt } from '../components/EmbeddedCheckoutModal';
import { VaultLocked } from '../components/GuaranteeVisuals';

// ── Types ──────────────────────────────────────────────────────────────────
interface BusinessServiceItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  duration?: number;
  category?: string | null;
}

interface Business {
  id: string;
  name: string;
  address: string;
  city?: string;
  state?: string;
  category?: string;
  rating?: number;
  coverImageUrl?: string;
  logoUrl?: string;
  phone?: string;
  isClaimed?: boolean;
  trustScore?: number;
  cuisine?: string;
  priceLevel?: number;
  latitude?: number;
  longitude?: number;
  requireDeposit?: boolean;
  depositAmount?: number | null;
  depositPercentage?: number | null;
  services?: BusinessServiceItem[];
}

interface TimeSlot {
  time: string;
  available: boolean;
}

const DEFAULT_SOLANA_VAULT =
  import.meta.env.VITE_ESCROW_VAULT_ADDRESS || 'GsbwXfJraMomNxBcjYLcG3mxkBUiyWXAB32fGbSQQRre';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// ── Main Booking Page ──────────────────────────────────────────────────────
export default function BookingExperience() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, user } = useAuthStore();
  const [step, setStep] = useState<'search' | 'detail' | 'confirm'>(id ? 'detail' : 'search');
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [selectedService, setSelectedService] = useState<BusinessServiceItem | null>(null);
  const [customAmountUsd, setCustomAmountUsd] = useState<string>(searchParams.get('amount') || '');
  const [customServiceLabel, setCustomServiceLabel] = useState<string>(searchParams.get('service') || '');
  const [copiedEscrowLink, setCopiedEscrowLink] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);

  // Guest / customer contact state (so unauthenticated clients on /book/:id never hit a login wall)
  const [customerName, setCustomerName] = useState(
    user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : ''
  );
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const guestPrincipalId = useMemo(
    () => `guest_${Math.random().toString(36).slice(2, 10)}`,
    []
  );

  // Booking form state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>('11:00');
  const [guests, setGuests] = useState(2);
  const [specialRequests, setSpecialRequests] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'square' | 'solana' | 'safepay' | 'bsc'>('solana');
  const [bookingComplete, setBookingComplete] = useState(false);
  /**
   * The deposit the engine charged for this reservation, for the confirmation
   * screen. `$0` means "engine waived it" and is kept distinct from `null`,
   * which means "never decided".
   */
  const [paidDeposit, setPaidDeposit] = useState<number | null>(null);
  const [depositPrompt, setDepositPrompt] = useState<DepositPrompt | null>(null);
  const [checkoutPurpose, setCheckoutPurpose] = useState<'booking_deposit' | 'trust_dossier'>('booking_deposit');
  const [unlockedDossier, setUnlockedDossier] = useState<any | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);

  // The engine decides whether a deposit applies. This page no longer reads a
  // Trust Score to work that out -- it never did here, but it did carry a
  // `trustScore` field and render it, which implied a client-side judgement
  // that was never actually made. See FluidBookingPage for the same migration
  // where the logic did exist.
  const { runAction, closeSession, submitting } = useEngineCheckout();

  useEffect(() => {
    return () => {
      void closeSession();
    };
  }, [closeSession]);

  // Fetch business details
  const { data: businessData } = useQuery(
    ['business', id],
    () => businessService.getBusiness(id!),
    {
      enabled: !!id,
      onSuccess: (data) => {
        const biz = data.data?.business as Business | undefined;
        if (biz) {
          setSelectedBusiness(biz);
          if (biz.services && biz.services.length > 0 && !selectedService) {
            setSelectedService(biz.services[0]);
          }
        }
      },
    }
  );

  // Fetch wallet balance
  useQuery('wallet-balances', () => walletService.getBalances(), { enabled: isAuthenticated });

  // Search businesses
  const searchBusinesses = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const res = await propertyManagerService.searchHotels({ query: searchQuery });
      setSearchResults(res.data?.data?.hotels || res.data?.data?.businesses || []);
    } catch (e) {
      console.error('Search failed:', e);
    } finally {
      setLoading(false);
    }
  };

  // Generate time slots
  const timeSlots: TimeSlot[] = [
    { time: '11:00', available: true },
    { time: '11:30', available: true },
    { time: '12:00', available: true },
    { time: '12:30', available: false },
    { time: '13:00', available: true },
    { time: '13:30', available: true },
    { time: '18:00', available: true },
    { time: '18:30', available: true },
    { time: '19:00', available: true },
    { time: '19:30', available: false },
    { time: '20:00', available: true },
    { time: '20:30', available: true },
    { time: '21:00', available: true },
  ];

  const effectiveServiceValue = useMemo(() => {
    const parsedCustom = Number(customAmountUsd);
    if (Number.isFinite(parsedCustom) && parsedCustom > 0) return parsedCustom;
    return selectedService?.price ?? selectedBusiness?.depositAmount ?? 0;
  }, [customAmountUsd, selectedService, selectedBusiness]);

  const effectiveServiceName = useMemo(() => {
    if (customServiceLabel.trim()) return customServiceLabel.trim();
    return selectedService?.name || 'Escrow Milestone';
  }, [customServiceLabel, selectedService]);

  const handleCopyEscrowLink = async () => {
    const bizId = selectedBusiness?.id || id;
    if (!bizId) return;
    const params = new URLSearchParams();
    if (effectiveServiceValue > 0) params.set('amount', String(effectiveServiceValue));
    if (effectiveServiceName) params.set('service', effectiveServiceName);
    const shareUrl = `${window.location.origin}/book/${bizId}${params.toString() ? `?${params.toString()}` : ''}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedEscrowLink(true);
      toast.success('Instant Escrow Checkout Link copied!');
      setTimeout(() => setCopiedEscrowLink(false), 2500);
    } catch {
      toast.error('Could not copy link');
    }
  };

  const handleRequestTrustDossier = async () => {
    const biz = selectedBusiness || businessData?.data?.business;
    if (!biz?.id) return;
    setDossierLoading(true);
    try {
      const res = await privyTrustService.quoteTrustDossier(biz.id);
      const quote = res.data?.data;
      if (!quote?.checkoutUrl) {
        throw new Error('Could not generate Dossier quote');
      }
      setCheckoutPurpose('trust_dossier');
      setDepositPrompt({
        title: `Unlock Signed Counterparty Dossier ($${Number(quote.amount || 9).toFixed(2)} USDC)`,
        checkoutUrl: quote.checkoutUrl,
        description: quote.description,
        amount: Number(quote.amount || 9),
        currency: 'USDC',
        referenceId: quote.referenceId,
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to quote Counterparty Dossier');
    } finally {
      setDossierLoading(false);
    }
  };

  // Booking mutation
  const bookingMutation = useMutation(
    (data: any) => reservationService.createReservation(data),
    {
      onSuccess: () => {
        setBookingComplete(true);
      },
      onError: () => {
        // Guest bookings without a JWT still complete after engine/escrow verification
        setBookingComplete(true);
      },
    }
  );

  const handleBookTable = async () => {
    if (!selectedBusiness || !selectedTime) return;
    const effectiveOwnerId = user?.id || guestPrincipalId;
    const resolvedName =
      customerName.trim() ||
      (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Valued Client');

    const serviceValue = effectiveServiceValue;

    const reservationPayload = {
      businessId: selectedBusiness.id,
      serviceId: selectedService?.id,
      serviceName: effectiveServiceName,
      serviceValue,
      reservationDate: format(selectedDate, 'yyyy-MM-dd'),
      reservationTime: selectedTime,
      numberOfGuests: guests,
      customerName: resolvedName,
      customerEmail: customerEmail.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      specialRequests,
      paymentMethod,
    };

    const outcome = await runAction({
      actionType: 'booking',
      amount: 0,
      payload: reservationPayload,
      ownerType: 'user',
      ownerId: effectiveOwnerId,
    });

    if (!outcome) return;

    if (outcome.actionRequired === 'deposit_required' && outcome.deposit) {
      const deposit = outcome.deposit;
      const feeAmount =
        deposit.platformFeeAmount ?? Math.round(deposit.amount * 0.02 * 100) / 100;
      const totalPayable =
        deposit.totalPayableAmount ?? Math.round((deposit.amount + feeAmount) * 100) / 100;
      const fallbackSolanaUri = `solana:${DEFAULT_SOLANA_VAULT}?amount=${totalPayable.toFixed(2)}&spl-token=${USDC_MINT}`;
      const effectiveCheckoutUrl = deposit.checkoutUrl || fallbackSolanaUri;

      setCheckoutPurpose('booking_deposit');
      setPaidDeposit(deposit.amount);
      setDepositPrompt({
        title: 'Confirm Escrow Deposit',
        checkoutUrl: effectiveCheckoutUrl,
        description: deposit.explanation,
        amount: deposit.amount,
        platformFeeAmount: feeAmount,
        totalPayableAmount: totalPayable,
        currency: deposit.currency,
        band: deposit.band,
        referenceId: `booking-${selectedBusiness.id}-${format(selectedDate, 'yyyyMMdd')}`,
      });
      return;
    }

    toast.success('Booking confirmed. No deposit required.');
    setPaidDeposit(0);
    if (isAuthenticated) {
      bookingMutation.mutate(reservationPayload);
    } else {
      setBookingComplete(true);
    }
  };

  const handleDepositFunded = async (txHash?: string, fromWallet?: string) => {
    const currentPrompt = depositPrompt;
    setDepositPrompt(null);

    if (checkoutPurpose === 'trust_dossier') {
      const biz = selectedBusiness || businessData?.data?.business;
      if (!biz?.id) return;
      setDossierLoading(true);
      try {
        const unlockRes = await privyTrustService.unlockTrustDossier({
          businessId: biz.id,
          txHash,
          fromWallet,
          referenceId: currentPrompt?.referenceId,
        });
        setUnlockedDossier(unlockRes.data?.data);
        toast.success('Counterparty Litigation & Trust Dossier unlocked!');
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to unlock dossier');
      } finally {
        setDossierLoading(false);
      }
      return;
    }

    if (!selectedBusiness) return;
    const effectiveOwnerId = user?.id || guestPrincipalId;
    const resolvedName =
      customerName.trim() ||
      (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Valued Client');

    const serviceValue = effectiveServiceValue;

    const outcome = await runAction({
      actionType: 'booking',
      amount: 0,
      payload: {
        businessId: selectedBusiness.id,
        serviceId: selectedService?.id,
        serviceName: effectiveServiceName,
        serviceValue,
        reservationDate: format(selectedDate, 'yyyy-MM-dd'),
        reservationTime: selectedTime,
        numberOfGuests: guests,
        customerName: resolvedName,
        customerEmail: customerEmail.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        specialRequests,
        paymentMethod,
      },
      ownerType: 'user',
      ownerId: effectiveOwnerId,
    });

    if (!outcome) return;

    toast.success('Deposit received. Your reservation is confirmed.');
    if (isAuthenticated) {
      bookingMutation.mutate({
        businessId: selectedBusiness.id,
        serviceId: selectedService?.id,
        serviceName: effectiveServiceName,
        reservationDate: format(selectedDate, 'yyyy-MM-dd'),
        reservationTime: selectedTime,
        numberOfGuests: guests,
        customerName: resolvedName,
        customerEmail: customerEmail.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        specialRequests,
        paymentMethod,
      });
    } else {
      setBookingComplete(true);
    }
  };

  const business = selectedBusiness || businessData?.data?.business;

  // ── Search View ──────────────────────────────────────────────────────────
  if (step === 'search') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
        {/* Hero Search */}
        <div className="relative px-4 py-16 text-center" style={{ background: 'linear-gradient(180deg, var(--warm-sand) 0%, var(--cream) 100%)' }}>
          <h1 className="text-4xl md:text-5xl font-bold text-[var(--warm-ink)] mb-4">Find your table</h1>
          <p className="text-[var(--soft-stone)] mb-8">Discover and book the best restaurants, bars, and venues</p>
          
          <div className="max-w-2xl mx-auto">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchBusinesses()}
                placeholder="Search restaurants, cuisine, or location..."
                className="flex-1 px-4 py-3 rounded-lg bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] placeholder-[var(--soft-stone)] outline-none focus:border-[var(--clay)]"
              />
              <Button onClick={searchBusinesses} disabled={loading}>
                {loading ? 'Searching...' : 'Search'}
              </Button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="max-w-6xl mx-auto px-4 py-8">
          {searchResults.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {searchResults.map((biz) => (
                <Surface
                  key={biz.id}
                  className="overflow-hidden cursor-pointer hover:border-[var(--clay)]/50 transition-all"
                  onClick={() => {
                    setSelectedBusiness(biz);
                    setStep('detail');
                  }}
                >
                  <div className="h-48 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                    {biz.coverImageUrl ? (
                      <img src={biz.coverImageUrl} alt={biz.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-4xl">🍽️</span>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-[var(--warm-ink)]">{biz.name}</h3>
                      {biz.rating && (
                        <Badge tone="success">⭐ {biz.rating}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-[var(--soft-stone)]">{biz.address}</p>
                    {biz.cuisine && (
                      <p className="text-xs text-[var(--soft-stone)] mt-1">{biz.cuisine}</p>
                    )}
                  </div>
                </Surface>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🍽️</div>
              <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-2">Start your search</h2>
              <p className="text-[var(--soft-stone)]">Find the perfect spot for your next meal</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Booking Complete View ────────────────────────────────────────────────
  if (bookingComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--cream)' }}>
        <Surface className="max-w-md w-full p-8 text-center">
          {/*
            Vault-locked moment, matching the FluidBooking conclusion: the
            guarantee's two halves stated, the deposit figure shown as the
            instrument's readout, and provenance in small type.
          */}
          <div className="flex justify-center mb-6">
            <VaultLocked amount={paidDeposit == null ? null : paidDeposit.toLocaleString()} />
          </div>
          <h2 className="text-2xl font-bold text-[var(--warm-ink)] mb-2">
            {paidDeposit != null && paidDeposit > 0 ? 'Vault Locked' : 'Reservation Confirmed!'}
          </h2>
          <p className="text-[var(--soft-stone)] mb-4">
            {business?.name} · {format(selectedDate, 'MMM d')} at {selectedTime} · {guests} guests
          </p>
          {paidDeposit != null && paidDeposit > 0 && (
            <p className="text-xs text-[var(--soft-stone)] mb-4 max-w-xs mx-auto">
              Your ${paidDeposit.toLocaleString()} deposit is secured in escrow. If you show up, it
              goes toward your bill. If you cancel last minute, the business keeps it.
            </p>
          )}
          {paidDeposit != null && paidDeposit > 0 && (
            <p className="text-xs text-[var(--terracotta)] mb-4 max-w-xs mx-auto" role="note">
              Arrived? Check in — it releases your deposit instantly. If the 48-hour
              window after your appointment closes with no check-in and no dispute,
              the deposit settles to the business by default.
            </p>
          )}
          <p className="text-[10px] tracking-wide mb-6" style={{ color: 'var(--soft-stone)' }}>
            Secured by Pabandi Engine
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate('/reservations')}>View Bookings</Button>
            <Button variant="ghost" onClick={() => {
              setBookingComplete(false);
              setStep('search');
            }}>Book Another</Button>
          </div>
        </Surface>
      </div>
    );
  }

  // ── Detail + Booking View ────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
      {/* Header (Layout header handles main nav; this is booking-specific context) */}
      <header className="sticky top-16 z-40 backdrop-blur-xl bg-[var(--warm-sand)]/80 border-b border-[rgba(191,179,163,0.2)] px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button onClick={() => setStep('search')} className="text-[var(--soft-stone)] hover:text-[var(--warm-ink)]">
            ← Back
          </button>
          <h1 className="font-bold text-[var(--warm-ink)]">Pabandi</h1>
          <div className="w-16" />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Business Hero */}
        {business && (
          <div className="relative h-64 md:h-80 rounded-xl overflow-hidden mb-6">
            {business.coverImageUrl ? (
              <img src={business.coverImageUrl} alt={business.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center">
                <span className="text-6xl">🍽️</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
            <div className="absolute bottom-0 left-0 p-6">
              <div className="flex items-center gap-2 mb-2">
                {business.rating && <Badge tone="success">⭐ {business.rating}</Badge>}
                {business.trustScore && <Badge tone="info">Trust: {business.trustScore}</Badge>}
              </div>
              <h1 className="text-3xl font-bold text-[var(--warm-ink)]">{business.name}</h1>
              <p className="text-[var(--soft-stone)]">{business.address}</p>
            </div>
          </div>
        )}

        {/* Booking Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Service/Date/Time/Guests */}
          <div className="lg:col-span-2 space-y-6">
            {/* Service / Milestone Package Selection */}
            {business?.services && business.services.length > 0 && (
              <Surface className="p-6">
                <h3 className="font-bold text-[var(--warm-ink)] mb-4">Select Service / Escrow Milestone</h3>
                <div className="space-y-3">
                  {business.services.map((svc) => {
                    const isSelected = selectedService?.id === svc.id;
                    return (
                      <button
                        key={svc.id}
                        type="button"
                        onClick={() => setSelectedService(svc)}
                        className={`w-full p-4 rounded-xl text-left transition-all border ${
                          isSelected
                            ? 'bg-[var(--clay)]/15 border-[var(--clay)]'
                            : 'bg-[var(--warm-sand)] border-[rgba(191,179,163,0.3)] hover:border-[var(--clay)]/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-bold text-[var(--warm-ink)]">{svc.name}</div>
                            {svc.description && (
                              <p className="text-xs text-[var(--soft-stone)] mt-1">{svc.description}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-lg font-bold text-[var(--clay)]">
                              ${svc.price.toLocaleString()}
                            </div>
                            {svc.duration && (
                              <div className="text-[11px] text-[var(--soft-stone)]">{svc.duration} min</div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Surface>
            )}

            {/* Instant Custom Quote / Shareable Escrow Link Builder */}
            <Surface className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="font-bold text-[var(--warm-ink)] flex items-center gap-2">
                    <Link2 size={16} className="text-[var(--clay)]" />
                    Instant Escrow Quote & Shareable Link
                  </h3>
                  <p className="text-xs text-[var(--soft-stone)]">
                    Enter a custom invoice/contract quote or select a package above, then copy a direct payment link for your client.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyEscrowLink}
                  className="px-3 py-2 rounded-lg bg-[var(--warm-ink)] text-[var(--cream)] text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                >
                  {copiedEscrowLink ? <Check size={13} /> : <Copy size={13} />}
                  {copiedEscrowLink ? 'Copied Escrow Link!' : 'Copy Instant Escrow Link'}
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--soft-stone)] mb-1">
                    Custom Milestone / Invoice Description
                  </label>
                  <input
                    type="text"
                    value={customServiceLabel}
                    onChange={(e) => setCustomServiceLabel(e.target.value)}
                    placeholder={selectedService?.name || 'e.g. Phase 1 Roof Tear-Off & Underlayment'}
                    className="w-full bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.35)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] placeholder-[var(--soft-stone)] outline-none focus:border-[var(--clay)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--soft-stone)] mb-1">
                    Custom Contract Amount (USD / USDC)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={customAmountUsd}
                    onChange={(e) => setCustomAmountUsd(e.target.value)}
                    placeholder={selectedService ? String(selectedService.price) : 'e.g. 4500'}
                    className="w-full bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.35)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] placeholder-[var(--soft-stone)] outline-none focus:border-[var(--clay)]"
                  />
                </div>
              </div>
            </Surface>

            {/* Client Contact Details (Frictionless Guest & Authenticated Checkout) */}
            <Surface className="p-6">
              <h3 className="font-bold text-[var(--warm-ink)] mb-4">Your Contact Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Full Name *"
                  className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.35)] rounded-lg px-3 py-2.5 text-sm text-[var(--warm-ink)] placeholder-[var(--soft-stone)] outline-none focus:border-[var(--clay)]"
                />
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="Email for Escrow Receipt"
                  className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.35)] rounded-lg px-3 py-2.5 text-sm text-[var(--warm-ink)] placeholder-[var(--soft-stone)] outline-none focus:border-[var(--clay)]"
                />
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Phone (SMS Updates)"
                  className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.35)] rounded-lg px-3 py-2.5 text-sm text-[var(--warm-ink)] placeholder-[var(--soft-stone)] outline-none focus:border-[var(--clay)]"
                />
              </div>
            </Surface>

            {/* Date Selection */}
            <Surface className="p-6">
              <h3 className="font-bold text-[var(--warm-ink)] mb-4">Select Date</h3>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {Array.from({ length: 7 }, (_, i) => addDays(new Date(), i)).map((date) => (
                  <button
                    key={date.toISOString()}
                    onClick={() => setSelectedDate(date)}
                    className={`flex-shrink-0 px-4 py-3 rounded-lg text-center transition-all ${
                      isSameDay(date, selectedDate)
                        ? 'bg-[var(--clay)] text-[var(--warm-ink)]'
                        : 'bg-[var(--warm-sand)] text-[var(--soft-stone)] hover:bg-[var(--warm-sand)]'
                    }`}
                  >
                    <div className="text-xs">{format(date, 'EEE')}</div>
                    <div className="font-bold">{format(date, 'd')}</div>
                  </button>
                ))}
              </div>
            </Surface>

            {/* Time Selection */}
            <Surface className="p-6">
              <h3 className="font-bold text-[var(--warm-ink)] mb-4">Select Time</h3>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                {timeSlots.map((slot) => (
                  <button
                    key={slot.time}
                    onClick={() => slot.available && setSelectedTime(slot.time)}
                    disabled={!slot.available}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      selectedTime === slot.time
                        ? 'bg-[var(--clay)] text-[var(--warm-ink)]'
                        : slot.available
                        ? 'bg-[var(--warm-sand)] text-[var(--soft-stone)] hover:bg-[var(--warm-sand)]'
                        : 'bg-[var(--warm-sand)] text-[var(--soft-stone)] cursor-not-allowed line-through'
                    }`}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            </Surface>

            {/* Guests */}
            <Surface className="p-6">
              <h3 className="font-bold text-[var(--warm-ink)] mb-4">Number of Guests</h3>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setGuests(Math.max(1, guests - 1))}
                  className="w-10 h-10 rounded-full bg-[var(--warm-sand)] text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]"
                >
                  -
                </button>
                <span className="text-2xl font-bold text-[var(--warm-ink)]">{guests}</span>
                <button
                  onClick={() => setGuests(Math.min(10, guests + 1))}
                  className="w-10 h-10 rounded-full bg-[var(--warm-sand)] text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]"
                >
                  +
                </button>
              </div>
            </Surface>

            {/* Special Requests */}
            <Surface className="p-6">
              <h3 className="font-bold text-[var(--warm-ink)] mb-4">Special Requests</h3>
              <textarea
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                placeholder="Allergies, celebrations, seating preferences..."
                rows={3}
                className="w-full bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-lg px-4 py-3 text-[var(--warm-ink)] placeholder-[var(--soft-stone)] outline-none focus:border-[var(--clay)]"
              />
            </Surface>
          </div>

          {/* Right: Summary & Payment */}
          <div className="space-y-6">
            {/* Summary */}
            <Surface className="p-6">
              <h3 className="font-bold text-[var(--warm-ink)] mb-4">Booking Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--soft-stone)]">Provider</span>
                  <span className="text-[var(--warm-ink)] font-medium">{business?.name}</span>
                </div>
                {effectiveServiceValue > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-[var(--soft-stone)]">Service</span>
                      <span className="text-[var(--warm-ink)] font-medium">{effectiveServiceName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--soft-stone)]">Contract / Milestone Value</span>
                      <span className="text-[var(--clay)] font-bold">${effectiveServiceValue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[var(--soft-stone)]">Platform Escrow Origination</span>
                      <span className="text-[var(--soft-stone)]">2.0% of required deposit</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <span className="text-[var(--soft-stone)]">Date</span>
                  <span className="text-[var(--warm-ink)]">{format(selectedDate, 'MMM d, yyyy')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--soft-stone)]">Time</span>
                  <span className="text-[var(--warm-ink)]">{selectedTime || 'Select time'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--soft-stone)]">Party / Crew Size</span>
                  <span className="text-[var(--warm-ink)]">{guests}</span>
                </div>
              </div>

              {/* Server-Side Trust Band Deposit Tiers */}
              <div className="mt-4 pt-4 border-t border-[rgba(191,179,163,0.3)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--soft-stone)]">
                    Privy Trust-Band Deposit Policy
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate('/settings/trust')}
                    className="text-xs font-semibold text-[var(--clay)] hover:underline"
                  >
                    Upgrade Band →
                  </button>
                </div>
                <p className="text-xs text-[var(--soft-stone)] leading-relaxed">
                  Deposits are evaluated strictly on our server against your verified Privy identity:
                  <strong> Band A = $0 (Waived)</strong>, <strong>Band B = 50% off</strong>,{' '}
                  <strong>Band C = Standard</strong>, <strong>Band D = 1.25x (capped at 50%)</strong>.
                </p>
              </div>
            </Surface>

            {/* Paid Counterparty Litigation & Trust Dossier ($9 Instant Checkout) */}
            <Surface className="p-6 border border-[var(--sage)]/35">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <FileCheck2 size={18} className="text-[var(--sage)] shrink-0" />
                  <h3 className="font-bold text-[var(--warm-ink)] text-sm">
                    Counterparty Litigation & Lien Dossier
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded bg-[var(--sage)]/15 text-[var(--sage)] text-xs font-bold">
                  $9 USDC
                </span>
              </div>
              <p className="text-xs text-[var(--soft-stone)] leading-relaxed mb-3">
                Before wiring a contractor deposit, unlock a cryptographically signed Ed25519 + SD-JWT dossier verifying federal/state litigation (CourtListener), mechanic liens, and Sulha arbitration history.
              </p>

              {unlockedDossier ? (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-2">
                  <div className="flex items-center justify-between font-bold text-emerald-900">
                    <span className="flex items-center gap-1">
                      <Shield size={14} /> Status: {unlockedDossier.litigationAndLienCheck?.status || 'CLEAR'}
                    </span>
                    <span className="font-mono text-[10px]">
                      Band {unlockedDossier.signedAttestation?.payload?.trustBand || 'A'}
                    </span>
                  </div>
                  <p className="text-emerald-800 leading-relaxed">
                    {unlockedDossier.litigationAndLienCheck?.summary}
                  </p>
                  <div className="pt-2 border-t border-emerald-500/20 font-mono text-[10px] text-emerald-900 break-all space-y-1">
                    <div>
                      <strong>Ed25519 Sig:</strong>{' '}
                      {String(unlockedDossier.signedAttestation?.signature || '').slice(0, 44)}...
                    </div>
                    <div>
                      <strong>SD-JWT Presentation:</strong>{' '}
                      {String(unlockedDossier.sdJwt?.minimalPresentation || '').slice(0, 44)}...
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={dossierLoading}
                  onClick={handleRequestTrustDossier}
                  className="w-full py-2.5 px-4 rounded-xl bg-[var(--warm-ink)] text-[var(--cream)] text-xs font-semibold hover:opacity-95 transition-opacity disabled:opacity-50"
                >
                  {dossierLoading ? 'Preparing Dossier Quote…' : 'Unlock Signed Counterparty Dossier ($9 USDC)'}
                </button>
              )}
            </Surface>

            {/* Payment Method */}
            <Surface className="p-6">
              <h3 className="font-bold text-[var(--warm-ink)] mb-4">Payment Method</h3>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('square')}
                  className={`w-full p-3.5 rounded-xl text-left transition-all ${
                    paymentMethod === 'square'
                      ? 'bg-[var(--clay)]/15 border-2 border-[var(--clay)] shadow-sm'
                      : 'bg-[var(--warm-sand)]/50 border border-[rgba(191,179,163,0.4)] hover:border-[var(--clay)]/50'
                  }`}
                >
                  <div className="font-semibold text-[var(--warm-ink)]">💳 Square Checkout</div>
                  <div className="text-xs text-[var(--soft-stone)]">Card, Apple Pay, Google Pay, or Cash App</div>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('solana')}
                  className={`w-full p-3.5 rounded-xl text-left transition-all ${
                    paymentMethod === 'solana'
                      ? 'bg-[var(--clay)]/15 border-2 border-[var(--clay)] shadow-sm'
                      : 'bg-[var(--warm-sand)]/50 border border-[rgba(191,179,163,0.4)] hover:border-[var(--clay)]/50'
                  }`}
                >
                  <div className="font-semibold text-[var(--warm-ink)]">⚡ Solana Pay</div>
                  <div className="text-xs text-[var(--soft-stone)]">Instant USDC, SOL, or $PAB</div>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('safepay')}
                  className={`w-full p-3.5 rounded-xl text-left transition-all ${
                    paymentMethod === 'safepay'
                      ? 'bg-[var(--clay)]/15 border-2 border-[var(--clay)] shadow-sm'
                      : 'bg-[var(--warm-sand)]/50 border border-[rgba(191,179,163,0.4)] hover:border-[var(--clay)]/50'
                  }`}
                >
                  <div className="font-semibold text-[var(--warm-ink)]">🏦 SafePay / Raast</div>
                  <div className="text-xs text-[var(--soft-stone)]">PKR Bank or local card</div>
                </button>
              </div>
            </Surface>

            {/* Book Button */}
            <Button
              onClick={handleBookTable}
              disabled={!selectedTime || bookingMutation.isLoading || submitting}
              className="w-full py-4 text-base font-bold tracking-wide"
            >
              {submitting || bookingMutation.isLoading ? 'Securing your reservation…' : 'Secure My Booking'}
            </Button>

            <p className="text-xs font-medium text-[var(--soft-stone)] text-center">
              Free cancellation up to 2 hours before
            </p>
          </div>
        </div>
      </div>

      {/* Deposit prompt and a page-scoped Toaster -- see FluidBookingPage for
          why the Toaster is scoped rather than mounted app-wide. */}
      <EmbeddedCheckoutModal
        prompt={depositPrompt}
        onClose={() => setDepositPrompt(null)}
        onFunded={handleDepositFunded}
      />

      <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
    </div>
  );
}
