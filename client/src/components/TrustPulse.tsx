import { useEffect, useRef, useState } from 'react';

interface TrustPulsePayload {
  score?: number;
  tier?: string;
  velocity?: { slope30d?: number; streak?: number; label?: string };
  timestamp?: string;
}

export const TrustPulse = ({ userId, refreshKey }: { userId?: string; refreshKey?: number }) => {
  const [pulse, setPulse] = useState<TrustPulsePayload | null>(null);
  const [live, setLive] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!userId) return;

    const source = new EventSource(`/api/v1/trust/pulse/${userId}`);
    esRef.current = source;

    source.onmessage = (evt) => {
      try {
        setPulse(JSON.parse(evt.data));
        setLive(true);
      } catch {
        setLive(false);
      }
    };

    source.onerror = () => {
      setLive(false);
      source.close();
    };

    return () => {
      source.close();
      esRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, refreshKey]);

  if (!userId) return null;

  const score = Number(pulse?.score ?? 0);
  const tier = pulse?.tier ?? 'BASIC';
  const label = pulse?.velocity?.label ?? 'STABLE';
  const streak = Number(pulse?.velocity?.streak ?? 0);
  const slope = Number(pulse?.velocity?.slope30d ?? 0);

  const tierColor =
    tier === 'ENHANCED' ? 'text-emerald-400' : tier === 'RESTRICTED' ? 'text-red-400' : 'text-zinc-300';

  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#121212] p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Live Trust Pulse</p>
          <p className="text-3xl font-black text-white">{score.toFixed(1)}</p>
          <p className={`text-xs font-bold ${tierColor}`}>{tier}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-400">{label.replace('_', ' ')}</p>
          <p className="text-xs text-zinc-500">streak {streak}</p>
          <p className="text-xs text-zinc-500">{slope >= 0 ? '+' : ''}{slope.toFixed(1)} 30d</p>
        </div>
      </div>

      <div className="mt-3 h-2 rounded-full bg-zinc-800">
        <div
          className="h-2 rounded-full bg-[#95BF47]"
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${live ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
        <span className="text-[11px] text-zinc-500">{live ? 'Live' : 'Reconnecting...'}</span>
      </div>
    </div>
  );
};
