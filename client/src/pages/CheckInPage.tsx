import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Surface, Button, Badge, tokens } from '../design-system';

export const CheckInPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);

  const reservationId = searchParams.get('reservationId');

  useEffect(() => {
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' as any }).then((result: any) => {
        setLocationPermission(result.state);
      });
    }
  }, []);

  const requestLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocationPermission('granted');
        },
        () => setLocationPermission('denied')
      );
    }
  };

  const handleVerify = async () => {
    if (!code.trim()) {
      setError('Please enter the check-in code');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const rawBase = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
      const backendUrl = rawBase.replace(/\/api\/v\d+\/?$/, '');
      const res = await fetch(`${backendUrl}/api/v1/checkin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          reservationId,
          lat: position?.lat,
          lng: position?.lng,
          method: position ? 'location' : 'manual',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(data.message);
        setTimeout(() => navigate('/profile'), 2000);
      } else {
        setError(data.message || 'Invalid code');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: tokens.color.background }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-500/20 mb-4">
            <span className="material-symbols-outlined text-[32px] text-indigo-400">qr_code_scanner</span>
          </div>
          <h1 className="text-2xl font-black text-white">Check In</h1>
          <p className="text-sm text-white/60 mt-1">Enter the 6-digit code from your reservation</p>
        </div>
        <Surface className="p-6">
          <div className="mb-6 p-8 rounded-xl border-2 border-dashed border-white/10 text-center">
            <span className="material-symbols-outlined text-[48px] text-white/30">qr_code_2</span>
            <p className="text-sm text-white/40 mt-2">Scan QR code or enter code below</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-white/70 mb-2">Check-in Code</label>
              <input type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. ABC123" maxLength={6} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-center text-xl font-mono font-bold text-white outline-none focus:border-indigo-400 touch-target tracking-widest" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-white/50">location_on</span>
                <div>
                  <p className="text-xs font-semibold text-white">Location Services</p>
                  <p className="text-[10px] text-white/50">{position ? `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}` : 'Not enabled'}</p>
                </div>
              </div>
              {locationPermission !== 'granted' ? (
                <Button variant="ghost" size="sm" onClick={requestLocation}>Enable</Button>
              ) : (
                <Badge tone="success">Active</Badge>
              )}
            </div>
            {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-200">{error}</div>}
            {success && <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-200">{success}</div>}
            <Button onClick={handleVerify} disabled={loading || !code.trim()} className="w-full">
              {loading ? 'Verifying...' : 'Check In'}
            </Button>
          </div>
        </Surface>
        <div className="mt-6 text-center">
          <p className="text-xs text-white/40">Don't have a code? Ask your host or check your email confirmation.</p>
          <button onClick={() => navigate('/')} className="mt-2 text-xs text-indigo-300 hover:underline">Back to home</button>
        </div>
      </div>
    </div>
  );
};

export default CheckInPage;
