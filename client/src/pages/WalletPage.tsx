import React, { useState, useEffect } from 'react';
import { passportService } from '../services/api';
import QRCode from 'qrcode';

interface VC {
  id: string;
  credentialType: string;
  jwtProof: string;
  isRevoked: boolean;
  issuedAt: string;
  expiresAt: string;
  subject: any;
}

export const WalletPage: React.FC = () => {
  const [vcs, setVcs] = useState<VC[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVc, setSelectedVc] = useState<VC | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string>('');
  
  // Selective Disclosure State
  const [showDisclosureModal, setShowDisclosureModal] = useState(false);
  const [availableKeys, setAvailableKeys] = useState<string[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [generatingVp, setGeneratingVp] = useState(false);

  useEffect(() => {
    fetchCredentials();
  }, []);

  const fetchCredentials = async () => {
    try {
      setLoading(true);
      const data = await passportService.getVCs();
      setVcs(data);
    } catch (err) {
      console.error('Failed to fetch credentials', err);
    } finally {
      setLoading(false);
    }
  };

  const handleShowQR = async (vc: VC) => {
    setSelectedVc(vc);
    
    // Extract available keys from subject (ignoring id)
    const keys = Object.keys(vc.subject || {}).filter(k => k !== 'id');
    setAvailableKeys(keys);
    
    // Default select all safe fields, e.g., tier
    const defaultKeys = new Set(keys.filter(k => !k.includes('Score') && k !== 'reliability'));
    if (defaultKeys.size === 0) defaultKeys.add(keys[0]);
    setSelectedKeys(defaultKeys);
    
    setShowDisclosureModal(true);
  };

  const generatePresentation = async () => {
    if (!selectedVc) return;
    try {
      setGeneratingVp(true);
      const res = await passportService.createPresentation(selectedVc.id, Array.from(selectedKeys));
      const url = await QRCode.toDataURL(res.vpJwt, { width: 300, margin: 2 });
      setQrCodeData(url);
      setShowDisclosureModal(false);
    } catch (err) {
      console.error('QR Generate Error', err);
    } finally {
      setGeneratingVp(false);
    }
  };

  const handleDownload = (vc: VC) => {
    // Standard verifiable credential export format
    const blob = new Blob([JSON.stringify({ vc: vc.jwtProof }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pabandi-${vc.credentialType.toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Digital Wallet</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage and export your W3C Verifiable Credentials (Open Badges v3). 
          These credentials cryptographically prove your Trust Score anywhere on the internet.
        </p>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-gray-200 rounded-lg"></div>
          <div className="h-24 bg-gray-200 rounded-lg"></div>
        </div>
      ) : vcs.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-500">You haven't earned any Verifiable Credentials yet.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {vcs.map(vc => (
            <div key={vc.id} className="bg-white border rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{vc.credentialType.replace('_', ' ')}</h3>
                  <p className="text-sm text-gray-500">Issued: {new Date(vc.issuedAt).toLocaleDateString()}</p>
                </div>
                {vc.isRevoked ? (
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                    Revoked
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                    Active
                  </span>
                )}
              </div>
              <div className="bg-gray-50 px-6 py-4 space-y-3">
                <div className="flex gap-3">
                  <button
                    onClick={() => handleShowQR(vc)}
                    className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition"
                  >
                    Scan to Wallet
                  </button>
                  <button
                    onClick={() => handleDownload(vc)}
                    className="flex-1 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition"
                  >
                    Download JSON
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showDisclosureModal && selectedVc && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Selective Disclosure</h3>
            <p className="text-sm text-gray-500 mb-6">
              You are in full control of your data. Choose exactly which data fields you want to disclose in this cryptographic presentation.
            </p>
            
            <div className="space-y-3 mb-6 max-h-60 overflow-y-auto border p-4 rounded-md">
              {availableKeys.map(key => (
                <label key={key} className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                    checked={selectedKeys.has(key)}
                    onChange={(e) => {
                      const newSet = new Set(selectedKeys);
                      if (e.target.checked) newSet.add(key);
                      else newSet.delete(key);
                      setSelectedKeys(newSet);
                    }}
                  />
                  <span className="text-sm font-medium text-gray-900">{key}</span>
                  <span className="text-xs text-gray-500 truncate ml-2">
                    ({JSON.stringify(selectedVc.subject[key])})
                  </span>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDisclosureModal(false)}
                className="flex-1 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={generatePresentation}
                disabled={generatingVp || selectedKeys.size === 0}
                className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-md font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {generatingVp ? 'Generating Proof...' : 'Generate Proof'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedVc && qrCodeData && !showDisclosureModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 text-center shadow-xl">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Export to Wallet</h3>
            <p className="text-sm text-gray-500 mb-6">
              Scan this QR code with a compatible digital wallet to import your {selectedVc.credentialType.replace('_', ' ')} credential.
            </p>
            <div className="flex justify-center bg-gray-50 p-4 rounded-lg mb-6">
              <img src={qrCodeData} alt="QR Code" className="w-64 h-64" />
            </div>
            <button
              onClick={() => { setSelectedVc(null); setQrCodeData(''); }}
              className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-md font-medium hover:bg-gray-200"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
