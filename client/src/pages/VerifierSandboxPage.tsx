import React, { useState } from 'react';
import { passportService } from '../services/api';

export const VerifierSandboxPage: React.FC = () => {
  const [jwt, setJwt] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // In a real decentralized setup, the verifier (e.g. Shopify) would:
      // 1. Fetch did:web:pabandi.local/.well-known/did.json
      // 2. Extract public key
      // 3. Verify JWT signature locally
      // 4. Fetch the StatusList2021 to check if revoked
      // Here, we simulate that backend process by calling our verify endpoint.
      
      const res = await passportService.verifyCredential(jwt);
      setResult(res);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
      if (err.response?.data?.payload) {
        setResult(err.response.data);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">3rd-Party Verifier Sandbox</h1>
        <p className="mt-2 text-sm text-gray-600">
          Simulate being an external platform (like Upwork or Shopify). Paste a Pabandi Open Badges v3 Verifiable Credential (JWT) to cryptographically verify its authenticity and check its revocation status.
        </p>
      </div>

      <div className="bg-white border rounded-lg shadow-sm p-6 space-y-4">
        <div>
          <label htmlFor="jwt" className="block text-sm font-medium text-gray-700">
            Paste JWT Proof or Verifiable Presentation
          </label>
          <div className="mt-1">
            <textarea
              id="jwt"
              rows={5}
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
              placeholder="eyJhbGciOiJFUzI1NiIsImtpZCI6ImRpZDp3ZWI..."
              value={jwt}
              onChange={(e) => setJwt(e.target.value)}
            />
          </div>
        </div>

        <button
          onClick={handleVerify}
          disabled={loading || !jwt}
          className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Verifying...' : 'Verify Cryptographic Signature'}
        </button>

        {error && (
          <div className="mt-4 p-4 rounded-md bg-red-50 border border-red-200">
            <h3 className="text-sm font-medium text-red-800">Verification Failed</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        )}

        {result && result.valid && (
          <div className="mt-4 p-4 rounded-md bg-green-50 border border-green-200">
            <h3 className="text-sm font-medium text-green-800 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
              </svg>
              Cryptographically Verified
            </h3>
            <p className="mt-1 text-sm text-green-700">
              The signature is authentic, the DID is resolved, and the credential has not been revoked.
            </p>
          </div>
        )}

        {result && result.payload && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Decoded Payload:</h4>
            <pre className="bg-gray-800 text-green-400 p-4 rounded-md overflow-x-auto text-xs">
              {JSON.stringify(result.payload, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
