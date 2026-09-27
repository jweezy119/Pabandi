import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/primitives/Button';

export function InviteAcceptPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'LOADING' | 'SUCCESS' | 'ERROR'>('LOADING');
  const navigate = useNavigate();

  const API_BASE = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';

  useEffect(() => {
    if (token) {
      acceptInvite(token);
    } else {
      setStatus('ERROR');
    }
  }, [token]);

  const acceptInvite = async (t: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/team/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t })
      });

      if (res.ok) {
        setStatus('SUCCESS');
      } else {
        setStatus('ERROR');
      }
    } catch (err) {
      setStatus('ERROR');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--warm-sand)]/20 p-4">
      <div className="bg-white p-8 rounded-2xl border border-[var(--warm-sand)] max-w-md w-full text-center space-y-6">
        {status === 'LOADING' && (
          <>
            <div className="w-12 h-12 rounded-full border-4 border-[var(--warm-sand)] border-t-[var(--clay)] animate-spin mx-auto" />
            <h1 className="text-xl font-bold text-[var(--warm-ink)]">Accepting Invite...</h1>
          </>
        )}
        
        {status === 'SUCCESS' && (
          <>
            <div className="w-16 h-16 rounded-full bg-[var(--sage)]/10 text-[var(--sage)] flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[32px]">check_circle</span>
            </div>
            <h1 className="text-2xl font-bold text-[var(--warm-ink)]">Invite Accepted</h1>
            <p className="text-[var(--soft-stone)]">You have successfully joined the team.</p>
            <Button variant="primary" className="w-full" onClick={() => navigate('/login')}>
              Go to Login
            </Button>
          </>
        )}

        {status === 'ERROR' && (
          <>
            <div className="w-16 h-16 rounded-full bg-[var(--rose)]/10 text-[var(--rose)] flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[32px]">error</span>
            </div>
            <h1 className="text-2xl font-bold text-[var(--warm-ink)]">Invalid or Expired Link</h1>
            <p className="text-[var(--soft-stone)]">This invitation link is no longer valid. Please ask your administrator for a new invite.</p>
          </>
        )}
      </div>
    </div>
  );
}
