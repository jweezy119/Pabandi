import { useState, useEffect, useRef } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';
import { offrampLpService } from '../services/api';
import { CameraIcon, CheckCircleIcon, ExclamationTriangleIcon, BoltIcon, ClockIcon } from '@heroicons/react/24/outline';

// Mock values since LP Wallet Auth is basic for Phase 0.1
// In a real app this would come from a verified Web3 wallet or JWT.
const MOCK_LP_WALLET = '0xMockLpWallet001';

export default function LiquidityTerminalPage() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('lp_api_key') || '');
  const [isAuth, setIsAuth] = useState(!!localStorage.getItem('lp_api_key'));
  const [authError, setAuthError] = useState('');

  const [intents, setIntents] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);
  
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedIntentId, setSelectedIntentId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuth) return;

    let evtSource: EventSource | null = null;
    
    // Initial fetch
    offrampLpService.getIntents(MOCK_LP_WALLET, apiKey)
      .then(res => {
        if (res.data.success) {
          setIntents(res.data.intents || []);
          setAuthError('');
        }
      })
      .catch(err => {
        if (err.response?.status === 401) {
          handleLogout();
          setAuthError('Invalid API Key');
        }
      });

    // Setup SSE stream
    try {
      const streamUrl = offrampLpService.createStreamUrl(MOCK_LP_WALLET, apiKey);
      evtSource = new EventSource(streamUrl);
      
      evtSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'CONNECTED') {
          setConnected(true);
        } else if (data.type === 'INTENT_UPDATED') {
          const updated = data.intent;
          setIntents(prev => {
            const exists = prev.find(i => i.id === updated.id);
            if (exists) {
              return prev.map(i => i.id === updated.id ? updated : i);
            }
            return [updated, ...prev];
          });
        }
      };

      evtSource.onerror = () => {
        setConnected(false);
        // Will auto-reconnect typically, but can log here
      };

    } catch (e) {
      console.error('SSE Error', e);
    }

    return () => {
      evtSource?.close();
    };
  }, [isAuth, apiKey]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      localStorage.setItem('lp_api_key', apiKey);
      setIsAuth(true);
      setAuthError('');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('lp_api_key');
    setApiKey('');
    setIsAuth(false);
    setIntents([]);
  };

  const triggerUpload = (intentId: string) => {
    setSelectedIntentId(intentId);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedIntentId) return;

    setUploadingId(selectedIntentId);
    
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = reader.result as string;
        
        try {
          const res = await offrampLpService.submitProof(selectedIntentId, MOCK_LP_WALLET, base64, apiKey);
          if (res.data.success) {
            // State will update via SSE!
            console.log('Proof uploaded successfully', res.data);
          }
        } catch (error: any) {
          console.error(error.response?.data?.error || 'Upload failed');
          alert('Upload failed: ' + (error.response?.data?.error || 'Server error'));
        } finally {
          setUploadingId(null);
          setSelectedIntentId(null);
          // reset input
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
    } catch (error) {
      console.error(error);
      setUploadingId(null);
    }
  };

  if (!isAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: tokens.color.background }}>
        <Surface className="w-full max-w-sm">
          <h2 className="mb-2 font-headline text-2xl font-bold text-white text-center">LP Terminal Auth</h2>
          <p className="mb-6 text-xs text-white/70 text-center">Enter your secure LP API Key to connect to the trading engine.</p>
          
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input 
              type="password"
              placeholder="x-api-key"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="rounded-lg border border-white/10 bg-black/50 px-4 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
            {authError && <p className="text-xs text-rose-400">{authError}</p>}
            <Button type="submit" className="w-full">Connect Terminal</Button>
          </form>
        </Surface>
      </div>
    );
  }

  // Filter and sort intents
  const pendingIntents = intents.filter(i => i.status === 'MATCHED').sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
  const activeIntents = intents.filter(i => i.status !== 'MATCHED' && i.status !== 'PENDING_LP');

  return (
    <div className="flex min-h-screen flex-col font-body" style={{ background: tokens.color.background, color: tokens.color.text }}>
      {/* Hidden file input */}
      <input 
        type="file" 
        accept="image/*" 
        capture="environment" // Mobile camera preferred
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      <header className="sticky top-0 z-10 border-b border-white/[0.05] bg-black/80 backdrop-blur-xl px-4 py-3 sm:px-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="font-headline text-xl font-bold text-white">LP Terminal</h1>
          <div className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold tracking-widest text-white/60">
            <div className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-rose-500'}`} />
            {connected ? 'LIVE' : 'RECONNECTING'}
          </div>
        </div>
        <button onClick={handleLogout} className="text-xs font-semibold text-white/50 hover:text-white">Disconnect</button>
      </header>

      <main className="mx-auto w-full max-w-4xl p-4 sm:p-6 flex flex-col gap-6">
        
        {/* Mock P&L / Vault Analytics (Zeroed for Phase 0.1) */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Vol Today (USDC)', val: '0.00' },
            { label: 'Fees Earned', val: '0.00' },
            { label: 'Idle Yield (APY)', val: '5.2%' },
            { label: 'Trust Tier', val: 'Level 1' },
          ].map(stat => (
            <Surface key={stat.label} className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">{stat.label}</p>
              <p className="mt-1 font-headline text-xl font-bold text-white">{stat.val}</p>
            </Surface>
          ))}
        </div>

        {/* Action Queue */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white/90">Action Required <span className="ml-2 rounded bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-300">{pendingIntents.length}</span></h2>
          </div>
          
          <div className="flex flex-col gap-3">
            {pendingIntents.length === 0 && (
              <Surface className="flex flex-col items-center justify-center py-12 text-center opacity-50">
                <BoltIcon className="h-8 w-8 mb-2 text-indigo-400" />
                <p className="text-sm font-semibold">Waiting for orders...</p>
                <p className="text-xs">Your collateral is active.</p>
              </Surface>
            )}

            {pendingIntents.map(intent => (
              <Surface key={intent.id} className="relative overflow-hidden border-l-4" style={{ borderLeftColor: tokens.color.primary }}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge tone="info">Fill Immediately</Badge>
                      <span className="text-[11px] font-mono text-white/50 flex items-center gap-1">
                        <ClockIcon className="h-3 w-3" /> SLA 60s
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-headline text-2xl font-bold text-white">{intent.amountUsdc}</span>
                      <span className="text-xs text-white/60">USDC</span>
                      <span className="text-white/30 mx-1">→</span>
                      <span className="font-headline text-xl font-bold text-emerald-400">{(intent.amountUsdc * intent.minRatePkr).toLocaleString()}</span>
                      <span className="text-xs text-emerald-400/60">PKR</span>
                    </div>
                    <p className="mt-1 text-xs text-white/70">
                      Send to <strong className="text-white">{intent.destinationType}</strong>: {intent.destinationRef}
                    </p>
                  </div>
                  
                  <div className="shrink-0">
                    <Button 
                      onClick={() => triggerUpload(intent.id)}
                      disabled={uploadingId === intent.id}
                      className="w-full sm:w-auto min-w-[140px]"
                    >
                      {uploadingId === intent.id ? 'Uploading...' : (
                        <>
                          <CameraIcon className="h-4 w-4" />
                          Upload Proof
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Surface>
            ))}
          </div>
        </section>

        {/* Processing / Settled Log */}
        <section className="mt-4">
          <h2 className="text-sm font-bold text-white/50 mb-3">Recent Activity</h2>
          <div className="flex flex-col gap-2">
            {activeIntents.slice(0, 10).map(intent => (
              <div key={intent.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-3">
                <div className="flex items-center gap-3">
                  {intent.status === 'SETTLED' ? (
                    <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
                  ) : intent.status === 'DISPUTED' ? (
                    <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                  )}
                  <div>
                    <p className="text-xs font-semibold text-white/80">
                      {intent.amountUsdc} USDC to {intent.destinationType}
                    </p>
                    <p className="text-[10px] text-white/40">ID: {intent.id.slice(-8)}</p>
                  </div>
                </div>
                <Badge tone={intent.status === 'SETTLED' ? 'success' : intent.status === 'DISPUTED' ? 'warning' : 'info'}>
                  {intent.status}
                </Badge>
              </div>
            ))}
            {activeIntents.length === 0 && (
              <p className="text-xs text-center text-white/30 py-4">No recent activity.</p>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
