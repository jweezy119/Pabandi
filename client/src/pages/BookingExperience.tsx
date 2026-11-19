import { useState, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import toast, { Toaster } from 'react-hot-toast';
import { Shield, FileCheck2, Link2, Copy, Check } from 'lucide-react';
import {
  apiClient,
  businessService,
  privyTrustService,
} from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Surface, Button, Badge } from '../design-system';
import { format, addDays, isSameDay } from 'date-fns';
import { EmbeddedCheckoutModal, type DepositPrompt } from '../components/EmbeddedCheckoutModal';
import { PabandiCheckoutModal, type PaymentRail } from '../components/PabandiCheckoutModal';
import { VaultLocked } from '../components/GuaranteeVisuals';
import { getBookingSchema } from '../config/bookingSchemas';

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
  vertical?: string;
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
  raastId?: string | null;
  iban?: string | null;
  solanaWallet?: string | null;
  walletAddress?: string | null;
  settings?: { raastId?: string | null } | null;
  services?: BusinessServiceItem[];
}

interface TimeSlot {
  time: string;
  available: boolean;
}

const DEFAULT_TIME_SLOTS: TimeSlot[] = [
  { time: '11:00', available: true },
  { time: '11:30', available: true },
  { time: '12:00', available: true },
  { time: '12:30', available: true },
  { time: '13:00', available: true },
  { time: '13:30', available: true },
  { time: '18:00', available: true },
  { time: '18:30', available: true },
  { time: '19:00', available: true },
  { time: '19:30', available: true },
  { time: '20:00', available: true },
  { time: '20:30', available: true },
  { time: '21:00', available: true },
];

function extractBusinessFromResponse(res: any): Business | null {
  return (res?.data?.data?.business ?? res?.data?.business ?? null) as Business | null;
}

// ── Main Booking Page ──────────────────────────────────────────────────────
export default function BookingExperience() {
  const navigate = useNavigate();
  const params = useParams();
  const id = params.id || params.businessSlug || params.slug;
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const [step, setStep] = useState<'search' | 'detail' | 'confirm'>(id ? 'detail' : 'search');
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [selectedService, setSelectedService] = useState<BusinessServiceItem | null>(null);
  const [customAmountUsd, setCustomAmountUsd] = useState<string>(searchParams.get('amount') || '');
  const [customServiceLabel, setCustomServiceLabel] = useState<string>(searchParams.get('service') || '');
  const [copiedEscrowLink, setCopiedEscrowLink] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Guest / customer contact state (so unauthenticated clients on /book/:id never hit a login wall)
  const [customerName, setCustomerName] = useState(
    user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : ''
  );
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');

  // Booking form state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>('11:00');
  const [guests, setGuests] = useState(2);
  const [serviceAddress, setServiceAddress] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'square' | 'solana' | 'safepay' | 'bsc'>('solana');
  const [bookingComplete, setBookingComplete] = useState(false);
  const [createdBooking, setCreatedBooking] = useState<{ id: string; escrowId?: string } | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  /**
   * The deposit charged for this reservation, for the confirmation screen.
   * `$0` means waived; `null` means not decided yet.
   */
  const [paidDeposit, setPaidDeposit] = useState<number | null>(null);
  const [depositPrompt, setDepositPrompt] = useState<DepositPrompt | null>(null);
  const [unlockedDossier, setUnlockedDossier] = useState<any | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);

  // Fetch business details (unwraps { success, data: { business } })
  const {
    data: businessData,
    isLoading: businessLoading,
    isError: businessError,
  } = useQuery(
    ['business', id],
    () => businessService.getBusiness(id!),
    {
      enabled: !!id,
      retry: 1,
      onSuccess: (res) => {
        const biz = extractBusinessFromResponse(res);
        if (biz) {
          setSelectedBusiness(biz);
          if (biz.services && biz.services.length > 0 && !selectedService) {
            setSelectedService(biz.services[0]);
          }
        }
      },
    }
  );

  const business = selectedBusiness || extractBusinessFromResponse(businessData);
  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');

  // Fetch live slot availability for the selected date (falls back cleanly to defaults)
  const { data: slotsData } = useQuery(
    ['booking-slots', business?.id, selectedDateKey],
    () => apiClient.get(`/booking/${business!.id}/slots`, { params: { date: selectedDateKey } }),
    {
      enabled: !!business?.id,
      retry: false,
    }
  );

  // Search businesses via live BookingOS discovery endpoint
  const searchBusinesses = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const res = await apiClient.get('/booking/businesses', { params: { query: searchQuery.trim() } });
      setSearchResults(res.data?.items || res.data?.data || []);
    } catch (e) {
      console.error('Search failed:', e);
      toast.error('Could not search businesses right now.');
    } finally {
      setLoading(false);
    }
  };

  // Time slots from server availability, or default schedule
  const timeSlots: TimeSlot[] = useMemo(() => {
    const raw = slotsData?.data?.data ?? slotsData?.data?.slots;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((s: any) => ({
        time: s.time || s.startTime,
        available: s.available !== false,
      }));
    }
    return DEFAULT_TIME_SLOTS;
  }, [slotsData]);

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
    const biz = business;
    if (!biz?.id) return;
    setDossierLoading(true);
    try {
      const res = await privyTrustService.quoteTrustDossier(biz.id);
      const quote = res.data?.data;
      if (!quote?.checkoutUrl) {
        throw new Error('Could not generate Dossier quote');
      }
      setDepositPrompt({
        title: `Unlock Signed Counterparty Dossier ($${Number(quote.amount || 9).toFixed(2)} USDC)`,
        checkoutUrl: quote.checkoutUrl,
        description: quote.description,
        amount: Number(quote.amount || 9),
        currency: 'USDC',
        referenceId: quote.referenceId,
      });
    } catch (err: any) {
      const status = err?.response?.status;
      toast.error(
        status === 404
          ? 'Counterparty Dossier service is currently unavailable.'
          : err instanceof Error
          ? err.message
          : 'Failed to quote Counterparty Dossier'
      );
    } finally {
      setDossierLoading(false);
    }
  };

  const schema = useMemo(() => {
    return getBookingSchema(business?.vertical || business?.category);
  }, [business]);

  const computedDeposit = useMemo(() => {
    if (!business) return 0;
    if (business.depositAmount && business.depositAmount > 0) {
      return Number(business.depositAmount);
    }
    if (business.depositPercentage && business.depositPercentage > 0 && effectiveServiceValue > 0) {
      return Math.round(effectiveServiceValue * (business.depositPercentage / 100) * 100) / 100;
    }
    if (business.requireDeposit && effectiveServiceValue > 0) {
      return Math.round(effectiveServiceValue * 0.2 * 100) / 100;
    }
    return 0;
  }, [business, effectiveServiceValue]);

  const checkoutInitialRail: PaymentRail =
    paymentMethod === 'square' ? 'square' : paymentMethod === 'safepay' ? 'raast' : 'solana';

  const handleBookTable = async () => {
    const targetBusiness = business;
    if (!targetBusiness) {
      toast.error('Business details are still loading. Please try again.');
      return;
    }
    if (!selectedTime) {
      toast.error('Please select a time slot.');
      return;
    }

    const resolvedName =
      customerName.trim() ||
      (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Valued Client');

    const serviceValue = effectiveServiceValue;
    const depositDue = computedDeposit;

    setSubmitting(true);
    try {
      const res = await apiClient.post('/booking', {
        businessId: targetBusiness.id,
        serviceId: selectedService?.id,
        serviceName: effectiveServiceName,
        serviceType: selectedService?.name || effectiveServiceName || targetBusiness.category || 'Booking',
        serviceValue,
        reservationDate: selectedDateKey,
        reservationTime: selectedTime,
        durationMinutes: selectedService?.duration || 60,
        numberOfGuests: schema.showPartySize ? guests : 1,
        depositAmount: depositDue,
        customerName: resolvedName,
        customerEmail: customerEmail.trim() || user?.email || undefined,
        customerPhone: customerPhone.trim() || user?.phone || undefined,
        clientAddress: schema.showServiceAddress ? serviceAddress.trim() : undefined,
        serviceAddress: schema.showServiceAddress ? serviceAddress.trim() : undefined,
        specialRequests: schema.showSpecialRequests ? specialRequests : undefined,
        projectDescription: schema.showProjectDescription ? customServiceLabel : undefined,
        paymentMethod,
      });

      const created = res.data?.data;
      const bookingId = created?.bookingId || created?.id;
      const escrowId = created?.escrowId;
      setCreatedBooking(bookingId ? { id: bookingId, escrowId } : null);

      if (depositDue > 0 && bookingId) {
        setPaidDeposit(depositDue);
        setCheckoutOpen(true);
      } else {
        setPaidDeposit(0);
        toast.success('Booking confirmed!');
        setBookingComplete(true);
      }
    } catch (err: any) {
      if (err?.response?.status === 409) {
        toast.error('This time slot is already booked. Please choose another time.');
      } else {
        const message =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          'Booking failed. Please try again.';
        toast.error(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckoutSuccess = async (rail: PaymentRail, paymentUrlOrTxHash?: string) => {
    setCheckoutOpen(false);
    if (createdBooking?.id) {
      try {
        await apiClient.post(`/booking/${createdBooking.id}/confirm-deposit`, {
          rail,
          txHash: paymentUrlOrTxHash,
        });
      } catch {
        // Non-blocking: booking is already saved and payment webhook will also reconcile it
      }
    }
    toast.success('Deposit received. Your reservation is confirmed.');
    setBookingComplete(true);
  };

  const handleDepositFunded = async (txHash?: string, fromWallet?: string) => {
    const currentPrompt = depositPrompt;
    setDepositPrompt(null);

    const biz = business;
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
  };

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
            {business?.name} · {format(selectedDate, 'MMM d')} at {selectedTime}
            {schema.showPartySize && ` · ${guests} guests`}
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
            <Button onClick={() => navigate('/me/bookings')}>View Bookings</Button>
            <Button variant="ghost" onClick={() => {
              setBookingComplete(false);
              setCreatedBooking(null);
              setStep('search');
            }}>Book Another</Button>
          </div>
        </Surface>
      </div>
    );
  }

  // ── Loading / Not Found states when routed via /book/:id ─────────────────
  if (id && businessLoading && !business) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--cream)' }}>
        <div className="text-center space-y-3">
          <div className="w-10 h-10 mx-auto rounded-full border-4 border-[var(--clay)] border-t-transparent animate-spin" />
          <p className="text-sm font-medium text-[var(--soft-stone)]">Loading booking page…</p>
        </div>
      </div>
    );
  }

  if (id && businessError && !business) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--cream)' }}>
        <Surface className="max-w-md w-full p-8 text-center space-y-4">
          <h2 className="text-xl font-bold text-[var(--warm-ink)]">Business not found</h2>
          <p className="text-sm text-[var(--soft-stone)]">
            We couldn&apos;t load this provider&apos;s booking page. It may have moved or been removed.
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate('/booking')}>Browse Providers</Button>
          </div>
        </Surface>
      </div>
    );
  }

  // ── Detail + Booking View ────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
      {/* Header (Layout header handles main nav; this is booking-specific context) */}
      <header className="sticky top-14 sm:top-16 z-30 backdrop-blur-xl bg-[var(--warm-sand)]/80 border-b border-[rgba(191,179,163,0.2)] px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={() => (id ? navigate(-1) : setStep('search'))}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--soft-stone)] hover:text-[var(--warm-ink)] touch-target compact-touch"
          >
            ← Back
          </button>
          <h1 className="font-bold text-[var(--warm-ink)] truncate max-w-[180px] sm:max-w-xs">{business?.name || 'Pabandi'}</h1>
          <div className="w-14" />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 mobile-safe-bottom lg:pb-12">
        {/* Business Hero */}
        {business && (
          <div className="relative h-56 sm:h-64 md:h-80 rounded-2xl overflow-hidden mb-6 shadow-[var(--shadow-soft)]">
            {business.coverImageUrl ? (
              <img src={business.coverImageUrl} alt={business.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#101a24] via-[#182736] to-[#0a1118] flex items-center justify-center">
                <span className="text-6xl">{schema.heroEmoji || '🍽️'}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-2">
                {business.rating && <Badge tone="success">⭐ {business.rating}</Badge>}
                {business.trustScore && <Badge tone="info">Trust: {business.trustScore}</Badge>}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-sm">{business.name}</h1>
              <p className="text-sm text-white/80 mt-0.5">{business.address}</p>
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

            {/* Dynamic Scope / Custom Quote / Instant Escrow Link (Only for Service Businesses & Solo Builders) */}
            {(schema.showProjectDescription || schema.showContractAmount) && (
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
                  {schema.showProjectDescription && (
                    <div>
                      <label className="block text-xs font-medium text-[var(--soft-stone)] mb-1">
                        {schema.projectDescriptionLabel || 'Custom Milestone / Scope Description'}
                      </label>
                      <input
                        type="text"
                        value={customServiceLabel}
                        onChange={(e) => setCustomServiceLabel(e.target.value)}
                        placeholder={selectedService?.name || schema.projectDescriptionPlaceholder || 'e.g. Scope of work'}
                        className="w-full bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.35)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] placeholder-[var(--soft-stone)] outline-none focus:border-[var(--clay)]"
                      />
                    </div>
                  )}
                  {schema.showContractAmount && (
                    <div>
                      <label className="block text-xs font-medium text-[var(--soft-stone)] mb-1">
                        {schema.contractAmountLabel || 'Custom Contract Amount (USD / USDC)'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={customAmountUsd}
                        onChange={(e) => setCustomAmountUsd(e.target.value)}
                        placeholder={selectedService ? String(selectedService.price) : schema.contractAmountPlaceholder || 'e.g. 1500'}
                        className="w-full bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.35)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] placeholder-[var(--soft-stone)] outline-none focus:border-[var(--clay)]"
                      />
                    </div>
                  )}
                </div>
              </Surface>
            )}

            {/* Service Address (Only for Service Businesses like Roofing, HVAC, Plumbing) */}
            {schema.showServiceAddress && (
              <Surface className="p-6">
                <h3 className="font-bold text-[var(--warm-ink)] mb-1">{schema.serviceAddressLabel || 'Service / Job Site Address'}</h3>
                <p className="text-xs text-[var(--soft-stone)] mb-3">Where should the team arrive to complete this work?</p>
                <input
                  type="text"
                  value={serviceAddress}
                  onChange={(e) => setServiceAddress(e.target.value)}
                  placeholder={schema.serviceAddressPlaceholder || 'e.g. 123 Main St or job site location'}
                  className="w-full bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.35)] rounded-lg px-3 py-2.5 text-sm text-[var(--warm-ink)] placeholder-[var(--soft-stone)] outline-none focus:border-[var(--clay)]"
                />
              </Surface>
            )}

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

            {/* Guests (Only for Verticals with Party/Guest Size) */}
            {schema.showPartySize && (
              <Surface className="p-6">
                <h3 className="font-bold text-[var(--warm-ink)] mb-4">{schema.partySizeLabel || 'Number of Guests'}</h3>
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
            )}

            {/* Special Requests / Access Notes */}
            {schema.showSpecialRequests && (
              <Surface className="p-6">
                <h3 className="font-bold text-[var(--warm-ink)] mb-4">
                  {schema.specialRequestsLabel || 'Special Requests'}
                </h3>
                <textarea
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder={schema.specialRequestsPlaceholder || 'Allergies, celebrations, seating preferences...'}
                  rows={3}
                  className="w-full bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-lg px-4 py-3 text-[var(--warm-ink)] placeholder-[var(--soft-stone)] outline-none focus:border-[var(--clay)]"
                />
              </Surface>
            )}
          </div>

          {/* Right: Summary & Payment */}
          <div className="space-y-6">
            {/* Summary */}
            <Surface className="p-6">
              <h3 className="font-bold text-[var(--warm-ink)] mb-4">{schema.bookingSummaryLabel || 'Booking Summary'}</h3>
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
                {schema.showPartySize && (
                  <div className="flex justify-between">
                    <span className="text-[var(--soft-stone)]">{schema.partySizeLabel || 'Party / Crew Size'}</span>
                    <span className="text-[var(--warm-ink)]">{guests}</span>
                  </div>
                )}
                {schema.showServiceAddress && serviceAddress && (
                  <div className="flex justify-between">
                    <span className="text-[var(--soft-stone)]">Job Location</span>
                    <span className="text-[var(--warm-ink)] truncate max-w-[150px]">{serviceAddress}</span>
                  </div>
                )}
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

            {/* Paid Counterparty Litigation & Trust Dossier ($9 Instant Checkout - Only for Service Businesses) */}
            {schema.showLienDossier && (
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
            )}

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
              disabled={!selectedTime || !business || submitting}
              className="w-full py-4 text-base font-bold tracking-wide"
            >
              {submitting
                ? 'Securing booking…'
                : schema.buttonText || (schema.showPartySize ? 'Reserve Table' : 'Secure Booking & Escrow')}
            </Button>

            <p className="text-xs font-medium text-[var(--soft-stone)] text-center">
              Free cancellation up to 2 hours before
            </p>
          </div>
        </div>
      </div>

      {/* Sticky Mobile Quick-Book Bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-[#FAF6F0]/95 backdrop-blur-xl border-t border-[rgba(191,179,163,0.35)] px-4 py-3 safe-area-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-[var(--soft-stone)] truncate">
              {format(selectedDate, 'MMM d')} · {selectedTime || 'Select time'}
            </div>
            <div className="money-number text-base text-[var(--warm-ink)]">
              {effectiveServiceValue > 0 ? `$${effectiveServiceValue.toLocaleString()}` : 'Escrow Protected'}
            </div>
          </div>
          <Button
            onClick={handleBookTable}
            disabled={!selectedTime || !business || submitting}
            className="px-5 py-3 text-sm font-bold rounded-full shrink-0"
          >
            {submitting
              ? 'Securing…'
              : schema.buttonText || (schema.showPartySize ? 'Reserve →' : 'Book Now →')}
          </Button>
        </div>
      </div>

      {/* Live Booking Deposit Checkout (Square / Solana Pay / Raast) */}
      {createdBooking && (
        <PabandiCheckoutModal
          open={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          title={`Booking Deposit — ${business?.name || 'Provider'}`}
          subtitle={`${format(selectedDate, 'MMM d, yyyy')} at ${selectedTime}`}
          amount={paidDeposit || computedDeposit || 0}
          currency="USD"
          referenceId={`booking-${createdBooking.id}`}
          squareNote={`pabandi:booking:${createdBooking.id}`}
          customerEmail={customerEmail.trim() || user?.email}
          merchantRaastId={business?.raastId || business?.settings?.raastId || business?.phone}
          merchantIban={business?.iban}
          merchantJazzCash={business?.phone}
          merchantEasyPaisa={business?.phone}
          recipientWallet={business?.solanaWallet || business?.walletAddress}
          initialRail={checkoutInitialRail}
          onSuccess={handleCheckoutSuccess}
        />
      )}

      {/* Counterparty Dossier prompt */}
      <EmbeddedCheckoutModal
        prompt={depositPrompt}
        onClose={() => setDepositPrompt(null)}
        onFunded={handleDepositFunded}
      />

      <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
    </div>
  );
}
