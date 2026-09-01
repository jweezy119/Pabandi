import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { courtCheckService } from '../services/api';
import { tokens } from '../design-system';

export default function BackgroundCheckPage() {
  const { isAuthenticated } = useAuthStore();
  const [name, setName] = useState('');
  const [state, setState] = useState('IL');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const runCheck = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const res = await courtCheckService.courtCheckByName(name, state);
      setResult(res.data?.data || res.data);
    } catch (e: any) {
      setError(e.response?.data?.error || e.message || 'Check failed');
    } finally {
      setLoading(false);
    }
  };

  const bandColor: Record<string, string> = {
    LOW: '#16a34a',
    MEDIUM: '#ca8a04',
    HIGH: '#dc2626',
  };

  return (
    <div className="min-h-screen font-body" style={{ background: tokens.color.background, color: tokens.color.text }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        <div>
          <p className="text-xs uppercase tracking-widest opacity-60 mb-2">Trust & Safety</p>
          <h1 className="font-headline text-3xl sm:text-4xl font-bold">Background Check</h1>
          <p className="opacity-70 mt-2 max-w-2xl">
            Comprehensive court record screening — criminal history (state + federal) and civil/eviction records via CourtListener.
          </p>
        </div>

        {/* Input form */}
        <div className="rounded-3xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs uppercase tracking-wide opacity-60">Full Name *</label>
              <input
                className="mt-1 w-full rounded-xl px-4 py-3 outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }}
                placeholder="Full legal name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide opacity-60">State</label>
              <select
                className="mt-1 w-full rounded-xl px-4 py-3 outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }}
                value={state}
                onChange={(e) => setState(e.target.value)}
              >
                <option value="">All States</option>
                <option value="AL">Alabama</option><option value="AK">Alaska</option><option value="AZ">Arizona</option>
                <option value="AR">Arkansas</option><option value="CA">California</option><option value="CO">Colorado</option>
                <option value="CT">Connecticut</option><option value="DE">Delaware</option><option value="FL">Florida</option>
                <option value="GA">Georgia</option><option value="HI">Hawaii</option><option value="ID">Idaho</option>
                <option value="IL">Illinois</option><option value="IN">Indiana</option><option value="IA">Iowa</option>
                <option value="KS">Kansas</option><option value="KY">Kentucky</option><option value="LA">Louisiana</option>
                <option value="ME">Maine</option><option value="MD">Maryland</option><option value="MA">Massachusetts</option>
                <option value="MI">Michigan</option><option value="MN">Minnesota</option><option value="MS">Mississippi</option>
                <option value="MO">Missouri</option><option value="MT">Montana</option><option value="NE">Nebraska</option>
                <option value="NV">Nevada</option><option value="NH">New Hampshire</option><option value="NJ">New Jersey</option>
                <option value="NM">New Mexico</option><option value="NY">New York</option><option value="NC">North Carolina</option>
                <option value="ND">North Dakota</option><option value="OH">Ohio</option><option value="OK">Oklahoma</option>
                <option value="OR">Oregon</option><option value="PA">Pennsylvania</option><option value="RI">Rhode Island</option>
                <option value="SC">South Carolina</option><option value="SD">South Dakota</option><option value="TN">Tennessee</option>
                <option value="TX">Texas</option><option value="UT">Utah</option><option value="VT">Vermont</option>
                <option value="VA">Virginia</option><option value="WA">Washington</option><option value="WV">West Virginia</option>
                <option value="WI">Wisconsin</option><option value="WY">Wyoming</option><option value="DC">Washington DC</option>
              </select>
            </div>
          </div>
          {error && <div className="text-red-400 text-sm mt-3">{error}</div>}
          <div className="mt-5">
            <button
              onClick={runCheck}
              disabled={loading || !name.trim()}
              className="px-6 py-3 rounded-xl font-bold cursor-pointer border-none transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: tokens.color.primary, color: '#0a0a0a' }}
            >
              {loading ? '🔍 Searching Court Records...' : 'Run Background Check'}
            </button>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Verdict */}
            <div
              className="rounded-3xl p-6"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${bandColor[result.riskBand] || '#888'}40`,
              }}
            >
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide opacity-60">Verdict</p>
                  <p className="font-headline text-2xl font-bold" style={{ color: bandColor[result.riskBand] }}>
                    {result.riskBand} RISK
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide opacity-60">Total Cases</p>
                  <p className="font-headline text-4xl font-bold" style={{ color: bandColor[result.riskBand] }}>
                    {result.totalCases}
                  </p>
                  <p className="text-sm opacity-60">{result.criminalCount} criminal · {result.evictionCount} eviction</p>
                </div>
              </div>
            </div>

            {/* Risk Factors */}
            {result.riskFactors && result.riskFactors.length > 0 && (
              <div className="rounded-3xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <h3 className="font-bold text-lg mb-3">⚠️ Risk Factors</h3>
                <div className="space-y-2">
                  {result.riskFactors.map((f: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm" style={{ color: tokens.color.muted }}>
                      <span className="text-red-400">•</span> {f}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Criminal Section */}
            {result.criminalFound && (
              <div className="rounded-3xl p-6" style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.2)' }}>
                <h3 className="font-bold text-lg mb-3">🚨 Criminal Records ({result.criminalCount})</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="text-center p-3 rounded-xl bg-white/5">
                    <div className="text-xl font-bold text-red-300">{result.criminalCount}</div>
                    <div className="text-xs opacity-60">Total Criminal</div>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-white/5">
                    <div className="text-xl font-bold text-red-300">{result.felonyCount}</div>
                    <div className="text-xs opacity-60">Felonies</div>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-white/5">
                    <div className="text-xl font-bold">{result.violentCrime ? '🔴 YES' : '🟢 NO'}</div>
                    <div className="text-xs opacity-60">Violent Crime</div>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-white/5">
                    <div className="text-xl font-bold">{result.financialCrime ? '🔴 YES' : '🟢 NO'}</div>
                    <div className="text-xs opacity-60">Financial Crime</div>
                  </div>
                </div>
                {result.recentCriminal && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-400/20">
                    <p className="text-xs text-red-300">⚠️ Recent criminal activity within the last 3 years</p>
                  </div>
                )}
              </div>
            )}

            {/* Eviction Section */}
            {result.evictionFound && (
              <div className="rounded-3xl p-6" style={{ background: 'rgba(255,193,7,0.05)', border: '1px solid rgba(255,193,7,0.2)' }}>
                <h3 className="font-bold text-lg mb-3">🏠 Eviction / Housing Records ({result.evictionCount})</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-3 rounded-xl bg-white/5">
                    <div className="text-xl font-bold text-amber-300">{result.evictionCount}</div>
                    <div className="text-xs opacity-60">Total Evictions</div>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-white/5">
                    <div className="text-xl font-bold text-amber-300">{result.civilCases}</div>
                    <div className="text-xs opacity-60">Civil Cases</div>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-white/5">
                    <div className="text-xl font-bold">{result.recentEviction ? '🔴 Recent' : '🟢 None'}</div>
                    <div className="text-xs opacity-60">Recent (3yr)</div>
                  </div>
                </div>
              </div>
            )}

            {/* Clean Record */}
            {result.totalCases === 0 && (
              <div className="rounded-3xl p-6 text-center" style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <div className="text-4xl mb-3">✅</div>
                <h3 className="font-bold text-lg text-emerald-300">Clean Record</h3>
                <p className="text-sm mt-1" style={{ color: tokens.color.muted }}>No criminal, eviction, or civil records found.</p>
              </div>
            )}

            {/* Case List */}
            {result.cases && result.cases.length > 0 && (
              <div className="rounded-3xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <h3 className="font-bold text-lg mb-4">Case Details</h3>
                <div className="space-y-3">
                  {result.cases.map((c: any, i: number) => (
                    <div key={i} className="p-4 rounded-xl bg-white/5">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-semibold text-slate-100">{c.caseName}</div>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          c.courtType === 'CRIMINAL' ? 'bg-red-500/20 text-red-300' :
                          c.courtType === 'CIVIL' ? 'bg-amber-500/20 text-amber-300' :
                          'bg-slate-500/20 text-slate-300'
                        }`}>
                          {c.courtType || 'OTHER'}
                        </span>
                      </div>
                      <div className="text-xs" style={{ color: tokens.color.muted }}>
                        {c.docketNumber} · {c.court} · Filed {c.dateFiled}
                      </div>
                      <div className="text-xs mt-1 text-slate-300">{c.natureOfSuit}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Simulated mode notice */}
        {result?.simulated && (
          <div className="rounded-3xl p-4 text-sm" style={{ background: 'rgba(255,193,7,0.05)', border: '1px solid rgba(255,193,7,0.2)' }}>
            <p className="text-amber-300">⚠️ Demo mode — COURTLISTENER_API_KEY is not set. Results are simulated. Add the key to enable live screening.</p>
          </div>
        )}

        {!isAuthenticated && (
          <p className="text-sm opacity-60">Log in to save checks and view your screening history.</p>
        )}
      </div>
    </div>
  );
}
