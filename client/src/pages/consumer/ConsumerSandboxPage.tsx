import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const STEPS = ['Book & Lock Escrow', 'Job Completed', 'Proof of Work', 'Funds Released'];

function stepStatus(step: number, current: number) {
  if (step < current) return 'completed';
  if (step === current) return 'active';
  return 'pending';
}

export default function ConsumerSandboxPage() {
  const [step, setStep] = useState(1);
  const [animating, setAnimating] = useState(false);
  const [released, setReleased] = useState(false);
  const navigate = useNavigate();

  const next = () => {
    if (step < 4) setStep(step + 1);
  };

  const handleBook = () => {
    setAnimating(true);
    setTimeout(() => {
      setAnimating(false);
      next();
    }, 1000);
  };

  const handleComplete = () => {
    setAnimating(true);
    setTimeout(() => {
      setAnimating(false);
      next();
    }, 800);
  };

  const handleUpload = () => {
    setAnimating(true);
    setTimeout(() => {
      setReleased(true);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-amber-50 text-amber-900 font-sans">
      {/* Demo Mode Banner */}
      <div className="bg-amber-100 border border-amber-200 px-4 py-2 text-center">
        <p className="text-sm font-bold text-amber-700 flex items-center justify-center gap-1">
          ⚠️ You are in Demo Mode. No real funds are used.
        </p>
      </div>

      {/* Header */}
      <div className="px-4 py-4 bg-amber-50">
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-lg bg-white border border-amber-200 flex items-center justify-center text-amber-500 font-bold shadow-sm"
        >
          ←
        </button>
        <h1 className="text-xl font-bold text-amber-900 mt-2">Sandbox Demo</h1>
        <p className="text-xs text-amber-600">Experience Pabandi without real money</p>
      </div>

      {/* Progress */}
      <div className="px-4 py-2">
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => {
            const n = i + 1;
            return (
              <div key={n} className="flex items-center gap-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${
                    stepStatus(n, step) === 'completed'
                      ? 'bg-green-700 text-white border-green-700'
                      : stepStatus(n, step) === 'active'
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-amber-600 border-amber-200'
                  }`}
                >
                  {n}
                </div>
                {i < STEPS.length - 1 && <div className="h-0.5 flex-1 bg-amber-200" />}
                <span className="text-[10px] font-bold text-amber-600 whitespace-nowrap">{s}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="px-4">
        {/* Step 1: Book & Lock */}
        {step === 1 && (
          <div className="text-center py-10">
            <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🏢</span>
            </div>
            <h2 className="text-2xl font-bold text-amber-900 mb-2">Roof Inspection</h2>
            <p className="text-amber-600 mb-6">
              A commercial property needs a roof inspection before insurance renewal.
              Escrow locks $100 until the work is verified.
            </p>
            <div className="bg-white rounded-2xl shadow-sm border border-amber-200 p-6">
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-black text-amber-900">$100</span>
                <span className="text-xs text-amber-600">in escrow</span>
              </div>
              <p className="text-xs text-amber-500 mb-4">
                Funds held by Pabandi Vault. Released only when work is proven complete.
              </p>
              <button
                onClick={handleBook}
                disabled={animating}
                className="w-full py-4 rounded-xl bg-amber-500 text-white font-bold shadow-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                {animating ? 'Locking Escrow...' : 'Book & Lock Escrow ($100)'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Job Completed */}
        {step === 2 && (
          <div className="text-center py-10">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">✅</span>
            </div>
            <h2 className="text-2xl font-bold text-amber-900 mb-2">Job Completed</h2>
            <p className="text-amber-600 mb-6">
              The inspector has finished the roof inspection and uploaded their report.
              The work is marked as complete — ready for your review.
            </p>
            <div className="bg-white rounded-2xl shadow-sm border border-amber-200 p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-xs font-semibold text-amber-600 uppercase">Inspector</p>
                  <h3 className="font-bold text-amber-900">Acme Roofing Co.</h3>
                </div>
                <span className="px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-700">
                  Work Completed
                </span>
              </div>
              <div className="flex items-baseline gap-1 mt-4">
                <span className="text-3xl font-black text-amber-900">$100</span>
                <span className="text-xs text-amber-600">ready to release</span>
              </div>
              <button
                onClick={handleComplete}
                disabled={animating}
                className="mt-6 w-full py-4 rounded-xl bg-green-700 text-white font-bold shadow-lg hover:bg-green-800 transition-colors disabled:opacity-50"
              >
                {animating ? 'Verifying...' : 'Job Completed by Provider'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Proof of Work */}
        {step === 3 && (
          <div className="text-center py-10">
            <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">📷</span>
            </div>
            <h2 className="text-2xl font-bold text-amber-900 mb-2">Proof of Work</h2>
            <p className="text-amber-600 mb-6">
              Review the completed work. Upload a photo (or simulate one) to confirm
              delivery before funds are released.
            </p>
            <div className="bg-white rounded-2xl shadow-sm border border-amber-200 p-6">
              <div className="aspect-square w-48 h-48 rounded-2xl bg-amber-100 border-2 border-amber-500/30 border-dashed flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">🏠</span>
              </div>
              <button
                onClick={handleUpload}
                disabled={animating}
                className="w-full py-4 rounded-xl bg-amber-500 text-white font-bold shadow-lg hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span>📷</span>
                <span>Upload Photo (Demo)</span>
              </button>
              {animating && (
                <p className="text-xs text-amber-500 mt-2">Verifying proof of work...</p>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Released */}
        {released && (
          <div className="text-center py-10">
            <div className="relative w-32 h-32 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full bg-green-700/20 animate-pulse" />
              <div className="absolute inset-0 rounded-full bg-green-700/10 animate-pulse" style={{ animationDelay: '0.5s' }} />
              <div className="relative w-full h-full rounded-full bg-green-700 flex items-center justify-center shadow-[0_0_40px_rgba(34,197,94,0.6)]">
                <span className="text-4xl">🔓</span>
              </div>
            </div>
            <h2 className="text-3xl font-black text-amber-900 mb-2">Funds Released</h2>
            <p className="text-amber-600 mb-6">
              The $100 escrow has been released to the provider. Your trust score increased by +5.
            </p>
            <div className="bg-white rounded-2xl shadow-sm border border-amber-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs text-amber-600">Escrow Amount</span>
                <span className="font-bold text-amber-900">$100</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-amber-600">Trust Score Change</span>
                <span className="font-bold text-green-700">+5</span>
              </div>
            </div>
            <div className="mt-8">
              <button
                onClick={() => navigate('/app')}
                className="w-full py-4 rounded-xl bg-amber-500 text-white font-bold shadow-lg hover:bg-amber-600 transition-colors"
              >
                Back to Consumer App
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="mt-3 w-full py-3 rounded-xl bg-white border border-amber-200 text-amber-700 font-bold hover:bg-amber-50 transition-colors"
              >
                Ready to try it for real? Create an Account
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
