import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import { businessService } from '../services/api';
import { ClaimOverlay } from '../components/ClaimOverlay';
import { PaymentLinkCard } from '../components/PaymentLinkCard';
import { CheckCircleIcon } from '@heroicons/react/24/outline';

type BusinessActivationPageProps = {
  businessId?: string;
};

export default function BusinessActivationPage({ businessId }: BusinessActivationPageProps) {
  const navigate = useNavigate();
  const params = useParams();
  const id = businessId || params.id;

  const { data } = useQuery(['business-activation', id], async () => {
    if (!id) return null;
    const res = await businessService.getPublicBusinesses({ businessId: id });
    const items = res?.data?.data?.businesses || [];
    return items.find((b: any) => b.id === id) || null;
  }, { enabled: !!id });

  const biz = data as any;
  const isLiveSeller = ['LIVE_SELLER', 'FREELANCE'].includes(biz?.category);

  const steps = useMemo(() => {
    const items = [
      { label: 'Registered', done: true },
      { label: 'Claim listing', done: !!biz?.isClaimed },
      { label: 'Add payment link', done: false },
      { label: 'First booking or live stream', done: false },
    ];
    if (isLiveSeller) {
      items.splice(1, 0, { label: 'Setup live selling', done: false });
    }
    return items;
  }, [biz, isLiveSeller]);

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-headline text-2xl sm:text-3xl font-black">{biz?.name ? `${biz.name} launch plan` : 'Business launch plan'}</h1>
          <p className="text-sm text-on-surface-variant">Complete these steps to unlock bookings, escrow protection, and $PAB rewards.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { label: 'Claim listing', action: () => navigate(`/business/${id}`), cta: 'Open profile' },
            { label: 'Test booking flow', action: () => navigate(`/business/${id}`), cta: 'Book now' },
            ...(isLiveSeller ? [{ label: 'Try live selling', action: () => navigate('/live-selling'), cta: 'Open hub' }] : []),
            { label: 'Check dashboard', action: () => navigate('/business/dashboard'), cta: 'Dashboard' },
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4 text-left hover:bg-surface-container-high active:scale-[0.99] transition-colors touch-target"
            >
              <span className="block font-headline font-bold text-sm sm:text-base mb-1">{item.label}</span>
              <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold text-primary">
                {item.cta} <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </span>
            </button>
          ))}
        </div>

        <div className="rounded-3xl border border-outline-variant/10 bg-surface-container-low p-6 space-y-3">
          <h3 className="font-headline text-xl font-bold">Activation checklist</h3>
          <div className="flex flex-wrap gap-2">
            {steps.map((step) => (
              <span key={step.label} className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-bold border ${step.done ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100' : 'border-outline-variant/20 bg-surface text-on-surface-variant'}`}>
                {step.done ? <CheckCircleIcon className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-outline-variant/40" />}
                {step.label}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-headline text-xl font-bold">Payment & checkout</h3>
          {id && <PaymentLinkCard businessId={id} businessName={biz?.name || 'seller'} />}
        </div>

        {id && <ClaimOverlay show={false} businessName={biz?.name || 'Business'} onClose={() => {}} onSubmit={() => {}} />}
      </div>
    </div>
  );
}
