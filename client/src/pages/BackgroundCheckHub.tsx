import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const BackgroundCheckHub: React.FC = () => {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [state, setState] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

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
      } else {
        setError(data.error || 'Check failed');
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (rating: string) => {
    if (rating === 'HIGH_RISK') return 'text-red-400';
    if (rating === 'MEDIUM_RISK') return 'text-yellow-400';
    return 'text-green-400';
  };

  const getRiskBg = (rating: string) => {
    if (rating === 'HIGH_RISK') return 'bg-red-400/10 border-red-400/30';
    if (rating === 'MEDIUM_RISK') return 'bg-yellow-400/10 border-yellow-400/30';
    return 'bg-green-400/10 border-green-400/30';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-sm">BC</div>
            <span className="text-lg font-bold">Background Check Hub</span>
            <span className="text-xs text-gray-500">by Pabandi</span>
          </div>
          <button onClick={() => navigate('/')} className="text-sm text-gray-400 hover:text-white">← Pabandi</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero */}
        <section className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Public Records Background Check</h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Search court records, criminal databases, sex offender registries, FBI most wanted, 
            andInterpol red notices. Aggregated from real public sources.
          </p>
        </section>

        {/* Search Form */}
        <section className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">First Name *</label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Last Name *</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">State</label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">All States</option>
                <option value="IL">Illinois</option>
                <option value="CA">California</option>
                <option value="NY">New York</option>
                <option value="TX">Texas</option>
                <option value="FL">Florida</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={runCheck}
                disabled={loading}
                className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Searching...' : 'Run Check'}
              </button>
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </section>

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Risk Summary */}
            <section className={`rounded-lg p-6 border ${getRiskBg(result.riskAssessment?.rating)}`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold">{result.subject.firstName} {result.subject.lastName}</h2>
                  <p className="text-sm text-gray-400">Check ID: {result.id}</p>
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-bold ${getRiskColor(result.riskAssessment?.rating)}`}>
                    {result.riskAssessment?.score}/100
                  </div>
                  <p className={`text-sm ${getRiskColor(result.riskAssessment?.rating)}`}>
                    {result.riskAssessment?.rating?.replace('_', ' ')}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {result.riskAssessment?.factors?.map((factor: string) => (
                  <span key={factor} className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300">
                    {factor}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-sm text-gray-400">
                <strong>Recommendation:</strong> {result.riskAssessment?.recommendation}
              </p>
            </section>

            {/* Court Records */}
            {result.courtRecords?.records?.length > 0 && (
              <section className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h3 className="text-lg font-bold mb-4">⚖️ Court Records</h3>
                <div className="space-y-3">
                  {result.courtRecords.records.map((record: any, i: number) => (
                    <div key={i} className="p-3 bg-gray-900 rounded border border-gray-700">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{record.caseName}</span>
                        <span className="text-xs text-gray-500">{record.court}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Case: {record.caseNumber}</p>
                      {record.snippet && <p className="text-xs text-gray-500 mt-1">{record.snippet}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* FBI */}
            {result.fbi?.found && (
              <section className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h3 className="text-lg font-bold mb-4">🔴 FBI Most Wanted</h3>
                <div className="space-y-3">
                  {result.fbi.records.map((record: any, i: number) => (
                    <div key={i} className="p-3 bg-red-900/20 rounded border border-red-700/30">
                      <p className="font-medium text-sm text-red-300">{record.title}</p>
                      <p className="text-xs text-gray-400 mt-1">{record.description}</p>
                      {record.caution && <p className="text-xs text-red-400 mt-1">⚠️ {record.caution}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Interpol */}
            {result.interpol?.found && (
              <section className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h3 className="text-lg font-bold mb-4">🌍 Interpol Red Notice</h3>
                <div className="space-y-3">
                  {result.interpol.records.map((record: any, i: number) => (
                    <div key={i} className="p-3 bg-orange-900/20 rounded border border-orange-700/30">
                      <p className="font-medium text-sm text-orange-300">{record.forename} {record.name}</p>
                      <p className="text-xs text-gray-400 mt-1">Charge: {record.charge}</p>
                      <p className="text-xs text-gray-500">Country: {record.issuing_country}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Sex Offender */}
            {result.sexOffender?.found && (
              <section className="bg-gray-800 rounded-lg p-6 border border-red-700">
                <h3 className="text-lg font-bold mb-4 text-red-400">⚠️ Sex Offender Registry</h3>
                <p className="text-sm text-red-300">Match found in NSOPW database</p>
                <a href={result.sexOffender.searchUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline mt-2 block">
                  View on NSOPW.gov →
                </a>
              </section>
            )}

            {/* Mugshots */}
            {result.mugshots && (
              <section className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h3 className="text-lg font-bold mb-4">📸 Mugshot Databases</h3>
                <div className="grid md:grid-cols-3 gap-3">
                  <a href={result.mugshots.searchUrls?.bustedMugshots} target="_blank" rel="noopener noreferrer" className="p-3 bg-gray-900 rounded border border-gray-700 hover:border-gray-600">
                    <p className="font-medium text-sm">BustedMugshots</p>
                    <p className="text-xs text-gray-500">Search booking photos</p>
                  </a>
                  <a href={result.mugshots.searchUrls?.mugshotsCom} target="_blank" rel="noopener noreferrer" className="p-3 bg-gray-900 rounded border border-gray-700 hover:border-gray-600">
                    <p className="font-medium text-sm">Mugshots.com</p>
                    <p className="text-xs text-gray-500">Arrest records</p>
                  </a>
                  <a href={result.mugshots.searchUrls?.googleMugshots} target="_blank" rel="noopener noreferrer" className="p-3 bg-gray-900 rounded border border-gray-700 hover:border-gray-600">
                    <p className="font-medium text-sm">Google Images</p>
                    <p className="text-xs text-gray-500">Public photos</p>
                  </a>
                </div>
              </section>
            )}

            {/* Civil Records */}
            {result.civilRecords && (
              <section className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h3 className="text-lg font-bold mb-4">📋 Civil Records</h3>
                <div className="flex flex-wrap gap-2">
                  {result.civilRecords.categories.map((cat: string) => (
                    <span key={cat} className="px-3 py-1 bg-gray-900 rounded-full text-sm text-gray-300">{cat}</span>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-3">Search state and county court records for evictions, bankruptcies, liens, and judgments.</p>
              </section>
            )}

            {/* Criminal Records */}
            {result.criminalRecords && (
              <section className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h3 className="text-lg font-bold mb-4">🔍 Criminal Records</h3>
                <div className="flex flex-wrap gap-2">
                  {result.criminalRecords.categories.map((cat: string) => (
                    <span key={cat} className="px-3 py-1 bg-gray-900 rounded-full text-sm text-gray-300">{cat}</span>
                  ))}
                </div>
              </section>
            )}

            {/* No Records Found */}
            {result.courtRecords?.records?.length === 0 && !result.fbi?.found && !result.interpol?.found && (
              <section className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
                <div className="text-4xl mb-3">✅</div>
                <h3 className="text-lg font-bold mb-2">No Records Found</h3>
                <p className="text-sm text-gray-400">
                  No matching records found in federal courts, FBI, or Interpol databases.
                  This does not guarantee a clean record — state and county records may still exist.
                </p>
              </section>
            )}
          </div>
        )}

        {/* Sources */}
        <section className="mt-12 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-bold mb-4">Data Sources</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-900 rounded border border-gray-700">
              <h4 className="font-bold text-sm mb-1">CourtListener</h4>
              <p className="text-xs text-gray-400">Federal court opinions and cases (Free API)</p>
            </div>
            <div className="p-4 bg-gray-900 rounded border border-gray-700">
              <h4 className="font-bold text-sm mb-1">NSOPW</h4>
              <p className="text-xs text-gray-400">National Sex Offender Public Website</p>
            </div>
            <div className="p-4 bg-gray-900 rounded border border-gray-700">
              <h4 className="font-bold text-sm mb-1">FBI Most Wanted</h4>
              <p className="text-xs text-gray-400">Federal fugitives and wanted persons</p>
            </div>
            <div className="p-4 bg-gray-900 rounded border border-gray-700">
              <h4 className="font-bold text-sm mb-1">Interpol Red Notices</h4>
              <p className="text-xs text-gray-400">International wanted persons</p>
            </div>
            <div className="p-4 bg-gray-900 rounded border border-gray-700">
              <h4 className="font-bold text-sm mb-1">Mugshot Databases</h4>
              <p className="text-xs text-gray-400">BustedMugshots, Mugshots.com</p>
            </div>
            <div className="p-4 bg-gray-900 rounded border border-gray-700">
              <h4 className="font-bold text-sm mb-1">State & County Courts</h4>
              <p className="text-xs text-gray-400">Civil and criminal records</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default BackgroundCheckHub;
