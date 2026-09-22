import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck, CheckCircle2, AlertCircle, ArrowRight, ShieldAlert } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

export default function OAuthConsentPage() {
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  const responseType = searchParams.get('response_type');
  
  const { user, isAuthenticated } = useAuthStore();
  
  const [clientInfo, setClientInfo] = useState<{name: string, logoUrl?: string} | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // If not authenticated, redirect to login with returnTo
    if (!isAuthenticated) {
      window.location.href = `/api/v1/auth/google?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }

    const validateRequest = async () => {
      try {
        const res = await api.get('/api/v1/oauth/authorize', {
          params: { client_id: clientId, redirect_uri: redirectUri, response_type: responseType }
        });
        setClientInfo(res.data.client);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Invalid authorization request');
      } finally {
        setLoading(false);
      }
    };

    if (clientId && redirectUri) {
      validateRequest();
    } else {
      setError('Missing client_id or redirect_uri parameters');
      setLoading(false);
    }
  }, [clientId, redirectUri, responseType, isAuthenticated]);

  const handleConsent = async (action: 'approve' | 'deny') => {
    setSubmitting(true);
    try {
      const res = await api.post('/api/v1/oauth/authorize', {
        client_id: clientId,
        redirect_uri: redirectUri,
        action
      });
      
      // Redirect to the 3rd party
      if (res.data.redirect_uri) {
        window.location.href = res.data.redirect_uri;
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to process authorization');
      setSubmitting(false);
    }
  };

  if (!isAuthenticated || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--terracotta)]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-[var(--radius-card)] shadow-[var(--shadow-soft)] max-w-md w-full text-center">
          <div className="w-16 h-16 bg-[var(--dusty-rose)]/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-[var(--terracotta)]" />
          </div>
          <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-2">Authorization Failed</h2>
          <p className="text-[var(--soft-stone)] mb-6">{error}</p>
          <button 
            onClick={() => window.history.back()}
            className="text-indigo-600 font-semibold hover:text-[var(--terracotta)]"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[2rem] shadow-[var(--shadow-soft)] max-w-lg w-full overflow-hidden border border-[rgba(191,179,163,0.3)]0">
        
        {/* Header */}
        <div className="bg-[var(--cream)] p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--clay)]/15 rounded-full blur-3xl"></div>
          
          <div className="flex items-center justify-center space-x-6 mb-4 relative z-10">
            {/* Third Party App Logo */}
            <div className="w-16 h-16 bg-white rounded-[var(--radius-card)] flex items-center justify-center shadow-[var(--shadow-soft)] overflow-hidden">
              {clientInfo?.logoUrl ? (
                <img src={clientInfo.logoUrl} alt={clientInfo.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-[var(--warm-ink)]">{clientInfo?.name.charAt(0)}</span>
              )}
            </div>
            
            <ArrowRight className="w-6 h-6 text-[var(--soft-stone)]" />
            
            {/* Pabandi Logo */}
            <div className="w-16 h-16 bg-[var(--terracotta)] rounded-[var(--radius-card)] flex items-center justify-center shadow-[var(--shadow-soft)]">
              <ShieldCheck className="w-8 h-8 text-[var(--warm-ink)]" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-[var(--warm-ink)] relative z-10">
            Sign in to <span className="text-[var(--terracotta)]">{clientInfo?.name}</span>
          </h2>
          <p className="text-[var(--soft-stone)] mt-2 relative z-10 text-sm">
            {clientInfo?.name} wants to access your Pabandi Trust Passport
          </p>
        </div>

        {/* Permissions Body */}
        <div className="p-8">
          <p className="text-[var(--soft-stone)] font-medium mb-4">This will allow <span className="font-bold text-[var(--warm-ink)]">{clientInfo?.name}</span> to:</p>
          
          <div className="space-y-4 mb-8">
            <div className="flex items-start">
              <CheckCircle2 className="w-5 h-5 text-[var(--sage)] mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="font-semibold text-[var(--warm-ink)]">View your Identity & Contact Info</p>
                <p className="text-sm text-[var(--soft-stone)]">Name, verified email address, and profile picture.</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <CheckCircle2 className="w-5 h-5 text-[var(--sage)] mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="font-semibold text-[var(--warm-ink)]">Read your Trust Passport Data</p>
                <p className="text-sm text-[var(--soft-stone)]">Your Trust Score, Trust Band, and active verified badges.</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="font-semibold text-[var(--warm-ink)]">Cannot edit your data</p>
                <p className="text-sm text-[var(--soft-stone)]">This application only has read-only access to your public passport.</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl mb-8 border border-slate-100">
            <div className="w-10 h-10 bg-[var(--warm-sand)] rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-indigo-700 font-bold">{user?.firstName?.charAt(0)}</span>
            </div>
            <div className="text-sm">
              <p className="text-[var(--soft-stone)]">Signed in as</p>
              <p className="font-semibold text-[var(--warm-ink)]">{user?.firstName} {user?.lastName} ({user?.email})</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={() => handleConsent('deny')}
              disabled={submitting}
              className="flex-1 px-6 py-3.5 rounded-xl font-bold text-[var(--soft-stone)] bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={() => handleConsent('approve')}
              disabled={submitting}
              className="flex-1 px-6 py-3.5 rounded-xl font-bold text-[var(--warm-ink)] bg-[var(--terracotta)] hover:bg-[var(--terracotta)] transition-colors shadow-[var(--shadow-soft)] shadow-[rgba(180,130,90,0.15)] flex justify-center items-center"
            >
              {submitting ? 'Processing...' : 'Authorize App'}
            </button>
          </div>
        </div>
        
      </div>
    </div>
  );
}
