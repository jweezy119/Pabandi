import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { businessService } from '../services/api';

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
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 bg-surface">
      <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-6">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
      <h2 className="text-xl font-bold font-headline text-on-surface mb-2">
        {error ? 'Link Error' : 'Locating Business...'}
      </h2>
      <p className="text-on-surface-variant font-body">
        {error || 'Please wait while we redirect you to the booking page.'}
      </p>
      {error && (
        <button onClick={() => navigate('/')} className="mt-6 btn-primary px-6 py-2 rounded-xl">
          Return Home
        </button>
      )}
    </div>
  );
}
