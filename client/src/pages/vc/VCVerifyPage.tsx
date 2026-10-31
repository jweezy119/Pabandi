import { useState } from 'react';
import { ShieldCheck, FileText, CheckCircle, XCircle, Upload, ArrowRight } from 'lucide-react';
import { apiUrl } from '@/utils/apiHost';

export default function VCVerifyPage() {
  const [credentialJson, setCredentialJson] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<any>(null);

  const verify = async () => {
    setVerifying(true);
    setResult(null);
    try {
      let credential;
      try {
        credential = JSON.parse(credentialJson);
      } catch {
        setResult({ valid: false, reason: 'Invalid JSON' });
        setVerifying(false);
        return;
      }
      const res = await fetch(apiUrl('/api/v1/vc/verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const data = await res.json();
      setResult(data.data || data);
    } catch (e: any) {
      setResult({ valid: false, reason: e.message });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--clay)]/10 border border-[var(--clay)]/30 mb-6">
            <ShieldCheck className="w-4 h-4 text-[var(--clay)]" />
            <span className="text-sm font-label text-[var(--clay)]">Verifiable Credentials</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-headline text-[var(--warm-ink)] mb-4">
            Verify a Credential
          </h1>
          <p className="text-lg text-[var(--soft-stone)]">
            Verify Pabandi Verifiable Credentials instantly. No login required.
          </p>
        </div>

        <div className="rounded-[var(--radius-card)] bg-white border border-[rgba(191,179,163,0.3)] shadow-[var(--shadow-soft)] p-6 md:p-8 mb-8">
          <div className="mb-4">
            <label className="block text-sm font-label text-[var(--warm-ink)] mb-2">
              Paste Verifiable Credential (JSON)
            </label>
            <textarea
              value={credentialJson}
              onChange={(e) => setCredentialJson(e.target.value)}
              placeholder='{"@context": [...], "type": [...], "issuer": "did:web:pabandi.com", "proof": {...}}'
              rows={12}
              className="w-full px-4 py-3 rounded-[var(--radius-input)] bg-[var(--warm-sand)]/40 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] font-mono text-xs focus:outline-none focus:border-[var(--clay)]"
            />
          </div>
          <button
            onClick={verify}
            disabled={verifying || !credentialJson.trim()}
            className="w-full py-4 rounded-[var(--radius-btn)] bg-[var(--clay)] text-white hover:bg-[var(--terracotta)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg font-label"
          >
            {verifying ? 'Verifying...' : <>Verify Credential <ArrowRight className="w-5 h-5" /></>}
          </button>
        </div>

        {result && (
          <div className={`rounded-[var(--radius-card)] border shadow-[var(--shadow-soft)] p-6 md:p-8 ${result.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-3 mb-4">
              {result.valid ? <CheckCircle className="w-8 h-8 text-green-600" /> : <XCircle className="w-8 h-8 text-red-600" />}
              <div>
                <h2 className={`text-xl font-headline ${result.valid ? 'text-green-800' : 'text-red-800'}`}>
                  {result.valid ? 'Credential Valid' : 'Credential Invalid'}
                </h2>
                <p className={`text-sm ${result.valid ? 'text-green-700' : 'text-red-700'}`}>{result.reason}</p>
              </div>
            </div>
            {result.valid && (
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-green-700/70 mb-1">Issuer</p>
                  <p className="font-mono text-green-800 break-all">{result.issuer}</p>
                </div>
                <div>
                  <p className="text-green-700/70 mb-1">Type</p>
                  <p className="text-green-800">{Array.isArray(result.type) ? result.type.join(', ') : result.type}</p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-12 text-center">
          <p className="text-[var(--soft-stone)] mb-4">Learn more about Pabandi's portable trust</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a href="/.well-known/did.json" target="_blank" rel="noopener noreferrer" className="text-[var(--clay)] hover:underline">View DID Document</a>
            <a href="/agents" className="text-[var(--clay)] hover:underline">For Agents</a>
            <a href="/trust/passports" className="text-[var(--clay)] hover:underline">Trust Passports</a>
          </div>
        </div>
      </div>
    </div>
  );
}
