import React, { useState } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';
import { aiRealEstateService } from '../services/api';

interface LeaseResult {
  anomalies: string[];
  score: number;
  summary: string;
}

export const AILeaseAnomalyPage: React.FC = () => {
  const [text, setText] = useState('');
  const [result, setResult] = useState<LeaseResult | null>(null);
  const [loading, setLoading] = useState(false);

  const check = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await aiRealEstateService.analyzeLease(text);
      const payload = res.data?.data as any;
      setResult({
        anomalies: Array.isArray(payload?.anomalies) ? payload.anomalies : [],
        score: typeof payload?.score === 'number' ? payload.score : 0,
        summary: typeof payload?.summary === 'string' ? payload.summary : '',
      });
    } catch (e) {
      alert('Analysis failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)" }}>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <Badge tone="info" className="mb-3">🔍 AI Lease Analysis</Badge>
          <h1 className="text-3xl font-black text-[var(--warm-ink)] font-headline">Lease Anomaly Detector</h1>
          <p className="mt-3 text-[var(--soft-stone)]">Paste a lease and we'll flag red flags, asymmetries, and compliance gaps.</p>
        </div>

        <Surface className="p-4 md:p-6 mb-6">
          <textarea value={text} onChange={e => setText(e.target.value)} rows={10} placeholder="Paste lease text here..." className="w-full rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]" />
          <Button onClick={check} disabled={!text.trim()} className="w-full mt-4">{loading ? 'Analyzing...' : 'Analyze Lease'}</Button>
        </Surface>

        {result && (
          <div className="space-y-4">
            <Surface className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-[var(--warm-ink)]">Summary</h3>
                <div className="text-2xl font-black text-[var(--warm-ink)]">{result.score}/100</div>
              </div>
              <p className="text-sm mt-2 text-[var(--soft-stone)]">{result.summary}</p>
            </Surface>
            <Surface className="p-4 md:p-6">
              <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-3">Anomalies</h3>
              {result.anomalies.length === 0 && <p className="text-sm text-[var(--soft-stone)]">No obvious anomalies detected.</p>}
              <div className="space-y-2">
                {result.anomalies.map((a, i) => (
                  <div key={i} className="p-3 rounded-xl bg-[var(--warm-sand)] text-sm text-[var(--soft-stone)]">⚠️ {a}</div>
                ))}
              </div>
            </Surface>
          </div>
        )}
      </div>
    </div>
  );
};
