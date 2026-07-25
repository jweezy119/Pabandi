import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { businessService } from '../services/api';
import { tokens } from '../design-system';

export default function ShortLinkBookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    businessService.getBusinessBySlug(slug)
      .then((res) => {
        if (res.data?.data?.id) {
          navigate(`/business/${res.data.data.id}/book`, { replace: true });
        } else {
          setError('Business not found for this link.');
        }
      })
      .catch(() => {
        setError('Invalid or expired booking link.');
      });
  }, [slug, navigate]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6" style={{ background: tokens.color.background }}>
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: 'rgba(129,140,248,0.15)' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
      <h2 className="font-headline mb-2 text-xl font-bold" style={{ color: tokens.color.text }}>
        {error ? 'Link Error' : 'Locating Business...'}
      </h2>
      <p className="font-body" style={{ color: tokens.color.muted }}>
        {error || 'Please wait while we redirect you to the booking page.'}
      </p>
      {error && (
        <button onClick={() => navigate('/')} className="mt-6 rounded-xl px-6 py-2 text-sm font-bold text-white" style={{ background: tokens.color.primary }}>
          Return Home
        </button>
      )}
    </div>
  );
}
