import { useEffect, useState, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { serviceProviderService, type ServiceProvider } from '../services/serviceProviderService';
import { useAuthStore } from '../store/authStore';
import { useMutation, useQuery } from 'react-query';

const RISK_COLORS: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  B: 'bg-blue-100 text-blue-800 border-blue-200',
  C: 'bg-amber-100 text-amber-800 border-amber-200',
  D: 'bg-orange-100 text-orange-800 border-orange-200',
  E: 'bg-rose-100 text-rose-800 border-rose-200',
};

export default function ServiceProviderDetailPage() {
  const { passportId } = useParams<{ passportId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [provider, setProvider] = useState<ServiceProvider | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingResult, setBookingResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const { data: providerData, isLoading } = useQuery(
    ['service-provider', passportId],
    () => serviceProviderService.getProvider(passportId!),
    { enabled: !!passportId }
  );

  useEffect(() => {
    if (providerData?.data?.success) {
      setProvider(providerData.data.data);
    }
  }, [providerData]);

  const bookMutation = useMutation({
    mutationFn: () =>
      serviceProviderService.book({
        passportId: passportId!,
        amount: Number(amount),
        description,
      }),
    onSuccess: (res) => {
      if (res.data?.success) {
        setIsBooking(false);
        setBookingResult('success');
      }
    },
    onError: () => {
      setIsBooking(false);
      setBookingResult('error');
    },
  });

  const handleBook = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!amount || Number(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (!isAuthenticated) {
      navigate('/auth/login');
      return;
    }
    setIsBooking(true);
    bookMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--warm-sand)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--clay)]" />
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--warm-sand)]">
        <div className="text-center">
          <h2 className="text-[var(--warm-ink)] font-bold">Provider not found</h2>
          <p className="text-[var(--soft-stone)] mt-2">The service provider you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  const riskColor = RISK_COLORS[provider.riskBand] || RISK_COLORS.C;
  const amt = Number(amount) || 0;
  const platformFee = Math.round(amt * 0.035 * 100) / 100;
  const netAmount = Math.round((amt - platformFee) * 100) / 100;

  return (
    <div className="min-h-screen bg-[var(--warm-sand)] text-[var(--warm-ink)]">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row lg:items-start gap-6 mb-8">
          <div className="flex items-center gap-3">
            <img
              src={provider.avatarUrl || 'https://via.placeholder.com/100'}
              alt={provider.displayName}
              className="w-20 h-20 rounded-full object-cover border-4 border-[var(--clay)]"
            />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-2xl font-bold text-[var(--warm-ink)]">{provider.displayName}</h2>
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${riskColor}`}>
                  Band {provider.riskBand}
                </span>
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] text-[var(--soft-stone)]`}>
                  {provider.source}
                </span>
              </div>
              <p className="text-[var(--soft-stone)] text-sm">{provider.headline || provider.category}</p>
            </div>
          </div>

          <div className="lg:ml-auto text-right">
            <div className="text-3xl font-bold text-[var(--clay)]">{provider.trustScore}</div>
            <div className="text-[var(--soft-stone)] text-sm">Trust Score / 1000</div>
            {provider.externalRating && (
              <div className="flex items-center gap-1 justify-end mt-2 text-xs text-[var(--soft-stone)]">
                <span className="material-symbols-outlined">star</span>
                <span>{provider.externalRating.toFixed(1)} ({provider.reviewCount} reviews)</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] p-6">
              <h3 className="font-bold mb-3">About</h3>
              <p className="text-[var(--soft-stone)] leading-relaxed">
                {provider.bio || 'No description available. This provider was imported from an external marketplace.'}
              </p>
            </div>

            <div className="rounded-2xl border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] p-6">
              <h3 className="font-bold mb-3">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {provider.skills.map(skill => (
                  <span key={skill} className="px-3 py-1 rounded border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] text-[var(--soft-stone)] text-sm">
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {provider.portfolioUrls.length > 0 && (
              <div className="rounded-2xl border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] p-6">
                <h3 className="font-bold mb-3">Portfolio</h3>
                <div className="grid grid-cols-2 gap-3">
                  {provider.portfolioUrls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-xl border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] overflow-hidden">
                      <img src={url} alt={`Portfolio ${i + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] p-6 sticky top-6">
              <h3 className="font-bold mb-4">Book This Provider</h3>

              {isBooking ? null : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-[var(--soft-stone)]">Booking Amount (USDC)</label>
                    <span className="text-[var(--clay)] font-bold">${platformFee} platform fee</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full rounded-lg border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] px-3 py-2 text-sm text-[var(--warm-ink)] focus:outline-none focus:border-[var(--clay)]"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                  />
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-[var(--soft-stone)]">Description</label>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="What do you need done?"
                    className="w-full rounded-lg border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] px-3 py-2 text-sm text-[var(--warm-ink)] focus:outline-none focus:border-[var(--clay)]"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                  <div className="text-xs text-[var(--soft-stone)]">
                    Provider receives <span className="font-bold">${netAmount}</span> after 3.5% platform fee
                  </div>
                  <button
                    onClick={handleBook}
                    disabled={!amount || Number(amount) <= 0 || !isAuthenticated || isBooking}
                    className={`w-full py-3 rounded-xl font-bold transition-colors ${
                      !amount || Number(amount) <= 0 || !isAuthenticated || isBooking
                        ? 'bg-[rgba(191,179,163,0.3)] text-[var(--soft-stone)] cursor-not-allowed'
                        : 'bg-[var(--clay)] text-[var(--warm-ink)] hover:opacity-90'
                    }`}
                  >
                    {isBooking ? 'Creating Escrow...' : 'Create Escrow & Book'}
                  </button>
                  {!isAuthenticated && (
                    <p className="text-xs text-[var(--soft-stone)] text-center mt-2">
                      Sign in to book this provider.
                    </p>
                  )}
                </div>
              )}

              {bookingResult === 'success' && (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-center">
                  <h4 className="font-bold text-emerald-800 mb-2">Escrow Created!</h4>
                  <p className="text-emerald-700 text-sm">
                    Fund the escrow to start the booking. Provider gets paid when you verify completion.
                  </p>
                </div>
              )}

              {bookingResult === 'error' && (
                <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-center">
                  <h4 className="font-bold text-rose-800 mb-2">Booking Failed</h4>
                  <p className="text-rose-700 text-sm">Please try again.</p>
                </div>
              )}

              <div className="mt-6 rounded-xl border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] p-4">
                <h4 className="font-bold mb-2">How It Works</h4>
                <ol className="text-xs text-[var(--soft-stone)] space-y-2 list-disc list-inside">
                  <li>You deposit USDC into escrow</li>
                  <li>Provider delivers the service</li>
                  <li>You verify completion — funds release minus 3.5% platform fee</li>
                  <li>PTP guarantee protects you if the provider doesn't deliver</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-rose-50 border border-rose-200 p-4 text-rose-700 text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
