import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';

type EscrowDetail = {
  id: string;
  projectId?: string;
  providerPassportId?: string;
  totalAmount: number;
  releaseAmount: number;
  platformFee: number;
  status: string;
  deliverableHash?: string;
  fundedAt?: string;
};

function stepStatus(step: number, current: number) {
  if (step < current) return 'completed';
  if (step === current) return 'active';
  return 'pending';
}

export default function ConsumerReleasePage() {
  const { id: escrowId } = useParams();
  const { user, token } = useAuthStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [escrow, setEscrow] = useState<EscrowDetail | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageHash, setImageHash] = useState<string | null>(null);
  const [releasing, setReleasing] = useState(false);
  const [released, setReleased] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!escrowId) return;
    fetch(`/api/v1/m2m/escrow/${escrowId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setEscrow(data.data as EscrowDetail);
        } else {
          setError('Unable to load escrow details');
        }
      })
      .catch(() => setError('Unable to load escrow details'));
  }, [escrowId, token]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      setImageHash(hashHex);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escrowId || !imageFile || !imageHash) return;

    setReleasing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('proofOfWork', imageFile);
      formData.append('deliveredHash', imageHash);

      const res = await fetch(`/api/v1/m2m/escrow/${escrowId}/verify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        setReleased(true);
        setStep(3);
      } else {
        setError(data.error || 'Release failed');
        setReleasing(false);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Network error');
      setReleasing(false);
    }
  };

  if (released) {
    return (
      <div className="min-h-screen bg-amber-50 text-amber-900 font-sans flex flex-col items-center justify-center p-4">
        <div className="relative w-32 h-32 mb-6">
          <div className="absolute inset-0 rounded-full bg-green-700/20 animate-pulse" />
          <div className="absolute inset-0 rounded-full bg-green-700/10 animate-pulse" style={{ animationDelay: '0.5s' }} />
          <div className="relative w-full h-full rounded-full bg-amber-500 flex items-center justify-center shadow-[0_0_40px_rgba(184,122,78,0.6)]">
            <span className="text-4xl">🔓</span>
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-3xl font-black text-amber-900">Vault Unlocked</h2>
          <p className="text-lg text-amber-600 mb-6">
            Funds released successfully. The provider has been paid.
          </p>
          <button
            onClick={() => navigate('/app')}
            className="px-8 py-3 rounded-xl bg-amber-500 text-white font-bold shadow-lg hover:bg-amber-600 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amber-50 text-amber-900 font-sans">
      <div className="px-4 py-4 bg-amber-50">
        <button
          onClick={() => navigate('/app')}
          className="w-10 h-10 rounded-lg bg-white border border-amber-200 flex items-center justify-center text-amber-500 font-bold shadow-sm"
        >
          ←
        </button>
      </div>

      <div className="px-4 py-2">
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${
                  stepStatus(s, step) === 'completed'
                    ? 'bg-green-700 text-white border-green-700'
                    : stepStatus(s, step) === 'active'
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-white text-amber-600 border-amber-200'
                }`}
              >
                {s}
              </div>
              {s < 3 && <div className="h-0.5 flex-1" />}
            </div>
          ))}
        </div>
      </div>

      <div className="px-4">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-amber-900">Review Job</h2>
            <p className="text-amber-600">Confirm the details before releasing escrow.</p>

            {escrow ? (
              <div className="bg-white rounded-2xl shadow-sm border border-amber-200 p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-xs font-semibold text-amber-600 uppercase">Service Provider</p>
                    <h3 className="font-bold text-amber-900">{escrow.providerPassportId || 'Provider'}</h3>
                  </div>
                  <span className="px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-700">
                    Work Completed
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-amber-100">
                  <div>
                    <p className="text-xs text-amber-600">Amount Locked</p>
                    <p className="text-lg font-bold text-amber-900">{escrow.totalAmount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-amber-600">Platform Fee</p>
                    <p className="text-lg font-bold text-amber-900">{escrow.platformFee}</p>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-amber-100 rounded-xl">
                  <p className="text-xs text-amber-600 font-semibold uppercase">Deliverable Hash</p>
                  <p className="text-sm text-amber-900 break-all font-mono">{escrow.deliverableHash || '—'}</p>
                </div>

                <button
                  onClick={() => setStep(2)}
                  className="mt-6 w-full py-4 rounded-xl bg-amber-500 text-white font-bold shadow-lg hover:bg-amber-600 transition-colors"
                >
                  Upload Proof of Work →
                </button>
              </div>
            ) : (
              <div className="text-center py-10">
                <p className="text-amber-600">Loading escrow details...</p>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-amber-900">Proof of Work</h2>
            <p className="text-amber-600">Upload a photo of the completed work to verify delivery.</p>

            <div className="bg-white rounded-2xl shadow-sm border border-amber-200 p-5">
              <label className="block text-xs font-semibold text-amber-600 uppercase mb-3">
                Take or Upload Photo
              </label>

              {imagePreview ? (
                <div className="flex flex-col items-center">
                  <img
                    src={imagePreview}
                    alt="Proof of work"
                    className="w-48 h-48 object-cover rounded-xl border-4 border-amber-500/30"
                  />
                  <p className="text-xs text-amber-600 mt-2">Tap to retake</p>
                </div>
              ) : (
                <div className="aspect-square w-full rounded-2xl bg-amber-100 border-2 border-amber-500/30 border-dashed flex items-center justify-center">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="text-center">
                    <span className="text-3xl">📷</span>
                    <p className="text-sm text-amber-600 mt-2">Open camera to capture proof</p>
                  </div>
                </div>
              )}

              {imageHash && (
                <div className="text-xs text-green-700 bg-green-100/20 px-3 py-2 rounded-lg">
                  ✓ Image hash generated (SHA-256) — proof ready to submit
                </div>
              )}

              {error && (
                <div className="text-sm text-red-600 bg-red-100/20 px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}

              <button
                onClick={handleRelease}
                disabled={releasing || !imageFile}
                className="w-full py-4 rounded-xl font-bold shadow-lg transition-colors ${
                  !imageFile
                    ? 'bg-amber-200 text-amber-400'
                    : 'bg-amber-500 text-white hover:bg-amber-600'
                }"
              >
                {releasing ? 'Releasing Funds...' : 'Confirm & Release Funds →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
