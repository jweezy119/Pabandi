import { useState, useEffect } from "react";
import { CheckCircleIcon, XCircleIcon, ArrowPathIcon, CurrencyDollarIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";

type SandboxState = "IDLE" | "LOCKING" | "LOCKED" | "VERIFYING" | "SUCCESS" | "SLASHED";

export default function InteractiveEscrowSandbox() {
  const [state, setState] = useState<SandboxState>("IDLE");
  const [balance, setBalance] = useState(1500);
  const [escrow, setEscrow] = useState(0);
  const [reliabilityScore, setReliabilityScore] = useState(85);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (state === "LOCKING") {
      timeout = setTimeout(() => {
        setBalance((b) => b - 100);
        setEscrow(100);
        setState("LOCKED");
      }, 1500);
    } else if (state === "VERIFYING") {
      timeout = setTimeout(() => {
        // Decide randomly if success or slashed for demo?
        // No, we give the user buttons to trigger it!
      }, 1500);
    }
    return () => clearTimeout(timeout);
  }, [state]);

  const handleBook = () => {
    if (state !== "IDLE") return;
    setState("LOCKING");
  };

  const handleShowUp = () => {
    if (state !== "LOCKED") return;
    setState("VERIFYING");
    setTimeout(() => {
      setEscrow(0);
      setBalance((b) => b + 100 + 10); // Refund + Reward
      setReliabilityScore((s) => Math.min(100, s + 5));
      setState("SUCCESS");
    }, 1500);
  };

  const handleNoShow = () => {
    if (state !== "LOCKED") return;
    setState("VERIFYING");
    setTimeout(() => {
      setEscrow(0);
      setReliabilityScore((s) => Math.max(0, s - 15));
      setState("SLASHED");
    }, 1500);
  };

  const handleReset = () => {
    setState("IDLE");
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 md:p-8 bg-surface-container-low rounded-3xl border border-outline-variant/20 shadow-xl font-body relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />

      <div className="flex flex-col md:flex-row gap-8 items-center relative z-10">
        {/* Left Side - Info */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheckIcon className="w-6 h-6 text-primary" />
            <h2 className="font-headline text-2xl font-bold text-on-surface">Web3 Reliability Engine</h2>
          </div>
          <p className="text-on-surface-variant text-sm leading-relaxed">
            Pabandi uses Solana smart contracts to lock a tiny deposit in escrow when you book. Show up, and you get it back plus $PAB rewards. No-show, and it compensates the business. Try the live simulation below!
          </p>

          <div className="flex gap-4 pt-4">
            <div className="bg-surface-container p-4 rounded-xl flex-1 border border-outline-variant/10 text-center">
              <p className="text-xs text-on-surface-variant font-bold uppercase mb-1">Your Wallet</p>
              <p className="font-headline text-xl font-black text-on-surface">{balance} <span className="text-sm text-primary">$PAB</span></p>
            </div>
            <div className="bg-surface-container p-4 rounded-xl flex-1 border border-outline-variant/10 text-center">
              <p className="text-xs text-on-surface-variant font-bold uppercase mb-1">Trust Score</p>
              <p className="font-headline text-xl font-black text-on-surface">{reliabilityScore}/100</p>
            </div>
            <div className="bg-surface-container p-4 rounded-xl flex-1 border border-outline-variant/10 text-center">
              <p className="text-xs text-on-surface-variant font-bold uppercase mb-1">In Escrow</p>
              <p className="font-headline text-xl font-black text-blue-400">{escrow} <span className="text-sm text-blue-400/70">$PAB</span></p>
            </div>
          </div>
        </div>

        {/* Right Side - Interactive Demo */}
        <div className="flex-1 w-full bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/10 shadow-inner relative">
          
          {/* Status Header */}
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-on-surface text-sm">Booking Simulator</h3>
            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
              state === 'IDLE' ? 'bg-surface-container-highest text-on-surface' :
              state === 'LOCKING' ? 'bg-amber-500/20 text-amber-500 animate-pulse' :
              state === 'LOCKED' ? 'bg-blue-500/20 text-blue-500' :
              state === 'VERIFYING' ? 'bg-primary/20 text-primary animate-pulse' :
              state === 'SUCCESS' ? 'bg-green-500/20 text-green-500' :
              'bg-red-500/20 text-red-500'
            }`}>
              {state === 'IDLE' ? 'Ready' : state}
            </span>
          </div>

          {/* Central Escrow Visual */}
          <div className="flex flex-col items-center justify-center py-6 border-y border-outline-variant/10 mb-6 min-h-[160px]">
            {state === 'IDLE' && (
              <div className="text-center">
                <CurrencyDollarIcon className="w-12 h-12 text-on-surface-variant mx-auto mb-2 opacity-50" />
                <p className="text-sm text-on-surface-variant font-medium">Click "Book Appointment" to start.</p>
              </div>
            )}
            
            {state === 'LOCKING' && (
              <div className="text-center flex flex-col items-center">
                <ArrowPathIcon className="w-10 h-10 text-amber-500 animate-spin mb-3" />
                <p className="text-sm font-bold text-amber-500">Locking 100 $PAB into Escrow...</p>
                <p className="text-xs text-on-surface-variant mt-1">Executing Solana Smart Contract</p>
              </div>
            )}

            {state === 'LOCKED' && (
              <div className="text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center border-2 border-blue-500/30 mb-3 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
                  <span className="font-black text-blue-500 text-lg">100</span>
                </div>
                <p className="text-sm font-bold text-blue-500">Funds Secured in Escrow</p>
                <p className="text-xs text-on-surface-variant mt-1">Waiting for appointment time...</p>
              </div>
            )}

            {state === 'VERIFYING' && (
              <div className="text-center flex flex-col items-center">
                <ArrowPathIcon className="w-10 h-10 text-primary animate-spin mb-3" />
                <p className="text-sm font-bold text-primary">Verifying Attendance via Oracle...</p>
              </div>
            )}

            {state === 'SUCCESS' && (
              <div className="text-center flex flex-col items-center">
                <CheckCircleIcon className="w-12 h-12 text-green-500 mb-2" />
                <p className="text-sm font-bold text-green-500">Attendance Verified!</p>
                <p className="text-xs font-bold text-green-400 mt-1">+100 $PAB Refunded</p>
                <p className="text-xs font-bold text-primary mt-0.5">+10 $PAB Reward Earned</p>
              </div>
            )}

            {state === 'SLASHED' && (
              <div className="text-center flex flex-col items-center">
                <XCircleIcon className="w-12 h-12 text-red-500 mb-2" />
                <p className="text-sm font-bold text-red-500">No-Show Detected</p>
                <p className="text-xs font-bold text-red-400 mt-1">-100 $PAB Sent to Business</p>
                <p className="text-xs font-bold text-red-400 mt-0.5">-15 Trust Score Penalty</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 justify-center">
            {state === 'IDLE' && (
              <button onClick={handleBook} className="w-full py-3 rounded-xl bg-primary text-on-primary font-bold text-sm shadow-md hover:opacity-90 transition-opacity">
                Book Appointment (Locks 100 $PAB)
              </button>
            )}
            
            {state === 'LOCKED' && (
              <>
                <button onClick={handleShowUp} className="flex-1 py-3 rounded-xl bg-green-500/20 text-green-500 font-bold text-sm hover:bg-green-500/30 transition-colors border border-green-500/30">
                  Simulate Show Up
                </button>
                <button onClick={handleNoShow} className="flex-1 py-3 rounded-xl bg-red-500/20 text-red-500 font-bold text-sm hover:bg-red-500/30 transition-colors border border-red-500/30">
                  Simulate No-Show
                </button>
              </>
            )}

            {(state === 'SUCCESS' || state === 'SLASHED') && (
              <button onClick={handleReset} className="w-full py-3 rounded-xl bg-surface-container text-on-surface font-bold text-sm hover:bg-surface-container-high transition-colors">
                Reset Simulator
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
