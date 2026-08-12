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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Authorization Failed</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <button 
            onClick={() => window.history.back()}
            className="text-indigo-600 font-semibold hover:text-indigo-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full overflow-hidden border border-white/50">
        
        {/* Header */}
        <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl"></div>
          
          <div className="flex items-center justify-center space-x-6 mb-4 relative z-10">
            {/* Third Party App Logo */}
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg overflow-hidden">
              {clientInfo?.logoUrl ? (
                <img src={clientInfo.logoUrl} alt={clientInfo.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-slate-800">{clientInfo?.name.charAt(0)}</span>
              )}
            </div>
            
            <ArrowRight className="w-6 h-6 text-slate-400" />
            
            {/* Pabandi Logo */}
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-white relative z-10">
            Sign in to <span className="text-indigo-400">{clientInfo?.name}</span>
          </h2>
          <p className="text-slate-400 mt-2 relative z-10 text-sm">
            {clientInfo?.name} wants to access your Pabandi Trust Passport
          </p>
        </div>

        {/* Permissions Body */}
        <div className="p-8">
          <p className="text-slate-600 font-medium mb-4">This will allow <span className="font-bold text-slate-900">{clientInfo?.name}</span> to:</p>
          
          <div className="space-y-4 mb-8">
            <div className="flex items-start">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-900">View your Identity & Contact Info</p>
                <p className="text-sm text-slate-500">Name, verified email address, and profile picture.</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-900">Read your Trust Passport Data</p>
                <p className="text-sm text-slate-500">Your Trust Score, Trust Band, and active verified badges.</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-900">Cannot edit your data</p>
                <p className="text-sm text-slate-500">This application only has read-only access to your public passport.</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl mb-8 border border-slate-100">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-indigo-700 font-bold">{user?.firstName?.charAt(0)}</span>
            </div>
            <div className="text-sm">
              <p className="text-slate-500">Signed in as</p>
              <p className="font-semibold text-slate-900">{user?.firstName} {user?.lastName} ({user?.email})</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={() => handleConsent('deny')}
              disabled={submitting}
              className="flex-1 px-6 py-3.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={() => handleConsent('approve')}
              disabled={submitting}
              className="flex-1 px-6 py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex justify-center items-center"
            >
              {submitting ? 'Processing...' : 'Authorize App'}
            </button>
          </div>
        </div>
        
      </div>
    </div>
  );
}
