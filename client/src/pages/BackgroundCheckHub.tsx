import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// ═══════════════════════════════════════════════════════════════════════════════
// PREMIUM BACKGROUND CHECK HUB
// Professional UI with verbose data, animations, and rich visualization
// ═══════════════════════════════════════════════════════════════════════════════

const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
];

export const BackgroundCheckHub: React.FC = () => {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [state, setState] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [expandedSections, setExpandedSections] = useState<string[]>(['risk', 'court']);
  const [searchHistory, setSearchHistory] = useState<any[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('bgSearchHistory');
    if (saved) setSearchHistory(JSON.parse(saved));
  }, []);

  const runCheck = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/v1/background-checks/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, state }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data);
        const entry = { name: `${firstName} ${lastName}`, date: new Date().toISOString(), id: data.data.id };
        const updated = [entry, ...searchHistory].slice(0, 10);
        setSearchHistory(updated);
        localStorage.setItem('bgSearchHistory', JSON.stringify(updated));
      } else {
        setError(data.error || 'Check failed');
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  const getRiskGradient = (score: number) => {
    if (score >= 70) return 'from-red-500 to-rose-600';
    if (score >= 40) return 'from-yellow-500 to-amber-600';
    return 'from-emerald-500 to-green-600';
  };

  const getRiskLabel = (score: number) => {
    if (score >= 70) return 'HIGH RISK';
    if (score >= 40) return 'MEDIUM RISK';
    return 'LOW RISK';
  };

  const SectionHeader: React.FC<{ id: string; icon: string; title: string; count?: number; color?: string }> = ({ id, icon, title, count, color = 'blue' }) => (
    <button
      onClick={() => toggleSection(id)}
      className={`w-full flex items-center justify-between p-4 rounded-lg bg-gray-800/50 border border-gray-700/50 hover:bg-gray-800 transition-all ${expandedSections.includes(id) ? `border-${color}-500/30 bg-${color}-500/5` : ''}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <span className="font-semibold">{title}</span>
        {count !== undefined && count > 0 && (
          <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-500/20 text-blue-300">{count}</span>
        )}
      </div>
      <span className={`transform transition-transform ${expandedSections.includes(id) ? 'rotate-180' : ''}`}>▼</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <header className="relative bg-[#0f0f1a]/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-sm shadow-lg shadow-blue-500/20">BC</div>
            <div>
              <span className="text-lg font-bold tracking-tight">Public Records</span>
              <span className="text-[10px] text-gray-500 block">Powered by Pabandi</span>
            </div>
          </div>
          <button onClick={() => navigate('/')} className="text-sm text-gray-400 hover:text-white transition-colors">← Back</button>
        </div>
      </header>

      <div className="relative max-w-7xl mx-auto px-6 py-8">
        {/* Hero Search */}
        <section className="mb-10">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-white via-blue-100 to-blue-300 bg-clip-text text-transparent">
              Background Check
            </h1>
            <p className="text-gray-400 max-w-2xl mx-auto text-sm">
              Comprehensive public records search across federal courts, criminal databases, sex offender registries, FBI, Interpol, and mugshot databases.
            </p>
          </div>

          <div className="bg-[#0f0f1a] rounded-2xl p-6 border border-white/5 shadow-2xl shadow-black/50">
            <div className="grid md:grid-cols-12 gap-4">
              <div className="md:col-span-4">
                <label className="text-xs text-gray-500 mb-1.5 block font-medium uppercase tracking-wider">First Name</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:border-blue-500/50 focus:bg-white/10 focus:outline-none transition-all"
                />
              </div>
              <div className="md:col-span-4">
                <label className="text-xs text-gray-500 mb-1.5 block font-medium uppercase tracking-wider">Last Name</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:border-blue-500/50 focus:bg-white/10 focus:outline-none transition-all"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-gray-500 mb-1.5 block font-medium uppercase tracking-wider">State</label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-blue-500/50 focus:bg-white/10 focus:outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="">All</option>
                  {US_STATES.map(s => (
                    <option key={s.code} value={s.code} className="bg-gray-900">{s.code}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2 flex items-end">
                <button
                  onClick={runCheck}
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 shadow-lg shadow-blue-500/20 transition-all"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      Searching...
                    </span>
                  ) : 'Run Check'}
                </button>
              </div>
            </div>
            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          </div>

          {/* Search History */}
          {searchHistory.length > 0 && !result && (
            <div className="mt-4 flex flex-wrap gap-2">
              {searchHistory.slice(0, 5).map((item, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const parts = item.name.split(' ');
                    setFirstName(parts[0] || '');
                    setLastName(parts[1] || '');
                  }}
                  className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all"
                >
                  {item.name}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Loading State */}
        {loading && (
          <div className="space-y-6 animate-pulse">
            <div className="bg-[#0f0f1a] rounded-2xl p-8 border border-white/5">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-white/10 rounded-full"></div>
                <div className="space-y-2 flex-1">
                  <div className="h-6 bg-white/10 rounded w-48"></div>
                  <div className="h-4 bg-white/10 rounded w-32"></div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {[1,2,3,4].map(i => (
                  <div key={i} className="h-20 bg-white/5 rounded-xl"></div>
                ))}
              </div>
            </div>
            {[1,2,3].map(i => (
              <div key={i} className="bg-[#0f0f1a] rounded-xl p-6 border border-white/5">
                <div className="h-5 bg-white/10 rounded w-40 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-16 bg-white/5 rounded-lg"></div>
                  <div className="h-16 bg-white/5 rounded-lg"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-6">
            {/* Subject Header */}
            <section className="bg-[#0f0f1a] rounded-2xl p-6 border border-white/5 shadow-2xl shadow-black/50">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold shadow-lg shadow-blue-500/20">
                    {result.subject.firstName[0]}{result.subject.lastName[0]}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{result.subject.firstName} {result.subject.lastName}</h2>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-500">Check ID: {result.id}</span>
                      <span className="text-xs text-gray-500">•</span>
                      <span className="text-xs text-gray-500">{new Date(result.timestamp).toLocaleString()}</span>
                      {result.subject.state && (
                        <>
                          <span className="text-xs text-gray-500">•</span>
                          <span className="text-xs text-gray-500">{result.subject.state}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1.5 text-xs font-semibold rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                    ✓ Complete
                  </span>
                </div>
              </div>
            </section>

            {/* Risk Score Card */}
            <section className="bg-[#0f0f1a] rounded-2xl overflow-hidden border border-white/5 shadow-2xl shadow-black/50">
              <div className={`p-6 bg-gradient-to-r ${getRiskGradient(result.riskAssessment?.score || 50)} bg-opacity-10`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">Risk Assessment</h3>
                    <p className="text-sm text-gray-400">Based on all available data sources</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="relative">
                      <svg className="w-24 h-24 transform -rotate-90">
                        <circle cx="48" cy="48" r="40" fill="none" stroke="currentColor" strokeWidth="6" className="text-white/10" />
                        <circle
                          cx="48" cy="48" r="40" fill="none" stroke="currentColor" strokeWidth="6"
                          strokeDasharray={`${(result.riskAssessment?.score || 50) * 2.51} 251`}
                          className={result.riskAssessment?.score >= 70 ? 'text-red-400' : result.riskAssessment?.score >= 40 ? 'text-yellow-400' : 'text-emerald-400'}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`text-2xl font-bold ${result.riskAssessment?.score >= 70 ? 'text-red-400' : result.riskAssessment?.score >= 40 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                          {result.riskAssessment?.score}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className={`text-2xl font-bold ${result.riskAssessment?.score >= 70 ? 'text-red-400' : result.riskAssessment?.score >= 40 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                        {getRiskLabel(result.riskAssessment?.score || 50)}
                      </div>
                      <p className="text-sm text-gray-400 mt-1">out of 100</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="flex flex-wrap gap-2 mb-4">
                  {result.riskAssessment?.factors?.map((factor: string) => (
                    <span key={factor} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 border border-white/10 text-gray-300">
                      {factor}
                    </span>
                  ))}
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <p className="text-sm">
                    <span className="font-semibold text-white">Recommendation:</span>{' '}
                    <span className={result.riskAssessment?.score >= 70 ? 'text-red-300' : result.riskAssessment?.score >= 40 ? 'text-yellow-300' : 'text-emerald-300'}>
                      {result.riskAssessment?.recommendation}
                    </span>
                  </p>
                </div>
              </div>
            </section>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              {[
                { label: 'Court Cases', value: result.courtRecords?.records?.length || 0, icon: '⚖️', color: 'blue' },
                { label: 'FBI Matches', value: result.fbi?.records?.length || 0, icon: '🔴', color: 'red' },
                { label: 'Interpol', value: result.interpol?.records?.length || 0, icon: '🌍', color: 'orange' },
                { label: 'Sex Offender', value: result.sexOffender?.found ? 1 : 0, icon: '⚠️', color: 'pink' },
                { label: 'Mugshots', value: result.mugshots ? 1 : 0, icon: '📸', color: 'purple' },
                { label: 'Data Sources', value: 6, icon: '📊', color: 'cyan' },
              ].map((stat) => (
                <div key={stat.label} className="bg-[#0f0f1a] rounded-xl p-4 border border-white/5 text-center">
                  <div className="text-2xl mb-1">{stat.icon}</div>
                  <div className={`text-2xl font-bold ${stat.value > 0 ? `text-${stat.color}-400` : 'text-gray-500'}`}>{stat.value}</div>
                  <div className="text-xs text-gray-500">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Detailed Sections */}
            <div className="space-y-4">
              {/* Court Records */}
              <SectionHeader id="court" icon="⚖️" title="Court Records" count={result.courtRecords?.records?.length} color="blue" />
              {expandedSections.includes('court') && (
                <div className="bg-[#0f0f1a] rounded-2xl p-6 border border-white/5 space-y-3">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs text-gray-500">Source: CourtListener API</span>
                    <span className="text-xs text-gray-500">{result.courtRecords?.totalResults} total results</span>
                  </div>
                  {result.courtRecords?.records?.length > 0 ? result.courtRecords.records.map((record: any, i: number) => (
                    <div key={i} className="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-blue-500/20 transition-all">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h4 className="font-semibold text-blue-300">{record.caseName}</h4>
                          <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                            <span className="flex items-center gap-1">📁 {record.caseNumber}</span>
                            {record.court && <span className="flex items-center gap-1">🏛️ {record.court}</span>}
                            {record.dateFiled && <span className="flex items-center gap-1">📅 {record.dateFiled}</span>}
                          </div>
                          {record.snippet && <p className="text-xs text-gray-500 mt-2 line-clamp-2">{record.snippet}</p>}
                        </div>
                        {record.status && (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-blue-500/10 text-blue-300">{record.status}</span>
                        )}
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-3xl mb-2">✅</div>
                      <p className="text-sm">No federal court records found</p>
                    </div>
                  )}
                </div>
              )}

              {/* FBI */}
              <SectionHeader id="fbi" icon="🔴" title="FBI Most Wanted" count={result.fbi?.records?.length} color="red" />
              {expandedSections.includes('fbi') && (
                <div className="bg-[#0f0f1a] rounded-2xl p-6 border border-white/5 space-y-3">
                  {result.fbi?.records?.length > 0 ? result.fbi.records.map((record: any, i: number) => (
                    <div key={i} className="p-4 bg-red-500/5 rounded-xl border border-red-500/20">
                      <div className="flex items-start gap-4">
                        {record.images?.[0] && (
                          <img src={record.images[0]} alt="" className="w-20 h-20 rounded-lg object-cover" />
                        )}
                        <div className="flex-1">
                          <h4 className="font-semibold text-red-300">{record.title}</h4>
                          {record.aliases && <p className="text-xs text-gray-400 mt-1">Aliases: {record.aliases.join(', ')}</p>}
                          {record.description && <p className="text-xs text-gray-400 mt-2">{record.description}</p>}
                          {record.caution && <p className="text-xs text-red-400 mt-2 font-medium">⚠️ {record.caution}</p>}
                          {record.field_offices && <p className="text-xs text-gray-500 mt-1">Field Offices: {record.field_offices.join(', ')}</p>}
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-3xl mb-2">✅</div>
                      <p className="text-sm">Not on FBI Most Wanted list</p>
                    </div>
                  )}
                </div>
              )}

              {/* Interpol */}
              <SectionHeader id="interpol" icon="🌍" title="Interpol Red Notices" count={result.interpol?.records?.length} color="orange" />
              {expandedSections.includes('interpol') && (
                <div className="bg-[#0f0f1a] rounded-2xl p-6 border border-white/5 space-y-3">
                  {result.interpol?.records?.length > 0 ? result.interpol.records.map((record: any, i: number) => (
                    <div key={i} className="p-4 bg-orange-500/5 rounded-xl border border-orange-500/20">
                      <h4 className="font-semibold text-orange-300">{record.forename} {record.name}</h4>
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                        {record.date_of_birth && <span>DOB: {record.date_of_birth}</span>}
                        {record.nationalities && <span>Nationality: {record.nationalities.join(', ')}</span>}
                        {record.issuing_country && <span>Country: {record.issuing_country}</span>}
                      </div>
                      {record.charge && <p className="text-xs text-orange-400 mt-2">Charge: {record.charge}</p>}
                    </div>
                  )) : (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-3xl mb-2">✅</div>
                      <p className="text-sm">No Interpol Red Notices found</p>
                    </div>
                  )}
                </div>
              )}

              {/* Sex Offender */}
              <SectionHeader id="sexoffender" icon="⚠️" title="Sex Offender Registry" count={result.sexOffender?.found ? 1 : 0} color="pink" />
              {expandedSections.includes('sexoffender') && (
                <div className="bg-[#0f0f1a] rounded-2xl p-6 border border-white/5">
                  {result.sexOffender?.found ? (
                    <div className="p-4 bg-pink-500/5 rounded-xl border border-pink-500/20">
                      <h4 className="font-semibold text-pink-300">⚠️ Registry Match Found</h4>
                      <p className="text-xs text-gray-400 mt-2">Individual found in NSOPW database</p>
                      <a href={result.sexOffender.searchUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline mt-2 block">View on NSOPW.gov →</a>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-3xl mb-2">✅</div>
                      <p className="text-sm">No sex offender registry match</p>
                    </div>
                  )}
                </div>
              )}

              {/* Mugshots */}
              <SectionHeader id="mugshots" icon="📸" title="Mugshot Databases" color="purple" />
              {expandedSections.includes('mugshots') && (
                <div className="bg-[#0f0f1a] rounded-2xl p-6 border border-white/5">
                  <p className="text-xs text-gray-500 mb-4">Search across public mugshot databases for booking photos and arrest records.</p>
                  <div className="grid md:grid-cols-3 gap-4">
                    {result.mugshots?.searchUrls && Object.entries(result.mugshots.searchUrls).map(([key, url]) => {
                      const labels: Record<string, { name: string; desc: string }> = {
                        bustedMugshots: { name: 'BustedMugshots', desc: 'Booking photos & arrests' },
                        mugshotsCom: { name: 'Mugshots.com', desc: 'Criminal records' },
                        googleMugshots: { name: 'Google Images', desc: 'Public photos' },
                      };
                      const info = labels[key] || { name: key, desc: 'Search' };
                      return (
                        <a key={key} href={url as string} target="_blank" rel="noopener noreferrer" className="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all">
                          <h4 className="font-semibold text-sm">{info.name}</h4>
                          <p className="text-xs text-gray-500 mt-1">{info.desc}</p>
                          <span className="text-xs text-blue-400 mt-2 block">Search →</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Civil & Criminal */}
              <div className="grid md:grid-cols-2 gap-4">
                <SectionHeader id="civil" icon="📋" title="Civil Records" color="cyan" />
                {expandedSections.includes('civil') && (
                  <div className="bg-[#0f0f1a] rounded-2xl p-6 border border-white/5">
                    <p className="text-xs text-gray-500 mb-4">Civil court records including evictions, bankruptcies, liens, and judgments.</p>
                    <div className="flex flex-wrap gap-2">
                      {result.civilRecords?.categories?.map((cat: string) => (
                        <span key={cat} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">{cat}</span>
                      ))}
                    </div>
                    <div className="mt-4 space-y-2">
                      <a href={result.civilRecords?.searchUrls?.pacer} target="_blank" rel="noopener noreferrer" className="block p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all">
                        <span className="text-xs text-gray-400">Federal Court Records (PACER)</span>
                        <span className="text-xs text-blue-400 ml-2">→</span>
                      </a>
                    </div>
                  </div>
                )}

                <SectionHeader id="criminal" icon="🔍" title="Criminal Records" color="yellow" />
                {expandedSections.includes('criminal') && (
                  <div className="bg-[#0f0f1a] rounded-2xl p-6 border border-white/5">
                    <p className="text-xs text-gray-500 mb-4">State criminal records including felonies, misdemeanors, and warrants.</p>
                    <div className="flex flex-wrap gap-2">
                      {result.criminalRecords?.categories?.map((cat: string) => (
                        <span key={cat} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-yellow-500/10 text-yellow-300 border border-yellow-500/20">{cat}</span>
                      ))}
                    </div>
                    <div className="mt-4 space-y-2">
                      <a href={result.criminalRecords?.searchUrls?.stateCriminal} target="_blank" rel="noopener noreferrer" className="block p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all">
                        <span className="text-xs text-gray-400">State Criminal Records</span>
                        <span className="text-xs text-blue-400 ml-2">→</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Data Sources Footer */}
            <section className="bg-[#0f0f1a] rounded-2xl p-6 border border-white/5">
              <h3 className="text-lg font-semibold mb-4">Data Sources Queried</h3>
              <div className="grid md:grid-cols-3 gap-3">
                {[
                  { name: 'CourtListener', status: 'QUERIED', desc: 'Federal court records', color: 'blue' },
                  { name: 'NSOPW', status: 'QUERIED', desc: 'Sex offender registry', color: 'pink' },
                  { name: 'FBI Most Wanted', status: 'QUERIED', desc: 'Federal fugitives', color: 'red' },
                  { name: 'Interpol Red Notices', status: 'QUERIED', desc: 'International wanted', color: 'orange' },
                  { name: 'Mugshot Databases', status: 'QUERIED', desc: 'Booking photos', color: 'purple' },
                  { name: 'State & County Courts', status: 'QUERIED', desc: 'Civil & criminal', color: 'cyan' },
                ].map((source) => (
                  <div key={source.name} className="p-3 bg-white/5 rounded-lg border border-white/5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{source.name}</span>
                      <span className={`text-xs text-${source.color}-400`}>● {source.status}</span>
                    </div>
                    <p className="text-xs text-gray-500">{source.desc}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-4 text-center">
                Data aggregated from public records. This is not a consumer report under the FCRA.
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default BackgroundCheckHub;
