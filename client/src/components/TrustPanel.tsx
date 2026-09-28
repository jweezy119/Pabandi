import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, ShieldCheck, Activity, AlertCircle } from 'lucide-react';

interface TrustPanelProps {
  passportId?: string;
}

export function TrustPanel({ passportId }: TrustPanelProps) {
  const [passport, setPassport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!passportId) {
      setLoading(false);
      return;
    }
    const fetchPassport = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/v1/trust/passports/${passportId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) setPassport(json.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPassport();
  }, [passportId]);

  if (loading) {
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-[rgba(191,179,163,0.2)] p-6 animate-pulse">
        <div className="h-6 w-32 bg-gray-200 rounded mb-4"></div>
        <div className="h-24 bg-gray-100 rounded"></div>
      </div>
    );
  }

  if (!passport) {
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-[rgba(191,179,163,0.2)] p-6 text-center">
        <AlertCircle className="w-8 h-8 text-[var(--soft-stone)] mx-auto mb-2" />
        <p className="text-sm text-[var(--soft-stone)]">No Trust Passport found.</p>
      </div>
    );
  }

  const score = passport.compositeScore || 85;

  const getStatus = () => {
    if (score >= 90) return { color: 'text-[var(--sage)]', bg: 'bg-[rgba(163,177,138,0.1)]', icon: ShieldCheck, label: 'High Trust' };
    if (score >= 70) return { color: 'text-[var(--clay)]', bg: 'bg-[rgba(180,130,90,0.1)]', icon: Shield, label: 'Good Standing' };
    return { color: 'text-[var(--dusty-rose)]', bg: 'bg-[rgba(201,123,90,0.1)]', icon: ShieldAlert, label: 'Requires Attention' };
  };

  const status = getStatus();

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-[rgba(191,179,163,0.2)] p-6 transition-all hover:shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-[var(--warm-ink)] flex items-center gap-2">
          <Shield className="w-5 h-5 text-[var(--clay)]" />
          Trust Profile
        </h3>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${status.bg} ${status.color}`}>
          {status.label}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <div className="text-sm text-[var(--soft-stone)] font-medium">Composite Score</div>
            <div className="flex items-end gap-2">
              <div className={`text-4xl font-headline font-bold ${status.color}`}>{score}</div>
              <div className="text-sm text-[var(--soft-stone)] mb-1 font-bold">/ 100</div>
            </div>
            <div className="w-full bg-[rgba(191,179,163,0.2)] rounded-full h-2 mt-2">
              <div 
                className={`h-2 rounded-full ${score >= 90 ? 'bg-[var(--sage)]' : score >= 70 ? 'bg-[var(--clay)]' : 'bg-[var(--dusty-rose)]'}`}
                style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[rgba(191,179,163,0.2)]">
            <div className="text-center">
              <div className="text-xs text-[var(--soft-stone)]">Payment</div>
              <div className="font-bold text-[var(--warm-ink)]">{passport.paymentScore}</div>
            </div>
            <div className="text-center border-l border-r border-[rgba(191,179,163,0.2)]">
              <div className="text-xs text-[var(--soft-stone)]">Show-up</div>
              <div className="font-bold text-[var(--warm-ink)]">{passport.showUpScore}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-[var(--soft-stone)]">Delivery</div>
              <div className="font-bold text-[var(--warm-ink)]">{passport.deliveryScore}</div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-sm font-medium text-[var(--soft-stone)]">Recent Events</div>
          <div className="space-y-3 h-32 overflow-y-auto pr-2">
            {passport.events && passport.events.length > 0 ? (
              passport.events.slice(0, 4).map((evt: any) => (
                <div key={evt.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[rgba(191,179,163,0.1)] flex items-center justify-center shrink-0">
                    <Activity className="w-4 h-4 text-[var(--soft-stone)]" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[var(--warm-ink)]">{evt.eventType}</div>
                    <div className="text-xs font-medium text-[var(--soft-stone)]">{new Date(evt.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-[var(--soft-stone)]">No recent events.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
