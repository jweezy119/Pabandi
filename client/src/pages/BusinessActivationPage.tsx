import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import { businessService } from '../services/api';
import { ClaimOverlay } from '../components/ClaimOverlay';
import { PaymentLinkCard } from '../components/PaymentLinkCard';
import { CheckCircleIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { Surface, tokens } from '../design-system';

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
    <div className="min-h-screen pb-10 font-body" style={{ background: tokens.color.background, color: tokens.color.text, fontFamily: tokens.font.body }}>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
        <div className="flex flex-col gap-1">
          <h1 className="font-headline text-2xl sm:text-3xl font-black">{biz?.name ? `${biz.name} launch plan` : 'Business launch plan'}</h1>
          <p className="text-sm" style={{ color: tokens.color.muted }}>Complete these steps to unlock bookings, escrow protection, and $PAB rewards.</p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            { label: 'Claim listing', action: () => navigate(`/business/${id}`), cta: 'Open profile' },
            { label: 'Try booking', action: () => navigate(`/business/${id}`), cta: 'Book now' },
            ...(isLiveSeller ? [{ label: 'Try live selling', action: () => navigate('/live-selling'), cta: 'Open hub' }] : []),
            { label: 'Launch WhatsApp outreach', action: () => navigate('/business/dashboard'), cta: 'Open dashboard' },
            { label: 'Check dashboard', action: () => navigate('/business/dashboard'), cta: 'Dashboard' },
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 text-left transition-colors hover:-translate-y-[2px] hover:border-white/10"
            >
              <span className="block font-headline font-bold text-sm sm:text-base mb-1" style={{ color: tokens.color.text }}>{item.label}</span>
              <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold" style={{ color: tokens.color.primary }}>
                {item.cta} <ArrowRightIcon className="h-4 w-4" />
              </span>
            </button>
          ))}
        </div>

        <Surface className="mt-6 space-y-3">
          <h3 className="font-headline text-xl font-bold" style={{ color: tokens.color.text }}>Activation checklist</h3>
          <div className="flex flex-wrap gap-2">
            {steps.map((step) => (
              <span key={step.label} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs sm:text-sm font-bold ${
                step.done
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-white/10 bg-white/5 text-white/70'
              }`}>
                {step.done ? <CheckCircleIcon className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-white/40" />}
                {step.label}
              </span>
            ))}
          </div>
        </Surface>

        <div className="mt-6 space-y-3">
          <h3 className="font-headline text-xl font-bold" style={{ color: tokens.color.text }}>Payment & checkout</h3>
          {id && <PaymentLinkCard businessId={id} businessName={biz?.name || 'seller'} />}
        </div>

        {id && <ClaimOverlay show={false} businessName={biz?.name || 'Business'} onClose={() => {}} onSubmit={() => {}} />}
      </div>
    </div>
  );
}
